// GENERATED from the AlgoLift app by scripts/oss/mcp/sync.mts. Do not edit here: change the app, then sync.
// src/lib/propRules/ruleDefs.ts
//
// THE PROP FIRM RULES DATASET: what each rule is (the open-source program's
// repo #1, plan/features/open-source-program.md, OS-R3). One definition per
// rule: its group, its name, its unit and what it means. Everything else reads
// these: the projection from the engine catalogue (project.ts), the public
// repo's schema.json (schema.ts), and the algolift.ai page (page.ts). A rule
// added here without a projection fails the exporter's tests, so the dataset
// never carries a field nobody fills.
//
// PURE. No em dashes in any string here: they reach the public page and repo.

export type RuleGroup = "account" | "evaluation" | "funded" | "payouts";
export type PriceGroup = "prices";

export type Unit =
    | "usd"
    | "percent"
    | "trading_days"
    | "calendar_days"
    | "contracts"
    | "count"
    | "multiple"
    | "flag"
    | "choice"
    | "clock_new_york"
    | "contract_scaling"
    | "contract_growth"
    | "payout_lock"
    | "reduced_size"
    | "time_window";

/** What each unit means, for the schema and the page. */
export const UNIT_MEANING: Record<Unit, string> = {
    usd: "US dollars.",
    percent: "A percentage: 50 means 50%.",
    trading_days: "Trading days (a day the account traded, on the firm's trading-day clock).",
    calendar_days: "Calendar days.",
    contracts: "E-mini contracts; one E-mini equals 10 micro contracts.",
    count: "A count.",
    multiple: "A multiplier: 2 means twice.",
    flag: "True or false.",
    choice: "One of the listed values.",
    clock_new_york: "A time of day, HH:MM, New York time.",
    contract_scaling: "A list of steps, each { profit_above (US dollars), max_contracts (E-minis) }.",
    contract_growth: "An object { start (E-minis), add_one_per_usd (US dollars of profit per extra contract) }.",
    payout_lock: "An object { after (first_payout or every_payout), floor_above_start (US dollars) }.",
    reduced_size: "An object { fraction (of max_contracts), until_profit_above (US dollars) }.",
    time_window: "An object { start, end }, each HH:MM New York time; an end before the start runs past midnight.",
};

/** The shape of a rule's value, for the schema. */
export type ValueKind =
    | { kind: "number"; nullable: boolean; integer?: boolean }
    | { kind: "boolean" }
    | { kind: "choice"; options: readonly string[] }
    | { kind: "clock" }
    | { kind: "contract_scaling"; nullable: true }
    | { kind: "contract_growth"; nullable: true }
    | { kind: "payout_lock"; nullable: true }
    | { kind: "reduced_size"; nullable: true }
    | { kind: "time_window"; nullable: true };

export interface RuleDef {
    group: RuleGroup | PriceGroup;
    key: string;
    label: string;
    unit: Unit;
    meaning: string;
    value: ValueKind;
    /** The value may change with the payout number (a list; see BY_PAYOUT_MEANING). */
    byPayout?: boolean;
}

export const BY_PAYOUT_MEANING =
    "A rule that can change with the payout number is one value when it is the same for every payout, or a list: the first entry applies to the first payout, the second to the second, and the last entry to every later payout.";

export const DRAWDOWN_TYPES = ["end_of_day", "intraday", "static"] as const;
export const EVAL_DRAWDOWN_STOPS = ["starting_balance", "profit_target", "never"] as const;
export const PROFIT_BASES = ["since_last_payout", "since_funded"] as const;

const num = (nullable: boolean, integer = false): ValueKind => ({ kind: "number", nullable, integer });

const DRAWDOWN_TYPE_MEANING =
    "How the drawdown floor follows the balance: end_of_day trails the highest end-of-day balance; intraday trails the highest balance reached at any moment, open profit included; static never moves.";

export const RULE_DEFS: readonly RuleDef[] = [
    // ---------------------------------------------------------------- account
    {
        group: "account",
        key: "size",
        label: "Account size",
        unit: "usd",
        meaning: "The account's nominal size: the balance the evaluation starts at.",
        value: num(false),
    },
    {
        group: "account",
        key: "instant_funding",
        label: "Instant funding",
        unit: "flag",
        meaning: "True when the plan has no evaluation: the fee buys a funded account directly.",
        value: { kind: "boolean" },
    },
    {
        group: "account",
        key: "trading_day_start",
        label: "Trading day starts",
        unit: "clock_new_york",
        meaning:
            "When the firm's trading day begins. A trade after this time counts toward the next trading day for every daily rule: daily loss, consistency, winning days and minimum days.",
        value: { kind: "clock" },
    },
    {
        group: "account",
        key: "trading_hours",
        label: "Trading hours",
        unit: "time_window",
        meaning:
            "The hours in which the account may hold positions and trade, New York time; null when it may trade whenever the exchange is open.",
        value: { kind: "time_window", nullable: true },
    },

    // ------------------------------------------------------------- evaluation
    {
        group: "evaluation",
        key: "profit_target",
        label: "Profit target",
        unit: "usd",
        meaning: "The profit needed to pass the evaluation.",
        value: num(false),
    },
    {
        group: "evaluation",
        key: "max_drawdown",
        label: "Maximum drawdown",
        unit: "usd",
        meaning: "The drawdown: the floor sits this far below the balance it follows (see drawdown_type), and reaching it fails the evaluation.",
        value: num(false),
    },
    {
        group: "evaluation",
        key: "drawdown_type",
        label: "Drawdown type",
        unit: "choice",
        meaning: DRAWDOWN_TYPE_MEANING,
        value: { kind: "choice", options: DRAWDOWN_TYPES },
    },
    {
        group: "evaluation",
        key: "drawdown_stops_at",
        label: "Trailing drawdown stops at",
        unit: "choice",
        meaning:
            "Where a trailing floor stops rising: at the starting balance, at the balance of the profit target, or never.",
        value: { kind: "choice", options: EVAL_DRAWDOWN_STOPS },
    },
    {
        group: "evaluation",
        key: "daily_loss_limit",
        label: "Daily loss limit",
        unit: "usd",
        meaning: "The most the account may lose in one trading day; null when the plan has none.",
        value: num(true),
    },
    {
        group: "evaluation",
        key: "consistency_max_day_pct",
        label: "Consistency",
        unit: "percent",
        meaning:
            "The largest share of the total profit one trading day may contribute when the evaluation passes; null when the plan has no consistency rule.",
        value: num(true),
    },
    {
        group: "evaluation",
        key: "min_trading_days",
        label: "Minimum trading days",
        unit: "trading_days",
        meaning: "Trading days needed before the evaluation can pass; null when there is no minimum.",
        value: num(true, true),
    },
    {
        group: "evaluation",
        key: "time_limit_days",
        label: "Time limit",
        unit: "calendar_days",
        meaning: "Calendar days the evaluation may run before it expires; null when it has no time limit.",
        value: num(true, true),
    },
    {
        group: "evaluation",
        key: "max_contracts",
        label: "Maximum contracts",
        unit: "contracts",
        meaning: "The most contracts that may be open at once; null when contract_growth sets the limit instead.",
        value: num(true, true),
    },
    {
        group: "evaluation",
        key: "contract_growth",
        label: "Contract limit growth",
        unit: "contract_growth",
        meaning:
            "A contract limit that grows with profit: start contracts, plus one for every add_one_per_usd of profit at the start of the day; null when the limit is fixed.",
        value: { kind: "contract_growth", nullable: true },
    },

    // ----------------------------------------------------------------- funded
    {
        group: "funded",
        key: "starting_balance",
        label: "Funded starting balance",
        unit: "usd",
        meaning:
            "The balance the funded account starts at. 0 means the account counts profit from zero, with its drawdown floor below zero.",
        value: num(false),
    },
    {
        group: "funded",
        key: "max_drawdown",
        label: "Maximum drawdown",
        unit: "usd",
        meaning: "The drawdown: the floor sits this far below the balance it follows (see drawdown_type), and reaching it closes the funded account.",
        value: num(false),
    },
    {
        group: "funded",
        key: "drawdown_type",
        label: "Drawdown type",
        unit: "choice",
        meaning: DRAWDOWN_TYPE_MEANING,
        value: { kind: "choice", options: DRAWDOWN_TYPES },
    },
    {
        group: "funded",
        key: "drawdown_stops_above_start",
        label: "Trailing drawdown stops at",
        unit: "usd",
        meaning:
            "A trailing floor stops rising once it reaches the funded starting balance plus this amount; 0 means it stops at the funded starting balance.",
        value: num(false),
    },
    {
        group: "funded",
        key: "drawdown_after_payout",
        label: "Drawdown after a payout",
        unit: "payout_lock",
        meaning:
            "After the first payout, or after every payout, the floor moves to the funded starting balance plus floor_above_start; null when payouts do not move the floor.",
        value: { kind: "payout_lock", nullable: true },
    },
    {
        group: "funded",
        key: "daily_loss_limit",
        label: "Daily loss limit",
        unit: "usd",
        meaning: "The most the account may lose in one trading day; null when the plan has none.",
        value: num(true),
    },
    {
        group: "funded",
        key: "max_contracts",
        label: "Maximum contracts",
        unit: "contracts",
        meaning:
            "The most contracts that may be open at once; null when contract_scaling or contract_growth sets the limit instead.",
        value: num(true, true),
    },
    {
        group: "funded",
        key: "contract_scaling",
        label: "Contract scaling",
        unit: "contract_scaling",
        meaning:
            "The contract limit by profit above the funded starting balance, read at the start of each day: each step applies once that profit reaches its profit_above; null when there is no scaling plan.",
        value: { kind: "contract_scaling", nullable: true },
    },
    {
        group: "funded",
        key: "contract_growth",
        label: "Contract limit growth",
        unit: "contract_growth",
        meaning:
            "A contract limit that grows with profit: start contracts, plus one for every add_one_per_usd of profit at the start of the day; null when the limit is fixed.",
        value: { kind: "contract_growth", nullable: true },
    },
    {
        group: "funded",
        key: "reduced_size_until_buffer",
        label: "Reduced size until the buffer",
        unit: "reduced_size",
        meaning:
            "Until the balance first reaches the funded starting balance plus until_profit_above, only this fraction of max_contracts may be open (rounded down, at least one); null when the full limit applies from the start.",
        value: { kind: "reduced_size", nullable: true },
    },

    // ---------------------------------------------------------------- payouts
    {
        group: "payouts",
        key: "min_trading_days",
        label: "Trading days between payouts",
        unit: "trading_days",
        meaning:
            "Trading days needed since the last payout (since funding, for the first) before a payout can be requested; null when there is no minimum.",
        value: num(true, true),
        byPayout: true,
    },
    {
        group: "payouts",
        key: "min_calendar_days_between",
        label: "Calendar days between payouts",
        unit: "calendar_days",
        meaning:
            "Calendar days needed since the last payout (since funding, for the first) before a payout can be requested; null when there is no such rule.",
        value: num(true, true),
    },
    {
        group: "payouts",
        key: "min_winning_days",
        label: "Winning days",
        unit: "trading_days",
        meaning: "Winning days needed since the last payout before a payout can be requested; null when not required.",
        value: num(true, true),
        byPayout: true,
    },
    {
        group: "payouts",
        key: "winning_day_min_profit",
        label: "A winning day makes at least",
        unit: "usd",
        meaning: "The profit a trading day must make to count as a winning day; null when winning days are not required.",
        value: num(true),
        byPayout: true,
    },
    {
        group: "payouts",
        key: "consistency_max_day_pct",
        label: "Payout consistency",
        unit: "percent",
        meaning:
            "The largest share of the counted profit (see profit_basis) one trading day since the last payout may contribute before a payout is allowed; null when there is no such rule.",
        value: num(true),
        byPayout: true,
    },
    {
        group: "payouts",
        key: "profit_basis",
        label: "Profit counted from",
        unit: "choice",
        meaning:
            "Where the profit counted toward a payout is measured from: the last payout (since_last_payout) or the start of the funded account (since_funded).",
        value: { kind: "choice", options: PROFIT_BASES },
        byPayout: true,
    },
    {
        group: "payouts",
        key: "min_profit",
        label: "Profit before a payout",
        unit: "usd",
        meaning:
            "The profit, counted from profit_basis, needed before a payout can be requested; null when there is no minimum.",
        value: num(true),
        byPayout: true,
    },
    {
        group: "payouts",
        key: "buffer",
        label: "Buffer kept in the account",
        unit: "usd",
        meaning:
            "Profit above the funded starting balance that must stay in the account; a payout comes only from profit above it. 0 means no buffer.",
        value: num(false),
        byPayout: true,
    },
    {
        group: "payouts",
        key: "max_payout",
        label: "Largest payout",
        unit: "usd",
        meaning: "The largest single payout; null when there is no fixed cap.",
        value: num(true),
        byPayout: true,
    },
    {
        group: "payouts",
        key: "max_payout_pct_of_profit",
        label: "Payout share of profit",
        unit: "percent",
        meaning:
            "A payout may take at most this share of the profit above the buffer; null when the whole profit above the buffer may be paid out.",
        value: num(true),
        byPayout: true,
    },
    {
        group: "payouts",
        key: "max_payout_pct_of_balance",
        label: "Payout share of the balance",
        unit: "percent",
        meaning: "A payout may be at most this share of the account balance; null when there is no such cap.",
        value: num(true),
        byPayout: true,
    },
    {
        group: "payouts",
        key: "max_payout_multiple_of_recent_profit",
        label: "Payout multiple of recent profit",
        unit: "multiple",
        meaning: "A payout may be at most this multiple of the profit made since the last payout; null when there is no such cap.",
        value: num(true),
        byPayout: true,
    },
    {
        group: "payouts",
        key: "profit_split_pct",
        label: "Profit split",
        unit: "percent",
        meaning: "The trader's share of each payout.",
        value: num(false),
        byPayout: true,
    },
    {
        group: "payouts",
        key: "lifetime_max_payouts",
        label: "Payouts before the account closes",
        unit: "count",
        meaning: "The funded account closes after this many payouts; null when there is no such limit.",
        value: num(true, true),
    },
    {
        group: "payouts",
        key: "lifetime_max_payout_usd",
        label: "Total payouts before the account closes",
        unit: "usd",
        meaning: "The funded account closes once its payouts add up to this amount; null when there is no such limit.",
        value: num(true),
    },

    // ----------------------------------------------------------------- prices
    {
        group: "prices",
        key: "evaluation_fee",
        label: "Evaluation fee",
        unit: "usd",
        meaning: "The price of the evaluation, or of the account itself on an instant-funding plan.",
        value: num(false),
    },
    {
        group: "prices",
        key: "recurring_fee",
        label: "Recurring fee",
        unit: "usd",
        meaning:
            "Charged again every recurring_fee_every_days while the evaluation is open; null when the evaluation fee is paid once.",
        value: num(true),
    },
    {
        group: "prices",
        key: "recurring_fee_every_days",
        label: "Recurring fee period",
        unit: "calendar_days",
        meaning: "How often the recurring fee is charged; null when there is no recurring fee.",
        value: num(true, true),
    },
    {
        group: "prices",
        key: "reset_fee",
        label: "Reset fee",
        unit: "usd",
        meaning: "The price to restart a failed evaluation; null when the plan offers no reset and a new evaluation is bought instead.",
        value: num(true),
    },
    {
        group: "prices",
        key: "activation_fee",
        label: "Activation fee",
        unit: "usd",
        meaning: "Charged once when the account becomes funded; 0 when there is none.",
        value: num(false),
    },
];

export const RULE_GROUPS: readonly RuleGroup[] = ["account", "evaluation", "funded", "payouts"];

/** "evaluation.profit_target": the id a citation names a rule by. */
export const ruleId = (d: Pick<RuleDef, "group" | "key">): string => `${d.group}.${d.key}`;

export const RULE_DEF_BY_ID: ReadonlyMap<string, RuleDef> = new Map(RULE_DEFS.map((d) => [ruleId(d), d]));

export function defsOf(group: RuleGroup | PriceGroup): RuleDef[] {
    return RULE_DEFS.filter((d) => d.group === group);
}
