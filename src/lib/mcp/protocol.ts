// GENERATED from the AlgoLift app by scripts/oss/mcp/sync.mts. Do not edit here: change the app, then sync.
// src/lib/mcp/protocol.ts
//
// THE ALGOLIFT MCP SERVER's core (the open-source program's repo #5,
// plan/features/open-source-program.md, O6): the shapes every tool shares.
// The core is transport-free: the open repo's stdio server (the official MCP
// SDK) and the app's optional hosted endpoint (`http.ts`, /api/mcp) both serve
// the same `Toolset`.
//
// ⚠ The open repo (E:/Trading/saas/website/oss/mcp) holds a verbatim copy of
// this folder, written by scripts/oss/mcp/sync.mts. Every file here imports
// only from this folder, ../propRules/ruleDefs, ../propRules/format,
// ../tools/setupOdds/engine and @algolift/indicators (a test holds it), and
// never the database, S3, the engine or any user data: only the open datasets.
//
// PURE. No em dashes in any string: tool text is public copy.

/** The site the honest pointers name. */
export const SITE = "https://www.algolift.ai";

/** A JSON Schema, the subset `args.ts` checks. */
export interface JsonSchema {
    type?: "object" | "array" | "string" | "number" | "integer" | "boolean" | Array<"object" | "array" | "string" | "number" | "integer" | "boolean" | "null">;
    description?: string;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    additionalProperties?: boolean | JsonSchema;
    items?: JsonSchema;
    enum?: Array<string | number>;
    minimum?: number;
    maximum?: number;
    minLength?: number;
    maxLength?: number;
    minItems?: number;
    maxItems?: number;
    default?: unknown;
}

/** What `tools/list` says about one tool. */
export interface ToolDescriptor {
    name: string;
    title: string;
    description: string;
    inputSchema: JsonSchema & { type: "object" };
    /** The shape of `structuredContent`, for the tools whose answer has a fixed shape (search and fetch). */
    outputSchema?: JsonSchema & { type: "object" };
    /** The in-chat card the tool's result renders in, on hosts with MCP Apps (`{ ui: { resourceUri } }`, apps/index.ts). */
    _meta?: Record<string, unknown>;
    annotations: {
        title: string;
        readOnlyHint: true;
        destructiveHint: false;
        idempotentHint: true;
        openWorldHint: false;
    };
}

/** A tool's answer, as MCP's `tools/call` returns it. */
export interface ToolResult {
    content: Array<{ type: "text"; text: string }>;
    structuredContent?: Record<string, unknown>;
    isError?: boolean;
    [key: string]: unknown;
}

/** How much one call may ask for. The hosted endpoint runs tighter caps than a local server. */
export interface Limits {
    /** Bars `compute_indicator` takes in one call. */
    indicatorBars: number;
    /** Values per output `compute_indicator` writes into its text answer (the rest stay in structuredContent). */
    indicatorTextValues: number;
    /** Bars `run_setup_odds` takes in one call (the demo bars do not count). */
    setupOddsBars: number;
    /** Characters of CSV `run_setup_odds` takes in one call. */
    setupOddsCsvChars: number;
}

export const LOCAL_LIMITS: Limits = {
    indicatorBars: 20_000,
    indicatorTextValues: 1_000,
    // Setup Odds' MCP caps, SPEC § 10.5 (setupOdds.ts holds the rest of them).
    setupOddsBars: 2_000_000,
    setupOddsCsvChars: 16_777_216,
};

export const HOSTED_LIMITS: Limits = {
    indicatorBars: 5_000,
    indicatorTextValues: 1_000,
    setupOddsBars: 50_000,
    setupOddsCsvChars: 3_500_000,
};

/** One tool: what it says about itself, and what it does. */
export interface ToolDef {
    descriptor: ToolDescriptor;
    run(args: Record<string, unknown>): ToolResult;
}

/** Every tool is read-only: it reads the open datasets handed to it and computes on its arguments, nothing else. */
export function descriptor(name: string, title: string, description: string, inputSchema: JsonSchema & { type: "object" }, outputSchema?: JsonSchema & { type: "object" }): ToolDescriptor {
    return {
        name,
        title,
        description,
        inputSchema,
        ...(outputSchema ? { outputSchema } : {}),
        annotations: { title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    };
}

/**
 * The public algolift.ai pages a document is cited to (paths on SITE). The
 * app builds it from its own page model (src/lib/mcpHosted/sitePages.ts); the
 * open repo ships the same map as data/site-pages.json, written by the sync.
 */
export interface SitePages {
    /** The prop firms hub, "/prop-firms". */
    propHub: string;
    /** The open prop rules dataset's page, "/data/prop-firm-rules". */
    dataset: string;
    /** A firm's page, by the rules dataset's firm slug ("my-funded-futures"). */
    firms: Record<string, string>;
    /** A plan's page, by the rules dataset's plan id ("topstep/50k"). A plan with no page of its own is cited to its firm's. */
    plans: Record<string, string>;
    /** The open indicators page, "/open-source/indicators". */
    indicators: string;
    /** The Setup Odds page, "/tools/setup-odds". */
    setupOdds: string;
    /**
     * The comparison page of two firms, by their dataset slugs sorted and joined
     * with "|" ("apex|topstep" -> "/prop-firms/compare/topstep-vs-apex"). The
     * prop plan card opens it for a comparison of two firms' plans.
     */
    pairs?: Record<string, string>;
}

/** Without a page map: every prop document cites the dataset's page. */
export const DEFAULT_SITE_PAGES: SitePages = {
    propHub: "/prop-firms",
    dataset: "/data/prop-firm-rules",
    firms: {},
    plans: {},
    indicators: "/open-source/indicators",
    setupOdds: "/tools/setup-odds",
    pairs: {},
};

/** A tool's own failure (a bad argument, a plan that does not exist): the model reads it and can try again. */
export class ToolInputError extends Error {}

export function textResult(text: string, structuredContent?: Record<string, unknown>): ToolResult {
    return structuredContent ? { content: [{ type: "text", text }], structuredContent } : { content: [{ type: "text", text }] };
}

export function errorResult(text: string): ToolResult {
    return { content: [{ type: "text", text }], isError: true };
}

/** The one honest pointer at the end of an answer: plain, once, never pushy. */
export function pointer(text: string): string {
    return `\n\n${text}`;
}
