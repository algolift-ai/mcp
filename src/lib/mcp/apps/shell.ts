// GENERATED from the AlgoLift app by scripts/oss/mcp/sync.mts. Do not edit here: change the app, then sync.
// src/lib/mcp/apps/shell.ts
//
// The in-chat cards' shell (Agent Bridge Phase 0b, plan/features/agent-bridge.md
// § 4b; the approved mock: plan/design/agent-bridge/run-card/round1.html, A "the
// plate"): one self-contained HTML document per card, its CSS and script inline,
// no request to any origin. A host that speaks MCP Apps (the extension
// io.modelcontextprotocol/ui, spec 2026-01-26) renders it in a sandboxed iframe
// beside the tool's text result, which always stands on its own.
//
// The bridge is the spec's own postMessage protocol, written here without a
// dependency (the spec: "The App class ... is a convenience wrapper, not a
// requirement"): ui/initialize, ui/notifications/initialized, the host's
// tool-input, tool-result, tool-cancelled and host-context-changed, ui/open-link,
// ui/notifications/size-changed. ChatGPT's window.openai is read only where the
// shared bridge has no counterpart (openExternal, notifyIntrinsicHeight) or as a
// fallback for its older globals.
//
// The plate: AlgoLift's tokens (#09090b ground, hairlines, Inter, tabular
// numbers, the flat #0072f5 primary, amber for over or unverified, green for
// verified), dark by default and light when the host says its theme is light.
// Prose never dimmer than #9ca3af on the dark plate or under 11.5px.
//
// PURE. No em dashes in any string (the cards are public copy).

/** The MCP Apps resource MIME type (spec 2026-01-26). */
export const APP_MIME = "text/html;profile=mcp-app";

/** The MCP Apps protocol version the cards ask for in ui/initialize. */
export const APPS_PROTOCOL_VERSION = "2026-01-26";

/** The extension's identifier, as servers and hosts declare it in their capabilities. */
export const APPS_EXTENSION = "io.modelcontextprotocol/ui";

/** What every card is handed at build time: static configuration, never user data. */
export interface CardConfig {
    /** The card's id, also its utm_campaign ("prop_plans", "setup_odds"). */
    card: string;
    /** The server's version. */
    version: string;
    /** The site Open in AlgoLift opens, "https://www.algolift.ai". */
    site: string;
    /** Anything else the card's script reads (the page map, the firm marks). */
    [key: string]: unknown;
}

/** JSON inside a <script> element: nothing in it can close the element. */
export function scriptJson(value: unknown): string {
    return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

const escapeText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ---------------------------------------------------------------- the plate's CSS

export const BASE_CSS = String.raw`
:root{color-scheme:dark;
  --bg:#09090b;--line:rgba(255,255,255,.09);--line-soft:rgba(255,255,255,.06);--wash:rgba(255,255,255,.04);
  --t1:#f4f4f5;--t2:#e4e4e7;--t3:#d4d4d8;--t4:#a1a1aa;
  --pos:#28b537;--pos-ink:#4ade80;--neg:#f87171;--warn:#f59e0b;--warn-ink:#fcd34d;--blue:#0072f5;--blue-hover:#1a80ff;
  --chip:rgba(255,255,255,.06);--tab-on:rgba(255,255,255,.08);
  --sa-t:0px;--sa-r:0px;--sa-b:0px;--sa-l:0px}
:root[data-theme="light"]{color-scheme:light;
  --bg:#ffffff;--line:rgba(9,9,11,.12);--line-soft:rgba(9,9,11,.07);--wash:rgba(9,9,11,.035);
  --t1:#09090b;--t2:#18181b;--t3:#27272a;--t4:#52525b;
  --pos:#15803d;--pos-ink:#15803d;--neg:#b91c1c;--warn:#d97706;--warn-ink:#92400e;
  --chip:rgba(9,9,11,.06);--tab-on:rgba(9,9,11,.08)}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:transparent}
body{color:var(--t1);font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased;font-feature-settings:"cv11","ss03";font-size:13px;line-height:1.45;
  padding:var(--sa-t) var(--sa-r) var(--sa-b) var(--sa-l)}
p,h1,h2,h3{margin:0}
button{font:inherit;color:inherit;border:0;cursor:pointer;padding:0;background:transparent;margin:0;appearance:none}
a{color:inherit;text-decoration:none}
.tn,.metric,.hero,.twin,.val{font-variant-numeric:tabular-nums}
.card{background:var(--bg);border:1px solid var(--line);border-radius:12px;overflow:hidden;color:var(--t1)}
.c-head{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--line);min-width:0}
.mark{width:18px;height:18px;flex:none}
.c-ttl{font-size:13px;font-weight:600;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.c-meta{font-size:12px;color:var(--t4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.c-gap{flex:1;min-width:0}
.status{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--t3);white-space:nowrap;flex:none}
.status .d{width:6px;height:6px;border-radius:50%;background:var(--t4)}
.status.ok{color:var(--pos-ink)}.status.ok .d{background:var(--pos)}
.status.warn{color:var(--warn-ink)}.status.warn .d{background:var(--warn)}
.label{display:block;font-size:11.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--t4)}
.hero{font-size:28px;font-weight:600;letter-spacing:-.02em;line-height:1.05}
.metric{font-size:17px;font-weight:600;line-height:1.25;color:var(--t2)}
.cap{font-size:12px;color:var(--t4);line-height:1.5}
.twin{font-size:12px;color:var(--t4);margin-top:3px;line-height:1.4}
.twin b{color:var(--t3);font-weight:600}
.stats{display:grid;grid-template-columns:1.3fr repeat(4,1fr);border-bottom:1px solid var(--line)}
.stats>div{padding:14px 16px;border-right:1px solid var(--line-soft);min-width:0}
.stats>div:last-child{border-right:0}
.stats .label{margin-bottom:8px}
.bar-row{display:flex;align-items:center;gap:8px;padding:10px 12px 0 16px;flex-wrap:wrap}
.tabs{display:flex;gap:2px}
.tab{height:28px;padding:0 10px;border-radius:6px;font-size:13px;font-weight:500;color:var(--t4)}
.tab:hover{color:var(--t1);background:var(--chip)}
.tab.on{color:var(--t1);background:var(--tab-on)}
.honest{display:flex;align-items:flex-start;gap:10px;padding:10px 16px;border-top:1px solid var(--line);font-size:12.5px;color:var(--t3);line-height:1.45}
.honest svg{flex:none;margin-top:2px}
.honest b{color:var(--t1);font-weight:600}
.honest.warn{color:var(--warn-ink)}
.honest.warn b{color:var(--warn-ink)}
.c-foot{display:flex;align-items:center;gap:12px;padding:10px 12px 10px 16px;border-top:1px solid var(--line);flex-wrap:wrap}
.rcpt{font-size:12px;color:var(--t4);display:flex;align-items:center;gap:7px;white-space:nowrap;min-width:0;overflow:hidden;text-overflow:ellipsis}
.rcpt span{color:var(--t3)}
.btn-flat{display:inline-flex;align-items:center;gap:7px;min-height:32px;padding:0 13px;border-radius:8px;font-size:13px;font-weight:500;color:#fff;background:var(--blue);border:1px solid rgba(255,255,255,.08);box-shadow:inset 0 1px 0 rgba(255,255,255,.16),0 1px 2px rgba(0,0,0,.4);white-space:nowrap}
.btn-flat:hover{background:var(--blue-hover)}
.move{display:inline-flex;align-items:center;min-height:32px;padding:0 10px;border-radius:6px;font-size:13px;font-weight:500;color:var(--t3);white-space:nowrap}
.move:hover{background:var(--chip);color:var(--t1)}
.btn-flat:focus-visible,.move:focus-visible,.tab:focus-visible,.src:focus-visible{outline:2px solid var(--blue);outline-offset:2px}
.stone{width:30px;height:30px;border-radius:8px;background:linear-gradient(160deg,#2a2a30,#121216);border:1px solid rgba(255,255,255,.12);display:grid;place-items:center;font-size:11.5px;font-weight:700;color:#e4e4e7;box-shadow:inset 0 1px 0 rgba(255,255,255,.12);flex:none;overflow:hidden}
.stone img{width:22px;height:22px;object-fit:contain;display:block}
.stone.sm{width:22px;height:22px;border-radius:6px}
.stone.sm img{width:16px;height:16px}
.flag{display:inline-block;margin-top:3px;font-size:11.5px;font-weight:600;letter-spacing:.04em;line-height:1.3;color:var(--t4)}
.flag.warn{color:var(--warn-ink)}
.skel{padding:16px}
.skel i{display:block;height:12px;border-radius:4px;background:var(--wash);margin:10px 0}
.axis{font-size:11.5px;fill:var(--t4);font-variant-numeric:tabular-nums}
.src{color:var(--t3);text-decoration:underline;text-decoration-color:var(--line);text-underline-offset:2px;word-break:break-all}
.src:hover{color:var(--t1)}
.empty{padding:16px;font-size:13px;color:var(--t3);line-height:1.5;white-space:pre-line}
@media (max-width:560px){
  .stats{grid-template-columns:1fr 1fr}
  .stats>div{border-right:0;border-top:1px solid var(--line-soft)}
  .stats>div:nth-child(2n){border-right:1px solid var(--line-soft)}
  .stats>div.first{grid-column:1 / -1;border-right:0;border-top:0}
  .c-meta.wide{display:none}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
`;

// ---------------------------------------------------------------- the bridge and the kit

/**
 * The script every card starts with: window.AL, the bridge to the host and a
 * small DOM kit. A card sets AL.render(result, input) and the bridge calls it
 * with the tool's result (the CallToolResult the host forwards).
 */
export const BRIDGE_JS = String.raw`
(function(){
"use strict";
var CFG = JSON.parse(document.getElementById("algolift-config").textContent);
var AL = window.AL = { cfg: CFG, input: null, result: null, host: null, caps: {}, ctx: {} };
var ids = 1, pending = {};
function post(m){ try { window.parent.postMessage(m, "*"); } catch (e) {} }
function rpc(method, params){
  return new Promise(function(resolve, reject){
    var id = ids++;
    pending[id] = [resolve, reject];
    post({ jsonrpc: "2.0", id: id, method: method, params: params || {} });
    setTimeout(function(){ if (pending[id]) { delete pending[id]; reject(new Error("timeout")); } }, 15000);
  });
}
function notify(method, params){ post({ jsonrpc: "2.0", method: method, params: params || {} }); }
AL.rpc = rpc; AL.notify = notify;

function draw(){
  if (!AL.render) return;
  var root = document.getElementById("root");
  try { AL.render(AL.result, AL.input, root); } catch (e) { root.textContent = ""; }
  size();
}
AL.draw = draw;

function applyContext(c){
  if (!c || typeof c !== "object") return;
  for (var k in c) AL.ctx[k] = c[k];
  var t = AL.ctx.theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", t);
  var s = AL.ctx.safeAreaInsets;
  if (s && typeof s === "object") {
    var st = document.documentElement.style;
    st.setProperty("--sa-t", (+s.top || 0) + "px"); st.setProperty("--sa-r", (+s.right || 0) + "px");
    st.setProperty("--sa-b", (+s.bottom || 0) + "px"); st.setProperty("--sa-l", (+s.left || 0) + "px");
  }
}

window.addEventListener("message", function(ev){
  if (ev.source !== window.parent) return;
  var m = ev.data;
  if (!m || typeof m !== "object" || m.jsonrpc !== "2.0") return;
  if (m.id != null && typeof m.method !== "string") {
    var p = pending[m.id];
    if (p) { delete pending[m.id]; if (m.error) p[1](m.error); else p[0](m.result); }
    return;
  }
  switch (m.method) {
    case "ui/notifications/tool-input": AL.input = (m.params && m.params.arguments) || null; return;
    case "ui/notifications/tool-result": AL.result = m.params || null; draw(); return;
    case "ui/notifications/tool-cancelled": AL.result = { cancelled: true }; draw(); return;
    case "ui/notifications/host-context-changed": applyContext(m.params); size(); return;
  }
  // A request from the host (ui/resource-teardown, ping): nothing to keep, answer at once.
  if (m.id != null) post({ jsonrpc: "2.0", id: m.id, result: {} });
});

// The height the host should give the frame: the plate's own, so nothing scrolls inside it.
var lastW = -1, lastH = -1;
function size(){
  // The body's own box: the document's scrollHeight never drops below the frame's height, so it could not shrink.
  var r = document.body.getBoundingClientRect();
  var w = Math.ceil(r.width), h = Math.ceil(r.height);
  if (w === lastW && h === lastH) return;
  lastW = w; lastH = h;
  notify("ui/notifications/size-changed", { width: w, height: h });
  try { if (window.openai && typeof window.openai.notifyIntrinsicHeight === "function") window.openai.notifyIntrinsicHeight(h); } catch (e) {}
}
AL.size = size;
var lastWidth = 0;
if (typeof ResizeObserver === "function") new ResizeObserver(function(){
  var w = window.innerWidth;
  if (AL.relayout && w !== lastWidth) { lastWidth = w; AL.relayout(); }
  size();
}).observe(document.body);

// ChatGPT's own globals, for a host that sends no tool-result over the bridge.
function fromOpenAi(){
  var o = window.openai;
  if (!o || AL.result) return;
  if (o.theme) applyContext({ theme: o.theme });
  if (o.toolOutput) { AL.input = o.toolInput || null; AL.result = { structuredContent: o.toolOutput, content: [] }; draw(); }
}
window.addEventListener("openai:set_globals", fromOpenAi);

rpc("ui/initialize", {
  appCapabilities: { availableDisplayModes: ["inline", "fullscreen"] },
  // appInfo, as the official SDK sends it (@modelcontextprotocol/ext-apps McpUiInitializeRequest): Claude checks
  // this request against the SDK's schema and never shows a card whose handshake it refuses.
  appInfo: { name: "algolift-" + CFG.card, version: CFG.version },
  protocolVersion: "__PROTOCOL__"
}).then(function(r){
  r = r || {};
  AL.host = r.hostInfo || null; AL.caps = r.hostCapabilities || {};
  applyContext(r.hostContext || {});
  notify("ui/notifications/initialized", {});
  draw();
}, function(){ fromOpenAi(); });
setTimeout(fromOpenAi, 0);

// ---- links: always through the host, which may confirm first.
function source(){
  if (window.openai) return "chatgpt";
  var n = String((AL.host && AL.host.name) || "").toLowerCase();
  if (/claude/.test(n)) return "claude";
  if (/chatgpt|openai/.test(n)) return "chatgpt";
  n = n.replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return n || "mcp";
}
AL.ours = function(path){
  var u = new URL(path, CFG.site);
  u.searchParams.set("utm_source", source());
  u.searchParams.set("utm_medium", "mcp_app");
  u.searchParams.set("utm_campaign", CFG.card);
  return u.toString();
};
function open(url){
  function fallback(){ try { window.open(url, "_blank", "noopener,noreferrer"); } catch (e) {} }
  if (AL.caps && AL.caps.openLinks) { rpc("ui/open-link", { url: url }).then(function(r){ if (r && r.isError) fallback(); }, fallback); return; }
  if (window.openai && typeof window.openai.openExternal === "function") { try { window.openai.openExternal({ href: url, redirectUrl: false }); return; } catch (e) {} }
  fallback();
}
AL.open = open;

/** A long view (every rule) asks for the full screen where the host offers it, and gives it back when folded; inline it simply grows. */
AL.expand = function(on){
  var modes = AL.ctx.availableDisplayModes || [];
  var now = AL.ctx.displayMode || "inline";
  var want = on ? "fullscreen" : "inline";
  if (now === want || modes.indexOf(want) < 0) return;
  rpc("ui/request-display-mode", { mode: want }).then(function(r){ if (r && r.mode) applyContext({ displayMode: r.mode }); }, function(){});
};
/** The width a chart is drawn at: the plate's, so its type stays at its size on a phone. */
AL.chartWidth = function(){
  var root = document.getElementById("root");
  return Math.max(260, Math.min(1000, ((root && root.clientWidth) || window.innerWidth) - 34));
};

// ---- the kit
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  if (attrs) for (var k in attrs) {
    var v = attrs[k];
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  (kids || []).forEach(function(c){ if (c == null || c === false) return; el.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
  return el;
}
var NS = "http://www.w3.org/2000/svg";
function s(tag, attrs, parent){
  var el = document.createElementNS(NS, tag);
  for (var k in attrs || {}) el.setAttribute(k, String(attrs[k]));
  if (parent) parent.appendChild(el);
  return el;
}
AL.h = h; AL.s = s;

/** A link that opens through the host: an anchor, so it still works where the script cannot reach the host. */
AL.link = function(url, cls, kids, label){
  return h("a", { class: cls, href: url, target: "_blank", rel: "noopener noreferrer", "aria-label": label || null, onclick: function(e){ e.preventDefault(); open(url); } }, kids);
};
AL.mark = function(){
  var svg = s("svg", { class: "mark", viewBox: "0 0 24 24", "aria-hidden": "true" });
  s("path", { d: "M4 16 L12 7 L20 16", fill: "none", stroke: "#0072f5", "stroke-width": 3.2, "stroke-linecap": "round", "stroke-linejoin": "round" }, svg);
  s("path", { d: "M8 19 L12 14.5 L16 19", fill: "none", stroke: "#0072f5", "stroke-opacity": ".55", "stroke-width": 2.6, "stroke-linecap": "round", "stroke-linejoin": "round" }, svg);
  return svg;
};
AL.arrow = function(){
  var svg = s("svg", { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" });
  s("path", { d: "M7 17 17 7" }, svg); s("path", { d: "M8 7h9v9" }, svg);
  return svg;
};
AL.warnIcon = function(){
  var svg = s("svg", { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" });
  s("path", { d: "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" }, svg); s("path", { d: "M12 9v4" }, svg); s("path", { d: "M12 17h.01" }, svg);
  return svg;
};
AL.infoIcon = function(){
  var svg = s("svg", { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" });
  s("circle", { cx: 12, cy: 12, r: 9 }, svg); s("path", { d: "M12 11v5" }, svg); s("path", { d: "M12 8h.01" }, svg);
  return svg;
};
AL.status = function(word, tone){ return h("span", { class: "status" + (tone ? " " + tone : "") }, [h("span", { class: "d" }), word]); };
AL.openButton = function(url){ return AL.link(url, "btn-flat", ["Open in AlgoLift", AL.arrow()], "Open in AlgoLift"); };
var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-10-16" as "Oct 16, 2026". */
AL.day = function(d){
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ""));
  return m ? MONTHS[+m[2] - 1] + " " + (+m[3]) + ", " + m[1] : String(d || "");
};
AL.dayRange = function(a, b){
  if (!a && !b) return "";
  if (!a || !b || a === b) return AL.day(a || b);
  var ma = /^(\d{4})/.exec(a), mb = /^(\d{4})/.exec(b);
  if (ma && mb && ma[1] === mb[1]) return AL.day(a).replace(", " + ma[1], "") + " to " + AL.day(b);
  return AL.day(a) + " to " + AL.day(b);
};
AL.host_ = function(url){ try { return new URL(url).hostname.replace(/^www\./, ""); } catch (e) { return ""; } };
AL.skeleton = function(title){
  return h("div", { class: "card", "aria-busy": "true" }, [
    h("div", { class: "c-head" }, [AL.mark(), h("span", { class: "c-ttl", text: title })]),
    h("div", { class: "skel" }, [h("i", { style: "width:42%" }), h("i", { style: "width:86%" }), h("i", { style: "width:64%" })])
  ]);
};
AL.problem = function(title, result){
  var text = "";
  if (result && result.cancelled) text = "The tool call was cancelled.";
  else (result && result.content || []).forEach(function(c){ if (c && c.type === "text") text += c.text; });
  return h("div", { class: "card" }, [
    h("div", { class: "c-head" }, [AL.mark(), h("span", { class: "c-ttl", text: title })]),
    h("p", { class: "empty", text: text || "Nothing to show." })
  ]);
};
})();
`.replace("__PROTOCOL__", APPS_PROTOCOL_VERSION);

/** One card's HTML document: the plate's CSS and the bridge, then the card's own CSS and script. */
export function cardDocument(opts: { title: string; config: CardConfig; css: string; script: string }): string {
    return [
        "<!doctype html>",
        '<html lang="en" data-theme="dark">',
        "<head>",
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<meta name="color-scheme" content="dark light">',
        `<title>${escapeText(opts.title)}</title>`,
        `<style>${BASE_CSS}${opts.css}</style>`,
        "</head>",
        "<body>",
        '<div id="root" role="region" aria-live="polite"></div>',
        `<script type="application/json" id="algolift-config">${scriptJson(opts.config)}</script>`,
        `<script>${BRIDGE_JS}</script>`,
        `<script>${opts.script}</script>`,
        "</body>",
        "</html>",
    ].join("\n");
}
