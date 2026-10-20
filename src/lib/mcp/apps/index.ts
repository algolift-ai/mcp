// GENERATED from the AlgoLift app by scripts/oss/mcp/sync.mts. Do not edit here: change the app, then sync.
// src/lib/mcp/apps/index.ts
//
// The AlgoLift MCP server's in-chat cards (Agent Bridge Phase 0b,
// plan/features/agent-bridge.md § 4b): MCP Apps UI resources (the extension
// io.modelcontextprotocol/ui, spec 2026-01-26,
// github.com/modelcontextprotocol/ext-apps specification/2026-01-26/apps.mdx).
//
//   ui://algolift/prop-plans.v1.html   compare_prop_plans, get_prop_plan_rules
//   ui://algolift/setup-odds.v1.html   run_setup_odds
//
// A tool names its card in its descriptor (`_meta.ui.resourceUri`); the host
// reads the card with resources/read, renders it in a sandboxed iframe and
// hands it the tool's result over postMessage. The tool's text result is
// unchanged and stands alone for every host without MCP Apps. Every other
// tool (search and fetch among them) has no card.
//
// Each card is one static HTML document: inline CSS and script, the firms'
// marks as data URIs, the page map. Its declared CSP allows no origin at all
// (no fetch, no script, no image, no frame), and it never calls our API or any
// tool: it draws only the result it is handed. Open in AlgoLift asks the host to
// open a www.algolift.ai page (ChatGPT's `redirect_domains` names that one
// origin, so ChatGPT can treat it as trusted).
//
// The URIs carry a version: a card whose HTML changes in a way an older host
// cache would break gets a new one (OpenAI's guidance: the URI is a cache key).
//
// PURE. No em dashes in any string.

import { DEFAULT_SITE_PAGES, type SitePages } from "../protocol";
import { FIRM_LOGOS } from "./firmLogos.generated";
import { PROP_PLANS_CSS, PROP_PLANS_JS } from "./propPlans";
import { SETUP_ODDS_CSS, SETUP_ODDS_JS } from "./setupOdds";
import { APP_MIME, APPS_EXTENSION, APPS_PROTOCOL_VERSION, cardDocument } from "./shell";

export { APP_MIME, APPS_EXTENSION, APPS_PROTOCOL_VERSION } from "./shell";
export { FIRM_LOGOS } from "./firmLogos.generated";

export const PROP_PLANS_CARD_URI = "ui://algolift/prop-plans.v1.html";
export const SETUP_ODDS_CARD_URI = "ui://algolift/setup-odds.v1.html";

/** What resources/list says about one card. */
export interface CardResource {
    uri: string;
    name: string;
    title: string;
    description: string;
    mimeType: typeof APP_MIME;
    _meta: Record<string, unknown>;
}

/** What resources/read returns for one card. */
export interface CardContents {
    uri: string;
    mimeType: typeof APP_MIME;
    text: string;
    _meta: Record<string, unknown>;
}

interface CardDef {
    uri: string;
    /** The card's id: its config's `card` and its links' utm_campaign. */
    id: string;
    name: string;
    title: string;
    description: string;
    /** What ChatGPT tells the model when the card loads (openai/widgetDescription). */
    widgetDescription: string;
    tools: string[];
    css: string;
    script: string;
    /** Static data the card's script reads, beyond the page map. */
    extra?: Record<string, unknown>;
}

const CARDS: CardDef[] = [
    {
        uri: PROP_PLANS_CARD_URI,
        id: "prop_plans",
        name: "prop-plans-card",
        title: "Prop plan card",
        description: "Draws compare_prop_plans and get_prop_plan_rules: the plans side by side, each rule with its status, the date it was checked and the firm's page, and Open in AlgoLift.",
        widgetDescription:
            "A card showing the prop plans side by side, each value with its verification status, date and the firm's page; values that are NOT VERIFIED are marked. The text result holds the same values, so you need not repeat the table.",
        tools: ["compare_prop_plans", "get_prop_plan_rules"],
        css: PROP_PLANS_CSS,
        script: PROP_PLANS_JS,
        extra: { logos: FIRM_LOGOS },
    },
    {
        uri: SETUP_ODDS_CARD_URI,
        id: "setup_odds",
        name: "setup-odds-card",
        title: "Setup Odds card",
        description: "Draws run_setup_odds: the hit rate with its 95% interval and sample, the baseline, the path to the outcome against the baseline's band, and Open in AlgoLift.",
        widgetDescription:
            "A card showing the Setup Odds result: the hit rate with its 95% interval and sample size, the baseline, the lift and the halves, and a chart of when the outcome happened. The text result holds the same numbers and caveats.",
        tools: ["run_setup_odds"],
        css: SETUP_ODDS_CSS,
        script: SETUP_ODDS_JS,
    },
];

/** The card a tool renders with, if any. */
export function cardUriFor(tool: string): string | null {
    return CARDS.find((c) => c.tools.includes(tool))?.uri ?? null;
}

/** The `_meta` a tool's descriptor carries to name its card (spec: `_meta.ui.resourceUri`; visibility left at its default, model and app). */
export function cardToolMeta(tool: string): Record<string, unknown> | null {
    const uri = cardUriFor(tool);
    return uri ? { ui: { resourceUri: uri } } : null;
}

/** The resource `_meta`: the tightest CSP the spec allows (no origin of any kind), and ChatGPT's link allowlist. */
function resourceMeta(def: CardDef, site: string): Record<string, unknown> {
    return {
        ui: { csp: { connectDomains: [], resourceDomains: [] }, prefersBorder: false },
        // ChatGPT reads its legacy key for one thing the standard has not got: the
        // origins openExternal may open as trusted. The standard fields stay empty here too.
        "openai/widgetCSP": { connect_domains: [], resource_domains: [], redirect_domains: [new URL(site).origin] },
        "openai/widgetDescription": def.widgetDescription,
    };
}

export interface CardSet {
    resources: CardResource[];
    /** A card's contents by URI, or null for a URI this server does not have. */
    read(uri: string): CardContents | null;
}

/** The cards for one server: its version, its site and the page map Open in AlgoLift reads. Built once, served as is. */
export function buildCards(opts: { version: string; site: string; pages?: SitePages }): CardSet {
    const pages = opts.pages ?? DEFAULT_SITE_PAGES;
    const docs = new Map<string, CardContents>();
    const resources: CardResource[] = [];
    for (const def of CARDS) {
        const meta = resourceMeta(def, opts.site);
        const text = cardDocument({
            title: def.title,
            config: { card: def.id, version: opts.version, site: opts.site, protocol: APPS_PROTOCOL_VERSION, pages, ...(def.extra ?? {}) },
            css: def.css,
            script: def.script,
        });
        resources.push({ uri: def.uri, name: def.name, title: def.title, description: def.description, mimeType: APP_MIME, _meta: meta });
        docs.set(def.uri, { uri: def.uri, mimeType: APP_MIME, text, _meta: meta });
    }
    return {
        resources,
        read: (uri) => docs.get(uri) ?? null,
    };
}

/** The server capabilities a server with cards declares: resources, and the extension. */
export const CARD_CAPABILITIES = { resources: { listChanged: false }, extensions: { [APPS_EXTENSION]: {} } } as const;
