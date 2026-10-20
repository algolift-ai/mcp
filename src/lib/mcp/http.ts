// GENERATED from the AlgoLift app by scripts/oss/mcp/sync.mts. Do not edit here: change the app, then sync.
// src/lib/mcp/http.ts
//
// The AlgoLift MCP server over Streamable HTTP, stateless: each POST carries
// JSON-RPC and gets its answer as one JSON body (the transport lets a server
// answer with application/json instead of an event stream). No session, no
// server-sent events, no GET stream, nothing kept between requests, which is
// all a read-only toolset needs. Web-standard Request and Response, so it runs
// in a Next.js route (the app's /api/mcp) or any fetch-style server; the open
// repo's tests drive it with the official MCP SDK client.
//
// PURE (no I/O beyond the request it is given). No em dashes in any string.

import { CARD_CAPABILITIES } from "./apps/index";
import { SERVER_ICONS, UnknownToolError, type Toolset } from "./toolset";

/** The protocol versions this server speaks, newest first. The open repo's tests hold them to the SDK's. */
export const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"] as const;
export const LATEST_PROTOCOL_VERSION = PROTOCOL_VERSIONS[0];

const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
/** MCP's "Resource not found". */
const RESOURCE_NOT_FOUND = -32002;

type Id = string | number | null;

interface RpcResponse {
    jsonrpc: "2.0";
    id: Id;
    result?: unknown;
    error?: { code: number; message: string };
}

export interface HttpOptions {
    /** The largest request body read, in bytes. */
    maxBodyBytes: number;
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...extra } });
}

const rpcError = (id: Id, code: number, message: string): RpcResponse => ({ jsonrpc: "2.0", id, error: { code, message } });

function isObject(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** One JSON-RPC message: a response for a request, null for a notification (or a client's response). */
export function handleMessage(toolset: Toolset, msg: unknown): RpcResponse | null {
    if (!isObject(msg) || msg.jsonrpc !== "2.0") return rpcError(null, INVALID_REQUEST, "Not a JSON-RPC 2.0 message.");
    const hasId = "id" in msg && (typeof msg.id === "string" || typeof msg.id === "number");
    if (typeof msg.method !== "string") return hasId ? rpcError(msg.id as Id, INVALID_REQUEST, "No method.") : null;
    if (!hasId) return null; // a notification: notifications/initialized, cancelled ... nothing to do
    const id = msg.id as Id;
    const params = isObject(msg.params) ? msg.params : {};
    switch (msg.method) {
        case "initialize": {
            const asked = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
            const version = (PROTOCOL_VERSIONS as readonly string[]).includes(asked) ? asked : LATEST_PROTOCOL_VERSION;
            return {
                jsonrpc: "2.0",
                id,
                result: {
                    protocolVersion: version,
                    // Tools, plus the in-chat cards: resources and the MCP Apps extension.
                    capabilities: { tools: { listChanged: false }, ...CARD_CAPABILITIES },
                    serverInfo: { ...toolset.server, icons: SERVER_ICONS },
                    instructions: toolset.instructions,
                },
            };
        }
        case "ping":
            return { jsonrpc: "2.0", id, result: {} };
        case "tools/list":
            return { jsonrpc: "2.0", id, result: { tools: toolset.tools } };
        case "resources/list":
            return { jsonrpc: "2.0", id, result: { resources: toolset.resources } };
        case "resources/templates/list":
            return { jsonrpc: "2.0", id, result: { resourceTemplates: [] } };
        case "resources/read": {
            if (typeof params.uri !== "string") return rpcError(id, INVALID_PARAMS, "resources/read needs a uri.");
            const contents = toolset.readResource(params.uri);
            if (!contents) return rpcError(id, RESOURCE_NOT_FOUND, `Resource not found: ${params.uri.slice(0, 200)}`);
            return { jsonrpc: "2.0", id, result: { contents: [contents] } };
        }
        case "tools/call": {
            if (typeof params.name !== "string") return rpcError(id, INVALID_PARAMS, "tools/call needs a tool name.");
            try {
                return { jsonrpc: "2.0", id, result: toolset.call(params.name, params.arguments) };
            } catch (e) {
                if (e instanceof UnknownToolError) return rpcError(id, INVALID_PARAMS, e.message);
                return rpcError(id, -32603, "Internal error.");
            }
        }
        default:
            return rpcError(id, METHOD_NOT_FOUND, `Method not found: ${msg.method}`);
    }
}

/** A Streamable HTTP request to the MCP endpoint, answered statelessly. */
export async function handleMcpHttp(req: Request, toolset: Toolset, opts: HttpOptions): Promise<Response> {
    if (req.method !== "POST") {
        // No server-to-client stream (GET) and no session to end (DELETE).
        return new Response(null, { status: 405, headers: { allow: "POST" } });
    }
    const type = req.headers.get("content-type") ?? "";
    if (!type.toLowerCase().includes("application/json")) return json(rpcError(null, INVALID_REQUEST, "Send JSON (content-type: application/json)."), 415);
    const version = req.headers.get("mcp-protocol-version");
    if (version && !(PROTOCOL_VERSIONS as readonly string[]).includes(version)) {
        return json(rpcError(null, INVALID_REQUEST, `Unsupported protocol version ${version}; this server speaks ${PROTOCOL_VERSIONS.join(", ")}.`), 400);
    }
    const declared = Number(req.headers.get("content-length") ?? "0");
    if (declared > opts.maxBodyBytes) return json(rpcError(null, INVALID_REQUEST, `The request is larger than ${opts.maxBodyBytes} bytes.`), 413);
    const text = await req.text();
    if (new TextEncoder().encode(text).length > opts.maxBodyBytes) return json(rpcError(null, INVALID_REQUEST, `The request is larger than ${opts.maxBodyBytes} bytes.`), 413);

    let body: unknown;
    try {
        body = JSON.parse(text);
    } catch {
        return json(rpcError(null, PARSE_ERROR, "The body is not JSON."), 400);
    }
    if (Array.isArray(body)) {
        if (!body.length) return json(rpcError(null, INVALID_REQUEST, "An empty batch."), 400);
        const out = body.map((m) => handleMessage(toolset, m)).filter((r): r is RpcResponse => r !== null);
        return out.length ? json(out) : new Response(null, { status: 202 });
    }
    const out = handleMessage(toolset, body);
    return out ? json(out) : new Response(null, { status: 202 });
}
