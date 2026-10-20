// src/http.ts: `algolift-mcp --http`. The same tools over Streamable HTTP,
// stateless (each POST is answered with one JSON body; no session, no event
// stream), by the handler the AlgoLift app serves at /api/mcp. For clients
// that take a remote server by URL, such as ChatGPT and the OpenAI Responses
// API: run it behind an HTTPS address you control.
//
// It only listens: it makes no outbound request. Calls are capped as the
// hosted endpoint caps them (HOSTED_LIMITS, 4 MB bodies). It has no rate
// limit and no authentication of its own, which a read-only server over
// public data does not need, but a public deployment should sit behind a
// proxy that limits requests.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import { handleMcpHttp, HOSTED_LIMITS, type Toolset } from "./lib/mcp/index";
import { createDefaultToolset } from "./server";

export interface HttpServeOptions {
    /** 0 picks a free port. */
    port: number;
    /** Default 127.0.0.1: only this machine. Use 0.0.0.0 behind a proxy or in a container. */
    host: string;
    /** The endpoint's path, default /mcp. */
    path: string;
    /** Browser origins allowed besides localhost (the MCP transport asks servers to check Origin). */
    allowOrigins: string[];
    maxBodyBytes: number;
    toolset?: Toolset;
}

export const HTTP_DEFAULTS: Omit<HttpServeOptions, "toolset"> = { port: 3000, host: "127.0.0.1", path: "/mcp", allowOrigins: [], maxBodyBytes: 4_000_000 };

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function originAllowed(origin: string | undefined, allow: string[]): boolean {
    if (!origin) return true; // not a browser: a server-side client, such as ChatGPT's
    if (allow.includes(origin)) return true;
    try {
        return LOCAL_HOSTS.has(new URL(origin).hostname);
    } catch {
        return false;
    }
}

function send(res: ServerResponse, status: number, body: string, headers: Record<string, string> = {}) {
    res.writeHead(status, { "content-type": "application/json", ...headers });
    res.end(body);
}

/** The body, or null when it is larger than the cap (read to its end and dropped, so the answer reaches the client). */
function readBody(req: IncomingMessage, max: number): Promise<Buffer | null> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        let size = 0;
        req.on("data", (c: Buffer) => {
            size += c.length;
            if (size <= max) chunks.push(c);
        });
        req.on("end", () => resolve(size > max ? null : Buffer.concat(chunks)));
        req.on("error", reject);
    });
}

/** Starts the HTTP server; resolves once it listens. */
export function startHttpServer(options: Partial<HttpServeOptions> = {}): Promise<Server> {
    const opts = { ...HTTP_DEFAULTS, ...options };
    const toolset = opts.toolset ?? createDefaultToolset({ limits: HOSTED_LIMITS });
    const server = createServer(async (req, res) => {
        try {
            const url = new URL(req.url ?? "/", "http://localhost");
            if (url.pathname !== opts.path) return send(res, 404, JSON.stringify({ error: `Not found: the MCP endpoint is ${opts.path}` }));
            if (!originAllowed(req.headers.origin, opts.allowOrigins)) return send(res, 403, JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Origin not allowed." } }));
            const body = req.method === "POST" ? await readBody(req, opts.maxBodyBytes) : Buffer.alloc(0);
            if (body === null) return send(res, 413, JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32600, message: `The request is larger than ${opts.maxBodyBytes} bytes.` } }));
            const headers = new Headers();
            for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
            const request = new Request(`http://localhost${url.pathname}`, { method: req.method, headers, body: req.method === "POST" ? new Uint8Array(body) : undefined });
            const response = await handleMcpHttp(request, toolset, { maxBodyBytes: opts.maxBodyBytes });
            const out: Record<string, string> = {};
            response.headers.forEach((v, k) => (out[k] = v));
            res.writeHead(response.status, out);
            res.end(Buffer.from(await response.arrayBuffer()));
        } catch {
            if (!res.headersSent) send(res, 500, JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32603, message: "Internal error." } }));
            else res.end();
        }
    });
    return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(opts.port, opts.host, () => resolve(server));
    });
}
