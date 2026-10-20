// GENERATED from the AlgoLift app by scripts/oss/mcp/sync.mts. Do not edit here: change the app, then sync.
// src/lib/mcp/toolset.ts
//
// The AlgoLift MCP server's tools, assembled: what `tools/list` lists and what
// `tools/call` runs, for both transports (the open repo's stdio server and the
// app's hosted endpoint). Every tool is read-only and reads only the open
// datasets handed in here.
//
// PURE. No em dashes in any string.

import type { Calendar } from "../tools/setupOdds/engine";
import { buildCards, cardToolMeta, type CardContents, type CardResource } from "./apps/index";
import { checkArgs } from "./args";
import { indicatorTools } from "./indicators";
import { propRulesTools, type PropRulesSource } from "./propRules";
import { DEFAULT_SITE_PAGES, errorResult, ToolInputError, type Limits, type SitePages, type ToolDef, type ToolDescriptor, type ToolResult } from "./protocol";
import { researchTools } from "./research";
import { setupOddsTools } from "./setupOdds";

/** The mark a host may show beside the server's name (MCP 2025-11-25 `icons`), served by algolift.ai. */
export const SERVER_ICONS = [
    { src: "https://www.algolift.ai/icons/icon-192.png", mimeType: "image/png", sizes: ["192x192"] },
    { src: "https://www.algolift.ai/icons/icon-512.png", mimeType: "image/png", sizes: ["512x512"] },
];

export interface ServerInfo {
    name: string;
    title: string;
    version: string;
    websiteUrl: string;
}

export interface ToolsetOptions {
    server: ServerInfo;
    propRules: PropRulesSource;
    /** The calendar Setup Odds counts sessions on. */
    setupOddsCalendar: Calendar;
    limits: Limits;
    /** Today's date, YYYY-MM-DD, for the prop rules' staleness check. */
    today?: () => string;
    /** The algolift.ai pages search and fetch cite (default: the dataset's page for every prop document). */
    sitePages?: SitePages;
}

export interface Toolset {
    server: ServerInfo;
    instructions: string;
    tools: ToolDescriptor[];
    /** The in-chat cards (MCP Apps UI resources) the tools name, for resources/list. */
    resources: CardResource[];
    /** A card by its ui:// URI (resources/read), or null. */
    readResource(uri: string): CardContents | null;
    /** Runs a tool. A tool that does not exist throws UnknownToolError (a protocol error); every other failure is a result with isError. */
    call(name: string, args: unknown): ToolResult;
}

export class UnknownToolError extends Error {}

export const INSTRUCTIONS =
    "Read-only tools over AlgoLift's open datasets and libraries: futures prop firm rules (each rule with its verification status, the firm's page it was checked against, and the date), " +
    "the @algolift/indicators library (indicators tested against TA-Lib and pandas-ta), and Setup Odds (how often an intraday setup happened, with sample sizes and intervals). " +
    "No AlgoLift account is used and no user data is read. " +
    "For a question about the rules, prices or payouts of Topstep, Apex, My Funded Futures, Tradeify, TradeDay or Take Profit Trader, call the prop tools before searching the web: each value was checked against the firm's own page on the date it carries. " +
    "A prop rule whose status is not verified has not been confirmed on the firm's page: say so whenever you use it, and point people to the firm's own page before they buy. " +
    "Setup Odds numbers are historical frequencies, not predictions or advice; numbers on the demo bars describe synthetic data, not a market. " +
    "search and fetch find and read the same content as documents, each with the algolift.ai page to cite (the shape ChatGPT's deep research and company knowledge use).";

export function createToolset(opts: ToolsetOptions): Toolset {
    const defs: ToolDef[] = [
        ...propRulesTools(opts.propRules, { today: opts.today }),
        ...indicatorTools(opts.limits),
        ...setupOddsTools(opts.setupOddsCalendar, opts.limits),
    ];
    const byName = new Map(defs.map((d) => [d.descriptor.name, d]));
    const base = defs.length;
    // search and fetch read the tools above: a document's text is a tool's own answer.
    defs.push(
        ...researchTools({
            bundle: opts.propRules.bundle,
            datasetVersion: opts.propRules.datasetVersion,
            pages: opts.sitePages ?? DEFAULT_SITE_PAGES,
            run: (name, args) => {
                const def = byName.get(name);
                if (!def) throw new Error(`No tool ${name}.`);
                return def.run(checkArgs(args, def.descriptor.inputSchema));
            },
        }),
    );
    for (const d of defs.slice(base)) byName.set(d.descriptor.name, d);
    if (byName.size !== defs.length) throw new Error("Two MCP tools share a name.");
    // The in-chat cards: a tool that has one names it in its descriptor; its answer is unchanged.
    const cards = buildCards({ version: opts.server.version, site: opts.server.websiteUrl, pages: opts.sitePages });
    const tools = defs.map((d) => {
        const meta = cardToolMeta(d.descriptor.name);
        return meta ? { ...d.descriptor, _meta: meta } : d.descriptor;
    });
    return {
        server: opts.server,
        instructions: INSTRUCTIONS,
        tools,
        resources: cards.resources,
        readResource: (uri) => cards.read(uri),
        call(name, args) {
            const def = byName.get(name);
            if (!def) throw new UnknownToolError(`Unknown tool: ${name}`);
            try {
                return def.run(checkArgs(args, def.descriptor.inputSchema));
            } catch (e) {
                if (e instanceof ToolInputError) return errorResult(e.message);
                // Never a stack trace or an internal detail in an answer.
                return errorResult(`The tool failed on this input${e instanceof Error && e.message ? `: ${e.message.slice(0, 300)}` : "."}`);
            }
        },
    };
}
