// GENERATED from the AlgoLift app by scripts/oss/mcp/sync.mts. Do not edit here: change the app, then sync.
// src/lib/propRules/format.ts
//
// How the prop firm rules read on algolift.ai (/data/prop-firm-rules): a rule's
// value in words, its status in words, and dates. Client-safe (the page's rule
// detail renders in the browser from the fetched file), so it never imports
// the bundle itself.
//
// PURE. No em dashes: every string here is public copy.

type RuleStatus = "verified" | "not_stated" | "differs" | "unverified";
import { RULE_DEF_BY_ID, type RuleDef } from "./ruleDefs";

export type { RuleStatus };

/** Where the page fetches the whole dataset (the static route beside the page). */
export const RULES_JSON_URL = "/data/prop-firm-rules/rules.json";
export const PAGE_PATH = "/data/prop-firm-rules";
export const REPO_URL = "https://github.com/algolift-ai/prop-firm-rules";
/** Where "Run your strategy against these rules" lands: the projects page, where a prop project starts. */
export const PRODUCT_PATH = "/dashboard/projects";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-10-16" as "16 Oct 2026" (fixed, so server and browser render the same). */
export function formatDate(ymd: string | null, long = false): string {
    if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return "";
    const [y, m, d] = ymd.split("-").map(Number);
    return `${d} ${(long ? MONTHS_LONG : MONTHS)[m - 1]} ${y}`;
}

export function formatUsd(n: number): string {
    const fractional = Math.round(n * 100) % 100 !== 0;
    return `$${n.toLocaleString("en-US", { minimumFractionDigits: fractional ? 2 : 0, maximumFractionDigits: 2 })}`;
}

const CHOICE_WORDS: Record<string, string> = {
    end_of_day: "End of day",
    intraday: "Intraday",
    static: "Static",
    starting_balance: "At the starting balance",
    profit_target: "At the profit target",
    never: "Never",
    since_last_payout: "Since the last payout",
    since_funded: "Since funding",
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

type Value = unknown;

function formatOne(def: Pick<RuleDef, "unit">, v: Value): string {
    if (v === null || v === undefined) return "None";
    switch (def.unit) {
        case "usd":
            return formatUsd(v as number);
        case "percent":
            return `${v}%`;
        case "trading_days":
            return plural(v as number, "trading day", "trading days");
        case "calendar_days":
            return plural(v as number, "calendar day", "calendar days");
        case "contracts":
            return plural(v as number, "contract", "contracts");
        case "count":
            return String(v);
        case "multiple":
            return `${v} times`;
        case "flag":
            return v ? "Yes" : "No";
        case "choice":
            return CHOICE_WORDS[v as string] ?? String(v);
        case "clock_new_york":
            return `${v} New York time`;
        case "contract_scaling":
            return (v as Array<{ profit_above: number; max_contracts: number }>)
                .map((s) => `${plural(s.max_contracts, "contract", "contracts")} from ${formatUsd(s.profit_above)} profit`)
                .join(", ");
        case "contract_growth": {
            const g = v as { start: number; add_one_per_usd: number };
            return `${plural(g.start, "contract", "contracts")}, plus one per ${formatUsd(g.add_one_per_usd)} of profit`;
        }
        case "payout_lock": {
            const l = v as { after: string; floor_above_start: number };
            const when = l.after === "first_payout" ? "After the first payout" : "After every payout";
            return l.floor_above_start > 0
                ? `${when}, the floor moves to the starting balance plus ${formatUsd(l.floor_above_start)}`
                : `${when}, the floor moves to the starting balance`;
        }
        case "time_window": {
            const w = v as { start: string; end: string };
            return `${w.start} to ${w.end} New York time`;
        }
        case "reduced_size": {
            const r = v as { fraction: number; until_profit_above: number };
            const share = r.fraction === 0.5 ? "Half the contract limit" : `${Math.round(r.fraction * 100)}% of the contract limit`;
            return `${share} until ${formatUsd(r.until_profit_above)} of profit`;
        }
    }
}

const ORDINAL = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];

/** A rule's value in words. A per-payout list reads "1st: $1,500 · 2nd: $2,000 · later: $3,000". */
export function formatValue(def: Pick<RuleDef, "unit" | "byPayout">, v: Value): string {
    if (def.byPayout && Array.isArray(v)) {
        return v
            .map((x, i) => `${i === v.length - 1 ? "later" : ORDINAL[i] ?? `${i + 1}th`}: ${formatOne(def, x)}`)
            .join(" · ");
    }
    return formatOne(def, v);
}

export function formatRule(id: string, v: Value): string {
    const def = RULE_DEF_BY_ID.get(id);
    return def ? formatValue(def, v) : String(v);
}

/** The order a reader trusts statuses in: a cell built from several rules shows its weakest. */
const STATUS_RANK: Record<RuleStatus, number> = { verified: 0, not_stated: 1, differs: 2, unverified: 3 };

export function weakest(statuses: RuleStatus[]): RuleStatus {
    return statuses.reduce((a, b) => (STATUS_RANK[b] > STATUS_RANK[a] ? b : a), "verified" as RuleStatus);
}

/** What each status says on the page. Nothing that is not verified ever reads as verified. */
export const STATUS_WORDS: Record<RuleStatus, { short: string; long: string }> = {
    verified: { short: "Verified", long: "Checked against the firm's page on this date." },
    not_stated: {
        short: "Not stated by the firm",
        long: "The firm's pages do not state this rule, so the value is the assumption AlgoLift simulates.",
    },
    differs: {
        short: "Verification in progress",
        long: "The firm's page has changed since this rule was set. The value shown is what AlgoLift simulates today, and it is being updated.",
    },
    unverified: {
        short: "Verification in progress",
        long: "This rule has not been checked against the firm's page yet.",
    },
};

/** Is a dated rule older than the re-check window, on `today`? */
export function isStale(verified: string | null, today: string, windowDays: number): boolean {
    if (!verified) return false;
    const day = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86_400_000;
    return day(today) - day(verified) > windowDays;
}
