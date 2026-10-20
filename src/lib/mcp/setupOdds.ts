// GENERATED from the AlgoLift app by scripts/oss/mcp/sync.mts. Do not edit here: change the app, then sync.
// src/lib/mcp/setupOdds.ts
//
// The AlgoLift MCP server's Setup Odds tools, over the open Setup Odds engine
// (github.com/algolift-ai/setup-odds; the app's copy is ../tools/setupOdds/engine,
// written by scripts/oss/setup-odds/sync-engine.mjs): how often a day-trading
// setup was followed by an outcome on 1-minute bars, with the sample, a 95%
// Wilson interval, the baseline, the stability halves, the years, the time to
// the event and every warning the engine gives.
//
//   list_setup_presets             the engine's presets, by family or by words
//   describe_setup_query_language  the language's grammar and tables (describeLanguage)
//   run_setup_odds                 one preset or setup and outcome, on the caller's bars or the demo bars
//
// The caps are the MCP server's column of the engine spec (SPEC § 10.5):
// 2,000,000 bars, 2,600 sessions, 16 MiB of CSV, 2,000 characters a text, 10
// seconds a run, no session rows, a demo of at most ten years. A surface may
// cap tighter (the hosted endpoint's HOSTED_LIMITS do), never looser.
//
// The calendar is passed in: the engine's own bundled calendar
// (defaultCalendar()) in both the open server and the app.
//
// PURE (no I/O; the run's timeout reads the clock). No em dashes in any string.

import {
    barsFromArray,
    buildHandoff,
    demoBars,
    describeLanguage,
    ENGINE_VERSION,
    formatResultText,
    listPresets,
    parseBarsCsv,
    runSetupOdds,
    type BarInput,
    type Bars,
    type Calendar,
    type HandoffResult,
    type LanguageDescription,
    type PresetFamily,
    type QueryInput,
    type RunInput,
} from "../tools/setupOdds/engine";
import { checkArgs } from "./args";
import { descriptor, errorResult, pointer, textResult, ToolInputError, type Limits, type ToolDef } from "./protocol";

/** The MCP server's caps, SPEC § 10.5. */
export const SETUP_ODDS_MCP_CAPS = {
    maxBars: 2_000_000,
    maxSessions: 2_600,
    maxCsvBytes: 16_777_216,
    maxQueryChars: 2_000,
    timeoutMs: 10_000,
    maxSessionRows: 0,
    /** The demo range, in calendar days (ten years). */
    maxDemoDays: 3_653,
} as const;

const FAMILIES: PresetFamily[] = ["gap", "opening-range", "prior-day", "overnight", "event"];
const SECTIONS = ["all", "grammar", "values", "functions", "outcomes", "examples"] as const;
type Section = (typeof SECTIONS)[number];
const YMD = /^\d{4}-\d{2}-\d{2}$/;

const DEMO_WARNING =
    "THE DEMO BARS ARE SYNTHETIC, NOT MARKET DATA. They are a seeded random series in the shape of an equity-index future, so these numbers describe the generator, not a market.";

const LIMITS_TEXT =
    "A frequency is not an edge: it places no trade, pays no cost and takes no stop. An interval holds for one question asked once; try twenty variations and one will look good by chance. Neighbouring sessions are not independent, so the real uncertainty is wider than the interval.";

const n = (x: number) => x.toLocaleString("en-US");

type EngineError = { code: string; message: string; line?: number | null; column?: number | string | null; part?: string };

/** One engine error as a line, the way the CLI prints it. */
function errorLine(e: EngineError): string {
    let where = "";
    if (typeof e.part === "string" && (e.part === "setup" || e.part === "outcome") && typeof e.column === "number") where = ` (${e.part}, column ${e.column})`;
    else if (typeof e.line === "number") where = ` (line ${e.line})`;
    return `error ${e.code}: ${e.message}${where}`;
}

function daysBetween(a: string, b: string): number {
    return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

function languageText(d: LanguageDescription, section: Section): string {
    const out: string[] = [`The Setup Odds language, version ${d.languageVersion}. A query is two texts: a setup (which sessions you ask about) and an outcome (what you want to know happened in them).`, ""];
    const want = (s: Section) => section === "all" || section === s;
    if (section === "all") out.push(`The clock: ${d.clock}`, "");
    if (want("grammar")) out.push("Grammar (EBNF):", d.grammar, "");
    if (want("values")) {
        out.push("Values:", ...d.values.map((v) => `- ${v.name} (${v.type}, known ${v.knownAt}): ${v.description}`));
        out.push("Windows and fields:", ...d.selectors.map((s) => `- ${s.name} (${s.type}): ${s.description}`), "");
        out.push("Units:", ...d.units.map((u) => `- ${u.words.join(", ")}: ${u.meaning}`), "");
    }
    if (want("functions")) {
        out.push("Functions:", ...d.functions.map((f) => `- ${f.signature} returns ${f.returns}: ${f.description}`));
        out.push("Operators:", ...d.operators.map((o) => `- ${o.symbol}: ${o.description}`), "");
    }
    if (want("outcomes")) out.push("Outcomes:", ...d.outcomes.map((o) => `- ${o.form}: ${o.description}`), "");
    if (want("examples")) out.push("Examples:", ...d.examples.map((e) => `- setup: ${e.setup} | outcome: ${e.outcome} | reads: ${e.reads}`), "");
    if (section === "all") out.push(`Keywords: ${d.keywords.join(", ")}.`);
    return out.join("\n").trimEnd();
}

function languagePart(d: LanguageDescription, section: Section): Record<string, unknown> {
    switch (section) {
        case "grammar":
            return { languageVersion: d.languageVersion, grammar: d.grammar };
        case "values":
            return { languageVersion: d.languageVersion, values: d.values, selectors: d.selectors, units: d.units };
        case "functions":
            return { languageVersion: d.languageVersion, functions: d.functions, operators: d.operators };
        case "outcomes":
            return { languageVersion: d.languageVersion, outcomes: d.outcomes };
        case "examples":
            return { languageVersion: d.languageVersion, examples: d.examples };
        default:
            return d as unknown as Record<string, unknown>;
    }
}

export function setupOddsTools(calendar: Calendar, limits: Limits): ToolDef[] {
    const caps = {
        maxBars: Math.min(SETUP_ODDS_MCP_CAPS.maxBars, limits.setupOddsBars),
        maxCsvBytes: Math.min(SETUP_ODDS_MCP_CAPS.maxCsvBytes, limits.setupOddsCsvChars),
    };

    // The demo's default range: 2023 and 2024 (about 530,000 bars), or December 2024 alone (about 30,000)
    // where the bar cap is smaller than the two years, as on the hosted endpoint.
    const DEMO_TO = "2024-12-31";
    const DEMO_FROM = caps.maxBars >= 600_000 ? "2023-01-03" : "2024-12-02";
    const DEMO_DEFAULT_WORDS = DEMO_FROM === "2023-01-03" ? "2023 and 2024" : "December 2024, as this server caps the bars";

    // The demo bars for the defaults, built once (a fraction of a second) and kept.
    let defaultDemo: Bars | null = null;
    function demo(seed: number | undefined, from: string | undefined, to: string | undefined): Bars {
        if (seed === undefined && from === undefined && to === undefined) return (defaultDemo ??= demoBars({ calendar, from: DEMO_FROM, to: DEMO_TO }));
        return demoBars({ calendar, seed, from: from ?? DEMO_FROM, to: to ?? DEMO_TO });
    }

    const presets = listPresets();

    const list: ToolDef = {
        descriptor: descriptor(
            "list_setup_presets",
            "List Setup Odds presets",
            `Lists Setup Odds' ${presets.length} ready-made setups (gaps, the opening range, the prior day, overnight, event days). Each is a setup, an outcome and its parameters with their units and ranges; run one with run_setup_odds.`,
            {
                type: "object",
                properties: {
                    family: { type: "string", enum: FAMILIES, description: "Only this family." },
                    query: { type: "string", maxLength: 200, description: "Words to search for in the presets' ids, names and descriptions." },
                },
                additionalProperties: false,
            },
        ),
        run(raw) {
            const args = checkArgs(raw, list.descriptor.inputSchema);
            const words = typeof args.query === "string" ? args.query.toLowerCase().split(/\s+/).filter(Boolean) : [];
            const hits = presets.filter((p) => (!args.family || p.family === args.family) && words.every((w) => `${p.id} ${p.name} ${p.description} ${p.family}`.toLowerCase().includes(w)));
            if (!hits.length) return textResult(`No preset matches. The families are ${FAMILIES.join(", ")}; describe_setup_query_language shows how to write a setup of your own.`, { presets: [] });
            const lines = [
                `${hits.length} preset${hits.length === 1 ? "" : "s"}:`,
                ...hits.map((p) => {
                    const params = p.params.map((x) => `${x.name}=${x.default} (${x.unit === "none" ? "a number" : x.unit}, ${x.min} to ${x.max})`).join(", ");
                    return `- ${p.id}: ${p.name} [${p.family}]. ${p.description} Setup: ${p.setup}. Outcome: ${p.outcome}.${params ? ` Params: ${params}.` : ""}`;
                }),
                "",
                "run_setup_odds runs one (preset, with params) on your bars or on the synthetic demo bars.",
            ];
            return textResult(lines.join("\n"), { presets: hits });
        },
    };

    const language: ToolDef = {
        descriptor: descriptor(
            "describe_setup_query_language",
            "Describe the Setup Odds language",
            "The Setup Odds language: a setup (a condition true or false for each session, like gap > 0.5% and or15.close > or15.open) and an outcome (an event looked for later that session, like touches prior.close by 12:00, or a condition judged later). Gives the grammar, every value, window, function, operator and outcome form, the units and worked examples, or one section of them.",
            {
                type: "object",
                properties: {
                    section: { type: "string", enum: [...SECTIONS], description: "One part only: grammar, values (with windows, fields and units), functions (with operators), outcomes or examples. Default all." },
                },
                additionalProperties: false,
            },
        ),
        run(raw) {
            const args = checkArgs(raw, language.descriptor.inputSchema);
            const section = (args.section as Section | undefined) ?? "all";
            const d = describeLanguage();
            return textResult(languageText(d, section), languagePart(d, section));
        },
    };

    const barItem = {
        type: "object" as const,
        properties: {
            time: { type: ["number", "string"] as Array<"number" | "string">, description: "The bar's time: epoch milliseconds, or a string such as 2024-03-08T09:30:00-05:00, 2024-03-08 09:30 (read in tz) or epoch seconds." },
            open: { type: "number" as const },
            high: { type: "number" as const },
            low: { type: "number" as const },
            close: { type: "number" as const },
            volume: { type: "number" as const },
        },
        required: ["time", "open", "high", "low", "close"],
        additionalProperties: false,
    };

    const run: ToolDef = {
        descriptor: descriptor(
            "run_setup_odds",
            "Run Setup Odds",
            `How often did this setup actually work? Runs one Setup Odds preset, or a setup and an outcome, on 1-minute bars and returns the engine's result: the sessions that met the setup and how many saw the outcome, with the rate and its 95% Wilson interval, the baseline over every measured session and the lift, a first-half and second-half split, counts by year, the time to the event, and every warning. Pass your bars (a list or CSV text) or demo (the engine's synthetic bars, not market data). Every time is New York time on the CME equity-index futures calendar. At most ${n(caps.maxBars)} bars, ${n(SETUP_ODDS_MCP_CAPS.maxSessions)} sessions and ${SETUP_ODDS_MCP_CAPS.timeoutMs / 1000} seconds a call. Historical frequencies, not predictions or advice.`,
            {
                type: "object",
                properties: {
                    preset: { type: "string", maxLength: 100, description: "A preset id from list_setup_presets, instead of setup and outcome (or with them, to rewrite one of its texts)." },
                    setup: { type: "string", minLength: 1, maxLength: SETUP_ODDS_MCP_CAPS.maxQueryChars, description: "Which sessions: a condition, like gap > 0.5%, or all." },
                    outcome: { type: "string", minLength: 1, maxLength: SETUP_ODDS_MCP_CAPS.maxQueryChars, description: "What happened later that session, like touches prior.close by 12:00." },
                    params: { type: "object", additionalProperties: { type: "number" }, description: "Values for the $parameters, like {\"gap\": 0.5}." },
                    bars: { type: "array", maxItems: caps.maxBars, items: barItem, description: "1-minute bars, any order, like [{\"time\":\"2024-03-08 09:30\",\"open\":5130.25,\"high\":5132,\"low\":5129.5,\"close\":5131.75,\"volume\":1200}]." },
                    csv: { type: "string", maxLength: caps.maxCsvBytes, description: "1-minute bars as CSV text: a header with timestamp (or date and time), open, high, low and close, and optionally volume." },
                    demo: {
                        type: "object",
                        properties: {
                            seed: { type: "integer", minimum: 0, maximum: 4294967295 },
                            from: { type: "string", maxLength: 10, description: `YYYY-MM-DD, default ${DEMO_FROM}.` },
                            to: { type: "string", maxLength: 10, description: "YYYY-MM-DD, default 2024-12-31." },
                        },
                        additionalProperties: false,
                        description: `Use the synthetic demo bars ({} for the defaults: seed 1, ${DEMO_DEFAULT_WORDS}). NOT market data.`,
                    },
                    tz: { type: "string", maxLength: 40, description: "The zone of CSV or list times with no offset: America/New_York (default), America/Chicago, UTC or an offset like -05:00." },
                    stamp: { type: "string", enum: ["open", "close"], description: "Whether a bar's time is its open (default) or its close." },
                    label: { type: "string", maxLength: 80, description: "A name for the bars, like \"ES 2024\"." },
                    from: { type: "string", maxLength: 10, description: "First trading day, YYYY-MM-DD." },
                    to: { type: "string", maxLength: 10, description: "Last trading day, YYYY-MM-DD." },
                    tie: { type: "string", enum: ["miss", "hit", "exclude"], description: "How A before B counts when both first happen in the same minute bar (default miss)." },
                    min_coverage: { type: "number", minimum: 0, maximum: 1, description: "The share of regular-hours minutes a session's bars must cover to count (default 0.8)." },
                    tick_size: { type: "number", minimum: 0, description: "The tick size, for a setup or outcome written in ticks." },
                    instrument: { type: "string", maxLength: 20, description: "Named in the strategy request the answer links to, like ES." },
                },
                additionalProperties: false,
            },
        ),
        run(raw) {
            const args = checkArgs(raw, run.descriptor.inputSchema);
            const hasTexts = args.setup !== undefined || args.outcome !== undefined;
            if (args.preset === undefined && !(args.setup !== undefined && args.outcome !== undefined))
                throw new ToolInputError("Pass a preset, or a setup and an outcome.");
            if (args.params !== undefined && args.preset === undefined && !hasTexts) throw new ToolInputError("params go with a preset or with texts that use $parameters.");
            const sources = [args.bars !== undefined, args.csv !== undefined, args.demo !== undefined].filter(Boolean).length;
            if (sources !== 1) throw new ToolInputError("Pass exactly one of bars, csv or demo (the synthetic demo bars, not market data).");
            for (const k of ["from", "to"] as const) if (args[k] !== undefined && !YMD.test(args[k] as string)) throw new ToolInputError(`${k} must be a date, YYYY-MM-DD.`);

            // ---- the bars
            const isDemo = args.demo !== undefined;
            let bars: Bars;
            const notes: string[] = [];
            const readOptions = { calendar, tz: args.tz as string | undefined, stamp: args.stamp as "open" | "close" | undefined, label: args.label as string | undefined, maxBars: caps.maxBars };
            if (isDemo) {
                const d = args.demo as { seed?: number; from?: string; to?: string };
                for (const k of ["from", "to"] as const) if (d[k] !== undefined && !YMD.test(d[k]!)) throw new ToolInputError(`demo.${k} must be a date, YYYY-MM-DD.`);
                const span = daysBetween(d.from ?? DEMO_FROM, d.to ?? DEMO_TO);
                if (span > SETUP_ODDS_MCP_CAPS.maxDemoDays) throw new ToolInputError("The demo range may be at most ten years.");
                if (span < 0) throw new ToolInputError("demo.from must come before demo.to.");
                bars = demo(d.seed, d.from, d.to);
            } else {
                const parsed =
                    args.csv !== undefined
                        ? parseBarsCsv(args.csv as string, { ...readOptions, maxBytes: caps.maxCsvBytes })
                        : barsFromArray((args.bars as Array<Record<string, unknown>>).map((b) => ({ ...b, t: b.time }) as unknown as BarInput), readOptions);
                if (!parsed.ok) return errorResult(["The bars could not be read:", ...parsed.errors.map(errorLine)].join("\n"));
                bars = parsed.bars;
                notes.push(...parsed.warnings.map((w) => w.message));
            }

            // ---- the run
            const query: RunInput["query"] = hasTexts
                ? ({ setup: args.setup, outcome: args.outcome, params: args.params, preset: args.preset ?? null } as QueryInput)
                : { preset: args.preset as string, params: args.params as Record<string, number> | undefined };
            const deadline = Date.now() + SETUP_ODDS_MCP_CAPS.timeoutMs;
            let timedOut = false;
            const out = runSetupOdds({
                query,
                bars,
                calendar,
                from: args.from as string | undefined,
                to: args.to as string | undefined,
                tie: args.tie as "miss" | "hit" | "exclude" | undefined,
                minCoverage: args.min_coverage as number | undefined,
                tickSize: args.tick_size as number | undefined,
                limits: { maxBars: caps.maxBars, maxSessions: SETUP_ODDS_MCP_CAPS.maxSessions, maxCsvBytes: caps.maxCsvBytes, maxQueryChars: SETUP_ODDS_MCP_CAPS.maxQueryChars, timeoutMs: SETUP_ODDS_MCP_CAPS.timeoutMs, maxSessionRows: SETUP_ODDS_MCP_CAPS.maxSessionRows },
                shouldAbort: () => (timedOut ||= Date.now() > deadline),
            });
            if (!out.ok) {
                const errors = out.errors.map((e) =>
                    e.code === "C_ABORTED" && timedOut ? { code: "C_TIMEOUT", limit: SETUP_ODDS_MCP_CAPS.timeoutMs, message: `The run took longer than ${SETUP_ODDS_MCP_CAPS.timeoutMs} ms and was stopped.` } : e,
                );
                return errorResult(
                    [...errors.map((e) => errorLine(e as EngineError)), "", "describe_setup_query_language shows the language; list_setup_presets the presets."].join("\n"),
                );
            }
            const result = out.result;
            const text = formatResultText(result);

            // ---- the honest pointer
            const handoffQuery = hasTexts ? (query as QueryInput) : (query as { preset: string; params?: Record<string, number> });
            const handoff: HandoffResult = buildHandoff(handoffQuery, { instrument: args.instrument as string | undefined, tickSize: args.tick_size as number | undefined });
            const handoffText =
                handoff.status === "home"
                    ? `To test this setup as a strategy: ${handoff.message} It needs an AlgoLift account: ${handoff.url}`
                    : `No strategy handoff: ${handoff.message}`;

            const lines = [text.trimEnd()];
            if (isDemo) lines.push("", DEMO_WARNING);
            if (notes.length) lines.push("", "Reading the bars:", ...notes.map((m) => `- ${m}`));
            lines.push("", LIMITS_TEXT, `Engine: setup-odds ${ENGINE_VERSION}.`);
            return textResult(lines.join("\n") + pointer(handoffText), { result, text, demo: isDemo, handoff });
        },
    };

    return [list, language, run];
}
