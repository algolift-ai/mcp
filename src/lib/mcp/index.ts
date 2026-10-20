// GENERATED from the AlgoLift app by scripts/oss/mcp/sync.mts. Do not edit here: change the app, then sync.
// src/lib/mcp/index.ts
//
// The AlgoLift MCP server's core (the open-source program's repo #5): read-only
// tools over the open prop firm rules, @algolift/indicators and Setup Odds,
// plus search and fetch over the same content (the shape ChatGPT's deep
// research reads), served by the open repo's stdio server and the app's
// optional /api/mcp, with in-chat cards (MCP Apps UI resources, ./apps) for
// the prop plan and Setup Odds answers on hosts that render them.
// Copied verbatim into the open repo by scripts/oss/mcp/sync.mts.

export * from "./protocol";
export { checkArgs } from "./args";
export { propRulesTools, resolvePlan, tokens, STATUS_TAG, STATUS_LEGEND, RULES_PAGE_URL } from "./propRules";
export type { PlanFile, PropRulesSource, RuleLeaf, RulesBundle, StatusCounts } from "./propRules";
export { indicatorTools, findIndicator, searchScore, toColumns } from "./indicators";
export { setupOddsTools } from "./setupOdds";
export { researchTools, searchWords, SEARCH_RESULTS } from "./research";
export type { FetchedDocument, ResearchInput, SearchResult } from "./research";
export { createToolset, INSTRUCTIONS, SERVER_ICONS, UnknownToolError } from "./toolset";
export type { ServerInfo, Toolset, ToolsetOptions } from "./toolset";
export { handleMcpHttp, handleMessage, PROTOCOL_VERSIONS, LATEST_PROTOCOL_VERSION } from "./http";
export { APP_MIME, APPS_EXTENSION, APPS_PROTOCOL_VERSION, buildCards, CARD_CAPABILITIES, cardToolMeta, cardUriFor, FIRM_LOGOS, PROP_PLANS_CARD_URI, SETUP_ODDS_CARD_URI } from "./apps/index";
export type { CardContents, CardResource, CardSet } from "./apps/index";
export type { HttpOptions } from "./http";
