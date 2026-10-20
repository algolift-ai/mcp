// GENERATED from the AlgoLift app by scripts/oss/mcp/sync.mts. Do not edit here: change the app, then sync.
// src/lib/mcp/research.ts
//
// The AlgoLift MCP server's `search` and `fetch`: the two read-only tools
// OpenAI's ChatGPT deep research and company knowledge read a remote MCP
// server through (developers.openai.com/api/docs/mcp, read 2026-10-19), and
// the pair the Responses API's deep research models accept. Any other MCP
// client can call them too.
//
//   search   { query }  ->  { results: [{ id, title, url }] }
//   fetch    { id }     ->  { id, title, text, url, metadata }
//
// Each answer is `structuredContent`, with the same value as a JSON-encoded
// string in one text content item, as that page asks "for compatibility".
//
// The documents are AlgoLift's own open content and nothing else: the prop
// firms and plans of the open rules dataset, the indicators of
// @algolift/indicators, Setup Odds' presets and its query language. A
// document's text is the matching tool's own answer (get_prop_plan_rules,
// list_prop_firms, describe_indicator, describe_setup_query_language), so
// every prop rule keeps its status, source and date, and a rule that is not
// verified reads NOT VERIFIED, exactly as those tools say it. Every url is a
// public algolift.ai page (SitePages), so a citation opens.
//
// Deterministic: the same query on the same data gives the same results in
// the same order. No network.
//
// PURE. No em dashes in any string.

import { CATALOG, type IndicatorInfo } from "@algolift/indicators";
import { listPresets, type Preset } from "../tools/setupOdds/engine";
import { tokens, type PlanFile, type RulesBundle, type StatusCounts } from "./propRules";
import { descriptor, errorResult, SITE, ToolInputError, type JsonSchema, type SitePages, type ToolDef, type ToolResult } from "./protocol";

/** How many results one search returns. */
export const SEARCH_RESULTS = 10;

const SEARCH_OUTPUT: JsonSchema & { type: "object" } = {
    type: "object",
    properties: {
        results: {
            type: "array",
            items: {
                type: "object",
                properties: { id: { type: "string" }, title: { type: "string" }, url: { type: "string" } },
                required: ["id", "title", "url"],
            },
        },
    },
    required: ["results"],
};

const FETCH_OUTPUT: JsonSchema & { type: "object" } = {
    type: "object",
    properties: {
        id: { type: "string" },
        title: { type: "string" },
        text: { type: "string" },
        url: { type: "string" },
        metadata: { type: "object" },
    },
    required: ["id", "title", "text", "url"],
};

export interface SearchResult {
    id: string;
    title: string;
    url: string;
}

export interface FetchedDocument {
    id: string;
    title: string;
    text: string;
    url: string;
    metadata: Record<string, unknown>;
}

interface Doc {
    id: string;
    title: string;
    url: string;
    /** Words that name the document (its title, ids, aliases): a match here counts most. */
    names: Set<string>;
    /** Words of its summary. */
    body: Set<string>;
    /** An exact reference that puts the document first ("rsi", "topstep/50k"). */
    exact: Set<string>;
    read(): { text: string; metadata: Record<string, unknown> };
}

/** Runs another tool of the set (the documents' text is the tools' own answers). */
export type RunTool = (name: string, args: Record<string, unknown>) => ToolResult;

export interface ResearchInput {
    bundle: RulesBundle;
    datasetVersion: string | null;
    pages: SitePages;
    run: RunTool;
}

// ---------------------------------------------------------------- words

const STOPWORDS = new Set([
    "a", "an", "and", "are", "about", "as", "at", "by", "can", "do", "does", "for", "from", "how", "i", "in", "into", "is", "it", "its",
    "me", "of", "on", "or", "show", "tell", "the", "their", "there", "this", "to", "vs", "versus", "what", "whats", "which", "who", "with",
]);

/** A text's words for matching: lower case, "$50,000" and "50K" as "50k" (the prop tools' own reading). */
export function searchWords(text: string): string[] {
    return tokens(text.replace(/[_/]/g, " ")).filter((w) => !STOPWORDS.has(w));
}

const wordSet = (...texts: Array<string | null | undefined>) => new Set(texts.flatMap((t) => (t ? searchWords(t) : [])));

function has(set: Set<string>, w: string): "exact" | "prefix" | null {
    if (set.has(w)) return "exact";
    if (w.length >= 3) for (const x of set) if (x.startsWith(w)) return "prefix";
    return null;
}

/** [words matched, score] for one document: more of the query's words first, then where they matched. */
function scoreDoc(d: Doc, query: string, words: string[]): [number, number] {
    let matched = 0;
    let score = 0;
    for (const w of words) {
        const n = has(d.names, w);
        const b = n ? null : has(d.body, w);
        if (n === "exact") score += 3;
        else if (n === "prefix") score += 2;
        else if (b === "exact") score += 1;
        else if (b === "prefix") score += 0.5;
        if (n || b) matched++;
    }
    if (d.exact.has(query.trim().toLowerCase())) {
        matched = words.length + 1;
        score += 100;
    }
    return [matched, score];
}

// ---------------------------------------------------------------- the documents

const absolute = (path: string) => (/^https?:\/\//.test(path) ? path : `${SITE}${path.startsWith("/") ? "" : "/"}${path}`);

function countsOf(p: PlanFile): StatusCounts {
    const c: StatusCounts = { verified: 0, not_stated: 0, differs: 0, unverified: 0 };
    const groups = [p.rules.account, p.rules.evaluation ?? {}, p.rules.funded, p.rules.payouts, p.prices];
    for (const g of groups) for (const leaf of Object.values(g)) c[leaf.status] = (c[leaf.status] ?? 0) + 1;
    return c;
}

function verificationWords(c: StatusCounts): string {
    const total = c.verified + c.not_stated + c.differs + c.unverified;
    const notVerified = c.differs + c.unverified;
    return `${c.verified} of ${total} rules and prices verified${notVerified ? `, ${notVerified} NOT VERIFIED` : ""}`;
}

/** A tool's own answer, as a document's text. */
function textOf(r: ToolResult): string {
    return r.content.map((c) => c.text).join("\n");
}

const FAMILY_WORDS: Record<string, string> = {
    moving_averages: "moving average",
    price_transforms: "price transform",
    momentum: "momentum",
    trend_strength: "trend strength",
    volatility: "volatility",
    bands_channels: "bands and channels",
    volume: "volume",
    cycles: "cycle",
    statistics: "statistics",
    regression: "regression",
    market_structure: "market structure",
    candlestick_patterns: "candlestick pattern",
};

function firstSentence(s: string): string {
    const m = /^(.*?[.!?])(\s|$)/.exec(s);
    return m ? m[1] : s;
}

function presetText(p: Preset, pageUrl: string): string {
    const lines = [
        `Setup Odds preset ${p.id}: ${p.name} (family: ${p.family}).`,
        p.description,
        "",
        `Setup (which sessions it asks about): ${p.setup}`,
        `Outcome (what it looks for later that session): ${p.outcome}`,
    ];
    if (p.params.length) {
        lines.push("", "Parameters:");
        for (const x of p.params) lines.push(`- $${x.name}: default ${x.default}${x.unit === "none" ? "" : ` (${x.unit})`}, ${x.min} to ${x.max}. ${x.description}`);
    }
    lines.push(
        "",
        `Run it with the run_setup_odds tool ({"preset": "${p.id}"} with your own 1-minute bars, or "demo": {} for the synthetic demo bars, which are not market data), or on ${pageUrl}.`,
        "A Setup Odds number is a historical frequency with its sample and a 95% Wilson interval: it places no trade, pays no cost and takes no stop, so it is not an edge, a prediction or advice.",
    );
    return lines.join("\n");
}

function buildDocs(input: ResearchInput): Doc[] {
    const { bundle, pages, run } = input;
    const docs: Doc[] = [];
    const firms = [...new Map(bundle.plans.map((p) => [p.firm.slug, p.firm])).values()];
    const datasetUrl = absolute(pages.dataset);
    const firmUrl = (slug: string) => absolute(pages.firms[slug] ?? pages.dataset);
    const registry = bundle.registry ? { version: bundle.registry.version, sha256: bundle.registry.sha256, published_at: bundle.registry.published_at } : null;
    const dataset = { name: "AlgoLift prop firm rules", version: input.datasetVersion, registry, repository: "https://github.com/algolift-ai/prop-firm-rules", license: "CC-BY-4.0" };

    // ---- the prop firms, as a whole
    docs.push({
        id: "prop-firms",
        title: `Futures prop firms and plans in AlgoLift's open rules dataset (${bundle.plans.length} plans from ${firms.length} firms)`,
        url: absolute(pages.propHub),
        names: wordSet("prop firms futures prop firm plans rules dataset list all firms evaluations", ...firms.map((f) => f.name)),
        body: wordSet("every rule cited to the firm's page with its verification status and date"),
        exact: new Set(["prop-firms", "prop firms"]),
        read: () => ({ text: textOf(run("list_prop_firms", {})), metadata: { kind: "prop_firms", dataset, dataset_page: datasetUrl } }),
    });

    // ---- each firm
    for (const f of firms) {
        const plans = bundle.plans.filter((p) => p.firm.slug === f.slug);
        const c = plans.map(countsOf).reduce((a, b) => ({ verified: a.verified + b.verified, not_stated: a.not_stated + b.not_stated, differs: a.differs + b.differs, unverified: a.unverified + b.unverified }));
        docs.push({
            id: `prop-firm:${f.slug}`,
            title: `${f.name} prop firm: ${plans.length} plan${plans.length === 1 ? "" : "s"}, ${verificationWords(c)}`,
            url: firmUrl(f.slug),
            names: wordSet(f.name, f.slug, "prop firm plans"),
            body: wordSet(...plans.map((p) => p.plan.name)),
            exact: new Set([f.slug, f.name.toLowerCase()]),
            read: () => ({
                text: textOf(run("list_prop_firms", { firm: f.slug })),
                metadata: { kind: "prop_firm", firm: f, plans: plans.map((p) => p.id), status_counts: c, dataset, dataset_page: datasetUrl },
            }),
        });
    }

    // ---- each plan
    for (const p of bundle.plans) {
        const c = countsOf(p);
        const size = p.rules.account.size?.value;
        docs.push({
            id: `prop-plan:${p.id}`,
            title: `${p.firm.name} ${p.plan.name} rules${p.plan.status === "discontinued" ? " (no longer sold)" : ""}: ${verificationWords(c)}`,
            url: absolute(pages.plans[p.id] ?? pages.firms[p.firm.slug] ?? pages.dataset),
            names: wordSet(p.firm.name, p.firm.slug, p.plan.name, p.plan.slug, p.id, typeof size === "number" ? `${size / 1000}k` : null, "rules"),
            body: wordSet(
                "profit target drawdown trailing daily loss limit consistency minimum days contracts payouts fees price evaluation funded",
                p.plan.status === "discontinued" ? "discontinued" : null,
            ),
            exact: new Set([p.id, `prop-plan:${p.id}`]),
            read: () => ({
                text: textOf(run("get_prop_plan_rules", { plan_id: p.id })),
                metadata: {
                    kind: "prop_plan",
                    plan_id: p.id,
                    firm: p.firm,
                    plan: p.plan,
                    status_counts: c,
                    rules_verified: p.rules_verified,
                    prices_verified: p.prices_verified,
                    dataset,
                    dataset_page: datasetUrl,
                    note: "Each rule in the text carries its status, the firm's page it was checked against and the date. A rule marked NOT VERIFIED has not been confirmed on the firm's page.",
                },
            }),
        });
    }

    // ---- each indicator
    const indicatorsUrl = absolute(pages.indicators);
    for (const i of CATALOG as readonly IndicatorInfo[]) {
        docs.push({
            id: `indicator:${i.id}`,
            title: `${i.name} (${i.id}): ${FAMILY_WORDS[i.family] ?? i.family} indicator in @algolift/indicators`,
            url: indicatorsUrl,
            names: wordSet(i.name, i.id, i.fn, ...(i.aliases ?? []), "indicator"),
            body: wordSet(firstSentence(i.description), FAMILY_WORDS[i.family], ...i.outputs.map((o) => o.label)),
            exact: new Set([i.id, i.fn.toLowerCase(), i.name.toLowerCase(), `indicator:${i.id}`]),
            read: () => ({
                text: textOf(run("describe_indicator", { id: i.id })),
                metadata: { kind: "indicator", indicator_id: i.id, family: i.family, package: "@algolift/indicators", repository: "https://github.com/algolift-ai/indicators", verified_against: i.verifiedAgainst },
            }),
        });
    }

    // ---- Setup Odds: each preset, and the language
    const setupUrl = absolute(pages.setupOdds);
    for (const p of listPresets()) {
        docs.push({
            id: `setup-preset:${p.id}`,
            title: `Setup Odds preset: ${p.name}`,
            url: setupUrl,
            names: wordSet(p.name, p.id, p.family, "setup odds preset"),
            body: wordSet(p.description, p.setup, p.outcome),
            exact: new Set([p.id, `setup-preset:${p.id}`]),
            read: () => ({
                text: presetText(p, setupUrl),
                metadata: { kind: "setup_odds_preset", preset_id: p.id, family: p.family, setup: p.setup, outcome: p.outcome, params: p.params, repository: "https://github.com/algolift-ai/setup-odds" },
            }),
        });
    }
    docs.push({
        id: "setup-odds:language",
        title: "The Setup Odds query language: grammar, values, functions, outcomes and examples",
        url: setupUrl,
        names: wordSet("setup odds query language grammar syntax setup outcome"),
        body: wordSet("values windows fields units functions operators outcomes examples how to write a setup"),
        exact: new Set(["setup-odds:language", "setup odds language", "query language"]),
        read: () => ({ text: textOf(run("describe_setup_query_language", {})), metadata: { kind: "setup_odds_language", repository: "https://github.com/algolift-ai/setup-odds" } }),
    });

    const ids = new Set(docs.map((d) => d.id));
    if (ids.size !== docs.length) throw new Error("Two search documents share an id.");
    return docs;
}

// ---------------------------------------------------------------- the tools

/** The answer the way OpenAI's MCP page asks: structuredContent, and the same value as JSON text. */
function jsonResult(value: SearchResult[] | FetchedDocument): ToolResult {
    const structuredContent = (Array.isArray(value) ? { results: value } : value) as unknown as Record<string, unknown>;
    return { content: [{ type: "text", text: JSON.stringify(structuredContent) }], structuredContent };
}

export function researchTools(input: ResearchInput): ToolDef[] {
    let docs: Doc[] | null = null;
    let byId: Map<string, Doc> | null = null;
    // Built on first use: the documents' text is read only when fetched.
    const corpus = () => {
        docs ??= buildDocs(input);
        byId ??= new Map(docs.map((d) => [d.id, d]));
        return { docs, byId };
    };

    const search: ToolDef = {
        descriptor: descriptor(
            "search",
            "Search AlgoLift's open content",
            "Searches AlgoLift's open content and returns matching documents, each with an id, a title and the algolift.ai page to cite: futures prop firms and their plans' rules (each rule with its verification status, source and date), the technical indicators of @algolift/indicators, and Setup Odds' presets and query language. Use fetch with a result's id to read the whole document.",
            {
                type: "object",
                properties: { query: { type: "string", maxLength: 500, description: "A single query string, like \"Topstep 50K drawdown\", \"RSI\" or \"gap fill by noon\"." } },
                required: ["query"],
            },
            SEARCH_OUTPUT,
        ),
        run(args) {
            const query = String(args.query ?? "");
            const words = [...new Set(searchWords(query))];
            const { docs: all } = corpus();
            if (!words.length && !query.trim()) return jsonResult([]);
            const results = all
                .map((d, order) => ({ d, order, s: scoreDoc(d, query, words) }))
                .filter((x) => x.s[0] > 0)
                .sort((a, b) => b.s[0] - a.s[0] || b.s[1] - a.s[1] || a.order - b.order)
                .slice(0, SEARCH_RESULTS)
                .map(({ d }) => ({ id: d.id, title: d.title, url: d.url }));
            return jsonResult(results);
        },
    };

    const fetch: ToolDef = {
        descriptor: descriptor(
            "fetch",
            "Fetch an AlgoLift document",
            "Returns the full text of one document found by search, with its title, the algolift.ai page to cite and metadata. A prop plan's text lists every rule with its status, the firm's page it was checked against and the date; a rule marked NOT VERIFIED has not been confirmed on the firm's page.",
            {
                type: "object",
                properties: { id: { type: "string", minLength: 1, maxLength: 200, description: "A unique identifier for a search document: the id of a search result, like \"prop-plan:topstep/50k\"." } },
                required: ["id"],
            },
            FETCH_OUTPUT,
        ),
        run(args) {
            const id = String(args.id).trim();
            const d = corpus().byId.get(id);
            if (!d) {
                if (!id) throw new ToolInputError("id is required.");
                return errorResult(`No document "${id}". Use the id of a search result, like "prop-plan:topstep/50k", "indicator:rsi" or "setup-odds:language".`);
            }
            const { text, metadata } = d.read();
            return jsonResult({ id: d.id, title: d.title, text, url: d.url, metadata: { source: "AlgoLift (algolift.ai)", ...metadata } });
        },
    };

    return [search, fetch];
}
