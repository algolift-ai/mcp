// GENERATED from the AlgoLift app by scripts/oss/mcp/sync.mts. Do not edit here: change the app, then sync.
// src/lib/mcp/apps/setupOdds.ts
//
// The Setup Odds card (Agent Bridge Phase 0b, § 4b's "Setup odds"): what
// run_setup_odds returns, drawn on the plate, and only that.
//
//   the numbers   the hit rate with its 95% Wilson interval, the sessions (n and
//                 how many saw the outcome), the baseline over every measured
//                 session, the lift, the two halves
//   the path      the share of the setup's sessions that had seen the outcome by
//                 each minute of the window (the engine's time-to-event bins),
//                 rising to the rate, with the rate's interval at its end and the
//                 baseline's interval as the band it is read against; a setup
//                 judged at one moment (no window) draws the two intervals instead
//   by year       the setup's rate and interval each year against that year's baseline
//
// The engine returns no multiple-testing deflation, so the card draws none; its
// honesty line carries the engine's own caveat (one question asked once) and the
// demo bars' warning. Open in AlgoLift opens the public Setup Odds page (it takes
// no setup in its URL today); "Test as a strategy" opens the Home chart with the
// request the engine built (handoff), when the engine offers one.
//
// PURE. No em dashes in any string.

export const SETUP_ODDS_CSS = String.raw`
.q{display:flex;flex-wrap:wrap;gap:6px 14px;padding:12px 16px;border-bottom:1px solid var(--line);font-size:12.5px;color:var(--t4)}
.q code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12.5px;color:var(--t2);background:var(--chip);padding:1px 6px;border-radius:5px;overflow-wrap:anywhere}
.q .qi{display:flex;gap:6px;align-items:baseline;min-width:0}
.chart{padding:8px 16px 4px}
.chart svg{display:block;width:100%;height:auto;overflow:visible}
.legend{display:flex;flex-wrap:wrap;gap:6px 16px;padding:2px 16px 8px;font-size:12px;color:var(--t4)}
.legend i{display:inline-block;width:12px;height:8px;margin-right:6px;vertical-align:middle;border-radius:2px}
.warnings{padding:0 16px 10px 40px;font-size:12px;color:var(--t3);line-height:1.5}
.warnings p{margin-top:3px}
`;

export const SETUP_ODDS_JS = String.raw`
(function(){
"use strict";
var AL = window.AL, h = AL.h, s = AL.s, CFG = AL.cfg, PAGES = CFG.pages || {};
var state = { view: "path" };
var MINUS = "−";

function pct(x, d){ return x == null ? "n/a" : (x * 100).toFixed(d == null ? 1 : d) + "%"; }
function n(x){ return x == null ? "n/a" : Number(x).toLocaleString("en-US"); }
function signed(x, unit){ return x == null ? "n/a" : (x < 0 ? MINUS : x > 0 ? "+" : "") + Math.abs(x).toFixed(1) + unit; }

function stat(label, value, twins, first){
  var kids = [h("span", { class: "label", text: label }), h("span", { class: first ? "hero" : "metric", text: value })];
  (twins || []).forEach(function(t){ if (t) kids.push(h("div", { class: "twin" }, Array.isArray(t) ? t : [t])); });
  return h("div", { class: first ? "first" : null }, kids);
}

function tierChip(r, demo){
  if (demo) return AL.status("Synthetic bars", "warn");
  var t = r.setup && r.setup.tier;
  if (t === "ok") return AL.status(n(r.setup.n) + " sessions", "");
  if (t === "thin") return AL.status("Thin sample", "warn");
  if (t === "anecdotal") return AL.status("Anecdotal", "warn");
  return AL.status("No sessions", "warn");
}

// ---- the charts: SVG drawn from the result, axes in the plate's ink
var L = 40, R = 16, T = 10, B = 26;

function stepOf(max){ return max > 0.6 ? 0.25 : max > 0.3 ? 0.1 : 0.05; }
function axisY(svg, y, max, W){
  var step = stepOf(max);
  for (var v = 0; v <= max + 1e-9; v += step) {
    s("line", { x1: L, x2: W - R, y1: y(v), y2: y(v), style: "stroke:var(--line-soft)" }, svg);
    s("text", { x: L - 6, y: y(v) + 4, "text-anchor": "end", class: "axis" }, svg).textContent = Math.round(v * 100) + "%";
  }
}

function band(svg, x0, x1, y, g, fill, line){
  if (!g || g.lo == null || g.hi == null) return;
  s("rect", { x: x0, y: y(g.hi), width: Math.max(0, x1 - x0), height: Math.max(1, y(g.lo) - y(g.hi)), fill: fill }, svg);
  if (g.rate != null && line) s("line", { x1: x0, x2: x1, y1: y(g.rate), y2: y(g.rate), style: "stroke:" + line, "stroke-dasharray": "4 4" }, svg);
}

function pathChart(r){
  var tte = r.timeToEvent, base = r.baseline, set = r.setup;
  var bins = (tte && tte.bins) || [];
  var span = bins.length ? bins[bins.length - 1].hi : 0;
  var W = AL.chartWidth(), H = W < 480 ? 160 : 210;
  var svg = s("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "The share of the setup's sessions that had seen the outcome, by minutes after " + tte.start + ", against the baseline's interval" });
  var top = Math.min(1, Math.max(set.hi || 0, base.hi || 0, 0.1) * 1.05), max = Math.min(1, Math.ceil(top / stepOf(top) - 1e-9) * stepOf(top));
  var x = function(m){ return L + (m / span) * (W - L - R - 14); };
  var y = function(v){ return T + (1 - v / max) * (H - T - B); };
  axisY(svg, y, max, W);
  band(svg, L, W - R - 14, y, base, "rgba(161,161,170,.16)", "var(--t4)");
  var d = "M" + x(0) + "," + y(0);
  bins.forEach(function(b){ d += " L" + x(b.lo).toFixed(1) + "," + y(b.cumulative - b.count / Math.max(1, set.n)).toFixed(1) + " L" + x(b.hi).toFixed(1) + "," + y(b.cumulative).toFixed(1); });
  s("path", { d: d + " L" + x(span) + "," + y(0) + " L" + x(0) + "," + y(0) + " Z", fill: "rgba(0,114,245,.14)" }, svg);
  s("path", { d: d, fill: "none", stroke: "#0072f5", "stroke-width": 2, "stroke-linejoin": "round" }, svg);
  // the rate's interval at the end of the window
  var ex = W - R - 6;
  if (set.lo != null && set.hi != null) {
    s("line", { x1: ex, x2: ex, y1: y(set.hi), y2: y(set.lo), stroke: "#0072f5", "stroke-width": 3, "stroke-linecap": "round" }, svg);
    s("circle", { cx: ex, cy: y(set.rate), r: 4, fill: "#0072f5", style: "stroke:var(--bg)", "stroke-width": 1.5 }, svg);
  }
  var ticks = 4, labelOf = function(m){ return "+" + m + "m"; };
  for (var i = 0; i <= ticks; i++) {
    var m = Math.round(span * i / ticks);
    s("text", { x: x(m), y: H - 6, "text-anchor": i === 0 ? "start" : i === ticks ? "end" : "middle", class: "axis" }, svg).textContent = i === 0 ? tte.start : labelOf(m);
  }
  var legend = h("div", { class: "legend" }, [
    h("span", {}, [h("i", { style: "background:#0072f5" }), "Setup sessions that saw it (n " + n(set.n) + ")"]),
    h("span", {}, [h("i", { style: "background:rgba(161,161,170,.35)" }), "Baseline, all " + n(base.n) + " sessions, 95% interval"])
  ]);
  return [h("div", { class: "chart" }, [svg]), legend];
}

function intervalChart(r){
  var rows = [["Setup", r.setup, "#0072f5"], ["Baseline", r.baseline, "#a1a1aa"]];
  if (r.complement && r.complement.n) rows.push(["Not the setup", r.complement, "#a1a1aa"]);
  var rowH = 34, Hh = rows.length * rowH + 30, W = AL.chartWidth(), LW = W < 480 ? 112 : 132;
  var svg = s("svg", { viewBox: "0 0 " + W + " " + Hh, role: "img", "aria-label": "Each group's rate with its 95% interval" });
  var x = function(v){ return LW + 8 + v * (W - LW - 8 - R - 8); };
  [0, 0.25, 0.5, 0.75, 1].forEach(function(v){
    s("line", { x1: x(v), x2: x(v), y1: 4, y2: Hh - 22, style: "stroke:var(--line-soft)" }, svg);
    s("text", { x: x(v), y: Hh - 6, "text-anchor": "middle", class: "axis" }, svg).textContent = Math.round(v * 100) + "%";
  });
  rows.forEach(function(row, i){
    var g = row[1], cy = 18 + i * rowH;
    s("text", { x: 0, y: cy + 4, class: "axis" }, svg).textContent = row[0] + " (n " + n(g.n) + ")";
    if (g.lo != null) s("line", { x1: x(g.lo), x2: x(g.hi), y1: cy, y2: cy, stroke: row[2], "stroke-width": 4, "stroke-linecap": "round", "stroke-opacity": i ? 0.6 : 1 }, svg);
    if (g.rate != null) s("circle", { cx: x(g.rate), cy: cy, r: 5, fill: row[2], style: "stroke:var(--bg)", "stroke-width": 1.5 }, svg);
  });
  return [h("div", { class: "chart" }, [svg])];
}

function yearChart(r){
  var ys = r.byYear || [];
  var rowH = 30, Hh = ys.length * rowH + 30, W = AL.chartWidth(), LW = W < 480 ? 118 : 132;
  var svg = s("svg", { viewBox: "0 0 " + W + " " + Hh, role: "img", "aria-label": "The setup's rate and interval each year, against that year's baseline" });
  var x = function(v){ return LW + 8 + v * (W - LW - 8 - R - 8); };
  [0, 0.25, 0.5, 0.75, 1].forEach(function(v){
    s("line", { x1: x(v), x2: x(v), y1: 4, y2: Hh - 22, style: "stroke:var(--line-soft)" }, svg);
    s("text", { x: x(v), y: Hh - 6, "text-anchor": "middle", class: "axis" }, svg).textContent = Math.round(v * 100) + "%";
  });
  ys.forEach(function(row, i){
    var cy = 16 + i * rowH, g = row.setup, b = row.baseline;
    s("text", { x: 0, y: cy + 4, class: "axis" }, svg).textContent = row.year + "  " + n(g.k) + " of " + n(g.n) + (row.few ? " (few)" : "");
    if (b && b.rate != null) s("line", { x1: x(b.rate), x2: x(b.rate), y1: cy - 9, y2: cy + 9, style: "stroke:var(--t4)", "stroke-width": 2 }, svg);
    if (g.lo != null) s("line", { x1: x(g.lo), x2: x(g.hi), y1: cy, y2: cy, stroke: "#0072f5", "stroke-width": 4, "stroke-linecap": "round", "stroke-opacity": row.few ? 0.5 : 1 }, svg);
    if (g.rate != null) s("circle", { cx: x(g.rate), cy: cy, r: 4.5, fill: "#0072f5", style: "stroke:var(--bg)", "stroke-width": 1.5 }, svg);
  });
  var legend = h("div", { class: "legend" }, [
    h("span", {}, [h("i", { style: "background:#0072f5" }), "Setup rate, 95% interval"]),
    h("span", {}, [h("i", { style: "background:var(--t4);width:3px" }), "That year's baseline"])
  ]);
  return [h("div", { class: "chart" }, [svg]), legend];
}

function card(sc){
  var r = sc.result, demo = !!sc.demo, handoff = sc.handoff;
  var set = r.setup || {}, base = r.baseline || {}, lift = r.lift || {}, st = r.stability || {};
  var q = r.query || {}, win = q.window || {}, data = r.data || {}, ses = r.sessions || {};
  var hasPath = !!(r.timeToEvent && r.timeToEvent.bins && r.timeToEvent.bins.length && set.n);
  var hasYears = (r.byYear || []).length >= 2;
  if (state.view === "path" && !hasPath) state.view = "intervals";
  if (state.view === "years" && !hasYears) state.view = hasPath ? "path" : "intervals";

  var title = q.preset ? "Setup Odds: " + q.preset : "Setup Odds";
  var meta = (data.label || "your bars") + " · " + AL.dayRange(ses.firstDay, ses.lastDay);
  var headEl = h("div", { class: "c-head" }, [AL.mark(), h("span", { class: "c-ttl", text: title }), h("span", { class: "c-meta wide", text: meta }), h("span", { class: "c-gap" }), tierChip(r, demo)]);

  var when = win.kind === "event" ? win.start + " to " + win.end + " New York" : win.kind === "state" ? "known at " + win.knownAt + " New York" : "";
  var query = h("div", { class: "q" }, [
    h("span", { class: "qi" }, ["Setup", h("code", { text: q.setup || "" })]),
    h("span", { class: "qi" }, ["Outcome", h("code", { text: q.outcome || "" })]),
    when ? h("span", { class: "qi", text: when }) : null
  ]);

  var halves = st.withheld || !st.first || !st.second ? null : pct(st.first.rate, 0) + " / " + pct(st.second.rate, 0);
  var stats = h("div", { class: "stats" }, [
    stat("Hit rate", pct(set.rate), [set.lo != null ? ["95% interval ", h("b", { text: pct(set.lo) + " to " + pct(set.hi) })] : "no interval"], true),
    stat("Sessions", n(set.n), [n(set.k) + " saw the outcome"]),
    stat("Baseline", pct(base.rate), ["all " + n(base.n) + " measured"]),
    stat("Lift", lift.points == null ? "n/a" : signed(lift.points * 100, " pts"), [lift.baselineInsideInterval ? "baseline inside the interval" : lift.ratio != null ? lift.ratio.toFixed(2) + "x the baseline" : null]),
    stat("Halves", halves || "withheld", [halves ? "first / second half" : "too few to split"])
  ]);

  function tab(id, label){ return h("button", { class: "tab" + (state.view === id ? " on" : ""), type: "button", "aria-pressed": state.view === id ? "true" : "false", onclick: function(){ state.view = id; AL.draw(); } }, [label]); }
  var tabEls = [hasPath ? tab("path", "Path") : null, tab("intervals", "Intervals"), hasYears ? tab("years", "By year") : null];
  var chartLabel = state.view === "path" ? "Share that saw it, by minute" : state.view === "years" ? "Each year" : "Rates, 95% intervals";
  var bar = h("div", { class: "bar-row" }, [h("span", { class: "label", text: chartLabel }), h("span", { class: "c-gap" }), h("div", { class: "tabs", role: "group", "aria-label": "Chart" }, tabEls)]);
  var chart = state.view === "path" ? pathChart(r) : state.view === "years" ? yearChart(r) : intervalChart(r);

  var honestText = demo
    ? [h("b", { text: "Synthetic demo bars, not market data:" }), " these numbers describe the generator, not a market."]
    : [h("b", { text: "A frequency is not an edge." }), " The interval holds for one question asked once; try twenty variations and one will look good by chance."];
  var honest = h("div", { class: "honest" + (demo || set.tier !== "ok" ? " warn" : "") }, [demo || set.tier !== "ok" ? AL.warnIcon() : AL.infoIcon(), h("span", {}, honestText)]);
  var warns = (r.warnings || []).slice(0, 2).map(function(w){ return h("p", { text: w.message }); });
  if ((r.warnings || []).length > 2) warns.push(h("p", { text: "And " + (r.warnings.length - 2) + " more in the text result." }));

  var actions = [h("span", { class: "rcpt" }, ["Engine", h("span", { class: "tn", text: "setup-odds " + r.engineVersion })]), h("span", { class: "c-gap" })];
  if (handoff && handoff.status === "home" && handoff.url) actions.push(AL.link(AL.ours(handoff.url), "move", ["Test as a strategy"], "Test as a strategy in AlgoLift"));
  actions.push(AL.openButton(AL.ours(PAGES.setupOdds || "/tools/setup-odds")));

  return h("div", { class: "card" }, [headEl, query, stats, bar].concat(chart, [honest, warns.length ? h("div", { class: "warnings" }, warns) : null, h("div", { class: "c-foot" }, actions)]));
}

AL.render = function(result, input, root){
  root.textContent = "";
  if (!result) { root.appendChild(AL.skeleton("Setup Odds")); return; }
  var sc = result.structuredContent;
  if (result.cancelled || result.isError || !sc || !sc.result) { root.appendChild(AL.problem("Setup Odds", result)); return; }
  root.appendChild(card(sc));
};
AL.draw();
})();
`;
