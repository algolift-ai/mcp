// scripts/build.mjs: the npm build of @algolift/mcp.
//
//   dist/cli.js    the server, one ES module file with its data inlined; the
//                  MCP SDK and @algolift/indicators stay dependencies.

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
fs.rmSync(dist, { recursive: true, force: true });

await build({
    entryPoints: [path.join(root, "src", "cli.ts")],
    outfile: path.join(dist, "cli.js"),
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    external: ["@modelcontextprotocol/sdk", "@algolift/indicators"],
    banner: { js: "#!/usr/bin/env node" },
    legalComments: "inline",
    logLevel: "warning",
});
fs.chmodSync(path.join(dist, "cli.js"), 0o755);
console.log("built dist/cli.js");
