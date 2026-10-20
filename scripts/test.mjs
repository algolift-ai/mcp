// scripts/test.mjs: `npm test`.
//
//   1. builds the server (scripts/build.mjs);
//   2. bundles each test/*.test.ts with esbuild and runs them with node:test:
//      every tool on the core, the built server over stdio through the
//      official MCP SDK client, and the stateless HTTP handler through the
//      SDK's Streamable HTTP client;
//   3. type-checks the source and the tests.

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const run = (args) => execFileSync(process.execPath, args, { stdio: "inherit", cwd: root });

run([path.join(root, "scripts", "build.mjs")]);

const out = path.join(root, ".test-build");
fs.rmSync(out, { recursive: true, force: true });
const tests = fs.readdirSync(path.join(root, "test")).filter((f) => f.endsWith(".test.ts"));
for (const t of tests) {
    await build({
        entryPoints: [path.join(root, "test", t)],
        outfile: path.join(out, t.replace(/\.ts$/, ".mjs")),
        bundle: true,
        platform: "node",
        format: "esm",
        target: "node20",
        packages: "external",
        logLevel: "warning",
    });
}
run(["--test", ...tests.map((t) => path.join(out, t.replace(/\.ts$/, ".mjs")))]);

run([require.resolve("typescript/bin/tsc"), "-p", path.join(root, "tsconfig.json")]);
console.log("types ok");
