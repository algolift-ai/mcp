// test/package.test.ts: the package is what it says. Its version, its pinned
// dependencies, the generated files' provenance, and the rule that the server
// reaches nothing outside the package (no network, no account).

import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { test } from "node:test";

import { VERSION } from "../src/server";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

function walk(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

test("version and pinned dependencies", () => {
    assert.equal(pkg.name, "@algolift/mcp");
    assert.equal(VERSION, pkg.version);
    for (const [name, spec] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) assert.match(spec as string, /^\d+\.\d+\.\d+$/, `${name} is pinned to an exact version`);
    assert.equal(pkg.license, "MIT");
    assert.equal(pkg.bin["algolift-mcp"], "dist/cli.js");
});

test("the generated half carries its provenance header", () => {
    for (const f of walk(path.join("src", "lib", "mcp")).concat(walk(path.join("src", "lib", "propRules")))) {
        assert.match(fs.readFileSync(f, "utf8"), /^\/\/ GENERATED from the AlgoLift app by scripts\/oss\/mcp\/sync\.mts/, f);
    }
    assert.ok(fs.existsSync(path.join("src", "lib", "tools", "setupOdds", "engine", "LICENSE")), "Setup Odds' MIT notice travels with its engine");
});

test("no outbound network, no account, no file outside the package", () => {
    const HTTP_MODE = path.join("src", "http.ts");
    const src = walk("src").filter((f) => f.endsWith(".ts"));
    for (const f of src) {
        let text = fs.readFileSync(f, "utf8");
        if (f === HTTP_MODE) {
            // The --http mode only listens: node:http's createServer, never a request out.
            assert.match(text, /^import \{ createServer, type IncomingMessage, type Server, type ServerResponse \} from "node:http";$/m);
            assert.doesNotMatch(text, /\b(request|get)\(|https/, f);
            text = text.replace(/from "node:http"/, "");
        }
        assert.doesNotMatch(text, /\bfetch\(|XMLHttpRequest|node:(http|https|net|dns|fs|child_process)|from "(http|https|net|fs|child_process)"/, f);
        assert.doesNotMatch(text, /process\.env/, f);
    }
});

test("public copy has no em dashes", () => {
    for (const f of ["README.md", "CHANGELOG.md", "SECURITY.md"].concat(walk(path.join("src", "lib", "mcp")))) {
        assert.doesNotMatch(fs.readFileSync(f, "utf8"), /—/, f);
    }
});
