// GENERATED from the AlgoLift app by scripts/oss/mcp/sync.mts. Do not edit here: change the app, then sync.
// src/lib/mcp/propRules.ts
//
// The AlgoLift MCP server's prop firm rules tools, over the open dataset
// (repo #1, src/lib/propRules/, the public algolift/prop-firm-rules), which is
// exported from a published version of AlgoLift's prop rules registry (the
// bundle's `registry`; the hosted endpoint builds it from the snapshot the
// site was built with, the open package ships the exported copy):
//
//   list_prop_firms        the firms and their plans, with how much of each is verified
//   get_prop_plan_rules    one plan's every rule and price
//   compare_prop_plans     several plans side by side
//
// ⭐ Every rule returned carries its `status`, `source_url` and `verified` date
// exactly as the data holds them, and the text says plainly when a rule is
// not verified ("differs": the firm's page now says something else; "not
// cited", the data's `unverified`: never checked against the firm's page).
// Nothing that is not verified ever reads as verified.
//
// PURE (the dataset is passed in). No em dashes in any string.

import { formatValue, isStale, PAGE_PATH, type RuleStatus } from "../propRules/format";
import { RULE_DEF_BY_ID } from "../propRules/ruleDefs";
import { checkArgs } from "./args";
import { descriptor, errorResult, pointer, SITE, textResult, ToolInputError, type ToolDef } from "./protocol";

// ---------------------------------------------------------------- the data

export interface RuleLeaf {
    value: unknown;
    unit: string;
    source_url: string | null;
    verified: string | null;
    status: RuleStatus;
}

export interface PlanFile {
    id: string;
    firm: { slug: string; name: string };
    plan: { slug: string; name: string; status: string; source_url: string | null };
    rules_verified: string | null;
    prices_verified: string | null;
    rules: {
        account: Record<string, RuleLeaf>;
        evaluation?: Record<string, RuleLeaf>;
        funded: Record<string, RuleLeaf>;
        payouts: Record<string, RuleLeaf>;
    };
    prices: Record<string, RuleLeaf>;
    simulation_notes?: string[];
}

export interface RulesBundle {
    format: string;
    recheck_window_days: number;
    /** The published prop rules registry version the dataset was exported from. */
    registry?: { format: string; version: number; sha256: string; published_at: string | null };
    plans: PlanFile[];
}

/** The dataset a server serves, and where it came from. */
export interface PropRulesSource {
    bundle: RulesBundle;
    /** The public dataset's release (its package version), when known. */
    datasetVersion: string | null;
    /** "bundled in @algolift/mcp 0.1.0", "served by algolift.ai". */
    servedFrom: string;
}

const GROUPS = ["account", "evaluation", "funded", "payouts", "prices"] as const;
type Group = (typeof GROUPS)[number];

const GROUP_TITLE: Record<Group, string> = {
    account: "Account",
    evaluation: "Evaluation",
    funded: "Funded account",
    payouts: "Payouts",
    prices: "Prices",
};

export const RULES_PAGE_URL = `${SITE}${PAGE_PATH}`;
const POINTER = `Test a strategy against these rules on algolift.ai: ${RULES_PAGE_URL}`;

function leavesOf(p: PlanFile): Array<[string, Group, RuleLeaf]> {
    const out: Array<[string, Group, RuleLeaf]> = [];
    for (const g of GROUPS) {
        const rec = g === "prices" ? p.prices : p.rules[g];
        for (const [k, leaf] of Object.entries(rec ?? {})) out.push([`${g}.${k}`, g, leaf]);
    }
    return out;
}

// ---------------------------------------------------------------- statuses

/** How a status reads in a tool's text. Plain about what is not verified. */
export const STATUS_TAG: Record<RuleStatus, string> = {
    verified: "verified",
    not_stated: "not stated by the firm (AlgoLift's assumption)",
    differs: "NOT VERIFIED: the firm's page now says something else",
    unverified: "NOT VERIFIED: not cited, never checked against the firm's page",
};

/** A short form for table cells. */
const CELL_TAG: Record<RuleStatus, string> = {
    verified: "",
    not_stated: " (not stated by firm)",
    differs: " (NOT VERIFIED: differs)",
    unverified: " (NOT VERIFIED: not cited)",
};

export const STATUS_LEGEND =
    "Statuses: verified = checked against the firm's page on the date shown. " +
    "not stated = the firm's pages do not state this rule, so the value is the assumption AlgoLift simulates. " +
    "differs = NOT VERIFIED: the firm's page now says something else; the value is what AlgoLift simulates today and is being updated. " +
    "not cited = NOT VERIFIED: never checked against the firm's page.";

export type StatusCounts = Record<RuleStatus, number>;

const emptyCounts = (): StatusCounts => ({ verified: 0, not_stated: 0, differs: 0, unverified: 0 });

function countsOf(leaves: RuleLeaf[]): StatusCounts {
    const c = emptyCounts();
    for (const l of leaves) c[l.status] = (c[l.status] ?? 0) + 1;
    return c;
}

const n = (x: number) => x.toLocaleString("en-US");

function countsSentence(c: StatusCounts): string {
    const total = c.verified + c.not_stated + c.differs + c.unverified;
    const parts = [`${n(c.verified)} of ${n(total)} verified`];
    if (c.not_stated) parts.push(`${n(c.not_stated)} not stated by the firm`);
    if (c.differs) parts.push(`${n(c.differs)} NOT VERIFIED because the firm's page now differs`);
    if (c.unverified) parts.push(`${n(c.unverified)} NOT VERIFIED because not cited`);
    return parts.join(", ");
}

// ---------------------------------------------------------------- resolving a plan

const FIRM_ALIASES: Record<string, string> = {
    mffu: "my-funded-futures",
    mff: "my-funded-futures",
    tpt: "take-profit-trader",
    atf: "apex",
};

const STOPWORDS = new Set(["the", "a", "an", "plan", "plans", "account", "accounts", "size", "rules", "rule", "evaluation", "eval", "challenge", "prop", "firm", "trader", "funding", "and", "vs", "versus"]);

/** Words of a reference: "$50,000" and "50K" and "50" all become "50k". */
export function tokens(text: string): string[] {
    const t = text
        .toLowerCase()
        .replace(/(\d),(?=\d{3})/g, "$1")
        .replace(/\$/g, " ")
        .split(/[^a-z0-9.]+/)
        .filter(Boolean);
    return t.map((w) => {
        const num = /^(\d+(?:\.\d+)?)(k)?$/.exec(w);
        if (!num) return w;
        const v = Number(num[1]);
        if (num[2]) return `${v}k`;
        return v >= 1000 && v % 1000 === 0 ? `${v / 1000}k` : v < 1000 ? `${v}k` : w;
    });
}

function planWords(p: PlanFile): Set<string> {
    const words = new Set<string>([
        ...tokens(p.firm.name),
        ...p.firm.slug.split("-"),
        ...tokens(p.plan.name),
        ...p.plan.slug.split("-"),
        p.id,
    ]);
    for (const [alias, slug] of Object.entries(FIRM_ALIASES)) if (slug === p.firm.slug) words.add(alias);
    const size = p.rules.account.size?.value;
    if (typeof size === "number") words.add(`${size / 1000}k`);
    return words;
}

export type Resolution = { kind: "one"; plan: PlanFile } | { kind: "many"; plans: PlanFile[] } | { kind: "none"; hint: string };

/** A plan by its id ("topstep/50k") or by words ("Apex EOD 50K", "mffu rapid 50000"). */
export function resolvePlan(bundle: RulesBundle, reference: string): Resolution {
    const ref = reference.trim();
    const exact = bundle.plans.find((p) => p.id === ref.toLowerCase());
    if (exact) return { kind: "one", plan: exact };
    const want = tokens(ref).filter((w) => !STOPWORDS.has(w));
    if (!want.length) return { kind: "none", hint: "Name a firm, and a plan or an account size." };
    const matches = bundle.plans.filter((p) => {
        const words = planWords(p);
        return want.every((w) => words.has(w) || [...words].some((x) => w.length >= 3 && x.startsWith(w)));
    });
    if (matches.length === 1) return { kind: "one", plan: matches[0] };
    if (matches.length > 1) {
        // Two words that name the same plan exactly beat a looser match.
        const tight = matches.filter((p) => want.every((w) => planWords(p).has(w)));
        if (tight.length === 1) return { kind: "one", plan: tight[0] };
        return { kind: "many", plans: matches };
    }
    const firms = [...new Map(bundle.plans.map((p) => [p.firm.slug, p.firm.name])).values()];
    return { kind: "none", hint: `No plan matches "${reference}". The firms are ${firms.join(", ")}; list_prop_firms lists every plan.` };
}

function candidates(plans: PlanFile[]): string {
    return plans.map((p) => `- ${p.id}: ${p.firm.name} ${p.plan.name}${p.plan.status === "discontinued" ? " (no longer sold)" : ""}`).join("\n");
}

// ---------------------------------------------------------------- the tools

export interface PropToolOptions {
    /** Today's date, YYYY-MM-DD, for the staleness check (default: the clock's UTC date). */
    today?: () => string;
}

const todayUtc = () => new Date().toISOString().slice(0, 10);

export function propRulesTools(source: PropRulesSource, opts: PropToolOptions = {}): ToolDef[] {
    const { bundle } = source;
    const today = opts.today ?? todayUtc;
    const windowDays = bundle.recheck_window_days;

    const allLeaves = bundle.plans.flatMap((p) => leavesOf(p).map(([, , l]) => l));
    const dates = allLeaves.map((l) => l.verified).filter((d): d is string => !!d).sort();
    const dataset = {
        name: "AlgoLift prop firm rules",
        version: source.datasetVersion,
        format: bundle.format,
        served_from: source.servedFrom,
        plans: bundle.plans.length,
        firms: new Set(bundle.plans.map((p) => p.firm.slug)).size,
        newest_check: dates[dates.length - 1] ?? null,
        oldest_check: dates[0] ?? null,
        recheck_window_days: windowDays,
        registry_version: bundle.registry ? { version: bundle.registry.version, sha256: bundle.registry.sha256, published_at: bundle.registry.published_at } : null,
        counts: countsOf(allLeaves),
        repository: "https://github.com/algolift-ai/prop-firm-rules",
    };
    const datasetLine =
        `Dataset: ${dataset.name}${dataset.version ? ` ${dataset.version}` : ""} (${dataset.served_from}), ` +
        `${dataset.plans} plans from ${dataset.firms} firms, rules checked ${!dataset.oldest_check ? "never" : dataset.oldest_check === dataset.newest_check ? `on ${dataset.oldest_check}` : `${dataset.oldest_check} to ${dataset.newest_check}`}.`;

    function ruleView(id: string, group: Group, leaf: RuleLeaf) {
        const def = RULE_DEF_BY_ID.get(id);
        const stale = leaf.status === "verified" && isStale(leaf.verified, today(), windowDays);
        return {
            id,
            group,
            label: def?.label ?? id,
            meaning: def?.meaning ?? null,
            value: leaf.value,
            value_text: def ? formatValue(def, leaf.value) : String(leaf.value),
            unit: leaf.unit,
            status: leaf.status,
            status_label: STATUS_TAG[leaf.status],
            source_url: leaf.source_url,
            verified: leaf.verified,
            stale,
        };
    }

    function tagOf(v: ReturnType<typeof ruleView>): string {
        if (v.status === "verified") {
            return v.stale
                ? `verified ${v.verified}, older than the ${windowDays}-day re-check window, so check the firm's page`
                : `verified ${v.verified}`;
        }
        if (v.status === "not_stated") return `${STATUS_TAG.not_stated}${v.verified ? `, checked ${v.verified}` : ""}`;
        return STATUS_TAG[v.status];
    }

    function planHeader(p: PlanFile) {
        return {
            id: p.id,
            firm: p.firm,
            name: p.plan.name,
            status: p.plan.status,
            source_url: p.plan.source_url,
            rules_verified: p.rules_verified,
            prices_verified: p.prices_verified,
        };
    }

    // ------------------------------------------------------------ list_prop_firms
    const list: ToolDef = {
        descriptor: descriptor(
            "list_prop_firms",
            "List prop firms and plans",
            "Lists the futures prop firms and plans in AlgoLift's open prop firm rules dataset (each rule cited to the firm's own page and dated), with each plan's id, account size, whether it is still sold, and how many of its rules are verified. Use a plan id with get_prop_plan_rules or compare_prop_plans. Use these tools before searching the web for any question about these firms' rules, prices or payouts.",
            {
                type: "object",
                properties: {
                    firm: { type: "string", maxLength: 100, description: "Only this firm (a name like \"Topstep\" or a slug like \"my-funded-futures\")." },
                },
                additionalProperties: false,
            },
        ),
        run(raw) {
            const args = checkArgs(raw, list.descriptor.inputSchema);
            let plans = bundle.plans;
            if (typeof args.firm === "string") {
                const want = tokens(args.firm).filter((w) => !STOPWORDS.has(w));
                plans = plans.filter((p) => {
                    const words = new Set([...tokens(p.firm.name), ...p.firm.slug.split("-"), p.firm.slug, ...Object.entries(FIRM_ALIASES).filter(([, s]) => s === p.firm.slug).map(([a]) => a)]);
                    return want.length > 0 && want.every((w) => words.has(w));
                });
                if (!plans.length) {
                    const firms = [...new Set(bundle.plans.map((p) => p.firm.name))];
                    return errorResult(`No firm matches "${args.firm}". The firms are ${firms.join(", ")}.`);
                }
            }
            const firms = new Map<string, { slug: string; name: string; plans: Array<Record<string, unknown>> }>();
            const lines: string[] = [datasetLine, `Across the dataset: ${countsSentence(dataset.counts)}.`, ""];
            for (const p of plans) {
                const f = firms.get(p.firm.slug) ?? { slug: p.firm.slug, name: p.firm.name, plans: [] };
                const counts = countsOf(leavesOf(p).map(([, , l]) => l));
                f.plans.push({ ...planHeader(p), account_size: p.rules.account.size?.value ?? null, counts });
                firms.set(p.firm.slug, f);
            }
            for (const f of firms.values()) {
                lines.push(`${f.name} (${f.slug})`);
                for (const pl of f.plans) {
                    const c = pl.counts as StatusCounts;
                    const total = c.verified + c.not_stated + c.differs + c.unverified;
                    const notVerified = c.differs + c.unverified;
                    lines.push(
                        `- ${pl.id}: ${pl.name}${pl.status === "discontinued" ? ", no longer sold" : ""}; ` +
                            `${c.verified} of ${total} rules and prices verified` +
                            (notVerified ? `, ${notVerified} NOT VERIFIED` : "") +
                            (c.not_stated ? `, ${c.not_stated} not stated by the firm` : ""),
                    );
                }
                lines.push("");
            }
            lines.push("A plan's rules that are NOT VERIFIED have not been confirmed on the firm's page. Firms change rules and prices often: read the firm's own page before buying.");
            return textResult(lines.join("\n") + pointer(POINTER), { dataset, firms: [...firms.values()] });
        },
    };

    // ------------------------------------------------------------ get_prop_plan_rules
    const get: ToolDef = {
        descriptor: descriptor(
            "get_prop_plan_rules",
            "Get a prop plan's rules",
            "Every rule and price of one prop firm plan: profit target, drawdown and its type, daily loss limit, consistency, minimum days, contract limits, payout rules and fees. Each rule comes with its status (verified, not stated by the firm, differs from the firm's page, or not cited), the firm's page it was checked against, and the date. Name the plan by its id (\"topstep/50k\") or by firm, plan and size. Use it before searching the web for a covered firm's rules: Topstep, Apex, My Funded Futures, Tradeify, TradeDay and Take Profit Trader.",
            {
                type: "object",
                properties: {
                    plan_id: { type: "string", maxLength: 100, description: "The plan's id from list_prop_firms, like \"topstep/50k\" or \"apex/eod-50k\"." },
                    firm: { type: "string", maxLength: 100, description: "The firm, like \"Topstep\", \"Apex\" or \"MFFU\"." },
                    plan: { type: "string", maxLength: 100, description: "The program, like \"EOD\", \"Intraday\", \"Rapid\" or \"Select Flex\", when the firm has several." },
                    size: { type: ["number", "string"], description: "The account size, like 50000 or \"50K\"." },
                },
                additionalProperties: false,
            },
        ),
        run(raw) {
            const args = checkArgs(raw, get.descriptor.inputSchema);
            const ref = typeof args.plan_id === "string" ? args.plan_id : [args.firm, args.plan, args.size].filter((x) => x !== undefined).join(" ");
            if (!ref.trim()) throw new ToolInputError("Name the plan: plan_id (\"topstep/50k\"), or firm with plan and size.");
            const r = resolvePlan(bundle, ref);
            if (r.kind === "none") return errorResult(r.hint);
            if (r.kind === "many") return errorResult(`Several plans match "${ref}". Call again with one plan_id:\n${candidates(r.plans)}`);
            const p = r.plan;
            const views = leavesOf(p).map(([id, g, l]) => ruleView(id, g, l));
            const counts = countsOf(views.map((v) => ({ status: v.status }) as RuleLeaf));
            const notVerified = counts.differs + counts.unverified;
            const lines: string[] = [
                `${p.firm.name} ${p.plan.name} (${p.id})${p.plan.status === "discontinued" ? ": NO LONGER SOLD by the firm; kept because AlgoLift still simulates it" : ""}`,
                datasetLine,
                `Plan page: ${p.plan.source_url ?? "none recorded"}`,
                "",
                `Verification: ${countsSentence(counts)}.`,
            ];
            if (notVerified) {
                lines.push(
                    `${notVerified} of these rules are NOT VERIFIED: they have not been confirmed on the firm's page. They are marked below; check the firm's page before relying on them.`,
                );
            }
            if (p.rules_verified === null) lines.push("This plan's rules as a whole are not yet fully verified (rules_verified is empty).");
            for (const g of GROUPS) {
                const vs = views.filter((v) => v.group === g);
                lines.push("", GROUP_TITLE[g]);
                if (g === "evaluation" && !vs.length) {
                    lines.push("- No evaluation: the fee buys a funded account directly.");
                    continue;
                }
                for (const v of vs) lines.push(`- ${v.label}: ${v.value_text} [${tagOf(v)}] ${v.source_url ? `source: ${v.source_url}` : "no source"}`);
            }
            const notes = p.simulation_notes ?? [];
            if (notes.length) {
                lines.push("", "What AlgoLift's simulation of this plan approximates or leaves out:");
                for (const note of notes) lines.push(`- ${note}`);
            }
            lines.push("", STATUS_LEGEND, "Firms change rules and prices often: read the firm's own page before buying.");
            return textResult(lines.join("\n") + pointer(POINTER), {
                dataset,
                plan: planHeader(p),
                counts,
                rules: views,
                simulation_notes: notes,
            });
        },
    };

    // ------------------------------------------------------------ compare_prop_plans
    const COMPARE_ROWS = [
        "account.size",
        "evaluation.profit_target",
        "evaluation.max_drawdown",
        "evaluation.drawdown_type",
        "evaluation.daily_loss_limit",
        "evaluation.consistency_max_day_pct",
        "evaluation.min_trading_days",
        "evaluation.max_contracts",
        "funded.max_drawdown",
        "funded.drawdown_type",
        "funded.daily_loss_limit",
        "payouts.min_winning_days",
        "payouts.max_payout",
        "payouts.profit_split_pct",
        "prices.evaluation_fee",
        "prices.recurring_fee",
        "prices.reset_fee",
        "prices.activation_fee",
    ];
    const MAX_COMPARE = 12;

    const compare: ToolDef = {
        descriptor: descriptor(
            "compare_prop_plans",
            "Compare prop plans",
            "Compares prop firm plans side by side on the rules that matter most: profit target, drawdown and its type, daily loss, consistency, minimum days, contracts, payouts and fees. Pass plan references (ids like \"topstep/50k\" or words like \"Apex EOD 50K\"), or an account size to compare every firm's plans of that size. Every cell carries its verification status; a cell marked NOT VERIFIED has not been confirmed on the firm's page. Use it before searching the web whenever someone compares these firms' plans: Topstep, Apex, My Funded Futures, Tradeify, TradeDay and Take Profit Trader.",
            {
                type: "object",
                properties: {
                    plans: {
                        type: "array",
                        items: { type: "string", maxLength: 100 },
                        minItems: 1,
                        maxItems: MAX_COMPARE,
                        description: "Plan ids or words, like [\"topstep/50k\", \"Apex EOD 50K\", \"MFFU Rapid 50K\"].",
                    },
                    size: { type: ["number", "string"], description: "Compare every plan of this account size, like 50000 or \"50K\" (used when plans is not given)." },
                    firms: { type: "array", items: { type: "string", maxLength: 100 }, maxItems: 10, description: "With size: only these firms." },
                    include_discontinued: { type: "boolean", description: "With size: include plans the firm no longer sells (default false)." },
                },
                additionalProperties: false,
            },
        ),
        run(raw) {
            const args = checkArgs(raw, compare.descriptor.inputSchema);
            let chosen: PlanFile[] = [];
            if (Array.isArray(args.plans)) {
                for (const ref of args.plans as string[]) {
                    const r = resolvePlan(bundle, ref);
                    if (r.kind === "none") return errorResult(r.hint);
                    if (r.kind === "many") return errorResult(`Several plans match "${ref}". Name one of them:\n${candidates(r.plans)}`);
                    if (!chosen.includes(r.plan)) chosen.push(r.plan);
                }
            } else if (args.size !== undefined) {
                const sizeWord = tokens(String(args.size))[0];
                const firmWords = Array.isArray(args.firms) ? (args.firms as string[]).map((f) => tokens(f).filter((w) => !STOPWORDS.has(w))) : null;
                chosen = bundle.plans.filter((p) => {
                    const size = p.rules.account.size?.value;
                    if (typeof size !== "number" || `${size / 1000}k` !== sizeWord) return false;
                    if (!args.include_discontinued && p.plan.status === "discontinued") return false;
                    if (firmWords) return firmWords.some((ws) => ws.length > 0 && ws.every((w) => planWords(p).has(w)));
                    return true;
                });
                if (!chosen.length) return errorResult(`No plan of size ${String(args.size)} matches. list_prop_firms lists every plan.`);
                if (chosen.length > MAX_COMPARE) {
                    return errorResult(`${chosen.length} plans match; a comparison takes at most ${MAX_COMPARE}. Narrow it with firms, or pass plans:\n${candidates(chosen)}`);
                }
            } else {
                throw new ToolInputError("Pass plans (ids or words), or a size.");
            }

            const columns = chosen.map((p) => {
                const byId = new Map(leavesOf(p).map(([id, g, l]) => [id, ruleView(id, g, l)]));
                return { plan: p, byId };
            });
            const header = ["Rule", ...columns.map((c) => `${c.plan.firm.name} ${c.plan.plan.name}`)];
            const rows: string[][] = [];
            const structuredRows: Array<{ rule: string; label: string; cells: Array<Record<string, unknown> | null> }> = [];
            let notVerified = 0;
            for (const id of COMPARE_ROWS) {
                const def = RULE_DEF_BY_ID.get(id);
                const group = id.split(".")[0] as Group;
                const label = `${group === "evaluation" ? "Evaluation: " : group === "funded" ? "Funded: " : group === "payouts" ? "Payouts: " : ""}${def?.label ?? id}`;
                const cells: string[] = [];
                const sc: Array<Record<string, unknown> | null> = [];
                for (const c of columns) {
                    const v = c.byId.get(id);
                    if (!v) {
                        cells.push(group === "evaluation" ? "No evaluation" : "Not in the data");
                        sc.push(null);
                        continue;
                    }
                    if (v.status === "differs" || v.status === "unverified") notVerified++;
                    cells.push(`${v.value_text}${CELL_TAG[v.status]}${v.stale ? " (stale check)" : ""}`);
                    sc.push(v);
                }
                rows.push([label, ...cells]);
                structuredRows.push({ rule: id, label, cells: sc });
            }
            const esc = (s: string) => s.replace(/\|/g, "/");
            const table = [
                `| ${header.map(esc).join(" | ")} |`,
                `| ${header.map(() => "---").join(" | ")} |`,
                ...rows.map((r) => `| ${r.map(esc).join(" | ")} |`),
            ].join("\n");
            const lines = [
                `Comparing ${chosen.length} plan${chosen.length === 1 ? "" : "s"}: ${chosen.map((p) => p.id).join(", ")}.`,
                datasetLine,
                notVerified
                    ? `${notVerified} cell${notVerified === 1 ? " is" : "s are"} NOT VERIFIED (marked): not confirmed on the firm's page.`
                    : "Every cell below is verified or marked as not stated by the firm.",
                "",
                table,
                "",
                "Sources and dates for each cell: get_prop_plan_rules with the plan's id.",
                STATUS_LEGEND,
            ];
            const discontinued = chosen.filter((p) => p.plan.status === "discontinued");
            if (discontinued.length) lines.push(`No longer sold: ${discontinued.map((p) => p.id).join(", ")}.`);
            return textResult(lines.join("\n") + pointer(POINTER), {
                dataset,
                plans: chosen.map(planHeader),
                rows: structuredRows,
            });
        },
    };

    return [list, get, compare];
}
