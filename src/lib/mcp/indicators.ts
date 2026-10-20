// GENERATED from the AlgoLift app by scripts/oss/mcp/sync.mts. Do not edit here: change the app, then sync.
// src/lib/mcp/indicators.ts
//
// The AlgoLift MCP server's indicator tools, over @algolift/indicators (the
// open-source program's repo #3): every indicator ported from TA-Lib,
// pandas-ta-classic, pandas-ta or technicalindicators and tested against that
// library's own output, and the classic indicators AlgoLift wrote for its
// strategy nodes (SMA, EMA, RSI, MACD, Bollinger Bands, ATR and the rest),
// each compared with TA-Lib with its differences stated.
//
//   list_indicators       search by name or by what it measures
//   describe_indicator    its settings, outputs, where its code came from, what verified it
//   compute_indicator     run it on the caller's bars or columns (capped)
//
// PURE. No em dashes in any string.

import { CATALOG, calculate, settings, type Family, type IndicatorInfo } from "@algolift/indicators";
import { checkArgs } from "./args";
import { descriptor, errorResult, pointer, SITE, textResult, ToolInputError, type Limits, type ToolDef } from "./protocol";

const FAMILIES: Family[] = [
    "moving_averages",
    "price_transforms",
    "momentum",
    "trend_strength",
    "volatility",
    "bands_channels",
    "volume",
    "cycles",
    "statistics",
    "regression",
    "market_structure",
    "candlestick_patterns",
];

const FAMILY_WORDS: Record<Family, string> = {
    moving_averages: "moving averages",
    price_transforms: "price transforms",
    momentum: "momentum",
    trend_strength: "trend strength",
    volatility: "volatility",
    bands_channels: "bands and channels",
    volume: "volume",
    cycles: "cycles",
    statistics: "statistics",
    regression: "regression",
    market_structure: "market structure",
    candlestick_patterns: "candlestick patterns",
};

const FIELDS = ["open", "high", "low", "close", "volume"] as const;
type Field = (typeof FIELDS)[number];

const PACKAGE_LINE = "From @algolift/indicators (npm install @algolift/indicators, MIT): each indicator tested against the library it was ported from, or, for a classic AlgoLift wrote, compared with TA-Lib.";
const POINTER = `Build and backtest a strategy with this indicator, without code, on algolift.ai: ${SITE}`;

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9+]+/).filter(Boolean);

function haystack(i: IndicatorInfo): string {
    return [i.id, i.fn, i.name, ...(i.aliases ?? []), i.description, FAMILY_WORDS[i.family], ...i.outputs.map((o) => o.label)].join(" ").toLowerCase();
}

/** How well an indicator matches a search: 0 is no match. */
export function searchScore(i: IndicatorInfo, query: string): number {
    const q = query.trim().toLowerCase();
    if (!q) return 1;
    if (i.id === q || i.fn.toLowerCase() === q || i.name.toLowerCase() === q) return 100;
    const name = [i.name, ...(i.aliases ?? [])].join(" ").toLowerCase();
    if (name.includes(q)) return 50;
    const ws = words(q);
    if (!ws.length) return 0;
    const nameWords = new Set(words(name));
    if (ws.every((w) => nameWords.has(w) || [...nameWords].some((x) => w.length >= 3 && x.startsWith(w)))) return 30;
    if (FAMILY_WORDS[i.family].includes(q)) return 20;
    // Whole words, or the start of one: "vol" finds volume and volatility, "rsi" never "first".
    const hay = new Set(words(haystack(i)));
    if (ws.every((w) => hay.has(w) || (w.length >= 3 && [...hay].some((x) => x.startsWith(w))))) return 10;
    return 0;
}

/** An indicator by its id ("cdl_engulfing"), its function ("cdlEngulfing") or its name. */
export function findIndicator(ref: string): IndicatorInfo | undefined {
    const r = ref.trim().toLowerCase();
    return CATALOG.find((i) => i.id === r || i.fn.toLowerCase() === r || i.name.toLowerCase() === r);
}

function firstSentence(s: string): string {
    const m = /^(.*?[.!?])(\s|$)/.exec(s);
    return m ? m[1] : s;
}

function paramLine(p: IndicatorInfo["parameters"][number]): string {
    if (p.type === "number") {
        const range = [p.min !== undefined ? `min ${p.min}` : null, p.max !== undefined ? `max ${p.max}` : null].filter(Boolean).join(", ");
        return `- ${p.name} (${p.label}): number, default ${p.default}${range ? `, ${range}` : ""}${p.description ? `. ${p.description}` : ""}`;
    }
    return `- ${p.name} (${p.label}): one of ${p.options.map((o) => o.value).join(", ")}, default ${p.default}${p.description ? `. ${p.description}` : ""}`;
}

function suggestions(ref: string): string {
    const near = CATALOG.map((i) => ({ i, s: searchScore(i, ref) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, 5)
        .map((x) => `${x.i.id} (${x.i.name})`);
    return near.length ? ` Close matches: ${near.join(", ")}.` : " list_indicators searches by name or by what it measures.";
}

/** Bars (objects) or columns, checked and turned into columns of the fields given. */
export function toColumns(args: Record<string, unknown>, maxBars: number): Partial<Record<Field, number[]>> {
    const hasBars = args.bars !== undefined;
    const hasCols = args.columns !== undefined;
    if (hasBars === hasCols) throw new ToolInputError("Pass bars (a list of {open, high, low, close, volume}) or columns ({close: [...], ...}), not both.");
    const out: Partial<Record<Field, number[]>> = {};
    if (hasBars) {
        const bars = args.bars as Array<Record<string, unknown>>;
        if (bars.length > maxBars) throw new ToolInputError(`bars has ${bars.length.toLocaleString("en-US")} bars; one call takes at most ${maxBars.toLocaleString("en-US")}.`);
        if (!bars.length) throw new ToolInputError("bars is empty.");
        const present = FIELDS.filter((f) => bars[0][f] !== undefined && bars[0][f] !== null);
        if (!present.length) throw new ToolInputError("Each bar needs open, high, low, close or volume (numbers).");
        for (const f of present) out[f] = new Array(bars.length);
        for (let i = 0; i < bars.length; i++) {
            const b = bars[i];
            for (const f of FIELDS) {
                const v = b[f];
                const has = v !== undefined && v !== null;
                if (has !== present.includes(f)) throw new ToolInputError(`bars[${i}] ${has ? "has" : "lacks"} ${f}, which bars[0] ${has ? "lacks" : "has"}: every bar needs the same fields.`);
                if (!has) continue;
                if (typeof v !== "number" || !Number.isFinite(v)) throw new ToolInputError(`bars[${i}].${f} must be a finite number.`);
                out[f]![i] = v;
            }
        }
        return out;
    }
    const cols = args.columns as Record<string, unknown>;
    let n = -1;
    for (const f of FIELDS) {
        const c = cols[f];
        if (c === undefined || c === null) continue;
        const arr = c as unknown[];
        if (arr.length > maxBars) throw new ToolInputError(`columns.${f} has ${arr.length.toLocaleString("en-US")} values; one call takes at most ${maxBars.toLocaleString("en-US")}.`);
        if (n >= 0 && arr.length !== n) throw new ToolInputError(`columns.${f} has ${arr.length} values; the other columns have ${n}.`);
        n = arr.length;
        arr.forEach((v, i) => {
            if (typeof v !== "number" || !Number.isFinite(v)) throw new ToolInputError(`columns.${f}[${i}] must be a finite number.`);
        });
        out[f] = arr as number[];
    }
    if (n < 0) throw new ToolInputError("columns needs at least one of open, high, low, close, volume.");
    if (n === 0) throw new ToolInputError("columns are empty.");
    return out;
}

const numList = { type: "array" as const, items: { type: "number" as const } };

export function indicatorTools(limits: Limits): ToolDef[] {
    const list: ToolDef = {
        descriptor: descriptor(
            "list_indicators",
            "List indicators",
            `Searches the ${CATALOG.length} technical indicators and candlestick patterns in @algolift/indicators: the classics (SMA, EMA, RSI, MACD, Bollinger Bands, ATR and more, compared with TA-Lib) and ports of TA-Lib, pandas-ta-classic, pandas-ta and technicalindicators tested against that library's own output. Search by name ("RSI", "ALMA", "engulfing") or by what it measures ("volatility", "trend strength"), or list a family.`,
            {
                type: "object",
                properties: {
                    query: { type: "string", maxLength: 200, description: "Words to search for in names, aliases and descriptions." },
                    family: { type: "string", enum: FAMILIES, description: "Only this family." },
                    limit: { type: "integer", minimum: 1, maximum: 200, description: "How many to list (default 40)." },
                },
                additionalProperties: false,
            },
        ),
        run(raw) {
            const args = checkArgs(raw, list.descriptor.inputSchema);
            const query = typeof args.query === "string" ? args.query : "";
            const family = args.family as Family | undefined;
            const limit = (args.limit as number | undefined) ?? 40;
            const hits = CATALOG.map((i, order) => ({ i, order, s: searchScore(i, query) }))
                .filter((x) => x.s > 0 && (!family || x.i.family === family))
                .sort((a, b) => b.s - a.s || a.order - b.order);
            const shown = hits.slice(0, limit);
            if (!shown.length) {
                return textResult(
                    `No indicator in @algolift/indicators matches${query ? ` "${query}"` : ""}${family ? ` in ${FAMILY_WORDS[family]}` : ""}. ` +
                        `It holds ${CATALOG.length} indicators ported from open-source libraries and tested against them; an indicator not ported yet is not in it. ` +
                        `The families are ${FAMILIES.map((f) => FAMILY_WORDS[f]).join(", ")}.`,
                    { total: 0, indicators: [] },
                );
            }
            const lines = [
                `${hits.length} indicator${hits.length === 1 ? "" : "s"} match${hits.length === 1 ? "es" : ""}${hits.length > shown.length ? `; the first ${shown.length}` : ""}:`,
                ...shown.map(({ i }) => `- ${i.id}: ${i.name} (${FAMILY_WORDS[i.family]}; outputs ${i.outputs.map((o) => o.name).join(", ")}). ${firstSentence(i.description)}`),
                "",
                "describe_indicator gives the settings and provenance; compute_indicator runs one on your bars.",
                PACKAGE_LINE,
            ];
            return textResult(lines.join("\n"), {
                total: hits.length,
                indicators: shown.map(({ i }) => ({ id: i.id, fn: i.fn, name: i.name, family: i.family, kind: i.kind, outputs: i.outputs.map((o) => o.name), summary: firstSentence(i.description) })),
            });
        },
    };

    const describe: ToolDef = {
        descriptor: descriptor(
            "describe_indicator",
            "Describe an indicator",
            "One indicator from @algolift/indicators in full: what it measures, which bar fields it reads, its settings with defaults and limits, its outputs, the library and file its code was ported from (with license and every change the port made) or, for a classic, how it compares with TA-Lib, and what its values were verified against.",
            {
                type: "object",
                properties: { id: { type: "string", minLength: 1, maxLength: 100, description: "The indicator's id (\"alma\", \"cdl_engulfing\"), function name or full name." } },
                required: ["id"],
                additionalProperties: false,
            },
        ),
        run(raw) {
            const args = checkArgs(raw, describe.descriptor.inputSchema);
            const i = findIndicator(args.id as string);
            if (!i) return errorResult(`No indicator "${args.id as string}".${suggestions(args.id as string)}`);
            const reads = [...new Set([...i.reads, ...(i.parameters.some((p) => p.name === "source") ? ["the source setting's value"] : [])])];
            const p = i.provenance;
            const lines = [
                `${i.name} (id ${i.id}, function ${i.fn})`,
                `Family: ${FAMILY_WORDS[i.family]}. Draws as: ${i.kind}.`,
                i.description,
                ...(i.aliases?.length ? [`Also known as: ${i.aliases.join(", ")}.`] : []),
                `Reads: ${reads.length ? reads.join(", ") : "nothing beyond its settings"}.`,
                "",
                "Settings:",
                ...(i.parameters.length ? i.parameters.map(paramLine) : ["- none"]),
                "",
                "Outputs (one value per bar, null where it has none yet):",
                ...i.outputs.map((o) => `- ${o.name} (${o.label})${o.description ? `: ${o.description}` : ""}`),
                "",
                ...(p.origin === "ported"
                    ? [`Ported from ${p.library} ${p.version}, ${p.entry} (${p.license}, ${p.copyright}): ${p.url}`, ...(p.changes ? [`What the port changed: ${p.changes}`] : [])]
                    : [
                          `Written by ${p.author} for its strategy node (${p.license}). Compared with ${p.talib.library} ${p.talib.version} (${p.talib.functions}): ${p.talib.result === "match" ? "every output TA-Lib computes matches it" : "it differs by a convention"}.`,
                          `How it differs from TA-Lib: ${p.talib.differences.join(" ")}`,
                      ]),
                `Verified against: ${i.verifiedAgainst}, value by value on fixed test bars at several settings.`,
                ...(i.oracleNote ? [`Where the comparison differs from the default: ${i.oracleNote}`] : []),
                "",
                PACKAGE_LINE,
            ];
            return textResult(lines.join("\n") + pointer(POINTER), { indicator: i });
        },
    };

    const compute: ToolDef = {
        descriptor: descriptor(
            "compute_indicator",
            "Compute an indicator",
            `Computes one indicator from @algolift/indicators on bars you pass (oldest first), and returns one value per bar for each output (null during its warmup). Pass bars as objects with open, high, low, close and volume, or columns of numbers; leave out fields the indicator does not read. Settings left out take the library's defaults. At most ${limits.indicatorBars.toLocaleString("en-US")} bars a call.`,
            {
                type: "object",
                properties: {
                    id: { type: "string", minLength: 1, maxLength: 100, description: "The indicator's id, function name or full name (list_indicators finds it)." },
                    bars: {
                        type: "array",
                        maxItems: limits.indicatorBars,
                        items: {
                            type: "object",
                            properties: { open: { type: "number" }, high: { type: "number" }, low: { type: "number" }, close: { type: "number" }, volume: { type: "number" } },
                        },
                        description: "Bars, oldest first, like [{\"open\":101.2,\"high\":102,\"low\":100.8,\"close\":101.6,\"volume\":1200}, ...]. Other fields (a time) are ignored.",
                    },
                    columns: {
                        type: "object",
                        properties: { open: numList, high: numList, low: numList, close: numList, volume: numList },
                        additionalProperties: false,
                        description: "Columns of the same length, oldest first, like {\"close\": [101.6, 101.9, 102.4]}.",
                    },
                    options: {
                        type: "object",
                        additionalProperties: { type: ["number", "string"] },
                        description: "Settings by name, like {\"period\": 20, \"source\": \"hlc3\"}. describe_indicator lists them.",
                    },
                    tail: { type: "integer", minimum: 1, maximum: limits.indicatorTextValues, description: `How many of the last values to write in the answer's text (default all, up to ${limits.indicatorTextValues}).` },
                },
                required: ["id"],
                additionalProperties: false,
            },
        ),
        run(raw) {
            const args = checkArgs(raw, compute.descriptor.inputSchema);
            const i = findIndicator(args.id as string);
            if (!i) return errorResult(`No indicator "${args.id as string}".${suggestions(args.id as string)}`);
            const columns = toColumns(args, limits.indicatorBars);
            const options = (args.options as Record<string, number | string> | undefined) ?? {};
            let outputs: Record<string, (number | null)[]>;
            let used: Record<string, number | string>;
            try {
                used = settings(i, options);
                outputs = calculate(i.id as Parameters<typeof calculate>[0], columns, options);
            } catch (e) {
                if (e instanceof TypeError || e instanceof RangeError) return errorResult(e.message);
                throw e;
            }
            const n = Object.values(columns)[0]!.length;
            const tail = Math.min((args.tail as number | undefined) ?? limits.indicatorTextValues, limits.indicatorTextValues, n);
            const settingsText = Object.entries(used).map(([k, v]) => `${k} ${v}`).join(", ");
            const lines = [`${i.name} (${i.id}) on ${n.toLocaleString("en-US")} bars${settingsText ? `, settings: ${settingsText}` : ""}.`];
            const structured: Array<Record<string, unknown>> = [];
            for (const o of i.outputs) {
                const values = outputs[o.name] ?? [];
                const first = values.findIndex((v) => v !== null);
                lines.push(
                    "",
                    `${o.name} (${o.label}): ${first < 0 ? "no value on these bars (too few bars for its warmup, or a setting it cannot use)" : `first value at bar ${first} (bars counted from 0)`}.`,
                    tail < n ? `The last ${tail} values (bars ${n - tail} to ${n - 1}):` : "Every value:",
                    JSON.stringify(values.slice(n - tail)),
                );
                structured.push({ name: o.name, label: o.label, first_value_index: first < 0 ? null : first, values });
            }
            lines.push("", PACKAGE_LINE);
            return textResult(lines.join("\n") + pointer(POINTER), { id: i.id, name: i.name, bars: n, settings: used, outputs: structured });
        },
    };

    return [list, describe, compute];
}
