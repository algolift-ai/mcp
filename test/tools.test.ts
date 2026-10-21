// test/tools.test.ts: every tool on the bundled data, and above all that a
// prop rule that is not verified is labelled so, every time.

import assert from "node:assert/strict";
import { test } from "node:test";

import { calculate } from "@algolift/indicators";

import calendarJson from "../data/setup-odds-calendar.json";
import { createToolset, LOCAL_LIMITS, resolvePlan, STATUS_TAG, type PlanFile, type RulesBundle, type ToolResult } from "../src/lib/mcp/index";
import { demoBars, formatResultText, listPresets, loadCalendar, runSetupOdds, type RunResult } from "../src/lib/tools/setupOdds/engine/index";
import { createDefaultToolset, PROP_RULES, SITE_PAGES, VERSION } from "../src/server";

const ts = createDefaultToolset({ today: () => "2026-10-16" });
const text = (r: ToolResult) => r.content.map((c) => c.text).join("\n");
const BUNDLE = PROP_RULES.bundle;

type View = { id: string; label: string; status: string; status_label: string; source_url: string | null; verified: string | null; value: unknown };

function leaf(plan: PlanFile, id: string) {
    const [g, k] = id.split(".");
    return g === "prices" ? plan.prices[k] : (plan.rules as unknown as Record<string, Record<string, PlanFile["prices"][string]>>)[g][k];
}

/** The same core on a hand-built bundle. */
function coreOn(bundle: RulesBundle, today = "2026-10-16") {
    return createToolset({
        server: { name: "algolift", title: "AlgoLift", version: "0.1.0", websiteUrl: "https://www.algolift.ai" },
        propRules: { bundle, datasetVersion: "test", servedFrom: "test" },
        setupOddsCalendar: loadCalendar(calendarJson),
        limits: LOCAL_LIMITS,
        today: () => today,
    });
}

test("eleven read-only tools", () => {
    assert.deepEqual(
        ts.tools.map((t) => t.name).sort(),
        ["compare_prop_plans", "compute_indicator", "describe_indicator", "describe_setup_query_language", "fetch", "get_prop_plan_rules", "list_indicators", "list_prop_firms", "list_setup_presets", "run_setup_odds", "search"],
    );
    for (const t of ts.tools) {
        assert.equal(t.annotations.readOnlyHint, true);
        assert.equal(t.annotations.destructiveHint, false);
        assert.equal(t.annotations.openWorldHint, false);
        assert.doesNotMatch(JSON.stringify(t), /—/);
    }
});

test("the bundled dataset is versioned and dated", () => {
    assert.equal(PROP_RULES.dataset_version, "0.1.0");
    assert.equal(PROP_RULES.license, "CC-BY-4.0");
    assert.ok(BUNDLE.plans.length > 0);
    const r = ts.call("list_prop_firms", {});
    assert.match(
        text(r),
        // The server's own version (VERSION in src/server.ts), so a release bump does not break the check.
        new RegExp(
            String.raw`Dataset: AlgoLift prop firm rules 0\.1\.0 \(bundled in @algolift\/mcp ` +
                VERSION.replace(/\./g, "\\.") +
                String.raw`\), \d+ plans from \d+ firms, rules checked (on \d{4}-\d{2}-\d{2}|\d{4}-\d{2}-\d{2} to \d{4}-\d{2}-\d{2})\.`,
        ),
    );
});

test("get_prop_plan_rules returns every rule's status, source and date exactly as the data holds them", () => {
    for (const plan of BUNDLE.plans) {
        const r = ts.call("get_prop_plan_rules", { plan_id: plan.id });
        assert.ok(!r.isError, plan.id);
        for (const v of (r.structuredContent as { rules: View[] }).rules) {
            const l = leaf(plan, v.id);
            assert.deepEqual(
                { status: v.status, source_url: v.source_url, verified: v.verified, value: v.value },
                { status: l.status, source_url: l.source_url, verified: l.verified, value: l.value },
                `${plan.id} ${v.id}`,
            );
            assert.equal(v.status_label, STATUS_TAG[l.status]);
        }
    }
});

test("every prop rule that is not verified is labelled so in the text, on every plan", () => {
    const LABEL: Record<string, string> = {
        differs: "NOT VERIFIED: the firm's page now says something else",
        unverified: "NOT VERIFIED: not cited",
        not_stated: "not stated by the firm",
    };
    for (const plan of BUNDLE.plans) {
        const r = ts.call("get_prop_plan_rules", { plan_id: plan.id });
        const lines = text(r).split("\n");
        for (const v of (r.structuredContent as { rules: View[] }).rules) {
            if (v.status === "verified") continue;
            const line = lines.find((l) => l.startsWith(`- ${v.label}: `) && l.includes(LABEL[v.status]));
            assert.ok(line, `${plan.id} ${v.id} (${v.status}) has no labelled line`);
            assert.doesNotMatch(line!, /\[verified/);
        }
        const c = (r.structuredContent as { counts: Record<string, number> }).counts;
        if (c.differs + c.unverified > 0) assert.match(text(r), /of these rules are NOT VERIFIED/);
    }
});

test("a hand-built plan: each status reads as itself, and a stale check says so", () => {
    const base = JSON.parse(JSON.stringify(BUNDLE.plans.find((p) => p.id === "topstep/50k"))) as PlanFile;
    const fix = (id: string, status: string, verified: string | null, source: string | null) => Object.assign(leaf(base, id), { status, verified, source_url: source });
    fix("evaluation.profit_target", "verified", "2026-10-10", "https://example.com/target");
    fix("evaluation.consistency_max_day_pct", "differs", "2026-10-10", "https://example.com/c");
    fix("account.trading_day_start", "unverified", null, null);
    fix("evaluation.min_trading_days", "not_stated", "2026-10-10", "https://example.com/d");
    const bundle: RulesBundle = { format: BUNDLE.format, recheck_window_days: 45, plans: [base] };

    const t = text(coreOn(bundle).call("get_prop_plan_rules", { plan_id: "topstep/50k" }));
    const line = (label: string) => t.split("\n").find((l) => l.startsWith(`- ${label}:`))!;
    assert.match(line("Profit target"), /\[verified 2026-10-10\] source: https:\/\/example\.com\/target/);
    assert.match(line("Consistency"), /\[NOT VERIFIED: the firm's page now says something else\]/);
    assert.match(line("Trading day starts"), /\[NOT VERIFIED: not cited, never checked against the firm's page\] no source/);
    assert.match(line("Minimum trading days"), /not stated by the firm/);

    assert.match(text(coreOn(bundle).call("compare_prop_plans", { plans: ["topstep/50k"] })), /\d+% \(NOT VERIFIED: differs\)/);
    assert.match(text(coreOn(bundle, "2027-02-01").call("get_prop_plan_rules", { plan_id: "topstep/50k" })), /older than the 45-day re-check window/);
});

test("plans resolve by id or words; ambiguity lists the candidates", () => {
    assert.equal((resolvePlan(BUNDLE, "Topstep 50K") as { plan: PlanFile }).plan.id, "topstep/50k");
    assert.equal((resolvePlan(BUNDLE, "TPT 150k") as { plan: PlanFile }).plan.id, "take-profit-trader/150k");
    const r = ts.call("get_prop_plan_rules", { firm: "Tradeify", size: 50000 });
    assert.equal(r.isError, true);
    assert.match(text(r), /tradeify\/growth-50k/);
    assert.equal(ts.call("get_prop_plan_rules", { firm: "Nobody" }).isError, true);
});

test("compare_prop_plans by size", () => {
    const r = ts.call("compare_prop_plans", { size: "150K", firms: ["Topstep", "Apex"] });
    assert.ok(!r.isError, text(r));
    assert.match(text(r), /\| Rule \| Topstep 150K Combine \| Apex EOD 150K \| Apex Intraday 150K \|/);
    assert.match(text(r), /algolift\.ai\/data\/prop-firm-rules/);
});

test("indicators: search, describe, compute equal to the package", () => {
    const l = ts.call("list_indicators", { query: "moving average", limit: 5 });
    assert.equal((l.structuredContent as { indicators: unknown[] }).indicators.length, 5);
    assert.match(text(ts.call("describe_indicator", { id: "alma" })), /Arnaud Legoux/);
    const close = Array.from({ length: 50 }, (_, i) => 100 + Math.cos(i / 4) * 3);
    const r = ts.call("compute_indicator", { id: "trima", columns: { close }, options: { period: 7 } });
    assert.deepEqual((r.structuredContent as { outputs: Array<{ values: unknown }> }).outputs[0].values, calculate("trima", { close }, { period: 7 }).value);
    assert.equal(ts.call("compute_indicator", { id: "trima", columns: { close }, options: { period: 0 } }).isError, true);
    const big = ts.call("compute_indicator", { id: "trima", columns: { close: new Array(LOCAL_LIMITS.indicatorBars + 1).fill(1) } });
    assert.match(text(big), /at most 20,000/);
});

test("Setup Odds: presets and the language, from the engine", () => {
    const all = ts.call("list_setup_presets", {});
    assert.equal((all.structuredContent as { presets: unknown[] }).presets.length, listPresets().length);
    const g = ts.call("list_setup_presets", { family: "gap", query: "noon" });
    assert.match(text(g), /gap-up-fill-by-noon: Gap up fills by noon \[gap\]/);
    assert.match(text(ts.call("describe_setup_query_language", {})), /Grammar \(EBNF\)/);
    const ex = ts.call("describe_setup_query_language", { section: "examples" });
    assert.deepEqual(Object.keys(ex.structuredContent ?? {}).sort(), ["examples", "languageVersion"]);
});

test("Setup Odds on the demo bars equals the engine run directly, labelled synthetic", () => {
    const r = ts.call("run_setup_odds", { preset: "gap-up-fill-by-noon", demo: {} });
    assert.ok(!r.isError, text(r));
    const sc = r.structuredContent as { result: RunResult; text: string; demo: boolean };
    const direct = runSetupOdds({ query: { preset: "gap-up-fill-by-noon" }, bars: demoBars() });
    assert.ok(direct.ok);
    if (direct.ok) {
        assert.deepEqual(sc.result.setup, direct.result.setup);
        assert.equal(sc.text, formatResultText(direct.result));
    }
    assert.match(text(r), /THE DEMO BARS ARE SYNTHETIC, NOT MARKET DATA/);
    assert.equal(sc.demo, true);
});

test("Setup Odds on CSV text, and its refusals", () => {
    const rows = ["timestamp,open,high,low,close,volume"];
    let p = 5100;
    for (const day of ["2024-03-04", "2024-03-05", "2024-03-06"]) {
        for (let m = 0; m < 390; m++) {
            const h = String(9 + Math.floor((30 + m) / 60)).padStart(2, "0");
            const mi = String((30 + m) % 60).padStart(2, "0");
            const o = p;
            p += Math.round(Math.sin(m + p) * 4) / 4;
            rows.push(`${day} ${h}:${mi},${o},${Math.max(o, p) + 0.25},${Math.min(o, p) - 0.25},${p},10`);
        }
    }
    const r = ts.call("run_setup_odds", { setup: "all", outcome: "touches prior.close by close", csv: rows.join("\n"), label: "test bars" });
    assert.ok(!r.isError, text(r));
    assert.match(text(r), /test bars, 1170 bars, 2024-03-04 to 2024-03-06/);
    assert.doesNotMatch(text(r), /SYNTHETIC/);
    assert.match(text(ts.call("run_setup_odds", { preset: "gap-up-fill-by-noon" })), /exactly one of bars, csv or demo/);
    assert.match(text(ts.call("run_setup_odds", { setup: "gap >", outcome: "touches prior.close by 12:00", demo: {} })), /^error E_/m);
    assert.equal(ts.call("run_setup_odds", { preset: "gap-up-fill-by-noon", csv: "x".repeat(LOCAL_LIMITS.setupOddsCsvChars + 1) }).isError, true);
});

test("search and fetch: OpenAI's shapes, citing the algolift.ai pages in data/site-pages.json", () => {
    type Results = { results: Array<{ id: string; title: string; url: string }> };
    const s = ts.call("search", { query: "Topstep 50K rules" });
    assert.ok(!s.isError, text(s));
    // structuredContent, and the same value as JSON in one text item
    assert.equal(s.content.length, 1);
    assert.deepEqual(JSON.parse(s.content[0].text), s.structuredContent);
    const results = (s.structuredContent as Results).results;
    assert.ok(results.length > 0 && results.length <= 10);
    for (const r of results) assert.deepEqual(Object.keys(r).sort(), ["id", "title", "url"]);
    assert.equal(results[0].id, "prop-plan:topstep/50k");
    assert.equal(results[0].url, `https://www.algolift.ai${SITE_PAGES.plans["topstep/50k"]}`);
    assert.match(results[0].url, /^https:\/\/www\.algolift\.ai\/prop-firms\/topstep\//);

    const f = ts.call("fetch", { id: results[0].id });
    assert.ok(!f.isError, text(f));
    assert.deepEqual(JSON.parse(f.content[0].text), f.structuredContent);
    const doc = f.structuredContent as { id: string; title: string; text: string; url: string; metadata: Record<string, unknown> };
    assert.deepEqual(Object.keys(doc).sort(), ["id", "metadata", "text", "title", "url"]);
    assert.equal(doc.url, results[0].url);
    assert.equal(doc.text, text(ts.call("get_prop_plan_rules", { plan_id: "topstep/50k" })));

    // every plan's document is cited to its own page, its firm's, or the dataset's, and every not-verified rule stays labelled
    for (const plan of BUNDLE.plans) {
        const d = ts.call("fetch", { id: `prop-plan:${plan.id}` }).structuredContent as typeof doc;
        const path = SITE_PAGES.plans[plan.id] ?? SITE_PAGES.firms[plan.firm.slug] ?? SITE_PAGES.dataset;
        assert.equal(d.url, `https://www.algolift.ai${path}`, plan.id);
        const counts = d.metadata.status_counts as Record<string, number>;
        if (counts.differs + counts.unverified > 0) {
            assert.match(d.text, /NOT VERIFIED/, plan.id);
            assert.match(d.title, /NOT VERIFIED/, plan.id);
        }
    }
    const first = (q: string) => (ts.call("search", { query: q }).structuredContent as Results).results[0];
    assert.deepEqual(first("RSI"), { id: "indicator:rsi", title: first("RSI").title, url: "https://www.algolift.ai/open-source/indicators" });
    assert.equal(first("gap up fill by noon").url, "https://www.algolift.ai/tools/setup-odds");
    assert.equal(ts.call("fetch", { id: "nope" }).isError, true);
});

test("data/site-pages.json names every firm and only pages the AlgoLift site has", () => {
    for (const slug of new Set(BUNDLE.plans.map((p) => p.firm.slug))) assert.match(SITE_PAGES.firms[slug] ?? "", /^\/prop-firms\/[a-z0-9-]+$/, slug);
    for (const [id, path] of Object.entries(SITE_PAGES.plans)) {
        assert.ok(BUNDLE.plans.some((p) => p.id === id), id);
        assert.match(path, /^\/prop-firms\/[a-z0-9-]+\/[a-z0-9-]+$/, id);
    }
    assert.deepEqual([SITE_PAGES.propHub, SITE_PAGES.dataset, SITE_PAGES.indicators, SITE_PAGES.setupOdds], ["/prop-firms", "/data/prop-firm-rules", "/open-source/indicators", "/tools/setup-odds"]);
});

