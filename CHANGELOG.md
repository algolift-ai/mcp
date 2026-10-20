# Changelog

Every release is dated. A release that carries a new prop firm rules dataset names the dataset's version and the dates its rules were checked.

## 0.1.0 (2026-10-19)

The first release, with the prop firm rules dataset 0.1.0 (the published registry, version 1).

- Eleven read-only tools, each marked `readOnlyHint: true`: `list_prop_firms`, `get_prop_plan_rules`, `compare_prop_plans`, `list_indicators`, `describe_indicator`, `compute_indicator`, `list_setup_presets`, `describe_setup_query_language`, `run_setup_odds`, `search` and `fetch`.
- `search` and `fetch` in the shapes OpenAI's MCP guide gives for ChatGPT's deep research and company knowledge (search: `query` in, `results` of `id`, `title`, `url` out; fetch: `id` in, `id`, `title`, `text`, `url`, `metadata` out; each as `structuredContent` and as JSON text, with an `outputSchema`), over the prop firms and plans, the indicators, and Setup Odds' presets and language. Each document is cited to its public algolift.ai page (`data/site-pages.json`); a prop plan's text keeps every rule's status, source and date.
- In-chat cards for hosts with MCP Apps (`io.modelcontextprotocol/ui`, spec 2026-01-26): `compare_prop_plans` and `get_prop_plan_rules` name `ui://algolift/prop-plans.v1.html`, `run_setup_odds` names `ui://algolift/setup-odds.v1.html` (`_meta.ui.resourceUri`). The server declares `resources` and the extension, and serves both cards over `resources/list` and `resources/read` as `text/html;profile=mcp-app`: self-contained pages that declare no allowed origin, draw only the tool's result and open algolift.ai through the host. Every text answer is unchanged.
- Over stdio, and over Streamable HTTP with `--http` (stateless, the hosted caps, `Origin` checked), for clients that take a server by URL, such as ChatGPT and the OpenAI Responses API. The hosted endpoint at `https://www.algolift.ai/api/mcp` is not switched on yet.
- The prop firm rules dataset 0.1.0 (51 plans from 6 firms), exported from version 1 of AlgoLift's prop rules registry (published 2026-10-18, sha256 `fb5a22ac...`): of 2,204 rules and prices, 2,163 verified, 27 not stated by the firm and 14 not cited, checked 2026-10-16 to 2026-10-18. Every rule comes with its status, source and date; a rule that is not verified is labelled so in every answer. `list_prop_firms` names the registry version in `dataset.registry_version` (`version`, `sha256`, `published_at`). Plans carry `account.trading_hours` and `payouts.max_payout_pct_of_balance`.
- @algolift/indicators 0.1.0, and the Setup Odds engine (`@algolift/setup-odds` 0.1.0, engine 1.0.0) with its calendar: setups and outcomes written in its own language (`gap > 0.5%`, `touches prior.close by 12:00`), 25 presets in five families.
