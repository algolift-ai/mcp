// src/cli.ts: `npx -y @algolift/mcp` (or `algolift-mcp`). The MCP server over
// stdio, for Claude Desktop, Cursor and any other MCP client. Speaks only on
// stdin and stdout; anything for a person goes to stderr.
//
// `algolift-mcp --http [--port 3000] [--host 127.0.0.1] [--path /mcp]
// [--allow-origin <origin>]...` serves the same tools over Streamable HTTP
// instead (src/http.ts), for clients that take a server by URL.

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { HTTP_DEFAULTS, startHttpServer } from "./http";
import { createAlgoLiftServer, PROP_RULES, VERSION } from "./server";

const args = process.argv.slice(2);
const arg = args[0];
if (arg === "--version" || arg === "-v") {
    process.stdout.write(`${VERSION}\n`);
    process.exit(0);
}
if (arg === "--help" || arg === "-h") {
    process.stdout.write(
        [
            `@algolift/mcp ${VERSION}: AlgoLift's read-only MCP server.`,
            "",
            "Run by an MCP client over stdio, for example in Claude Desktop's config:",
            '  { "mcpServers": { "algolift": { "command": "npx", "args": ["-y", "@algolift/mcp"] } } }',
            "",
            "Or over Streamable HTTP, for clients that take a server by URL (put it behind HTTPS):",
            `  algolift-mcp --http [--port ${HTTP_DEFAULTS.port}] [--host ${HTTP_DEFAULTS.host}] [--path ${HTTP_DEFAULTS.path}] [--allow-origin <origin>]`,
            "",
            "Tools: list_prop_firms, get_prop_plan_rules, compare_prop_plans, list_indicators,",
            "describe_indicator, compute_indicator, list_setup_presets, describe_setup_query_language,",
            "run_setup_odds, search, fetch. No account, no API key, no outbound network calls.",
            `Prop firm rules dataset: ${PROP_RULES.dataset_version ?? "unversioned"} (${PROP_RULES.source}).`,
            "",
        ].join("\n"),
    );
    process.exit(0);
}

function flag(name: string): string | undefined {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
}

if (args.includes("--http")) {
    const port = Number(flag("--port") ?? HTTP_DEFAULTS.port);
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
        process.stderr.write("--port must be a whole number from 0 to 65535.\n");
        process.exit(2);
    }
    const host = flag("--host") ?? HTTP_DEFAULTS.host;
    const raw = flag("--path") ?? HTTP_DEFAULTS.path;
    const path = raw.startsWith("/") ? raw : `/${raw}`;
    const allowOrigins = args.flatMap((a, i) => (a === "--allow-origin" && args[i + 1] ? [args[i + 1]] : []));
    const server = await startHttpServer({ port, host, path, allowOrigins });
    const address = server.address();
    const bound = typeof address === "object" && address ? address.port : port;
    process.stderr.write(`AlgoLift MCP server ${VERSION} listening on http://${host.includes(":") ? `[${host}]` : host}:${bound}${path} (Streamable HTTP, stateless)\n`);
} else {
    const server = createAlgoLiftServer();
    await server.connect(new StdioServerTransport());
    process.stderr.write(`AlgoLift MCP server ${VERSION} running on stdio\n`);
}
