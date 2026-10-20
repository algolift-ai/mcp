// test/transports.test.ts: the official MCP SDK client against every way the
// tools are served. The built server (dist/cli.js) over stdio, as Claude
// Desktop and Cursor run it; the stateless Streamable HTTP handler the
// AlgoLift app serves at /api/mcp, driven in process through the SDK's HTTP
// client; and the built server's own HTTP mode (`--http`) on a real port, as
// ChatGPT or the OpenAI Responses API would reach it behind HTTPS. The SDK's
// client checks each search and fetch answer against the tool's output schema,
// and each transport serves the in-chat cards (MCP Apps UI resources).

import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import * as path from "node:path";
import { after, before, test } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { LATEST_PROTOCOL_VERSION as SDK_LATEST, SUPPORTED_PROTOCOL_VERSIONS } from "@modelcontextprotocol/sdk/types.js";

import { handleMcpHttp, HOSTED_LIMITS, PROTOCOL_VERSIONS } from "../src/lib/mcp/index";
import { createDefaultToolset } from "../src/server";

type Text = { type: string; text: string };
const textOf = (r: unknown) => ((r as { content?: Text[] }).content ?? []).map((c) => c.text).join("\n");
const TOOL_COUNT = 11;

/** OpenAI's search and fetch shapes (developers.openai.com/api/docs/mcp), through a real client. */
async function checkSearchAndFetch(client: Client) {
    const { tools } = await client.listTools();
    const search = tools.find((t) => t.name === "search")!;
    const fetchTool = tools.find((t) => t.name === "fetch")!;
    assert.deepEqual(search.inputSchema.required, ["query"]);
    assert.deepEqual(Object.keys(search.inputSchema.properties ?? {}), ["query"]);
    assert.deepEqual(fetchTool.inputSchema.required, ["id"]);
    assert.deepEqual(Object.keys(fetchTool.inputSchema.properties ?? {}), ["id"]);
    for (const t of [search, fetchTool]) {
        assert.equal(t.annotations?.readOnlyHint, true);
        assert.ok(t.outputSchema, `${t.name} declares its output`);
    }

    const s = await client.callTool({ name: "search", arguments: { query: "Topstep 50K rules" } });
    assert.ok(!s.isError, textOf(s));
    const results = (s.structuredContent as { results: Array<Record<string, string>> }).results;
    assert.deepEqual(JSON.parse(textOf(s)), s.structuredContent);
    assert.equal(results[0].id, "prop-plan:topstep/50k");
    for (const r of results) {
        assert.deepEqual(Object.keys(r).sort(), ["id", "title", "url"]);
        assert.match(r.url, /^https:\/\/www\.algolift\.ai\//);
    }
    const f = await client.callTool({ name: "fetch", arguments: { id: results[0].id } });
    assert.ok(!f.isError, textOf(f));
    const doc = f.structuredContent as { id: string; title: string; text: string; url: string; metadata: Record<string, unknown> };
    assert.deepEqual(JSON.parse(textOf(f)), f.structuredContent);
    assert.equal(doc.id, results[0].id);
    assert.equal(doc.url, results[0].url);
    assert.match(doc.text, /Topstep 50K Combine \(topstep\/50k\)/);
    assert.equal(doc.metadata.kind, "prop_plan");
    const missing = await client.callTool({ name: "fetch", arguments: { id: "no-such-document" } });
    assert.equal(missing.isError, true);
}

const PROP_CARD = "ui://algolift/prop-plans.v1.html";
const ODDS_CARD = "ui://algolift/setup-odds.v1.html";
/** What a host with MCP Apps declares (the extension io.modelcontextprotocol/ui, spec 2026-01-26). */
const APPS_CLIENT = { capabilities: { extensions: { "io.modelcontextprotocol/ui": { mimeTypes: ["text/html;profile=mcp-app"] } } } };

/** The in-chat cards (MCP Apps), through a real client: the tools name them, resources/list and resources/read serve them, the answers are unchanged. */
async function checkCards(client: Client) {
    const caps = client.getServerCapabilities() as Record<string, unknown> & { extensions?: Record<string, unknown> };
    assert.ok(caps.resources, "the server declares resources");
    assert.deepEqual(caps.extensions?.["io.modelcontextprotocol/ui"], {});

    const { tools } = await client.listTools();
    const pointer = (name: string) => (tools.find((t) => t.name === name)?._meta as { ui?: { resourceUri?: string } } | undefined)?.ui?.resourceUri;
    assert.equal(pointer("compare_prop_plans"), PROP_CARD);
    assert.equal(pointer("get_prop_plan_rules"), PROP_CARD);
    assert.equal(pointer("run_setup_odds"), ODDS_CARD);
    for (const name of ["search", "fetch", "list_prop_firms", "compute_indicator"]) assert.equal(tools.find((t) => t.name === name)?._meta, undefined, name);

    const { resources } = await client.listResources();
    assert.deepEqual(resources.map((r) => r.uri).sort(), [PROP_CARD, ODDS_CARD].sort());
    for (const r of resources) {
        assert.equal(r.mimeType, "text/html;profile=mcp-app");
        const { contents } = await client.readResource({ uri: r.uri });
        assert.equal(contents.length, 1);
        const c = contents[0] as { uri: string; mimeType: string; text: string; _meta: { ui: { csp: unknown; prefersBorder: boolean } } };
        assert.equal(c.uri, r.uri);
        assert.equal(c.mimeType, "text/html;profile=mcp-app");
        assert.match(c.text, /^<!doctype html>/);
        assert.deepEqual(c._meta.ui.csp, { connectDomains: [], resourceDomains: [] });
        assert.doesNotMatch(c.text, /\bfetch\(|XMLHttpRequest|<link\b|—/);
    }
    await assert.rejects(client.readResource({ uri: "ui://algolift/none" }), /Resource not found/);

    // The answer a card draws: the same text a host without cards reads, the card's data in structuredContent.
    const r = await client.callTool({ name: "compare_prop_plans", arguments: { plans: ["topstep/50k", "apex/eod-50k"] } });
    assert.ok(!r.isError, textOf(r));
    assert.match(textOf(r), /\| Rule \| Topstep 50K Combine \| Apex EOD 50K \|/);
    assert.ok((r.structuredContent as { rows: unknown[] }).rows.length > 0);
    // One month of demo bars: the HTTP transports run the hosted caps (50,000 bars a call).
    const o = await client.callTool({ name: "run_setup_odds", arguments: { preset: "gap-up-fill-by-noon", demo: { from: "2024-12-02", to: "2024-12-31" } } });
    assert.ok(!o.isError, textOf(o));
    assert.match(textOf(o), /SYNTHETIC/);
    assert.ok((o.structuredContent as { result: { baseline: { n: number } } }).result.baseline.n > 0);
}

test("the HTTP handler speaks the SDK's protocol versions", () => {
    assert.equal(PROTOCOL_VERSIONS[0], SDK_LATEST);
    for (const v of PROTOCOL_VERSIONS) assert.ok((SUPPORTED_PROTOCOL_VERSIONS as string[]).includes(v), v);
});

let stdio: Client;
before(async () => {
    stdio = new Client({ name: "algolift-mcp-test", version: "0.0.0" }, APPS_CLIENT);
    await stdio.connect(new StdioClientTransport({ command: process.execPath, args: [path.resolve("dist", "cli.js")], stderr: "ignore" }));
});
after(async () => {
    await stdio?.close();
});

test("stdio: the built server lists the tools and answers each", async () => {
    const info = stdio.getServerVersion();
    assert.equal(info?.name, "algolift");
    assert.match(stdio.getInstructions() ?? "", /not verified/);
    const { tools } = await stdio.listTools();
    assert.equal(tools.length, TOOL_COUNT);
    for (const t of tools) assert.equal(t.annotations?.readOnlyHint, true);

    const calls: Array<[string, Record<string, unknown>, RegExp]> = [
        ["list_prop_firms", {}, /Topstep/],
        ["get_prop_plan_rules", { firm: "Topstep", size: "50K" }, /Topstep 50K Combine/],
        ["compare_prop_plans", { plans: ["topstep/50k", "Apex EOD 50K"] }, /\| Rule \|/],
        ["list_indicators", { query: "volatility" }, /match/],
        ["describe_indicator", { id: "cdl_engulfing" }, /Engulfing/],
        ["compute_indicator", { id: "wma", columns: { close: [1, 2, 3, 4, 5] }, options: { period: 3 } }, /\[null,null,2\.3333333333333335,3\.3333333333333335,4\.333333333333333\]/],
        ["list_setup_presets", { family: "gap" }, /gap-up-fill-by-noon/],
        ["describe_setup_query_language", { section: "outcomes" }, /Outcomes:/],
        ["run_setup_odds", { preset: "gap-up-fill-by-noon", demo: {} }, /SYNTHETIC/],
        ["search", { query: "RSI" }, /indicator:rsi/],
        ["fetch", { id: "setup-odds:language" }, /Grammar \(EBNF\)/],
    ];
    assert.equal(calls.length, TOOL_COUNT);
    for (const [name, args, want] of calls) {
        const r = await stdio.callTool({ name, arguments: args });
        assert.ok(!r.isError, `${name}: ${textOf(r)}`);
        assert.match(textOf(r), want, name);
    }
});

test("stdio: search and fetch in OpenAI's shapes", async () => {
    await checkSearchAndFetch(stdio);
});

test("stdio: the in-chat cards", async () => {
    await checkCards(stdio);
});

test("stdio: an unverified prop rule is labelled, and errors come back as words", async () => {
    const r = await stdio.callTool({ name: "get_prop_plan_rules", arguments: { plan_id: "topstep/50k" } });
    const rules = (r.structuredContent as { rules: Array<{ status: string }> }).rules;
    if (rules.some((x) => x.status === "differs" || x.status === "unverified")) assert.match(textOf(r), /NOT VERIFIED/);
    const bad = await stdio.callTool({ name: "compute_indicator", arguments: { id: "wma", columns: { close: [1, 2] }, options: { nope: 1 } } });
    assert.equal(bad.isError, true);
    assert.match(textOf(bad), /has no option "nope"/);
    await assert.rejects(stdio.callTool({ name: "no_such_tool", arguments: {} }), /Unknown tool/);
});

test("HTTP in process: the SDK's Streamable HTTP client against the stateless handler", async () => {
    const toolset = createDefaultToolset({ limits: HOSTED_LIMITS });
    const fetchLike = async (url: string | URL, init?: RequestInit) => handleMcpHttp(new Request(url, init), toolset, { maxBodyBytes: 4_000_000 });
    const client = new Client({ name: "algolift-mcp-http-test", version: "0.0.0" }, APPS_CLIENT);
    await client.connect(new StreamableHTTPClientTransport(new URL("https://example.test/api/mcp"), { fetch: fetchLike as never }));
    assert.equal(client.getServerVersion()?.name, "algolift");
    const { tools } = await client.listTools();
    assert.equal(tools.length, TOOL_COUNT);
    const r = await client.callTool({ name: "get_prop_plan_rules", arguments: { plan_id: "apex/eod-50k" } });
    assert.match(textOf(r), /Apex EOD 50K/);
    const capped = await client.callTool({ name: "compute_indicator", arguments: { id: "wma", columns: { close: new Array(5001).fill(1) } } });
    assert.equal(capped.isError, true);
    await checkSearchAndFetch(client);
    await checkCards(client);
    await client.close();
});

/** Starts `node dist/cli.js --http --port 0` and resolves with the URL it prints. */
function startHttpCli(): Promise<{ child: ChildProcess; url: string }> {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [path.resolve("dist", "cli.js"), "--http", "--port", "0"], { stdio: ["ignore", "ignore", "pipe"] });
        let err = "";
        const timer = setTimeout(() => reject(new Error(`no listening line: ${err}`)), 20_000);
        child.stderr!.on("data", (b: Buffer) => {
            err += b.toString();
            const m = /listening on (http:\/\/\S+)/.exec(err);
            if (m) {
                clearTimeout(timer);
                resolve({ child, url: m[1] });
            }
        });
        child.on("exit", (code) => reject(new Error(`exited ${code}: ${err}`)));
    });
}

test("HTTP mode: the built server's --http on a real port", async () => {
    const { child, url } = await startHttpCli();
    try {
        assert.match(url, /^http:\/\/127\.0\.0\.1:\d+\/mcp$/);
        const client = new Client({ name: "algolift-mcp-http-cli-test", version: "0.0.0" }, APPS_CLIENT);
        await client.connect(new StreamableHTTPClientTransport(new URL(url)));
        const { tools } = await client.listTools();
        assert.equal(tools.length, TOOL_COUNT);
        await checkSearchAndFetch(client);
        await checkCards(client);
        // the hosted caps in HTTP mode
        const capped = await client.callTool({ name: "compute_indicator", arguments: { id: "wma", columns: { close: new Array(5001).fill(1) } } });
        assert.equal(capped.isError, true);
        await client.close();

        // only the endpoint's path, only POST, and a browser origin that is not local is refused
        assert.equal((await fetch(url.replace(/\/mcp$/, "/other"), { method: "POST" })).status, 404);
        assert.equal((await fetch(url)).status, 405);
        const foreign = await fetch(url, { method: "POST", headers: { "content-type": "application/json", origin: "https://evil.example" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }) });
        assert.equal(foreign.status, 403);
        const big = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: "x".repeat(4_000_001) });
        assert.equal(big.status, 413);
    } finally {
        child.kill();
    }
});
