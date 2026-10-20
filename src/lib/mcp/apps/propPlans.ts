// GENERATED from the AlgoLift app by scripts/oss/mcp/sync.mts. Do not edit here: change the app, then sync.
// src/lib/mcp/apps/propPlans.ts
//
// The prop plan card (Agent Bridge Phase 0b, § 4b's "Prop plan compare"): what
// compare_prop_plans and get_prop_plan_rules return, drawn on the plate.
//
//   compare_prop_plans   the plans side by side on the comparison's rows (the key
//                        rows first, every row a click away), each plan under its
//                        firm's mark; a value that is not verified says so in amber
//   get_prop_plan_rules  one plan as a plate: five headline rules, then every rule
//
// Two views from the result already in the card: Rules (the values) and Sources
// (each value's status, date and the firm's page it was checked against, which
// opens through the host). The card shows only what the tool returned; it adds
// the firms' marks and the page map, both static. Open in AlgoLift opens the
// plan's public page, the firm's, the two firms' comparison, or the prop firms
// hub, whichever fits the plans shown (protocol.ts SitePages).
//
// PURE. No em dashes in any string.

export const PROP_PLANS_CSS = String.raw`
.plans{display:grid;border-bottom:1px solid var(--line)}
.plans .ph{padding:12px 12px 12px 0;display:flex;gap:9px;align-items:center;min-width:0}
.plans .ph:first-child{padding-left:16px}
.ph .nm{min-width:0}
.ph .fm{font-size:12px;color:var(--t4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ph .pn{font-size:13px;font-weight:600;color:var(--t1);line-height:1.3}
.grid{display:grid;align-items:stretch}
.grid>div{padding:9px 12px 9px 0;border-top:1px solid var(--line-soft);min-width:0;font-size:13px}
.grid>div.rl{padding-left:16px;color:var(--t3);font-size:12.5px}
.grid .val{color:var(--t2);font-weight:500;overflow-wrap:anywhere}
.grid .val.muted{color:var(--t4);font-weight:400}
.grid .val.warn{color:var(--warn-ink)}
.plans.stack .ph{padding:10px 8px 10px 0;flex-direction:column;align-items:flex-start;gap:6px}
.plans.stack .ph:first-child{padding-left:16px}
.plans.stack .pn{font-size:12.5px}
.plans .ph{overflow:hidden}
.plans.stack .nm{width:100%}
.ph .pn{overflow:hidden;text-overflow:ellipsis}
.grid.stack>div{padding:6px 8px 8px 0;border-top:0}
.grid.stack>div:nth-child(1){border-top:0}
.grid.stack>div.rl{padding:8px 16px 0;border-top:1px solid var(--line-soft);font-size:12px;color:var(--t4)}
.grid.stack>div:not(.rl){padding-left:0}
.grid.stack>div.rl+div{padding-left:16px}
.grid.stack .val{font-size:13px}
.blocks .blk{padding:10px 16px;border-top:1px solid var(--line-soft)}
.blocks .blk:first-child{border-top:0}
.blocks .rt{font-size:12.5px;color:var(--t3);margin-bottom:6px}
.blocks .pv{display:flex;align-items:flex-start;gap:9px;padding:4px 0}
.blocks .pv .who{flex:1;min-width:0;font-size:12.5px;color:var(--t4);line-height:1.35;padding-top:2px}
.blocks .pv .what{text-align:right;max-width:58%}
.more{padding:6px 12px 10px 8px}
.srcline{font-size:12px;color:var(--t4);line-height:1.45;margin-top:2px}
.srcline .ok{color:var(--pos-ink);font-weight:600}
.srcline .warn{color:var(--warn-ink);font-weight:600}
.groups .gt{padding:12px 16px 4px;border-top:1px solid var(--line)}
.rows .r{display:flex;gap:12px;padding:7px 16px;border-top:1px solid var(--line-soft);align-items:flex-start}
.rows .r:first-child{border-top:0}
.rows .k{flex:1;min-width:0;font-size:12.5px;color:var(--t3)}
.rows .v{text-align:right;max-width:60%}
.notes{padding:10px 16px;border-top:1px solid var(--line-soft)}
.notes p{font-size:12px;color:var(--t4);line-height:1.5;margin-top:4px}
`;

export const PROP_PLANS_JS = String.raw`
(function(){
"use strict";
var AL = window.AL, h = AL.h, CFG = AL.cfg, PAGES = CFG.pages || {}, LOGOS = CFG.logos || {};
var KEY_ROWS = ["evaluation.profit_target", "evaluation.max_drawdown", "evaluation.drawdown_type", "evaluation.daily_loss_limit", "evaluation.consistency_max_day_pct", "payouts.profit_split_pct", "prices.evaluation_fee", "prices.activation_fee"];
var GROUP_TITLE = { account: "Account", evaluation: "Evaluation", funded: "Funded account", payouts: "Payouts", prices: "Prices" };
var state = { view: "rules", all: false };

function notVerified(v){ return !!v && (v.status === "differs" || v.status === "unverified"); }
function initials(name){ return String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(function(w){ return w[0]; }).join("").toUpperCase(); }
function stone(firm, small){
  var src = firm && LOGOS[firm.slug];
  return h("span", { class: "stone" + (small ? " sm" : ""), title: firm ? firm.name : null }, [src ? h("img", { src: src, alt: firm.name + " logo" }) : (firm ? initials(firm.name) : "?")]);
}

/** A value as the card says it: amber with NOT VERIFIED when the data says so, a quiet tag when the firm does not state it. */
function valueCell(v, emptyText){
  if (!v) return h("div", {}, [h("span", { class: "val muted", text: emptyText })]);
  var kids = [h("span", { class: "val" + (notVerified(v) ? " warn" : v.status === "not_stated" ? " muted" : ""), text: v.value_text })];
  if (notVerified(v)) kids.push(h("div", {}, [h("span", { class: "flag warn", text: v.status === "differs" ? "NOT VERIFIED: the firm's page differs" : "NOT VERIFIED: not cited" })]));
  else if (v.status === "not_stated") kids.push(h("div", {}, [h("span", { class: "flag", text: "Not stated by the firm" })]));
  else if (v.stale) kids.push(h("div", {}, [h("span", { class: "flag warn", text: "Re-check due" })]));
  return h("div", {}, kids);
}

/** The same value's provenance: its status word, the date and the firm's page. */
function sourceCell(v, emptyText){
  if (!v) return h("div", {}, [h("span", { class: "val muted", text: emptyText })]);
  var word = v.status === "verified" ? (v.stale ? "Verified, re-check due" : "Verified") : v.status === "not_stated" ? "Not stated by the firm" : v.status === "differs" ? "NOT VERIFIED: differs" : "NOT VERIFIED: not cited";
  var tone = v.status === "verified" && !v.stale ? "ok" : notVerified(v) || v.stale ? "warn" : "";
  var line = [h("span", { class: tone, text: word })];
  if (v.verified) line.push(" " + AL.day(v.verified));
  var kids = [h("div", { class: "srcline" }, line)];
  if (v.source_url) kids.push(h("div", { class: "srcline" }, [AL.link(v.source_url, "src", [AL.host_(v.source_url) || "source"], "The firm's page: " + v.source_url)]));
  else kids.push(h("div", { class: "srcline", text: "No source recorded" }));
  return h("div", {}, kids);
}

function cell(v, emptyText){ return state.view === "sources" ? sourceCell(v, emptyText) : valueCell(v, emptyText); }

/** Where Open in AlgoLift goes for these plans. */
function destination(plans){
  if (plans.length === 1) { var p = plans[0]; return (PAGES.plans || {})[p.id] || (PAGES.firms || {})[p.firm.slug] || PAGES.dataset || "/"; }
  var firms = [];
  plans.forEach(function(p){ if (firms.indexOf(p.firm.slug) < 0) firms.push(p.firm.slug); });
  if (firms.length === 1) return (PAGES.firms || {})[firms[0]] || PAGES.propHub || "/";
  if (firms.length === 2) { var pair = (PAGES.pairs || {})[firms.slice().sort().join("|")]; if (pair) return pair; }
  return (PAGES.propHub || "/") + "#compare";
}

function head(title, meta, chip, logo){
  return h("div", { class: "c-head" }, [logo || AL.mark(), h("span", { class: "c-ttl", text: title }), meta ? h("span", { class: "c-meta wide", text: meta }) : null, h("span", { class: "c-gap" }), chip]);
}

function chipFor(cells){
  var nv = 0, ns = 0, stale = 0, n = 0;
  cells.forEach(function(v){ if (!v) return; n++; if (notVerified(v)) nv++; else if (v.status === "not_stated") ns++; else if (v.stale) stale++; });
  if (nv) return { el: AL.status(nv + " not verified", "warn"), nv: nv, ns: ns, stale: stale };
  if (stale) return { el: AL.status("Re-check due", "warn"), nv: 0, ns: ns, stale: stale };
  return { el: AL.status("Verified", "ok"), nv: 0, ns: ns, stale: 0, n: n };
}

function honest(c, dataset){
  var warn = c.nv > 0 || c.stale > 0;
  var text = [];
  if (c.nv) text.push(h("b", { text: c.nv + (c.nv === 1 ? " value is" : " values are") + " NOT VERIFIED:" }), " not confirmed on the firm's page. ");
  else text.push("Every value checked against the firm's own page" + (c.ns ? ", or marked where the firm does not state it" : "") + ". ");
  if (c.stale) text.push(c.stale + " past the " + (dataset && dataset.recheck_window_days || 45) + "-day re-check window. ");
  text.push("Firms change rules often: read the firm's page before you buy.");
  return h("div", { class: "honest" + (warn ? " warn" : "") }, [warn ? AL.warnIcon() : AL.infoIcon(), h("span", {}, text)]);
}

function foot(dataset, url){
  var checked = dataset ? AL.dayRange(dataset.oldest_check, dataset.newest_check) : "";
  return h("div", { class: "c-foot" }, [
    h("span", { class: "rcpt" }, checked ? ["Rules checked", h("span", { class: "tn", text: checked })] : []),
    h("span", { class: "c-gap" }),
    AL.openButton(AL.ours(url))
  ]);
}

function tabs(){
  function tab(id, label){ return h("button", { class: "tab" + (state.view === id ? " on" : ""), type: "button", "aria-pressed": state.view === id ? "true" : "false", onclick: function(){ state.view = id; AL.draw(); } }, [label]); }
  return h("div", { class: "tabs", role: "group", "aria-label": "View" }, [tab("rules", "Rules"), tab("sources", "Sources")]);
}

// ------------------------------------------------------------ compare_prop_plans

function compareCard(sc){
  var plans = sc.plans || [], rows = sc.rows || [];
  var all = [];
  rows.forEach(function(r){ (r.cells || []).forEach(function(v){ all.push(v); }); });
  var c = chipFor(all);
  var shown = state.all ? rows : rows.filter(function(r){ return KEY_ROWS.indexOf(r.rule) >= 0 || (r.cells || []).some(notVerified); });
  var hidden = rows.length - shown.length;
  // Three layouts, by the room each plan gets: a table (a rule per row), a stack (the rule over its values, a column a plan), and blocks (a line a plan).
  var width = (document.getElementById("root").clientWidth || window.innerWidth);
  var mode = width >= 150 + plans.length * 104 ? "table" : width >= plans.length * 78 ? "stack" : "blocks";
  var empty = function(r){ return r.rule.indexOf("evaluation.") === 0 ? "No evaluation" : "Not in the data"; };
  var body;
  if (mode === "table" || mode === "stack") {
    var cols = mode === "table" ? "minmax(120px,1.1fr) repeat(" + plans.length + ",minmax(0,1fr))" : "repeat(" + plans.length + ",minmax(0,1fr))";
    var lead = mode === "table" ? [h("div", { class: "ph" })] : [];
    var header = h("div", { class: "plans" + (mode === "stack" ? " stack" : ""), style: "grid-template-columns:" + cols }, lead.concat(plans.map(function(p){
      return h("div", { class: "ph" }, [stone(p.firm, mode === "stack"), h("div", { class: "nm" }, [h("div", { class: "fm", text: p.firm.name }), h("div", { class: "pn", text: p.name }), p.status === "discontinued" ? h("span", { class: "flag", text: "No longer sold" }) : null])]);
    })));
    var cells = [];
    shown.forEach(function(r){
      cells.push(h("div", { class: "rl" + (mode === "stack" ? " span" : ""), style: mode === "stack" ? "grid-column:1 / -1" : null, text: r.label }));
      (r.cells || []).forEach(function(v){ cells.push(cell(v, empty(r))); });
    });
    body = [header, h("div", { class: "grid" + (mode === "stack" ? " stack" : ""), style: "grid-template-columns:" + cols, role: "table" }, cells)];
  } else {
    body = [h("div", { class: "blocks" }, shown.map(function(r){
      return h("div", { class: "blk" }, [h("div", { class: "rt", text: r.label })].concat(plans.map(function(p, i){
        var w = cell((r.cells || [])[i], empty(r));
        w.className = "what";
        return h("div", { class: "pv" }, [stone(p.firm, true), h("span", { class: "who", text: p.firm.name + " " + p.name }), w]);
      })));
    }))];
  }
  var bar = h("div", { class: "bar-row" }, [h("span", { class: "label", text: state.view === "sources" ? "Status, date and source" : (state.all ? "Every rule compared" : "Key rules") }), h("span", { class: "c-gap" }), tabs()]);
  var more = rows.length > shown.length || state.all
    ? h("div", { class: "more" }, [h("button", { class: "move", type: "button", onclick: function(){ state.all = !state.all; AL.expand(state.all); AL.draw(); } }, [state.all ? "Key rules only" : "All " + rows.length + " rules (" + hidden + " more)"])])
    : null;
  var title = plans.length === 1 ? plans[0].firm.name + " " + plans[0].name : plans.map(function(p){ return p.firm.name; }).filter(function(n, i, a){ return a.indexOf(n) === i; }).join(" vs ");
  return h("div", { class: "card" }, [head(title, "Prop plans compared", c.el)].concat([bar], body, [more, honest(c, sc.dataset), foot(sc.dataset, destination(plans))]));
}

// ------------------------------------------------------------ get_prop_plan_rules

function ruleOf(rules, id){ for (var i = 0; i < rules.length; i++) if (rules[i].id === id) return rules[i]; return null; }

function stat(label, v, twin, first){
  var val = v ? v.value_text : "Not in the data";
  var kids = [h("span", { class: "label", text: label }), h("span", { class: first ? "hero" : "metric", style: v && notVerified(v) ? "color:var(--warn-ink)" : null, text: val })];
  if (v && notVerified(v)) kids.push(h("div", { class: "twin" }, [h("span", { class: "flag warn", text: "NOT VERIFIED" })]));
  else if (v && v.status === "not_stated") kids.push(h("div", { class: "twin", text: "Not stated by the firm" }));
  if (twin) kids.push(h("div", { class: "twin", text: twin }));
  return h("div", { class: first ? "first" : null }, kids);
}

function planCard(sc){
  var p = sc.plan, rules = sc.rules || [];
  var c = chipFor(rules);
  var hasEval = rules.some(function(r){ return r.group === "evaluation"; });
  var g = function(id){ return ruleOf(rules, id); };
  var dd = g(hasEval ? "evaluation.max_drawdown" : "funded.max_drawdown"), ddt = g(hasEval ? "evaluation.drawdown_type" : "funded.drawdown_type");
  var fee = g("prices.evaluation_fee"), act = g("prices.activation_fee"), days = g("evaluation.min_trading_days");
  var stats = h("div", { class: "stats" }, [
    hasEval ? stat("Profit target", g("evaluation.profit_target"), "to pass the evaluation", true) : stat("Max drawdown", dd, ddt ? ddt.value_text : null, true),
    hasEval ? stat("Max drawdown", dd, ddt ? ddt.value_text : null) : stat("Daily loss", g("funded.daily_loss_limit"), "funded account"),
    hasEval ? stat("Daily loss", g("evaluation.daily_loss_limit"), "evaluation") : stat("Profit split", g("payouts.profit_split_pct"), null),
    hasEval ? stat("Consistency", g("evaluation.consistency_max_day_pct"), days ? "min days: " + days.value_text : null) : stat("Largest payout", g("payouts.max_payout"), null),
    stat("Evaluation fee", fee, act ? "activation " + act.value_text : null)
  ]);
  var body = [stats];
  var bar = h("div", { class: "bar-row" }, [h("span", { class: "label", text: state.all ? "Every rule and price" : "The headline rules" }), h("span", { class: "c-gap" }), state.all ? tabs() : null]);
  body.push(bar);
  if (state.all) {
    var groups = [];
    ["account", "evaluation", "funded", "payouts", "prices"].forEach(function(gid){
      var rs = rules.filter(function(r){ return r.group === gid; });
      if (!rs.length && gid !== "evaluation") return;
      var list = rs.length ? rs.map(function(r){ var v = cell(r, ""); v.className = "v"; return h("div", { class: "r" }, [h("span", { class: "k", text: r.label }), v]); })
        : [h("div", { class: "r" }, [h("span", { class: "k", text: "No evaluation: the fee buys a funded account directly." })])];
      groups.push(h("div", { class: "groups" }, [h("div", { class: "gt" }, [h("span", { class: "label", text: GROUP_TITLE[gid] })]), h("div", { class: "rows" }, list)]));
    });
    body = body.concat(groups);
    var notes = sc.simulation_notes || [];
    if (notes.length) body.push(h("div", { class: "notes" }, [h("span", { class: "label", text: "What AlgoLift's simulation leaves out" })].concat(notes.map(function(n){ return h("p", { text: n }); }))));
  }
  body.push(h("div", { class: "more" }, [h("button", { class: "move", type: "button", onclick: function(){ state.all = !state.all; if (!state.all) state.view = "rules"; AL.expand(state.all); AL.draw(); } }, [state.all ? "Headline rules only" : "Every rule, with its source (" + rules.length + (c.nv ? ", " + c.nv + " not verified" : "") + ")"])]));
  var title = p.firm.name + " " + p.name;
  var meta = p.status === "discontinued" ? "No longer sold" : "Prop plan";
  return h("div", { class: "card" }, [head(title, meta, c.el, stone(p.firm, true))].concat(body, [honest(c, sc.dataset), foot(sc.dataset, destination([p]))]));
}

AL.relayout = function(){ AL.draw(); };
AL.render = function(result, input, root){
  root.textContent = "";
  if (!result) { root.appendChild(AL.skeleton("Prop plans")); return; }
  var sc = result.structuredContent;
  if (result.cancelled || result.isError || !sc) { root.appendChild(AL.problem("Prop plans", result)); return; }
  if (sc.rows && sc.plans) root.appendChild(compareCard(sc));
  else if (sc.plan && sc.rules) root.appendChild(planCard(sc));
  else root.appendChild(AL.problem("Prop plans", result));
};
AL.draw();
})();
`;
