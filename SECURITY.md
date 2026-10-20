# Security

The AlgoLift MCP server runs on your machine, started by your MCP client. It holds no accounts, sends no telemetry and makes no network requests: it answers over stdin and stdout from the data bundled in the package and the bars you pass it. The links it prints (to algolift.ai) are only followed if you open them.

## Reporting a vulnerability

Please report vulnerabilities privately, not in a public issue:

- through GitHub's private vulnerability reporting for this repository (the "Report a vulnerability" button on the Security tab), or
- by email to support@algolift.ai.

Tell us what you found, how to reproduce it, and what it could affect. We will acknowledge the report within three working days, keep you informed while we fix it, and credit you in the release notes if you would like.

## Scope

- The server (`src/`), its tools and the bundled data (`data/`).
- AlgoLift's hosted copy of the same tools, if it is serving them; report problems with it here too.
- Dependencies: tell us about a vulnerable dependency that affects how this server uses it.
