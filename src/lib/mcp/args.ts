// GENERATED from the AlgoLift app by scripts/oss/mcp/sync.mts. Do not edit here: change the app, then sync.
// src/lib/mcp/args.ts
//
// The AlgoLift MCP server's argument check: a tool's arguments against its own
// input schema (the JSON Schema subset in protocol.ts), before the tool runs.
// One schema serves `tools/list` and the check, so they cannot disagree. A
// failure is a ToolInputError naming the argument, which the model reads and
// can correct.
//
// PURE. No em dashes in any string.

import { ToolInputError, type JsonSchema } from "./protocol";

function typeOf(v: unknown): string {
    if (v === null) return "null";
    if (Array.isArray(v)) return "array";
    if (typeof v === "number") return Number.isInteger(v) ? "integer" : "number";
    return typeof v;
}

function matchesType(v: unknown, t: string): boolean {
    const actual = typeOf(v);
    if (t === "number") return actual === "number" || actual === "integer";
    return actual === t;
}

function check(v: unknown, s: JsonSchema, at: string): void {
    if (s.type !== undefined) {
        const types = Array.isArray(s.type) ? s.type : [s.type];
        if (!types.some((t) => matchesType(v, t))) {
            throw new ToolInputError(`${at} must be ${types.map((t) => (t === "integer" ? "a whole number" : t === "array" ? "a list" : t === "object" ? "an object" : `a ${t}`)).join(" or ")}.`);
        }
    }
    if (typeof v === "number" && !Number.isFinite(v)) throw new ToolInputError(`${at} must be a finite number.`);
    if (s.enum && !s.enum.includes(v as string | number)) throw new ToolInputError(`${at} must be one of: ${s.enum.join(", ")}.`);
    if (typeof v === "number") {
        if (s.minimum !== undefined && v < s.minimum) throw new ToolInputError(`${at} must be at least ${s.minimum}.`);
        if (s.maximum !== undefined && v > s.maximum) throw new ToolInputError(`${at} must be at most ${s.maximum}.`);
    }
    if (typeof v === "string") {
        if (s.minLength !== undefined && v.length < s.minLength) throw new ToolInputError(`${at} must have at least ${s.minLength} characters.`);
        if (s.maxLength !== undefined && v.length > s.maxLength) throw new ToolInputError(`${at} must have at most ${s.maxLength.toLocaleString("en-US")} characters.`);
    }
    if (Array.isArray(v)) {
        if (s.minItems !== undefined && v.length < s.minItems) throw new ToolInputError(`${at} must have at least ${s.minItems} items.`);
        if (s.maxItems !== undefined && v.length > s.maxItems) throw new ToolInputError(`${at} must have at most ${s.maxItems.toLocaleString("en-US")} items.`);
        if (s.items) {
            // Only the first problem is named; a long list is not walked twice.
            for (let i = 0; i < v.length; i++) check(v[i], s.items, `${at}[${i}]`);
        }
    }
    if (typeOf(v) === "object") {
        const o = v as Record<string, unknown>;
        for (const r of s.required ?? []) {
            if (o[r] === undefined) throw new ToolInputError(`${at === "arguments" ? "" : `${at}.`}${r} is required.`);
        }
        for (const [k, val] of Object.entries(o)) {
            if (val === undefined) continue;
            const ps = s.properties?.[k];
            const where = at === "arguments" ? k : `${at}.${k}`;
            if (ps) check(val, ps, where);
            else if (s.additionalProperties === false) {
                const names = Object.keys(s.properties ?? {});
                throw new ToolInputError(`Unknown argument "${where}"${names.length ? `; the arguments are ${names.join(", ")}` : ""}.`);
            } else if (typeof s.additionalProperties === "object") check(val, s.additionalProperties, where);
        }
    }
}

/** The arguments as an object, checked against the tool's schema; throws a ToolInputError. */
export function checkArgs(args: unknown, schema: JsonSchema): Record<string, unknown> {
    const a = args === undefined || args === null ? {} : args;
    check(a, schema, "arguments");
    return a as Record<string, unknown>;
}
