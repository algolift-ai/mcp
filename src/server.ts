// src/server.ts
//
// The AlgoLift MCP server: the tool core in src/lib/mcp (copied from the
// AlgoLift app, which serves the same tools on its optional hosted endpoint)
// wired to the official MCP TypeScript SDK. Every tool is read-only and reads
// only the data bundled in this package: the prop firm rules (data/), the
// @algolift/indicators package and Setup Odds' engine with its calendar, and
// for search and fetch the algolift.ai pages each document is cited to
// (data/site-pages.json). It makes no network call and reads no file outside
// the package.
//
// The SDK's low-level `Server` is used because the tools carry plain JSON
// Schemas (one definition serves the stdio server, the hosted endpoint and
// the argument check), which is the use the SDK keeps `Server` for.
//
// It also serves the in-chat cards (src/lib/mcp/apps): MCP Apps UI resources
// that a host with the extension (io.modelcontextprotocol/ui) renders beside
// the prop plan and Setup Odds answers. A host without it reads the text
// answers, which are unchanged.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
    CallToolRequestSchema,
    ErrorCode,
    ListResourcesRequestSchema,
    ListResourceTemplatesRequestSchema,
    ListToolsRequestSchema,
    McpError,
    ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import calendarJson from "../data/setup-odds-calendar.json";
import rulesJson from "../data/prop-firm-rules.json";
import sitePagesJson from "../data/site-pages.json";
import { CARD_CAPABILITIES, createToolset, LOCAL_LIMITS, SERVER_ICONS, SITE, UnknownToolError, type Limits, type RulesBundle, type SitePages, type Toolset } from "./lib/mcp/index";
import { loadCalendar } from "./lib/tools/setupOdds/engine/index";

/** This package's version (a test holds it to package.json). */
export const VERSION = "0.1.1";

/** The bundled prop firm rules: the public dataset's release, and the rules themselves. */
export const PROP_RULES = rulesJson as unknown as { source: string; license: string; dataset_version: string | null; bundle: RulesBundle };

/** The algolift.ai pages search and fetch cite, as the AlgoLift app builds them. */
export const SITE_PAGES = sitePagesJson as SitePages;

export interface CreateOptions {
    limits?: Limits;
    /** Today's date, YYYY-MM-DD, for the prop rules' staleness check (tests). */
    today?: () => string;
}

/** The tools, on the bundled data. */
export function createDefaultToolset(opts: CreateOptions = {}): Toolset {
    return createToolset({
        server: { name: "algolift", title: "AlgoLift", version: VERSION, websiteUrl: SITE },
        propRules: { bundle: PROP_RULES.bundle, datasetVersion: PROP_RULES.dataset_version, servedFrom: `bundled in @algolift/mcp ${VERSION}` },
        setupOddsCalendar: loadCalendar(calendarJson),
        limits: opts.limits ?? LOCAL_LIMITS,
        today: opts.today,
        sitePages: SITE_PAGES,
    });
}

/** An MCP server over the tools, ready to connect to a transport. */
export function createAlgoLiftServer(toolset: Toolset = createDefaultToolset()): Server {
    const server = new Server(
        { name: toolset.server.name, title: toolset.server.title, version: toolset.server.version, websiteUrl: toolset.server.websiteUrl, icons: SERVER_ICONS },
        { capabilities: { tools: { listChanged: false }, ...CARD_CAPABILITIES }, instructions: toolset.instructions },
    );
    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: toolset.tools as never }));
    server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: toolset.resources as never }));
    server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({ resourceTemplates: [] }));
    server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
        const contents = toolset.readResource(req.params.uri);
        // MCP's "Resource not found".
        if (!contents) throw new McpError(-32002, `Resource not found: ${req.params.uri.slice(0, 200)}`);
        return { contents: [contents] };
    });
    server.setRequestHandler(CallToolRequestSchema, async (req) => {
        try {
            return toolset.call(req.params.name, req.params.arguments);
        } catch (e) {
            if (e instanceof UnknownToolError) throw new McpError(ErrorCode.InvalidParams, e.message);
            throw e;
        }
    });
    return server;
}
