# AlgoLift MCP server

An [MCP](https://modelcontextprotocol.io) server that gives an AI assistant three open AlgoLift tools to call:

- **Prop firm rules.** The rules of futures prop firm accounts (profit targets, drawdowns and how they trail, daily loss limits, consistency, minimum days, contract limits, payouts, fees), each rule with its verification status, the firm's own page it was checked against, and the date.
- **Indicators.** The technical indicators and candlestick patterns of [@algolift/indicators](https://github.com/algolift-ai/indicators), each ported from TA-Lib, pandas-ta-classic, pandas-ta or technicalindicators and tested against that library's output.
- **Setup Odds.** How often an intraday setup actually happened ("when it gaps up, how often does it fill by noon?"), on your bars, with the sample size and a 95% interval on every number. The engine is [Setup Odds](https://github.com/algolift-ai/setup-odds).

It also has `search` and `fetch`, the two tools ChatGPT's deep research and company knowledge read, over the same content, each document with the algolift.ai page to cite.

It is **read-only**: every tool reads the data bundled in this package and computes on what you pass it, and each says so to the client (`readOnlyHint: true`). It needs **no AlgoLift account and no API key**, calls no AlgoLift service, makes no outbound network request and reads no file of yours. It runs over stdio for desktop clients, or over HTTP for clients that take a server by URL, such as ChatGPT.

Made by [AlgoLift](https://www.algolift.ai), a no-code platform for building and backtesting trading strategies.

## Install

You need [Node.js](https://nodejs.org) 20 or later. MCP clients start the server themselves with `npx`, so there is nothing else to install.

### Claude Desktop

Open Settings, Developer, Edit Config, and add the server to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "AlgoLift": {
      "command": "npx",
      "args": ["-y", "@algolift/mcp"]
    }
  }
}
```

Restart Claude Desktop. The tools appear in the tools menu of a new chat.

### Claude Code

```bash
claude mcp add algolift -- npx -y @algolift/mcp
```

### Cursor

Add it to `~/.cursor/mcp.json` (every project) or `.cursor/mcp.json` (one project):

```json
{
  "mcpServers": {
    "AlgoLift": {
      "command": "npx",
      "args": ["-y", "@algolift/mcp"]
    }
  }
}
```

### VS Code, Windsurf and other MCP clients

Any client that runs a local MCP server over stdio takes the same command: `npx -y @algolift/mcp`. In VS Code, add it to `.vscode/mcp.json`:

```json
{
  "servers": {
    "AlgoLift": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@algolift/mcp"]
    }
  }
}
```

On Windows, if your client cannot find `npx`, use `"command": "cmd"` with `"args": ["/c", "npx", "-y", "@algolift/mcp"]`.

To pin a version, name it: `@algolift/mcp@0.1.0`.

### ChatGPT

ChatGPT connects to a remote MCP server by URL, not to a command on your machine, so it needs the server reachable over public HTTPS. There are two ways to give it one:

- **The hosted endpoint, `https://www.algolift.ai/api/mcp`.** AlgoLift serves the same tools there, stateless, with tighter caps (5,000 bars for an indicator, 50,000 for Setup Odds) and a per-address rate limit. **It is not switched on yet**: until it is, every request to it gets a 404. This README and the changelog will say when it is on.
- **Your own deployment of the HTTP mode** (below), behind an HTTPS address you control.

Then, following [OpenAI's guide to connecting from ChatGPT](https://developers.openai.com/plugins/deploy/connect-chatgpt): open [ChatGPT Plugins](https://chatgpt.com/plugins), select the plus button, then **Add custom MCP server**; give it a name and description; under Connection choose a public endpoint and enter the URL with its path (for example `https://mcp.example.com/mcp`); configure authentication (this server has no sign-in); review the risk warning; and select **Create as a plugin**. Which ChatGPT plans and workspaces can add custom MCP servers is OpenAI's to decide and changes over time, so check OpenAI's help center for yours.

ChatGPT's deep research and company knowledge read a server through two read-only tools, `search` and `fetch`, with the input and output shapes in [OpenAI's MCP guide](https://developers.openai.com/api/docs/mcp). This server has both (see [Search and fetch](#search-and-fetch)), and every other tool is marked read-only (`readOnlyHint: true`) as well.

### The OpenAI Responses API

The Responses API's `mcp` tool takes a remote server by URL. With the hosted endpoint on, or your own HTTPS deployment in its place:

```js
import OpenAI from "openai";

const client = new OpenAI();
const response = await client.responses.create({
  model: "gpt-6.1-sol",
  tools: [
    {
      type: "mcp",
      server_label: "algolift",
      server_description: "Futures prop firm rules with each rule's verification status, technical indicators, and Setup Odds.",
      server_url: "https://www.algolift.ai/api/mcp",
      allowed_tools: ["search", "fetch", "get_prop_plan_rules", "compare_prop_plans"],
      require_approval: "never",
    },
  ],
  input: "Compare the Topstep and Apex 50K evaluations, and say which rules are not verified.",
});
console.log(response.output_text);
```

`allowed_tools` limits which of the server's tools the model sees; leave it out for all eleven. `require_approval: "never"` suits a server whose tools are all read-only, as these are; the API asks for approval by default. A deep research model reads only `search` and `fetch`, and OpenAI's [deep research guide](https://developers.openai.com/api/docs/guides/deep-research) says `require_approval` must be `"never"` there. The model above is the one OpenAI's MCP guide uses; any model that supports remote MCP servers works.

### Run it over HTTP

`algolift-mcp --http` serves the same tools over Streamable HTTP, stateless (each request is answered with one JSON body; no session and no event stream), by the same handler the hosted endpoint runs:

```bash
npx -y @algolift/mcp --http --port 3000
# AlgoLift MCP server 0.1.0 listening on http://127.0.0.1:3000/mcp (Streamable HTTP, stateless)
```

- `--port` (default 3000; 0 picks a free one), `--host` (default `127.0.0.1`, this machine only; use `0.0.0.0` in a container or behind a proxy on another host), `--path` (default `/mcp`).
- In HTTP mode every call has the hosted caps (5,000 bars for an indicator, 50,000 for Setup Odds, 4 MB bodies).
- A request from a browser page (one with an `Origin` header) is answered only from `localhost`, unless you allow its origin with `--allow-origin https://your.site` (the MCP transport asks servers to check `Origin`). Server-side clients such as ChatGPT and the Responses API send none.
- It has no rate limit and no authentication of its own: put it behind a reverse proxy that terminates HTTPS and limits requests before you give its URL to anyone. It reads only the data in the package and makes no outbound request.

To try it locally, run it and point the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) at `http://127.0.0.1:3000/mcp` with the Streamable HTTP transport.

## The tools

Each example is something you might ask, then the arguments the assistant passes.

### Prop firm rules

**`list_prop_firms`**: the firms and plans, with each plan's id and how many of its rules are verified.

> "Which prop firms do you have rules for?"

```json
{ "firm": "Apex" }
```

**`get_prop_plan_rules`**: every rule and price of one plan, each with its status, source and date. Name the plan by its id, or by firm, program and size.

> "What are Topstep's 50K Combine rules?"

```json
{ "plan_id": "topstep/50k" }
```
```json
{ "firm": "Apex", "plan": "EOD", "size": "50K" }
```

**`compare_prop_plans`**: plans side by side on the rules that matter most. Pass plans, or a size to compare every firm's plans of that size.

> "Compare the 50K accounts at Topstep, Apex and MFFU."

```json
{ "plans": ["topstep/50k", "Apex EOD 50K", "MFFU Rapid 50K"] }
```
```json
{ "size": 50000, "firms": ["Topstep", "Tradeify"] }
```

#### What "verified" means here

Every rule carries one of four statuses, exactly as the [prop firm rules dataset](https://github.com/algolift-ai/prop-firm-rules) holds it, and the answer's text says plainly when a rule is not verified:

| Status | In the answer | Meaning |
|---|---|---|
| `verified` | `[verified 2026-10-16]` | Checked against the firm's page (linked) on that date. |
| `not_stated` | `not stated by the firm` | The firm's pages do not state this rule, so the value is the assumption AlgoLift's simulator uses. |
| `differs` | `NOT VERIFIED: the firm's page now says something else` | The firm changed it; the value is what AlgoLift simulates today, and it is being updated. |
| `unverified` | `NOT VERIFIED: not cited` | Never checked against the firm's page. |

A verified rule older than the dataset's re-check window (45 days) is flagged as a stale check. Every answer names the dataset it comes from and the dates its rules were checked; a newer dataset ships as a new release of this package. Firms change rules and prices often: read the firm's own page before you buy an evaluation.

### Indicators

**`list_indicators`**: search by name or by what it measures, or list a family.

> "What volatility indicators can you compute?"

```json
{ "query": "volatility" }
```

**`describe_indicator`**: settings with defaults and limits, outputs, the library and file the code was ported from (with its license and every change the port made), and what verified it.

```json
{ "id": "alma" }
```

**`compute_indicator`**: run one on bars (oldest first), as objects or columns. Settings left out take the library's defaults. Up to 20,000 bars a call; each output comes back with one value per bar, `null` during its warmup.

> "Here are my closes: what is their 3-bar WMA?"

```json
{ "id": "wma", "columns": { "close": [101.6, 101.9, 102.4, 102.1, 103.0] }, "options": { "period": 3 } }
```
```json
{ "id": "cdl_engulfing", "bars": [{ "open": 10, "high": 11, "low": 9, "close": 9.5, "volume": 1200 }] }
```

The library holds the indicators it has ported and verified. An indicator it does not have yet is not in this server either, and `list_indicators` says so rather than guessing.

### Setup Odds

A Setup Odds question is two texts: a **setup** (which sessions you ask about, like `gap > 0.5%`) and an **outcome** (what you want to know happened later that session, like `touches prior.close by 12:00`). Every time is New York time on the CME equity-index futures calendar.

**`list_setup_presets`**: the 25 ready-made setups, in five families (`gap`, `opening-range`, `prior-day`, `overnight`, `event`), each with its setup, outcome and parameters.

```json
{ "family": "gap", "query": "noon" }
```

**`describe_setup_query_language`**: the language's grammar, every value, window, function, operator and outcome form, the units and worked examples, or one section of them.

```json
{ "section": "examples" }
```

**`run_setup_odds`**: one preset, or a setup and an outcome, on your 1-minute bars (a list or CSV text) or on the synthetic demo bars. It returns how many sessions met the setup and how many of those saw the outcome, the rate with its 95% Wilson interval, the baseline over every measured session and the lift, a first-half against second-half split, counts by year, the time to the event, and every warning. Up to 2,000,000 bars, 2,600 sessions and 10 seconds a call.

> "On my ES 1-minute bars, when it gaps up more than half a percent, how often does it trade back to yesterday's close by noon?"

```json
{ "setup": "gap > 0.5%", "outcome": "touches prior.close by 12:00", "csv": "timestamp,open,high,low,close,volume\n2024-01-08 09:30,4780.25,4782,4779.5,4781.75,1200\n...", "label": "ES 2024" }
```
```json
{ "preset": "gap-up-fill-by-noon", "params": { "gap": 0.5 }, "demo": {} }
```

The demo bars are synthetic, not market data, and every answer on them says so. Setup Odds counts how often something happened; it does not trade it (no entry rule, stop, costs or sizing), and an interval is for one question asked once.

### Search and fetch

The two tools ChatGPT's deep research and company knowledge read a server through, in the shapes [OpenAI's MCP guide](https://developers.openai.com/api/docs/mcp) gives. Any MCP client can use them. They cover AlgoLift's open content only: the prop firms and each plan's rules, the indicators, and Setup Odds' presets and language.

**`search`**: takes one argument, `query`, and returns up to 10 matching documents, each with an `id`, a `title` and the public algolift.ai page to cite as its `url`.

```json
{ "query": "Topstep 50K drawdown" }
```
```json
{ "results": [{ "id": "prop-plan:topstep/50k", "title": "Topstep 50K Combine rules: ...", "url": "https://www.algolift.ai/prop-firms/topstep/50k-combine" }] }
```

**`fetch`**: takes one argument, `id` (a search result's), and returns the whole document: `id`, `title`, `text`, `url` and `metadata`. A document's text is the matching tool's own answer, so a prop plan's lists every rule with its status, the firm's page it was checked against and the date, and a rule that is not verified reads NOT VERIFIED there too; a plan's title counts its rules that are not verified.

```json
{ "id": "prop-plan:topstep/50k" }
```

Both answer with `structuredContent` and, as the guide asks, the same value as JSON text. Each declares its output shape (`outputSchema`). A plan without a page of its own on algolift.ai is cited to its firm's page. The ids are `prop-firms`, `prop-firm:<firm>`, `prop-plan:<plan id>`, `indicator:<id>`, `setup-preset:<id>` and `setup-odds:language`. The results are deterministic: the same query on the same release gives the same list.

### In-chat cards

The answers of three tools can also be drawn as a card inside the chat, on hosts that support [MCP Apps](https://modelcontextprotocol.io/docs/extensions/apps) (the extension `io.modelcontextprotocol/ui`, specification 2026-01-26):

| Card | Tools | What it shows |
|---|---|---|
| `ui://algolift/prop-plans.v1.html` | `compare_prop_plans`, `get_prop_plan_rules` | The plans side by side (or one plan), each firm under its logo, every value with its status, the date it was checked and the firm's page; a value that is not verified is marked NOT VERIFIED |
| `ui://algolift/setup-odds.v1.html` | `run_setup_odds` | The hit rate with its 95% interval and sample, the baseline, the lift and the halves, and when the outcome happened against the baseline's interval, or by year |

Each tool names its card in its definition (`_meta.ui.resourceUri`); the server lists the cards with `resources/list` and serves them with `resources/read` as `text/html;profile=mcp-app`. A card is one self-contained HTML page: its styles, its script and the firms' logos are inline, it declares no allowed origin (`_meta.ui.csp` with empty `connectDomains` and `resourceDomains`), and it draws only the result the host hands it. It makes no request and calls no tool. **Open in AlgoLift** asks the host to open the matching page on www.algolift.ai (the plan's page, the two firms' comparison, the prop firms hub, or the Setup Odds page); the host may ask you to confirm first. The card follows the host's light or dark theme.

**Hosts without MCP Apps** read the text answer, which is exactly the same with or without the card: every number, status and source is in it. The [MCP client matrix](https://modelcontextprotocol.io/extensions/client-matrix) lists the hosts that render MCP Apps.

## What it does not do

- It does not trade, place orders, or connect to a broker or a prop firm.
- It does not use an AlgoLift account and cannot see anything in one: no strategies, backtests or results.
- It does not run AlgoLift's backtest engine, its robustness or prop Monte Carlo simulations, or its copilot.
- It does not fetch prices or any other data: the indicators and Setup Odds compute only on the bars you pass, or on the demo bars.
- It does not give advice. The prop rules are a record of published rules, which change; Setup Odds' numbers are historical frequencies, not predictions.

Where it helps, an answer ends with one pointer to the matching place on algolift.ai: testing a strategy against a firm's rules, building a strategy with an indicator, or testing a setup as a strategy (which needs an AlgoLift account). Following it is up to you.

## Develop

```bash
git clone https://github.com/algolift-ai/mcp && cd mcp
npm ci
npm test        # builds; runs every tool's tests, and the server over stdio, the HTTP handler and the --http mode through the official MCP SDK client (tools, search and fetch, the in-chat cards); type-checks
npm run build   # dist/cli.js
node dist/cli.js --help
```

`src/server.ts`, `src/cli.ts` and `src/http.ts` belong to this repository. `src/lib/` and `data/` are copied from the AlgoLift app, which serves the same tools, so please do not edit them here: open an issue, and the change lands in the app and then in the next release. A correction to a prop rule belongs in [algolift/prop-firm-rules](https://github.com/algolift-ai/prop-firm-rules), to an indicator in [algolift/indicators](https://github.com/algolift-ai/indicators), and to Setup Odds in [algolift/setup-odds](https://github.com/algolift-ai/setup-odds).

Report a security issue as [SECURITY.md](SECURITY.md) describes.

## License

MIT, copyright (c) 2026 AlgoLift LLC, see [LICENSE](LICENSE). The bundled prop firm rules (`data/prop-firm-rules.json`) are CC BY 4.0 ("Prop firm rules by AlgoLift (algolift.ai)"), and the Setup Odds engine keeps its own MIT notice; [NOTICE](NOTICE) lists both. Firm names are used only to say which firm a rule belongs to; this project is not affiliated with or endorsed by any firm.
