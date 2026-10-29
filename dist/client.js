window.__ModuleLoader__.load({id:"dsh-better-answer-view",factory(require){var module={exports:{}};var exports=module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.jsx
var client_exports = {};
__export(client_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(client_exports);
var import_react3 = __toESM(require("react"), 1);

// src/view-ui.jsx
var import_react = __toESM(require("react"), 1);

// src/presentation-style.js
var DEFAULT_STYLE = `
:root {
  color-scheme:light;
  --answer-bg:#ffffff; --answer-fg:#202a38; --answer-muted:#5e6b7d;
  --answer-border:#e1e6ed; --answer-soft:#f5f7fa; --answer-accent:#3456b8;
  --answer-accent-soft:#edf2ff; --answer-on-accent:#ffffff;
  --answer-positive:#236b50; --answer-positive-soft:#edf7f1;
  --answer-warning:#8b6018; --answer-warning-soft:#fbf4e6;
  --answer-radius:12px;
  --answer-font:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
}
:root[data-theme="dark"] {
  color-scheme:dark;
  --answer-bg:#17202f; --answer-fg:#edf1f7; --answer-muted:#b0bdcf;
  --answer-border:#374357; --answer-soft:#222e40; --answer-accent:#aac0ff;
  --answer-accent-soft:#2b3a59; --answer-on-accent:#152139;
  --answer-positive:#9ad5b3; --answer-positive-soft:#243d34;
  --answer-warning:#edca87; --answer-warning-soft:#433b2c;
}
* { box-sizing:border-box; }
html,body { margin:0; padding:0; width:100%; background:var(--answer-bg); color:var(--answer-fg); }
body { font:15px/1.6 var(--answer-font); -webkit-font-smoothing:antialiased; }
#answer-content { display:flow-root; padding:clamp(12px,2.3vw,20px); overflow-wrap:anywhere; }
main,article,section,figure,fieldset { min-width:0; max-width:100%; }
figure { margin:0; } fieldset { margin:0; padding:0; border:0; }
h1,h2,h3,h4 { line-height:1.35; letter-spacing:-.02em; margin:1.25em 0 .5em; font-weight:650; }
h1 { font-size:23px; } h2 { font-size:20px; } h3 { font-size:17px; } h4 { font-size:15px; }
#answer-content> :first-child,main> :first-child,article> :first-child,.answer-block> :first-child,.card> :first-child { margin-top:0; }
#answer-content> :last-child,.answer-block> :last-child,.card> :last-child { margin-bottom:0; }
p { margin:.65em 0 .9em; } ul,ol { margin:.7em 0; padding-left:1.4em; } li+li { margin-top:.3em; }
small,.muted,.answer-caption,.answer-source,.answer-cell-detail { color:var(--answer-muted); }
small,.answer-caption,.answer-source,.answer-cell-detail { font-size:12px; line-height:1.55; }
a { color:var(--answer-accent); text-underline-offset:3px; } strong { font-weight:650; }
button,input,select,textarea { font:inherit; }
button { min-height:38px; max-width:100%; border:1px solid var(--answer-border); border-radius:8px; padding:7px 12px; background:var(--answer-soft); color:var(--answer-fg); cursor:pointer; }
button:hover { border-color:var(--answer-accent); } button:disabled { opacity:.5; cursor:default; }
button.primary,[data-primary] { background:var(--answer-accent); color:var(--answer-on-accent); border-color:transparent; }
button[aria-pressed="true"] { border-color:var(--answer-accent); background:var(--answer-accent-soft); color:var(--answer-accent); }
:focus-visible { outline:3px solid var(--answer-accent); outline-offset:3px; }
input:not([type="range"]):not([type="checkbox"]):not([type="radio"]),select,textarea { width:100%; min-width:0; max-width:100%; padding:8px 10px; border:1px solid var(--answer-border); border-radius:8px; background:var(--answer-bg); color:var(--answer-fg); }
input[type="range"] { width:100%; min-height:32px; margin:0; accent-color:var(--answer-accent); }
input[type="checkbox"],input[type="radio"] { accent-color:var(--answer-accent); }
label { display:block; margin:.6em 0 .3em; } textarea { resize:vertical; min-height:80px; }
.answer-block,.card { padding:16px; border:1px solid var(--answer-border); border-radius:var(--answer-radius); background:var(--answer-bg); }
:where(.answer-block,.card,.answer-metric,.answer-decision,.answer-note,.answer-inline-note,.answer-cell-detail) { min-width:0; max-width:100%; overflow-wrap:anywhere; }
.grid,.answer-metric-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(160px,100%),1fr)); gap:12px; }
.grid>*,.answer-metric-grid>* { min-width:0; }
.row,.answer-block-heading,.answer-control-heading { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
.answer-block-heading,.answer-control-heading { justify-content:space-between; }
.answer-block-heading { margin-bottom:12px; } .answer-block-heading h2,.answer-block-heading h3 { margin:0; }
.badge { display:inline-block; padding:2px 7px; border-radius:5px; background:var(--answer-accent-soft); color:var(--answer-accent); font-size:12px; line-height:1.5; }
.answer-metric { padding:14px; border-radius:10px; background:var(--answer-soft); }
.answer-metric-label { color:var(--answer-muted); font-size:12px; line-height:1.5; }
.answer-metric-value { display:block; margin:5px 0 2px; font-size:clamp(23px,5vw,30px); line-height:1.2; font-weight:650; font-variant-numeric:tabular-nums; letter-spacing:-.035em; }
.answer-metric-unit { margin-left:4px; color:var(--answer-muted); font-size:13px; font-weight:400; letter-spacing:0; }
.answer-metric-detail { margin:6px 0 0; font-size:12px; color:var(--answer-muted); }
.answer-positive { color:var(--answer-positive); } .answer-warning { color:var(--answer-warning); }
.answer-bar-list { display:grid; gap:14px; margin:14px 0; }
.answer-bar-row { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:5px 12px; align-items:baseline; font-size:13px; }
.answer-bar-label { min-width:0; } .answer-bar-value { font-variant-numeric:tabular-nums; font-weight:600; }
.answer-bar-track { grid-column:1/-1; height:8px; border-radius:4px; background:var(--answer-soft); }
.answer-bar-fill { display:block; width:var(--value,0%); max-width:100%; height:100%; border-radius:4px; background:var(--answer-accent); }
.answer-bar-fill.answer-secondary { background:var(--answer-muted); }
.answer-legend { display:flex; flex-wrap:wrap; gap:6px 16px; margin:10px 0; color:var(--answer-muted); font-size:12px; }
.answer-legend-item { display:inline-flex; align-items:center; gap:6px; }
.answer-swatch { display:inline-block; width:10px; height:10px; flex:0 0 10px; border-radius:2px; background:var(--answer-accent); }
.answer-timeline { list-style:none; margin:12px 0; padding:0; }
.answer-timeline-item { position:relative; margin:0; padding:0 0 18px 21px; border-left:1px solid var(--answer-border); }
.answer-timeline-item::before { content:""; position:absolute; left:-4px; top:7px; width:7px; height:7px; border-radius:50%; background:var(--answer-accent); }
.answer-timeline-item:last-child { padding-bottom:0; border-color:transparent; }
.answer-timeline-item h3,.answer-timeline-item h4 { margin:0 0 3px; } .answer-timeline-item p { margin:4px 0 0; }
.answer-timeline-date { display:block; color:var(--answer-muted); font-size:12px; margin-bottom:3px; }
.answer-decision { padding:14px 16px; border-left:3px solid var(--answer-accent); border-radius:0 9px 9px 0; background:var(--answer-accent-soft); }
.answer-decision> :first-child { margin-top:0; } .answer-decision> :last-child { margin-bottom:0; }
.answer-evidence { display:grid; gap:10px; margin:12px 0; }
.answer-evidence>div { padding-bottom:10px; border-bottom:1px solid var(--answer-border); }
.answer-evidence>div:last-child { padding-bottom:0; border-bottom:0; }
.answer-note { margin:12px 0 0; padding:10px 12px; border-radius:8px; background:var(--answer-soft); color:var(--answer-muted); font-size:13px; }
/* Explicit compact vocabulary; the runtime gives painted inline surfaces safe
   boxes without overriding hidden elements, tables or authored grid/flex. */
.answer-inline-note { padding:2px 6px; border-radius:4px; background:var(--answer-soft); color:var(--answer-muted); font-size:13px; }
.answer-cell-detail { margin:0; padding:0; background:transparent; }
.answer-source { display:block; margin-top:10px; }
.answer-control { margin:14px 0; } .answer-control-heading label { margin:0; } .answer-control-heading output { color:var(--answer-accent); font-variant-numeric:tabular-nums; font-weight:600; }
table { border-collapse:collapse; table-layout:fixed; width:100%; max-width:100%; font-size:13px; margin:14px 0; }
th,td { min-width:0; padding:10px 9px; text-align:left; border-bottom:1px solid var(--answer-border); vertical-align:top; overflow-wrap:anywhere; }
th { color:var(--answer-muted); font-size:12px; font-weight:600; background:var(--answer-soft); }
.answer-numeric { text-align:right; font-variant-numeric:tabular-nums; }
blockquote { margin:16px 0; padding:8px 14px; border-left:3px solid var(--answer-accent); background:var(--answer-soft); }
pre { max-width:100%; padding:12px; border-radius:8px; background:var(--answer-soft); white-space:pre-wrap; overflow-wrap:anywhere; }
code { font-family:ui-monospace,SFMono-Regular,Consolas,monospace; font-size:.9em; }
:not(pre)>code { padding:2px 4px; border-radius:4px; background:var(--answer-soft); }
hr { border:0; border-top:1px solid var(--answer-border); margin:18px 0; }
svg,img,canvas { max-width:100%; } svg,img { height:auto; } svg text { font-family:var(--answer-font); } svg text:not([fill]) { fill:var(--answer-fg); }
figcaption { margin-top:8px; color:var(--answer-muted); font-size:12px; }
details { padding:10px 12px; border:1px solid var(--answer-border); border-radius:8px; margin:10px 0; }
summary { cursor:pointer; font-weight:600; }
@media(max-width:420px) {
  body { font-size:14px; } h1 { font-size:21px; } h2 { font-size:18px; }
  .answer-block,.card { padding:12px; } .answer-metric { padding:11px; }
  .grid,.answer-metric-grid { grid-template-columns:repeat(auto-fit,minmax(min(126px,100%),1fr)); gap:10px; }
  th,td { padding:8px 5px; font-size:12px; }
}
`;

// src/surface-runtime.js
var SURFACE_LIMITS = Object.freeze({ html: 256 * 1024, state: 16 * 1024, text: 8 * 1024 });
function byteLength(value) {
  return new TextEncoder().encode(value).byteLength;
}
function copyState(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("State must be a JSON object.");
  const seen = /* @__PURE__ */ new Set();
  function check(item, depth) {
    if (depth > 64) throw new TypeError("State is nested too deeply.");
    if (item === null || typeof item === "string" || typeof item === "boolean") return;
    if (typeof item === "number" && Number.isFinite(item)) return;
    if (typeof item !== "object") throw new TypeError("State must contain only JSON values.");
    if (seen.has(item)) throw new TypeError("State must not contain cycles.");
    if (!Array.isArray(item) && Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) {
      throw new TypeError("State must contain only plain JSON objects.");
    }
    seen.add(item);
    for (const key of Object.keys(item)) check(item[key], depth + 1);
    seen.delete(item);
  }
  check(value, 0);
  const json = JSON.stringify(value);
  if (byteLength(json) > SURFACE_LIMITS.state) throw new RangeError("State exceeds 16 KiB.");
  return JSON.parse(json);
}
function validateView(view) {
  if (!view || typeof view !== "object") throw new TypeError("A view is required.");
  if (typeof view.id !== "string" || !view.id || byteLength(view.id) > 256) throw new TypeError("Invalid view id.");
  if (!Number.isSafeInteger(view.revision) || view.revision < 1) throw new TypeError("Invalid view revision.");
  if (typeof view.html !== "string" || byteLength(view.html) > SURFACE_LIMITS.html) throw new RangeError("HTML must be a string of at most 256 KiB.");
  if (typeof view.title !== "string" || byteLength(view.title) > 1024) throw new TypeError("Invalid view title.");
  return {
    id: view.id,
    revision: view.revision,
    title: view.title,
    html: view.html,
    summary: typeof view.summary === "string" ? view.summary.slice(0, 8192) : "",
    stateSchemaVersion: view.stateSchemaVersion ?? 1
  };
}
function receiver() {
  "use strict";
  const nativeStringify = JSON.stringify.bind(JSON);
  const nativeParse = JSON.parse.bind(JSON);
  const NativePromise = Promise;
  const encode = new TextEncoder();
  const root = document.getElementById("answer-content");
  const pending = /* @__PURE__ */ new Map();
  let send = null;
  let state = {};
  let savedState = state;
  let stateChange = 0;
  let counter = 0;
  let rendered = false;
  let session = null;
  let lastHeight = 0;
  let errorCount = 0;
  let embedded = false;
  let viewportHeight = 800;
  let measurementPending = false;
  const jsonCopy = (value) => nativeParse(nativeStringify(value));
  const report = (message) => {
    if (send && errorCount++ < 20) send({ type: "error", session, message: String(message).slice(0, 2048) });
  };
  const validateState = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("State must be a JSON object.");
    const json = nativeStringify(value);
    if (encode.encode(json).length > 16384) throw new RangeError("State exceeds 16 KiB.");
    return nativeParse(json);
  };
  const request = (type, payload) => new NativePromise((resolve, reject) => {
    if (!send) {
      reject(new Error("Answer bridge is not ready."));
      return;
    }
    if (pending.size >= 64) {
      reject(new Error("Too many pending answer actions."));
      return;
    }
    const id = String(++counter);
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error("Host did not respond within 30 seconds."));
    }, 3e4);
    pending.set(id, { resolve, reject, timeout });
    send({ type, session, id, ...payload });
  });
  Object.defineProperty(window, "answer", {
    configurable: false,
    writable: false,
    value: Object.freeze({
      getState() {
        return jsonCopy(state);
      },
      setState(value) {
        let next;
        try {
          next = validateState(value);
        } catch (error) {
          return NativePromise.reject(error);
        }
        const change = ++stateChange;
        state = next;
        return request("state", { state: next }).then((result) => {
          savedState = next;
          return result;
        }).catch((error) => {
          if (stateChange === change) state = savedState;
          throw error;
        });
      },
      ask(text) {
        if (typeof text !== "string" || !text.trim() || encode.encode(text).length > 8192) {
          return NativePromise.reject(new TypeError("Question must contain 1\u20138192 UTF-8 bytes."));
        }
        return request("ask", { text, state: jsonCopy(state) });
      }
    })
  });
  window.addEventListener("error", (event) => report(event.message || "Page script failed."));
  window.addEventListener("unhandledrejection", (event) => report(event.reason?.message || event.reason || "Unhandled page error."));
  document.addEventListener("securitypolicyviolation", (event) => report(`Blocked by page policy: ${event.violatedDirective}`));
  document.addEventListener("click", (event) => {
    const anchor = event.target?.closest?.("a[href],area[href]");
    if (!anchor) return;
    event.preventDefault();
    const href = anchor.getAttribute("href");
    if (href?.startsWith("#")) {
      try {
        document.getElementById(decodeURIComponent(href.slice(1)))?.scrollIntoView({ behavior: "smooth" });
      } catch {
      }
    }
  }, true);
  document.addEventListener("submit", (event) => event.preventDefault(), true);
  const controlSelector = 'textarea,select,input,button,canvas,img,video,audio,[role="listbox"],[role="menu"],[role="tree"],[role="grid"],[role="slider"],[data-answer-scroll]';
  const surfaceSelector = ".answer-block,.card,.answer-metric,.answer-decision,.answer-note,.answer-inline-note";
  const componentRepairs = /* @__PURE__ */ new Map();
  function repairLayout(node, property, value) {
    if (node.style.getPropertyValue(property) === value && node.style.getPropertyPriority(property) === "important") return;
    let properties = componentRepairs.get(node);
    if (!properties) componentRepairs.set(node, properties = /* @__PURE__ */ new Map());
    if (!properties.has(property)) properties.set(property, { value: node.style.getPropertyValue(property), priority: node.style.getPropertyPriority(property) });
    node.style.setProperty(property, value, "important");
    properties.get(property).applied = node.style.getPropertyValue(property);
  }
  function restoreComponentRepairs() {
    for (const [node, properties] of componentRepairs) {
      for (const [property, previous] of properties) {
        if (node.style.getPropertyValue(property) !== previous.applied || node.style.getPropertyPriority(property) !== "important") continue;
        if (previous.value) node.style.setProperty(property, previous.value, previous.priority);
        else node.style.removeProperty(property);
      }
    }
    componentRepairs.clear();
  }
  let controlledPanelIds = /* @__PURE__ */ new Set();
  const labelTranslations = /* @__PURE__ */ new WeakMap();
  const isClippedAlternative = (node) => {
    for (let current = node; current && current !== root; current = current.parentElement) {
      const style = getComputedStyle(current);
      if (style.display === "none" || style.visibility === "hidden" || style.contentVisibility === "hidden") return true;
      if (current.tagName === "DETAILS" && !current.open && node !== current) {
        const summary = Array.from(current.children).find((child) => child.tagName === "SUMMARY");
        if (!summary?.contains(node)) return true;
      }
      if (style.clip !== "auto" || style.clipPath !== "none" && (current.clientWidth <= 2 || current.clientHeight <= 2)) return true;
    }
    return false;
  };
  const isControlledDescendant = (node) => {
    for (let parent = node.parentElement; parent && parent !== root; parent = parent.parentElement) if (controlledPanelIds.has(parent.id)) return true;
    return false;
  };
  const isLayoutBox = (node) => node.namespaceURI === "http://www.w3.org/1999/xhtml" && !node.closest(controlSelector) && !node.closest("svg") && !isControlledDescendant(node) && !isClippedAlternative(node);
  const setLayout = (node, property, value) => {
    if (node.style.getPropertyValue(property) !== value || node.style.getPropertyPriority(property) !== "important") node.style.setProperty(property, value, "important");
  };
  const isGrid = (style) => style.display === "grid" || style.display === "inline-grid";
  const contentWidth = (node) => {
    const style = getComputedStyle(node);
    return Math.max(0, node.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0));
  };
  const isDisclosure = (node, style) => controlledPanelIds.has(node.id) || node.closest('[hidden],[inert],[aria-hidden="true"]') || style.display !== "inline" && node.clientHeight <= 1 || parseFloat(style.maxHeight) === 0 || style.transitionDuration.split(",").some((value) => parseFloat(value) > 0) && /(?:all|height|block-size)/.test(style.transitionProperty);
  function normalizeComponents() {
    const surfaces = [];
    let changes = [];
    const change = (node, property, value) => changes.push([node, property, value]);
    const flush = () => {
      for (const args of changes) repairLayout(...args);
      changes = [];
    };
    for (const node of root.querySelectorAll(surfaceSelector)) {
      if (!isLayoutBox(node)) continue;
      const style = getComputedStyle(node);
      if (isDisclosure(node, style) || style.position === "absolute" || style.position === "fixed") continue;
      surfaces.push(node);
      if (style.display !== "inline") continue;
      change(node, "display", "inline-block");
      change(node, "vertical-align", "top");
      const parentStyle = getComputedStyle(node.parentElement);
      const clearance = Math.max(0, ((parseFloat(parentStyle.fontSize) || 0) * 1.3 - parseFloat(parentStyle.lineHeight)) / 2);
      if (Number.isFinite(clearance) && clearance > 0) for (const side of ["top", "bottom"]) {
        const margin = parseFloat(style.getPropertyValue(`margin-${side}`)) || 0;
        if (margin >= 0 && margin < clearance) change(node, `margin-${side}`, `${clearance}px`);
      }
      if (node.matches(".answer-note") && node.closest("td,th")) {
        for (const side of ["top", "right", "bottom", "left"]) {
          change(node, `margin-${side}`, "0px");
          change(node, `padding-${side}`, "0px");
        }
        change(node, "background-color", "transparent");
        change(node, "line-height", "1.5");
      }
    }
    flush();
    for (const node of surfaces) {
      const style = getComputedStyle(node);
      if (/^(?:table|contents)/.test(style.display)) continue;
      let container = node.parentElement;
      while (container && container !== root && /^(?:inline|contents)$/.test(getComputedStyle(container).display)) container = container.parentElement;
      const available = container ? contentWidth(container) : 0;
      const border = (parseFloat(style.borderLeftWidth) || 0) + (parseFloat(style.borderRightWidth) || 0);
      const padding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
      const glyph = (parseFloat(style.fontSize) || 0) * 1.2;
      if (available > 0 && padding + border + glyph > available) {
        const budget = Math.max(0, available - border - glyph);
        for (const side of ["left", "right"]) change(node, `padding-${side}`, `${padding ? (parseFloat(style.getPropertyValue(`padding-${side}`)) || 0) * budget / padding : 0}px`);
      }
    }
    flush();
    const expanding = /* @__PURE__ */ new Set();
    const descendants = Array.from(root.querySelectorAll("*")).reverse();
    for (const node of descendants) {
      const surface = node.closest(surfaceSelector);
      if (!surface || !isLayoutBox(node)) continue;
      const style = getComputedStyle(node);
      if (style.display === "inline" || style.display === "contents" || style.display.startsWith("table") || isDisclosure(node, style)) continue;
      let positioned = false;
      for (let current = node; current && current !== surface.parentElement; current = current.parentElement) {
        const currentStyle = getComputedStyle(current);
        if (/^(?:absolute|fixed)$/.test(currentStyle.position) || current !== node && isDisclosure(current, currentStyle)) {
          positioned = true;
          break;
        }
      }
      if (positioned) continue;
      const childExpands = Array.from(node.children).some((child) => expanding.has(child));
      if (!childExpands && node.scrollHeight <= node.clientHeight + 1) continue;
      const box = node.getBoundingClientRect();
      const flowBottom = Array.from(node.childNodes).reduce((bottom, child) => {
        if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) {
          const range = document.createRange();
          range.selectNode(child);
          return Math.max(bottom, range.getBoundingClientRect().bottom);
        }
        if (!(child instanceof HTMLElement) || isClippedAlternative(child)) return bottom;
        const childStyle = getComputedStyle(child);
        return /^(?:absolute|fixed)$/.test(childStyle.position) ? bottom : Math.max(bottom, child.getBoundingClientRect().bottom);
      }, box.top);
      if (!childExpands && flowBottom <= box.bottom + 1) continue;
      expanding.add(node);
      if (style.display === "block" && Array.from(node.children).some((child) => getComputedStyle(child).cssFloat !== "none")) change(node, "display", "flow-root");
      change(node, "height", "auto");
      change(node, "max-height", "none");
      change(node, "block-size", "auto");
      change(node, "max-block-size", "none");
    }
    flush();
  }
  function preserveMetricNumbers(nodes) {
    const metrics = [];
    const gridMinimums = /* @__PURE__ */ new Map();
    const candidates = [];
    for (const node of nodes) {
      if (node.childElementCount || !/^[+\-−]?(?:[¥$€£]\s*)?\d[\d.,]*(?:\s*[%％倍])?$/.test(node.textContent.trim())) continue;
      const style = getComputedStyle(node);
      if (style.position === "absolute" || !node.matches("strong,b,output") && parseFloat(style.fontSize) < 18) continue;
      candidates.push({ node, flex: /flex/.test(getComputedStyle(node.parentElement).display) });
    }
    for (const { node, flex } of candidates) {
      repairLayout(node, "white-space", "nowrap");
      repairLayout(node, "overflow-wrap", "normal");
      if (flex) repairLayout(node, "flex-shrink", "0");
    }
    for (const { node } of candidates) {
      const range = document.createRange();
      range.selectNodeContents(node);
      const required = range.getBoundingClientRect().width;
      metrics.push({ node, required });
      if (required > contentWidth(root) || required <= Math.min(node.getBoundingClientRect().width, contentWidth(node.parentElement)) + 1) continue;
      for (let cell = node, parent = node.parentElement; parent && parent !== root; cell = parent, parent = parent.parentElement) {
        const parentStyle = getComputedStyle(parent);
        if (!isGrid(parentStyle)) continue;
        const cellStyle = getComputedStyle(cell);
        const minimum = Math.max(120, Math.ceil(required + parseFloat(cellStyle.paddingLeft) + parseFloat(cellStyle.paddingRight)));
        gridMinimums.set(parent, Math.max(minimum, gridMinimums.get(parent) || 0));
        break;
      }
    }
    for (const [parent, minimum] of gridMinimums) repairLayout(parent, "grid-template-columns", `repeat(auto-fit, minmax(min(${minimum}px, 100%), 1fr))`);
    return metrics;
  }
  function wrapOversizedMetrics(metrics) {
    const oversized = [];
    for (const { node, required } of metrics) {
      let available = Infinity;
      for (let current = node; current && root.contains(current); current = current.parentElement) {
        const display = getComputedStyle(current).display;
        if (display !== "inline" && display !== "contents" && current.clientWidth) available = Math.min(available, contentWidth(current));
        if (current === root) break;
      }
      if (required <= available + 1) continue;
      oversized.push(node);
    }
    for (const node of oversized) {
      repairLayout(node, "white-space", "normal");
      repairLayout(node, "overflow-wrap", "anywhere");
      repairLayout(node, "word-break", "break-word");
      repairLayout(node, "flex-shrink", "1");
    }
  }
  function fitPositionedLabels(nodes) {
    for (const node of nodes) {
      const style = getComputedStyle(node);
      if (style.position !== "absolute" || node.childElementCount || !node.textContent.trim()) continue;
      if (style.translate !== "none" && !labelTranslations.has(node)) continue;
      const parent = node.offsetParent;
      if (!(parent instanceof HTMLElement) || parent === document.body) continue;
      const bounds = parent.getBoundingClientRect();
      const rect = node.getBoundingClientRect();
      const adjustment = labelTranslations.get(node);
      const previous = adjustment?.translation || 0;
      const originalLeft = rect.left - previous;
      const originalRight = rect.right - previous;
      const left = bounds.left + parent.clientLeft;
      const right = left + parent.clientWidth;
      if (rect.width > parent.clientWidth + 1) continue;
      let translation = originalRight > right ? right - originalRight : originalLeft < left ? left - originalLeft : 0;
      let insideColor = null;
      if (originalRight > right + 1) {
        for (const sibling of parent.children) {
          if (sibling === node || sibling.childElementCount || sibling.textContent.trim()) continue;
          const siblingStyle = getComputedStyle(sibling);
          if (siblingStyle.position !== "absolute") continue;
          const bar = sibling.getBoundingClientRect();
          const color = siblingStyle.backgroundColor.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
          if (!color || color[4] && Number(color[4]) !== 1 || bar.width < rect.width + 8 || bar.bottom <= rect.top || bar.top >= rect.bottom) continue;
          const luminance = color.slice(1, 4).map(Number).map((value) => {
            value /= 255;
            return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
          }).reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0);
          translation = bar.right - 4 - rect.width - originalLeft;
          insideColor = luminance > 0.179 ? "#000" : "#fff";
          break;
        }
      }
      if (Math.abs(translation - previous) < 0.5 && insideColor === (adjustment?.insideColor || null)) continue;
      const next = adjustment || { color: node.style.getPropertyValue("color"), colorPriority: node.style.getPropertyPriority("color") };
      next.translation = translation;
      next.insideColor = insideColor;
      labelTranslations.set(node, next);
      setLayout(node, "translate", `${Math.round(translation * 100) / 100}px`);
      if (insideColor) setLayout(node, "color", insideColor);
      else if (next.color) node.style.setProperty("color", next.color, next.colorPriority);
      else node.style.removeProperty("color");
    }
  }
  function normalizeViewportDeclaration(style, nodes) {
    for (const property of Array.from(style)) {
      const value = style.getPropertyValue(property);
      if (!/\b(?:\d*\.)?\d+(?:dvh|svh|lvh|vh)\b/i.test(value)) continue;
      const priority = style.getPropertyPriority(property);
      style.setProperty(property, value.replace(/(-?(?:\d*\.)?\d+)(?:dvh|svh|lvh|vh)\b/gi, (_, amount) => `${Number(amount) * viewportHeight / 100}px`), priority);
      if (!/^(?:height|min-height|max-height|block-size|min-block-size|max-block-size)$/.test(property)) continue;
      if (![...value.matchAll(/((?:\d*\.)?\d+)(?:dvh|svh|lvh|vh)\b/gi)].some((match) => Number(match[1]) >= 90)) continue;
      for (const node of nodes()) if (isLayoutBox(node)) {
        setLayout(node, property, property.startsWith("min-") ? "0px" : property.startsWith("max-") ? "none" : "auto");
      }
    }
  }
  function normalizeInlineLayout() {
    for (const styleNode of root.querySelectorAll("style")) {
      const visit = (rules) => {
        for (const rule of rules) {
          if (rule.style && rule.selectorText) normalizeViewportDeclaration(rule.style, () => {
            try {
              return Array.from(document.querySelectorAll(rule.selectorText));
            } catch {
              return [];
            }
          });
          if (rule.cssRules) visit(rule.cssRules);
        }
      };
      if (styleNode.sheet) visit(styleNode.sheet.cssRules);
    }
    const nodes = Array.from(root.querySelectorAll("*")).filter(isLayoutBox);
    const metrics = preserveMetricNumbers(nodes);
    for (const node of nodes) {
      normalizeViewportDeclaration(node.style, () => [node]);
      const computed = getComputedStyle(node);
      if (computed.position === "fixed") setLayout(node, "position", "static");
      const sizeTransition = computed.transitionDuration.split(",").some((value) => parseFloat(value) > 0) && /(?:all|height|block-size)/.test(computed.transitionProperty);
      const collapsed = node.clientHeight <= 1 || parseFloat(computed.maxHeight) === 0 || node.closest('[hidden],[inert],[aria-hidden="true"]');
      const disclosure = controlledPanelIds.has(node.id) || sizeTransition;
      if (!collapsed && !disclosure && /(?:auto|scroll|hidden|clip)/.test(computed.overflowY) && node.scrollHeight > node.clientHeight + 1) {
        repairLayout(node, "height", "auto");
        repairLayout(node, "max-height", "none");
        repairLayout(node, "overflow-y", "visible");
      }
      if (node.clientWidth && node.scrollWidth > node.clientWidth + 1) {
        if (isGrid(computed)) {
          const bounds = node.getBoundingClientRect();
          const left = bounds.left + node.clientLeft;
          const right = left + node.clientWidth;
          const tracksOverflow = Array.from(node.children).some((child) => {
            const childStyle = getComputedStyle(child);
            if (childStyle.position === "absolute" || childStyle.position === "fixed" || childStyle.display === "none") return false;
            const childBox = child.getBoundingClientRect();
            return childBox.right > right + 1 || childBox.left < left - 1;
          });
          if (tracksOverflow) repairLayout(node, "grid-template-columns", "repeat(auto-fit, minmax(min(220px, 100%), 1fr))");
        }
        if (computed.display === "flex" || computed.display === "inline-flex") repairLayout(node, "flex-wrap", "wrap");
        if (node.tagName === "PRE") repairLayout(node, "white-space", "pre-wrap");
        repairLayout(node, "overflow-wrap", "anywhere");
      }
      const available = node.parentElement?.clientWidth;
      if (available && node.getBoundingClientRect().width > available + 1) {
        repairLayout(node, "min-width", "0px");
        repairLayout(node, "max-width", "100%");
        repairLayout(node, "width", "100%");
      }
    }
    wrapOversizedMetrics(metrics);
    fitPositionedLabels(nodes);
  }
  function measure() {
    measurementPending = false;
    if (!rendered) return;
    mutationObserver.disconnect();
    try {
      restoreComponentRepairs();
      controlledPanelIds = new Set(Array.from(root.querySelectorAll("[aria-controls][aria-expanded]")).flatMap((node) => node.getAttribute("aria-controls").split(/\s+/)).filter(Boolean));
      normalizeComponents();
      if (embedded) normalizeInlineLayout();
    } finally {
      mutationObserver.observe(root, { subtree: true, childList: true, characterData: true, attributes: true });
    }
    const bodyBox = document.body.getBoundingClientRect();
    let bottom = bodyBox.bottom;
    for (const node of root.querySelectorAll("*")) {
      if (node.matches("script,style,template") || isClippedAlternative(node) || node.parentElement?.closest(controlSelector)) continue;
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const rect = node.getBoundingClientRect();
      if (rect.width || rect.height) {
        let paintedBottom = rect.bottom;
        for (let parent = node.parentElement; parent && parent !== root; parent = parent.parentElement) {
          if (/(?:auto|scroll|hidden|clip)/.test(getComputedStyle(parent).overflowY)) paintedBottom = Math.min(paintedBottom, parent.getBoundingClientRect().bottom);
        }
        bottom = Math.max(bottom, paintedBottom);
      }
    }
    const height = Math.max(1, Math.ceil(bottom + window.scrollY));
    if (send && height !== lastHeight) {
      lastHeight = height;
      send({ type: "height", session, height });
    }
  }
  function scheduleMeasure() {
    if (measurementPending) return;
    measurementPending = true;
    requestAnimationFrame(measure);
  }
  const resizeObserver = new ResizeObserver(scheduleMeasure);
  resizeObserver.observe(root);
  resizeObserver.observe(document.body);
  const mutationObserver = new MutationObserver(scheduleMeasure);
  mutationObserver.observe(root, { subtree: true, childList: true, characterData: true, attributes: true });
  window.addEventListener("resize", scheduleMeasure);
  document.addEventListener("load", scheduleMeasure, true);
  function render(message) {
    if (rendered) throw new Error("A surface can render only once; replace it to update a revision.");
    if (typeof message.html !== "string" || encode.encode(message.html).length > 262144) throw new Error("Invalid HTML payload.");
    state = validateState(message.state);
    savedState = state;
    embedded = message.embedded === true;
    viewportHeight = Number.isFinite(message.viewportHeight) && message.viewportHeight > 0 ? message.viewportHeight : 800;
    if (embedded) document.documentElement.dataset.answerLayout = "inline";
    document.documentElement.dataset.theme = message.theme === "dark" ? "dark" : "light";
    const template = document.createElement("template");
    template.innerHTML = message.html;
    template.content.querySelectorAll("base,meta,link,iframe,frame,frameset,object,embed").forEach((node) => node.remove());
    const scripts = [];
    for (const original of template.content.querySelectorAll("script")) {
      if (original.hasAttribute("src")) throw new Error("External scripts are not supported. Use inline JavaScript.");
      const type = (original.getAttribute("type") || "").toLowerCase().trim();
      if (type && type !== "text/javascript" && type !== "application/javascript") {
        if (type === "module") throw new Error("Module scripts are not supported. Use inline classic JavaScript without imports.");
        continue;
      }
      const placeholder = document.createComment("answer-script");
      original.replaceWith(placeholder);
      scripts.push({ placeholder, source: original.textContent });
    }
    root.replaceChildren(template.content);
    if (embedded) {
      const guard = document.createElement("style");
      guard.textContent = `
        html[data-answer-layout="inline"],html[data-answer-layout="inline"] body {height:auto!important;min-height:0!important;max-height:none!important;block-size:auto!important;min-block-size:0!important;max-block-size:none!important;width:100%!important;min-width:0!important;max-width:100%!important;overflow:visible!important;position:static!important;box-sizing:border-box!important;margin:0!important;}
        html[data-answer-layout="inline"] {overflow:clip!important;}
        html[data-answer-layout="inline"] #answer-content {display:flow-root!important;height:auto!important;min-height:0!important;max-height:none!important;min-width:0!important;max-width:100%!important;overflow:visible!important;}
        #answer-content :where(div,section,article,main,header,footer,aside,nav,figure,fieldset,ul,ol,li,details,form) {min-width:0!important;max-width:100%!important;overflow-wrap:anywhere;}
        #answer-content table {width:100%!important;min-width:0!important;max-width:100%!important;table-layout:fixed!important;}
        #answer-content th,#answer-content td {min-width:0!important;white-space:normal!important;overflow-wrap:anywhere!important;}
        #answer-content pre {white-space:pre-wrap!important;overflow-wrap:anywhere!important;}
        #answer-content :where(svg,img,canvas) {max-width:100%!important;}
      `;
      document.body.append(guard);
    }
    rendered = true;
    for (const { placeholder, source } of scripts) {
      const script = document.createElement("script");
      script.textContent = source;
      placeholder.replaceWith(script);
    }
    measure();
    send({ type: "rendered", session, errorCount });
  }
  function initialize(event) {
    if (event.source !== window.parent || send || event.data?.type !== "answer:init" || event.data?.version !== 1 || event.ports.length !== 1) return;
    if (typeof event.data.session !== "string" || event.data.session.length > 128) return;
    session = event.data.session;
    const port = event.ports[0];
    send = port.postMessage.bind(port);
    window.removeEventListener("message", initialize);
    port.onmessage = (portEvent) => {
      const message = portEvent.data;
      if (!message || message.session !== session) return;
      try {
        if (message.type === "render") render(message);
        else if (message.type === "theme") {
          document.documentElement.dataset.theme = message.theme === "dark" ? "dark" : "light";
          scheduleMeasure();
        } else if (message.type === "response" && typeof message.id === "string") {
          const action = pending.get(message.id);
          if (!action) return;
          clearTimeout(action.timeout);
          pending.delete(message.id);
          if (message.ok === true) action.resolve(message.result);
          else action.reject(new Error(String(message.error || "Host rejected the action.").slice(0, 2048)));
        }
      } catch (error) {
        report(error.message);
        if (message.type === "render") send({ type: "failed", session });
      }
    };
    port.start();
    send({ type: "ready", session });
  }
  window.addEventListener("message", initialize);
}
var CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src 'none'; connect-src 'none'; media-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
function receiverDocument() {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${DEFAULT_STYLE}</style></head><body><div id="answer-content"></div><script>(${receiver.toString()})();<\/script></body></html>`;
}
function createSurfaceFrame({ view, state = {}, theme = "light", embedded = false, onState, onAsk, onError, onHeight, onReady } = {}) {
  const safeView = validateView(view);
  const initialState = copyState(state);
  if (typeof document === "undefined" || typeof MessageChannel === "undefined") throw new Error("Surface frames require a browser.");
  const frame = document.createElement("iframe");
  frame.title = safeView.title;
  frame.setAttribute("sandbox", "allow-scripts");
  frame.setAttribute("referrerpolicy", "no-referrer");
  frame.setAttribute("allow", "camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'");
  frame.style.width = "100%";
  frame.style.height = "180px";
  frame.style.border = "0";
  frame.style.display = "block";
  frame.dataset.surfaceId = safeView.id;
  frame.dataset.surfaceRevision = String(safeView.revision);
  const channel = new MessageChannel();
  const session = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let active = true;
  let initialized = false;
  let ready = false;
  let rendered = false;
  let pendingCount = 0;
  let lastRequestId = 0;
  let currentTheme = theme === "dark" ? "dark" : "light";
  let operations = Promise.resolve();
  const requestIds = /* @__PURE__ */ new Set();
  const report = (error) => {
    if (!active) return;
    try {
      onError?.(error instanceof Error ? error : new Error(String(error)));
    } catch {
    }
  };
  const send = (message) => {
    if (active) channel.port1.postMessage({ ...message, session });
  };
  const timeout = setTimeout(() => {
    if (!rendered && active) {
      report(new Error("Answer page did not become ready within 10 seconds."));
      dispose();
    }
  }, 1e4);
  function dispose() {
    if (!active) return;
    active = false;
    clearTimeout(timeout);
    frame.removeEventListener("load", onLoad);
    channel.port1.onmessage = null;
    channel.port1.onmessageerror = null;
    channel.port1.close();
    channel.port2.close();
    requestIds.clear();
  }
  function onLoad() {
    if (!active) return;
    if (initialized) {
      report(new Error("Answer page attempted to navigate; its bridge was closed."));
      dispose();
      frame.srcdoc = "<!doctype html><p>\u9875\u9762\u5DF2\u505C\u6B62\uFF1A\u4E0D\u652F\u6301\u9875\u9762\u5BFC\u822A\u3002</p>";
      return;
    }
    initialized = true;
    frame.contentWindow.postMessage({ type: "answer:init", version: 1, session }, "*", [channel.port2]);
  }
  channel.port1.onmessageerror = () => report(new Error("Invalid message from answer page."));
  channel.port1.onmessage = ({ data: message }) => {
    if (!active || !message || typeof message !== "object" || message.session !== session || typeof message.type !== "string") return;
    if (message.type === "ready") {
      if (!initialized || ready) return;
      ready = true;
      send({ type: "render", html: safeView.html, state: initialState, theme: currentTheme, embedded, viewportHeight: globalThis.innerHeight || 800 });
      return;
    }
    if (!ready) return;
    if (message.type === "rendered") {
      if (rendered) return;
      rendered = true;
      clearTimeout(timeout);
      if (message.errorCount === 0) {
        try {
          onReady?.({ viewId: safeView.id, revision: safeView.revision });
        } catch (error) {
          report(error);
        }
      }
      return;
    }
    if (message.type === "failed") {
      clearTimeout(timeout);
      return;
    }
    if (message.type === "height") {
      if (!Number.isFinite(message.height) || message.height < 1 || !Number.isSafeInteger(Math.ceil(message.height))) return;
      frame.style.height = `${Math.ceil(message.height)}px`;
      try {
        onHeight?.(Math.ceil(message.height));
      } catch (error) {
        report(error);
      }
      return;
    }
    if (message.type === "error") {
      if (typeof message.message === "string" && byteLength(message.message) <= 8192) report(new Error(message.message));
      return;
    }
    if (message.type !== "state" && message.type !== "ask") return;
    if (typeof message.id !== "string" || !/^\d{1,16}$/.test(message.id) || requestIds.has(message.id)) return;
    const id = message.id;
    const numericId = Number(id);
    if (!Number.isSafeInteger(numericId) || numericId <= lastRequestId) return;
    lastRequestId = numericId;
    if (pendingCount >= 64) {
      send({ type: "response", id, ok: false, error: "Too many pending answer actions." });
      return;
    }
    let nextState;
    try {
      nextState = copyState(message.state);
      if (message.type === "ask" && (typeof message.text !== "string" || !message.text.trim() || byteLength(message.text) > SURFACE_LIMITS.text)) {
        throw new TypeError("Question must contain 1\u20138192 UTF-8 bytes.");
      }
    } catch (error) {
      send({ type: "response", id, ok: false, error: error.message });
      report(error);
      return;
    }
    requestIds.add(id);
    pendingCount++;
    const type = message.type;
    const question = message.text;
    operations = operations.then(async () => {
      if (!active) return;
      try {
        let result;
        if (type === "state") {
          if (typeof onState !== "function") throw new Error("This host does not support saving state.");
          result = await onState(nextState);
        } else {
          if (typeof onAsk !== "function") throw new Error("This host does not support follow-up questions.");
          result = await onAsk({ text: question, state: nextState });
        }
        send({ type: "response", id, ok: true, result: result === void 0 ? void 0 : copyState(result) });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        send({ type: "response", id, ok: false, error: reason.slice(0, 2048) });
        report(error);
      } finally {
        requestIds.delete(id);
        pendingCount--;
      }
    });
  };
  channel.port1.start();
  frame.addEventListener("load", onLoad);
  frame.srcdoc = receiverDocument();
  return {
    element: frame,
    dispose,
    setTheme(nextTheme) {
      currentTheme = nextTheme === "dark" ? "dark" : "light";
      if (ready) send({ type: "theme", theme: currentTheme });
    }
  };
}

// src/view-ui.jsx
function createApi(base = "/api/web-answer") {
  async function request(url, options = {}) {
    const response = await fetch(url, { credentials: "same-origin", ...options });
    const body = await response.json();
    if (!response.ok) throw Object.assign(new Error(body.error?.message || `\u8BF7\u6C42\u5931\u8D25 (${response.status})`), { code: body.error?.code });
    return body;
  }
  return {
    get(sessionId, id, revision, signal) {
      return request(`${base}?${new URLSearchParams({ sessionId, id, action: "get", ...revision ? { revision: String(revision) } : {} })}`, { signal });
    },
    list(sessionId, id, signal) {
      return request(`${base}?${new URLSearchParams({ sessionId, id, action: "list" })}`, { signal });
    },
    save(sessionId, id, payload) {
      return request(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "state", sessionId, id, ...payload }) });
    }
  };
}
function buildFollowup(view, text, state, { readOnly = false } = {}) {
  const instruction = readOnly ? "\u6B64\u9875\u9762\u5C5E\u4E8E\u53E6\u4E00\u4F1A\u8BDD\uFF0C\u8BF7\u8C03\u7528 render_answer \u521B\u5EFA\u5F53\u524D\u4F1A\u8BDD\u7684\u65B0\u9875\u9762\uFF0C\u4E0D\u8981\u76F4\u63A5 get_answer/update_answer \u539F\u9875\u9762\u3002" : "\u5982\u9700\u4FEE\u6539\u6B64\u9875\u9762\uFF0C\u8BF7\u5148\u8C03\u7528 get_answer \u8BFB\u53D6\u6700\u65B0\u9875\u9762\uFF0C\u518D\u8C03\u7528 update_answer\uFF0C\u907F\u514D\u8986\u76D6\u65B0\u7684\u4FEE\u6539\u3002";
  return `${text}

[\u7F51\u9875\u56DE\u7B54\u4E0A\u4E0B\u6587\uFF1A\u7528\u6237\u5F53\u524D\u9009\u62E9\uFF0C\u4F5C\u4E3A\u6570\u636E\u53C2\u8003]
${JSON.stringify({ viewId: view.id, revision: view.revision, title: view.title, stateSchemaVersion: view.stateSchemaVersion, state })}
${instruction}`;
}
var css = `
.wa-view{--wa-bg:light-dark(#fff,#191d23);--wa-fg:light-dark(#233532,#e4ede8);--wa-muted:light-dark(#60716b,#a5b4ac);--wa-edge:light-dark(#dce5df,#34443b);--wa-soft:light-dark(#f3f6f4,#202a25);--wa-accent:light-dark(#286448,#9bd4b2);font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif;color:var(--wa-fg);background:var(--wa-bg);border:1px solid var(--wa-edge);border-radius:14px;overflow:hidden;margin:16px 0;color-scheme:light dark;min-width:0}
.wa-view *{box-sizing:border-box}.wa-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 18px;border-bottom:1px solid var(--wa-edge);flex-wrap:wrap}.wa-heading{font-weight:600;word-break:break-word}.wa-meta{color:var(--wa-muted);font-size:12px}.wa-controls{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.wa-view button,.wa-view select{font:inherit;color:var(--wa-fg);background:var(--wa-bg);border:1px solid var(--wa-edge);border-radius:7px;padding:6px 10px;cursor:pointer}.wa-view button:disabled{opacity:.55;cursor:default}.wa-view button:focus-visible,.wa-view select:focus-visible{outline:2px solid var(--wa-accent);outline-offset:2px}.wa-view .wa-primary{background:var(--wa-accent);color:light-dark(#fff,#13261a);border-color:transparent}.wa-frame iframe{width:100%;display:block;border:0;min-height:150px}.wa-status{padding:9px 18px;color:var(--wa-muted);font-size:12px;border-top:1px solid var(--wa-edge)}.wa-notice{padding:13px 18px;background:var(--wa-soft);overflow-wrap:anywhere}.wa-notice p{margin:4px 0 10px}.wa-fallback{padding:22px;white-space:pre-wrap;overflow-wrap:anywhere}.wa-prompt{margin:0;white-space:pre-wrap;font:inherit;font-size:13px;overflow-wrap:anywhere}.wa-details{padding:12px 18px;border-top:1px solid var(--wa-edge);font-size:12px;color:var(--wa-muted)}.wa-details summary{cursor:pointer}.wa-details p{white-space:pre-wrap}.wa-confirm{border-top:1px solid var(--wa-edge);padding:16px 18px;background:var(--wa-soft)}.wa-confirm .wa-controls{margin-top:12px}.wa-status[role=alert]{color:light-dark(#9b3224,#f4b3a9)}@media(max-width:480px){.wa-head{padding:12px}.wa-frame iframe{min-height:220px}.wa-controls select{max-width:145px}}
.wa-view.wa-embedded{border:0;border-radius:0;background:transparent;margin:12px 0;overflow:visible}.wa-embedded .wa-frame{overflow:visible;border-radius:8px}.wa-embedded .wa-frame iframe{min-height:0}.wa-options{font-size:12px;color:var(--wa-muted);margin-top:6px}.wa-options>summary{cursor:pointer;width:fit-content;padding:4px 0}.wa-options>summary:focus-visible,.wa-details>summary:focus-visible{outline:2px solid var(--wa-accent);outline-offset:2px}.wa-options-body{padding:10px 0}.wa-options .wa-controls{margin-top:8px}.wa-embedded .wa-details{border:0;padding:10px 0 0}.wa-embedded .wa-status{border:0;padding:6px 0}.wa-embedded .wa-notice,.wa-embedded .wa-confirm{border:0;border-radius:8px;margin:8px 0}.wa-embedded .wa-fallback{padding:12px 0}
`;
function AnswerView({ sessionId, receipt, api: api2, sendMessage, initialRevision, readOnly = false, embedded = false }) {
  const [view, setView] = (0, import_react.useState)(null);
  const [versions, setVersions] = (0, import_react.useState)([]);
  const [revision, setRevision] = (0, import_react.useState)(initialRevision ?? null);
  const [reload, setReload] = (0, import_react.useState)(0);
  const [error, setError] = (0, import_react.useState)("");
  const [runtimeError, setRuntimeError] = (0, import_react.useState)("");
  const [status, setStatus] = (0, import_react.useState)("\u6B63\u5728\u8BFB\u53D6\u9875\u9762\u2026");
  const [statusEmphasis, setStatusEmphasis] = (0, import_react.useState)("loading");
  const [pending, setPending] = (0, import_react.useState)(null);
  const [sending, setSending] = (0, import_react.useState)(false);
  const [expanded, setExpanded] = (0, import_react.useState)(false);
  const mount = (0, import_react.useRef)(null);
  const current = (0, import_react.useRef)(null);
  const alive = (0, import_react.useRef)(true);
  const generation = (0, import_react.useRef)(0);
  const saveQueue = (0, import_react.useRef)(Promise.resolve());
  const liveFrame = (0, import_react.useRef)(null);
  const measuredHeight = (0, import_react.useRef)(180);
  const expandedRef = (0, import_react.useRef)(expanded);
  expandedRef.current = expanded;
  const frameHeight = (height, isExpanded) => embedded ? Math.max(1, height) : Math.min(isExpanded ? 2400 : 780, Math.max(160, height));
  function reportStatus(message, emphasis = null) {
    setStatus(message);
    setStatusEmphasis(emphasis);
  }
  (0, import_react.useEffect)(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  (0, import_react.useEffect)(() => {
    if (liveFrame.current) liveFrame.current.element.style.height = `${frameHeight(measuredHeight.current, expanded)}px`;
  }, [expanded, embedded]);
  (0, import_react.useEffect)(() => {
    const changed = (event) => {
      if (event.detail?.id === receipt.id && event.detail.revision > (current.current?.revision ?? 0) && revision === null) setReload((n) => n + 1);
    };
    window.addEventListener("web-answer:updated", changed);
    return () => window.removeEventListener("web-answer:updated", changed);
  }, [receipt.id, revision]);
  (0, import_react.useEffect)(() => {
    const abort = new AbortController();
    setError("");
    setRuntimeError("");
    reportStatus("\u6B63\u5728\u8BFB\u53D6\u9875\u9762\u2026", "loading");
    setPending(null);
    Promise.all([api2.get(sessionId, receipt.id, revision, abort.signal), api2.list(sessionId, receipt.id, abort.signal)]).then(([next, list]) => {
      if (abort.signal.aborted) return;
      current.current = next;
      setView(next);
      setVersions(list);
      reportStatus("\u6B63\u5728\u52A0\u8F7D\u4EA4\u4E92\u5185\u5BB9\u2026", "loading");
    }).catch((err) => {
      if (!abort.signal.aborted) {
        setError(err.message);
        reportStatus("");
      }
    });
    return () => abort.abort();
  }, [api2, sessionId, receipt.id, receipt.revision, revision, reload]);
  (0, import_react.useEffect)(() => {
    if (!view || !mount.current) return;
    const ownGeneration = ++generation.current;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const frame = createSurfaceFrame({
      view,
      state: view.state,
      theme: media.matches ? "dark" : "light",
      embedded,
      onReady() {
        if (alive.current && ownGeneration === generation.current) reportStatus(readOnly ? "\u6765\u81EA\u53E6\u4E00\u4F1A\u8BDD \xB7 \u4EC5\u4F9B\u67E5\u770B" : view.revision < view.latestRevision ? "\u5386\u53F2\u7248\u672C \xB7 \u53C2\u6570\u53D8\u66F4\u4E0D\u4F1A\u4FDD\u5B58" : "\u9875\u9762\u5DF2\u5C31\u7EEA \xB7 \u53C2\u6570\u4FEE\u6539\u81EA\u52A8\u4FDD\u5B58", view.revision < view.latestRevision ? "notice" : null);
      },
      onHeight(height) {
        measuredHeight.current = height;
        frame.element.style.height = `${frameHeight(height, expandedRef.current)}px`;
      },
      onError(err) {
        if (alive.current && ownGeneration === generation.current) {
          setRuntimeError(err.message);
          reportStatus("\u9875\u9762\u8FD0\u884C\u5F02\u5E38\uFF1B\u6587\u5B57\u8BF4\u660E\u4ECD\u53EF\u9605\u8BFB", "error");
        }
      },
      onState(state) {
        const action = saveQueue.current.catch(() => {
        }).then(async () => {
          if (!alive.current || ownGeneration !== generation.current) throw new Error("\u9875\u9762\u5DF2\u7ECF\u5207\u6362\uFF0C\u8BF7\u5728\u5F53\u524D\u9875\u9762\u64CD\u4F5C\u3002");
          if (readOnly) throw new Error("\u6B64\u9875\u9762\u6765\u81EA\u53E6\u4E00\u4F1A\u8BDD\uFF0C\u4EC5\u4F9B\u67E5\u770B\uFF1B\u8BF7\u5728\u5F53\u524D\u4F1A\u8BDD\u751F\u6210\u65B0\u9875\u9762\u540E\u4FEE\u6539\u3002");
          const snapshot = current.current;
          if (snapshot.revision !== view.revision || snapshot.revision < snapshot.latestRevision) throw new Error("\u5386\u53F2\u7248\u672C\u53EA\u4F9B\u67E5\u770B\uFF0C\u8BF7\u5207\u56DE\u6700\u65B0\u7248\u672C\u540E\u4FDD\u5B58\u3002");
          reportStatus("\u6B63\u5728\u4FDD\u5B58\u53C2\u6570\u2026");
          try {
            const saved = await api2.save(sessionId, receipt.id, { revision: snapshot.revision, expectedStateVersion: snapshot.stateVersion, state });
            if (ownGeneration === generation.current && alive.current) {
              current.current = saved;
              reportStatus("\u53C2\u6570\u5DF2\u4FDD\u5B58");
            }
            return { saved: true };
          } catch (err) {
            if (ownGeneration === generation.current && alive.current) reportStatus(err.code === "CONFLICT" ? "\u9875\u9762\u5DF2\u5728\u5176\u4ED6\u4F4D\u7F6E\u66F4\u65B0\u3002\u8BF7\u5237\u65B0\u540E\u7EE7\u7EED\u3002" : `\u4FDD\u5B58\u5931\u8D25\uFF1A${err.message}`, "error");
            throw err;
          }
        });
        saveQueue.current = action;
        return action;
      },
      async onAsk({ text, state }) {
        if (!alive.current || ownGeneration !== generation.current) throw new Error("\u9875\u9762\u5DF2\u7ECF\u5207\u6362\u3002");
        setPending({ text: buildFollowup(view, text, state, { readOnly }), viewId: view.id, revision: view.revision });
        reportStatus("\u8BF7\u5728\u9875\u9762\u4E0B\u65B9\u786E\u8BA4\u8FFD\u95EE\u5185\u5BB9", "notice");
        return { pending: true };
      }
    });
    liveFrame.current = frame;
    mount.current.replaceChildren(frame.element);
    const updateTheme = () => frame.setTheme(media.matches ? "dark" : "light");
    media.addEventListener("change", updateTheme);
    return () => {
      generation.current++;
      liveFrame.current = null;
      media.removeEventListener("change", updateTheme);
      frame.dispose();
    };
  }, [view, api2, sessionId, receipt.id, readOnly, embedded]);
  async function send() {
    if (!pending || sending) return;
    setSending(true);
    try {
      await sendMessage(pending.text);
      setPending(null);
      reportStatus("\u8FFD\u95EE\u5DF2\u63D0\u4EA4\u5230\u5F53\u524D\u5BF9\u8BDD");
    } catch (err) {
      reportStatus(`\u53D1\u9001\u5931\u8D25\uFF1A${err.message}`, "error");
    } finally {
      if (alive.current) setSending(false);
    }
  }
  const controls = /* @__PURE__ */ import_react.default.createElement("div", { className: "wa-controls" }, /* @__PURE__ */ import_react.default.createElement("select", { "aria-label": "\u9875\u9762\u7248\u672C", value: revision ?? "latest", onChange: (e) => setRevision(e.target.value === "latest" ? null : Number(e.target.value)) }, /* @__PURE__ */ import_react.default.createElement("option", { value: "latest" }, "\u6700\u65B0\u7248\u672C"), versions.map((v) => /* @__PURE__ */ import_react.default.createElement("option", { key: v.revision, value: v.revision }, "\u7248\u672C ", v.revision))), /* @__PURE__ */ import_react.default.createElement("button", { type: "button", onClick: () => setReload((x) => x + 1) }, "\u5237\u65B0"), !embedded && /* @__PURE__ */ import_react.default.createElement("button", { type: "button", "aria-pressed": expanded, onClick: () => setExpanded((v) => !v) }, expanded ? "\u6536\u8D77\u9AD8\u5EA6" : "\u5C55\u5F00\u9AD8\u5EA6"));
  const summary = view && /* @__PURE__ */ import_react.default.createElement("details", { className: "wa-details", open: Boolean(runtimeError || error) }, /* @__PURE__ */ import_react.default.createElement("summary", null, "\u6587\u5B57\u8BF4\u660E"), /* @__PURE__ */ import_react.default.createElement("p", null, view.summary));
  const statusLine = status && /* @__PURE__ */ import_react.default.createElement("div", { className: "wa-status", role: statusEmphasis === "error" ? "alert" : "status", "aria-live": "polite" }, status);
  return /* @__PURE__ */ import_react.default.createElement("section", { className: `wa-view${embedded ? " wa-embedded" : ""}`, "aria-label": receipt.title || "\u7F51\u9875\u56DE\u7B54" }, /* @__PURE__ */ import_react.default.createElement("style", null, css), !embedded && /* @__PURE__ */ import_react.default.createElement("header", { className: "wa-head" }, /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement("div", { className: "wa-heading" }, view?.title || receipt.title || "\u7F51\u9875\u56DE\u7B54"), /* @__PURE__ */ import_react.default.createElement("span", { className: "wa-meta" }, "\u7F51\u9875\u56DE\u7B54", view ? ` \xB7 \u7248\u672C ${view.revision}` : "")), controls), readOnly && /* @__PURE__ */ import_react.default.createElement("div", { className: "wa-notice", role: "note" }, "\u6B64\u9875\u9762\u6765\u81EA\u53E6\u4E00\u4F1A\u8BDD\uFF0C\u4EC5\u4F9B\u67E5\u770B\uFF1B\u8BF7\u5728\u5F53\u524D\u4F1A\u8BDD\u751F\u6210\u65B0\u9875\u9762\u540E\u4FEE\u6539\u3002"), error && /* @__PURE__ */ import_react.default.createElement("div", { className: "wa-notice", role: "alert" }, /* @__PURE__ */ import_react.default.createElement("p", null, "\u6682\u65F6\u65E0\u6CD5\u8BFB\u53D6\u9875\u9762\uFF1A", error), /* @__PURE__ */ import_react.default.createElement("button", { onClick: () => setReload((x) => x + 1) }, "\u91CD\u8BD5")), runtimeError && /* @__PURE__ */ import_react.default.createElement("div", { className: "wa-notice", role: "alert" }, /* @__PURE__ */ import_react.default.createElement("p", null, "\u9875\u9762\u8FD0\u884C\u9519\u8BEF\uFF1A", runtimeError), /* @__PURE__ */ import_react.default.createElement("div", { className: "wa-controls" }, /* @__PURE__ */ import_react.default.createElement("button", { onClick: () => setReload((x) => x + 1) }, "\u91CD\u65B0\u52A0\u8F7D"), view?.revision > 1 && /* @__PURE__ */ import_react.default.createElement("button", { onClick: () => setRevision(view.revision - 1) }, "\u67E5\u770B\u4E0A\u4E00\u7248"))), /* @__PURE__ */ import_react.default.createElement("div", { className: "wa-frame", ref: mount }), !view && (!embedded || error) && /* @__PURE__ */ import_react.default.createElement("div", { className: "wa-fallback" }, receipt.summary || "\u6B63\u5728\u51C6\u5907\u7F51\u9875\u56DE\u7B54\u2026"), (!embedded || runtimeError || error) && summary, pending && /* @__PURE__ */ import_react.default.createElement("div", { className: "wa-confirm", "aria-label": "\u786E\u8BA4\u8FFD\u95EE" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "wa-heading" }, "\u5C06\u4EE5\u4E0B\u5185\u5BB9\u53D1\u7ED9 AI"), /* @__PURE__ */ import_react.default.createElement("pre", { className: "wa-prompt" }, pending.text), /* @__PURE__ */ import_react.default.createElement("div", { className: "wa-controls" }, /* @__PURE__ */ import_react.default.createElement("button", { className: "wa-primary", disabled: sending, onClick: send }, sending ? "\u6B63\u5728\u53D1\u9001\u2026" : "\u53D1\u9001\u8FFD\u95EE"), /* @__PURE__ */ import_react.default.createElement("button", { disabled: sending, onClick: () => {
    setPending(null);
    reportStatus("\u5DF2\u53D6\u6D88\u8FFD\u95EE");
  } }, "\u53D6\u6D88"))), (!embedded || statusEmphasis) && statusLine, embedded && /* @__PURE__ */ import_react.default.createElement("details", { className: "wa-options" }, /* @__PURE__ */ import_react.default.createElement("summary", null, "\u56FE\u8868\u9009\u9879"), /* @__PURE__ */ import_react.default.createElement("div", { className: "wa-options-body" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "wa-heading" }, view?.title || receipt.title || "\u7F51\u9875\u56DE\u7B54"), /* @__PURE__ */ import_react.default.createElement("span", { className: "wa-meta" }, view ? `\u7248\u672C ${view.revision}` : "\u6B63\u5728\u51C6\u5907\u5185\u5BB9"), controls, !runtimeError && !error && summary, !statusEmphasis && statusLine)));
}

// src/inline-reference.js
var UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
var OPEN = new RegExp(`^ {0,3}:::web-answer[ \\t]+(${UUID})[ \\t]*$`, "i");
var CLOSE = /^ {0,3}:::[ \t]*$/;
function parseInlineReferences(text, { streaming = false } = {}) {
  if (typeof text !== "string" || text === "") return [];
  const lines = text.match(/[^\n]*\n|[^\n]+$/g) || [];
  const parts = [];
  let buffer = "";
  let fence = null;
  const flush = () => {
    if (buffer !== "") parts.push({ kind: "text", text: buffer });
    buffer = "";
  };
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].replace(/\r?\n$/, "");
    const code = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence !== null) {
      buffer += lines[i];
      if (code && code[1][0] === fence.char && code[1].length >= fence.length && code[2].trim() === "") fence = null;
      continue;
    }
    if (code) {
      fence = { char: code[1][0], length: code[1].length };
      buffer += lines[i];
      continue;
    }
    const open = OPEN.exec(line);
    if (open && i + 1 < lines.length && CLOSE.test(lines[i + 1].replace(/\r?\n$/, ""))) {
      flush();
      parts.push({ kind: "answer", id: open[1].toLowerCase() });
      i += 1;
      continue;
    }
    const tail = lines.slice(i).join("");
    if (streaming && /^ {0,3}:::web-answer(?:[ \t]+[0-9a-f-]{0,36})?[ \t]*(?:\r?\n {0,3}:{0,3}[ \t]*)?$/i.test(tail)) {
      flush();
      parts.push({ kind: "pending", text: tail });
      break;
    }
    buffer += lines[i];
  }
  flush();
  return parts;
}
function inlineAnswerIds(text) {
  return [...new Set(parseInlineReferences(text).filter((part) => part.kind === "answer").map((part) => part.id))];
}

// src/conversation.js
var ANSWER_TOOLS = /* @__PURE__ */ new Set(["render_answer", "update_answer"]);
function isCoordinate(value) {
  return Number.isSafeInteger(value) && value >= 0;
}
function readReceipt(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.kind !== "web-answer" || typeof value.id !== "string" || value.id.trim() === "" || !Number.isSafeInteger(value.revision) || value.revision < 1 || typeof value.title !== "string" || typeof value.summary !== "string" || typeof value.sessionId !== "string" || value.sessionId.trim() === "") return null;
  return {
    kind: "web-answer",
    id: value.id,
    revision: value.revision,
    title: value.title,
    summary: value.summary,
    sessionId: value.sessionId
  };
}
function resultReceipt(event) {
  if (event?.type !== "tool/result" || event.data?.error !== void 0) return null;
  const message = event.data?.message;
  if (message?.source?.kind !== "tool" || typeof message.source.callId !== "string" || message.source.callId === "" || message.isError === true) return null;
  let content;
  if (message.role === "tool") {
    if (message.toolCallId !== message.source.callId) return null;
    content = message.content;
  } else {
    const block = message.content?.[0];
    if (block?.type !== "tool-result" || block.isError === true || block.toolCallId !== message.source.callId) return null;
    content = block.content;
  }
  if (!Array.isArray(content)) return null;
  const receipt = readReceipt(event.data.meta);
  if (receipt !== null) return receipt;
  const text = content.filter((part) => part?.type === "text" && typeof part.text === "string").map((part) => part.text).join("\n");
  try {
    return readReceipt(JSON.parse(text));
  } catch {
    return null;
  }
}
function emptyState(turn) {
  return { turn, callNames: /* @__PURE__ */ new Map(), views: /* @__PURE__ */ new Map(), assistantBlocks: /* @__PURE__ */ new Map(), latestStep: void 0, resultSeq: void 0, endSeq: void 0 };
}
function isAssistantUpdate(event) {
  if (!isCoordinate(event.data.step)) return false;
  if (event.type === "assistant/message") {
    return event.surfaceOp === "append" && event.data.message?.role === "assistant" && Array.isArray(event.data.message.content);
  }
  if (event.type === "llm/retry") return true;
  const chunk = event.data.chunk;
  return event.type === "assistant/live-chunk" && isCoordinate(chunk?.index) && ["block-start", "text-delta", "reasoning-delta", "tool-call-delta", "block-end"].includes(chunk.type);
}
function referenceBlock(block) {
  return block?.type === "text" && typeof block.text === "string" ? { type: "text", text: block.text } : { type: block?.type };
}
function updateAssistant(state, event) {
  const assistantBlocks = new Map(state.assistantBlocks);
  const step = event.data.step;
  if (event.type === "llm/retry") assistantBlocks.delete(step);
  else if (event.type === "assistant/message") {
    assistantBlocks.set(step, event.data.message.content.map(referenceBlock));
  } else {
    const blocks = [...assistantBlocks.get(step) || []];
    const chunk = event.data.chunk;
    if (chunk.type === "block-start") blocks[chunk.index] = referenceBlock({ type: chunk.blockType, text: "" });
    else if (chunk.type === "text-delta") {
      if (typeof chunk.text !== "string") return state;
      const previous = blocks[chunk.index];
      blocks[chunk.index] = { type: "text", text: (previous?.type === "text" ? previous.text : "") + chunk.text };
    } else if (chunk.type === "reasoning-delta" || chunk.type === "tool-call-delta") {
      blocks[chunk.index] = { type: chunk.type === "reasoning-delta" ? "reasoning" : "tool-call" };
    } else if (chunk.type === "block-end") {
      blocks[chunk.index] = referenceBlock(chunk.block);
    }
    assistantBlocks.set(step, blocks);
  }
  return { ...state, assistantBlocks };
}
function projectedData(state) {
  const finalBlocks = state.assistantBlocks.get(state.latestStep) ?? [];
  const finalStep = finalBlocks.some((block) => block?.type === "text" && block.text.trim() !== "") && !finalBlocks.some((block) => block?.type === "tool-call") ? state.latestStep : null;
  const inlineStep = state.endSeq === void 0 ? void 0 : finalStep;
  const inlineIds = /* @__PURE__ */ new Set();
  for (const [step, blocks] of state.assistantBlocks) {
    if (inlineStep !== void 0 && step !== inlineStep) continue;
    for (const block of blocks) {
      if (block?.type !== "text") continue;
      for (const id of inlineAnswerIds(block.text)) if (state.views.has(id)) inlineIds.add(id);
    }
  }
  return { views: [...state.views.values()], inlineIds: [...inlineIds], inlineStep };
}
function sameData(left, right) {
  return left !== void 0 && left.views.length === right.views.length && left.views.every((view, index) => view === right.views[index]) && left.inlineStep === right.inlineStep && left.inlineIds.length === right.inlineIds.length && left.inlineIds.every((id, index) => id === right.inlineIds[index]);
}
function foldEvent(state, event) {
  if (event.data.turn !== state.turn) return state;
  if (isCoordinate(event.data.step) && (state.latestStep === void 0 || event.data.step > state.latestStep)) {
    state = { ...state, latestStep: event.data.step };
  }
  if (event.type === "tool/call") {
    const callNames = new Map(state.callNames);
    callNames.set(event.data.callId, event.data.name);
    return { ...state, callNames };
  }
  if (event.type === "turn/end") return { ...state, endSeq: event.seq };
  if (isAssistantUpdate(event)) return updateAssistant(state, event);
  const receipt = resultReceipt(event);
  if (receipt === null) return state;
  const name = state.callNames.get(event.data.message.source.callId);
  if (name !== void 0 && !ANSWER_TOOLS.has(name)) return state;
  const previous = state.views.get(receipt.id);
  if (previous !== void 0 && previous.revision > receipt.revision) return state;
  const views = new Map(state.views);
  views.set(receipt.id, receipt);
  return { ...state, views, resultSeq: event.seq };
}
function replayLoadedMatches(context) {
  let state = emptyState(Number(context.id));
  for (const match of context.matches) state = foldEvent(state, match.event);
  return state;
}
var webAnswerDefinition = {
  kind: "web-answer",
  target: "chat",
  match(event) {
    if (!isCoordinate(event?.data?.turn)) return null;
    const id = String(event.data.turn);
    if (event.type === "turn/start") return { id, role: "start" };
    if (event.type === "turn/end") return { id, role: "update" };
    if ((event.type === "step/start" || event.type === "step/end") && isCoordinate(event.data.step)) return { id, role: "update" };
    if (event.type === "tool/call" && typeof event.data.callId === "string" && typeof event.data.name === "string") return { id, role: "update" };
    if (isAssistantUpdate(event)) return { id, role: "update" };
    if (resultReceipt(event) !== null) return { id, role: "update" };
    return null;
  },
  start(_context, match) {
    return emptyState(match.event.data.turn);
  },
  update(context, match) {
    return foldEvent(context.state, match.event);
  },
  publication(match) {
    return match?.event.type === "assistant/live-chunk" ? "animation-frame" : "immediate";
  },
  buildLocationData(context, scope, previous) {
    if (scope !== "turn") return null;
    const state = context.state ?? replayLoadedMatches(context);
    const value = projectedData(state);
    if (previous?.kind === "turn" && previous.turn === state.turn && sameData(previous.value, value)) return previous;
    return { kind: "turn", turn: state.turn, key: "web-answer", value };
  },
  buildViewNode(context) {
    const state = context.state ?? replayLoadedMatches(context);
    const location = context.matches.at(-1)?.location ?? context.start?.location ?? { kind: "unresolved" };
    if (state.views.size === 0) {
      const current = context.current.get("chat");
      return current == null ? null : {
        ...current,
        location,
        visibility: "hidden",
        data: projectedData(state)
      };
    }
    return {
      key: context.key,
      kind: "web-answer",
      id: context.id,
      target: "chat",
      // Compact Chat folds process nodes before the final answer boundary.
      // A completed web answer belongs at the durable Turn end instead.
      anchorSeq: state.endSeq ?? state.resultSeq,
      location,
      visibility: "visible",
      // DSH 0.2.x groups unclassified custom nodes as execution details.
      // A delivered answer belongs to the Turn, outside collapsible processes.
      groupTree: "turn",
      // The assistant wrapper resolves inline references from the same Turn's
      // complete receipt list. The standalone renderer filters inlineIds only.
      data: projectedData(state)
    };
  }
};

// src/native-slot-bridge.js
var import_react2 = __toESM(require("react"), 1);
var PREFIX = "dsh-better-answer-view.native.";
function registerNativeSlotBridge(ctx, base, decorate) {
  const disposers = [];
  const alias = (name) => `${PREFIX}${name}`;
  function bridge(entry, name, component, options = {}) {
    const children = entry.children;
    const childNames = Object.keys(children || {});
    const mappedChildren = Object.fromEntries(childNames.map((key) => [alias(key), children[key]]));
    const Component = component || entry.component;
    function NativeWithAliases(props) {
      const renderSlot = childNames.length === 0 ? props.renderSlot : (key, owner, opts) => props.renderSlot(alias(key), owner, opts);
      const renderSlotChain = childNames.length === 0 ? props.renderSlotChain : (key, owner, opts) => props.renderSlotChain(alias(key), owner, opts);
      return import_react2.default.createElement(Component, { ...props, renderSlot, renderSlotChain });
    }
    const registration = {
      name,
      ...entry.options,
      ...entry.select ? { select: entry.select } : {},
      ...entry.inject ? { inject: entry.inject } : {},
      ...entry.locale ? { locale: entry.locale } : {},
      ...entry.store ? { store: entry.store } : {},
      ...childNames.length ? { children: mappedChildren } : {},
      ...options
    };
    const stop = ctx.slots.register(registration, NativeWithAliases);
    const stopChildren = [];
    try {
      for (const child of childNames) stopChildren.push(mirror(child));
    } catch (error) {
      for (const dispose of stopChildren.reverse()) dispose();
      stop();
      throw error;
    }
    return () => {
      for (const dispose of stopChildren.reverse()) dispose();
      stop();
    };
  }
  function mirror(originalName) {
    let lastEntries;
    let stopEntries = [];
    let stopped = false;
    const reconcile = () => {
      if (stopped) return;
      const entries = ctx.slots.entries(originalName);
      if (entries === lastEntries) return;
      lastEntries = entries;
      for (const dispose of stopEntries.reverse()) dispose();
      stopEntries = [];
      for (const entry of entries) stopEntries.push(bridge(entry, alias(originalName)));
    };
    try {
      reconcile();
    } catch (error) {
      for (const dispose of stopEntries.reverse()) dispose();
      throw error;
    }
    const unsubscribe = ctx.slots.subscribe(originalName, reconcile);
    return () => {
      stopped = true;
      unsubscribe();
      for (const dispose of stopEntries.reverse()) dispose();
    };
  }
  try {
    disposers.push(bridge(base, "conversation.chat.node", decorate(base.component), {
      key: "assistant-step",
      priority: (base.options.priority ?? 0) - 100
    }));
  } catch (error) {
    for (const dispose of disposers.reverse()) dispose();
    throw error;
  }
  return () => {
    for (const dispose of disposers.reverse()) dispose();
  };
}

// src/client.jsx
var api = createApi();
var EMPTY_VIEWS = [];
var inlineReady = false;
var inlineReadyListeners = /* @__PURE__ */ new Set();
var readInlineReady = () => inlineReady;
var subscribeInlineReady = (listener) => {
  inlineReadyListeners.add(listener);
  return () => inlineReadyListeners.delete(listener);
};
function setInlineReady(ready) {
  if (inlineReady === ready) return;
  inlineReady = ready;
  for (const listener of inlineReadyListeners) listener();
}
function partsForBlocks(blocks, streaming) {
  const parts = [];
  let native = [];
  const flush = () => {
    if (native.length) parts.push({ kind: "native", blocks: native });
    native = [];
  };
  for (const block of blocks) {
    if (block.kind !== "text") {
      native.push(block);
      continue;
    }
    for (const part of parseInlineReferences(block.text, { streaming })) {
      if (part.kind === "text") native.push({ ...block, text: part.text });
      else {
        flush();
        parts.push(part);
      }
    }
  }
  flush();
  return parts;
}
function inlineDecorator(ctx) {
  return (NativeAssistant) => function InlineAssistant(props) {
    const { node, sessionId, groupPart, useTurnData } = props;
    const turnAnswers = useTurnData("web-answer");
    const receipts = turnAnswers?.views || EMPTY_VIEWS;
    const parts = partsForBlocks(node.data.blocks, node.data.status === "running");
    if (groupPart === "reasoning" || !parts.some((part) => part.kind !== "native")) return /* @__PURE__ */ import_react3.default.createElement(NativeAssistant, { ...props });
    if (turnAnswers?.inlineStep !== void 0 && node.data.step !== turnAnswers.inlineStep) {
      const blocks = node.data.blocks.map((block) => block.kind !== "text" ? block : {
        ...block,
        text: parseInlineReferences(block.text).map((part) => part.kind === "text" ? part.text : receipts.some((view) => view.id === part.id) ? "\uFF08\u56FE\u6587\u5185\u5BB9\u89C1\u672C\u8F6E\u56DE\u7B54\u3002\uFF09\n" : `:::web-answer ${part.id}
:::
`).join("")
      });
      return /* @__PURE__ */ import_react3.default.createElement(NativeAssistant, { ...props, node: { ...node, data: { ...node.data, blocks } } });
    }
    const sendMessage = (text) => ctx.sessions.scope(sessionId).conversation.send(text);
    return /* @__PURE__ */ import_react3.default.createElement("div", { "data-web-answer-inline": "true", style: { display: "flex", flexDirection: "column", gap: 16 } }, parts.map((part, index) => {
      if (part.kind === "native") {
        const segmentNode = { ...node, data: {
          ...node.data,
          blocks: part.blocks,
          // The interruption notice belongs to the final displayed segment.
          ...node.data.status === "interrupted" && index !== parts.length - 1 ? { status: "settled" } : {}
        } };
        return /* @__PURE__ */ import_react3.default.createElement(NativeAssistant, { key: `text:${index}`, ...props, node: segmentNode });
      }
      if (part.kind === "pending") return /* @__PURE__ */ import_react3.default.createElement("div", { key: `pending:${index}`, role: "status", style: { fontSize: 13, opacity: 0.65 } }, "\u6B63\u5728\u51C6\u5907\u56FE\u6587\u5185\u5BB9\u2026");
      const receipt = receipts.find((view) => view.id === part.id);
      if (!receipt) return /* @__PURE__ */ import_react3.default.createElement("div", { key: `missing:${index}`, role: "status", style: { fontSize: 13 } }, "\u8FD9\u5904\u56FE\u6587\u5185\u5BB9\u6682\u4E0D\u53EF\u7528\uFF08", part.id, "\uFF09\u3002");
      return /* @__PURE__ */ import_react3.default.createElement(
        AnswerView,
        {
          key: `answer:${part.id}:${index}`,
          embedded: true,
          sessionId: receipt.sessionId,
          readOnly: Boolean(sessionId && receipt.sessionId !== sessionId),
          receipt,
          api,
          sendMessage
        }
      );
    }));
  };
}
function registerInlineAssistant(ctx) {
  return ctx.slots.inject("conversation.chat.node", () => {
    let activeBase;
    let stopBridge;
    let stopped = false;
    const reconcile = () => {
      if (stopped) return;
      const candidates = ctx.slots.entries("conversation.chat.node").filter((entry) => entry.options.key === "assistant-step" && entry.registrant !== "dsh-better-answer-view");
      const base = candidates.find((entry) => entry.registrant === "@deepseek-ai/dsh-client-ui-chat") || candidates.find((entry) => (entry.options.priority ?? 0) >= 0);
      if (base === activeBase) return;
      const previousBridge = stopBridge;
      stopBridge = void 0;
      activeBase = base;
      setInlineReady(false);
      previousBridge?.();
      if (base) {
        try {
          stopBridge = registerNativeSlotBridge(ctx, base, inlineDecorator(ctx));
          setInlineReady(true);
        } catch (error) {
          console.warn("[dsh-better-answer-view] Inline renderer unavailable; keeping answer blocks at the end of the turn.", error);
        }
      }
    };
    reconcile();
    const unsubscribe = ctx.slots.subscribe("conversation.chat.node", reconcile);
    return () => {
      stopped = true;
      unsubscribe();
      stopBridge?.();
      setInlineReady(false);
    };
  });
}
function isReceipt(value) {
  return value?.kind === "web-answer" && typeof value.id === "string" && value.id.trim() !== "" && Number.isSafeInteger(value.revision) && value.revision > 0 && typeof value.title === "string" && typeof value.summary === "string" && typeof value.sessionId === "string" && value.sessionId.trim() !== "";
}
function resultText(block) {
  return Array.isArray(block?.content) ? block.content.filter((part) => part?.type === "text" && typeof part.text === "string").map((part) => part.text).join("\n") : "";
}
function hasReceipt(block) {
  if (isReceipt(block.meta)) return true;
  try {
    return isReceipt(JSON.parse(resultText(block)));
  } catch {
    return false;
  }
}
function ToolReceipt({ block, toolName, inspect }) {
  const settled = block?.kind === "tool-result";
  const stopped = settled && block.error?.code === "interrupted";
  const failed = settled && (block.isError === true || block.error !== void 0);
  const complete = settled && !failed && hasReceipt(block);
  const operation = toolName === "update_answer" ? "\u66F4\u65B0" : "\u751F\u6210";
  const message = !settled ? `\u6B63\u5728${operation}\u7F51\u9875\u56DE\u7B54\u2026` : stopped ? `\u7F51\u9875\u56DE\u7B54${operation}\u5DF2\u505C\u6B62\u3002` : failed ? `\u7F51\u9875\u56DE\u7B54${operation}\u5931\u8D25\u3002` : complete ? "\u56FE\u6587\u5185\u5BB9\u5DF2\u4FDD\u5B58\uFF0C\u5C06\u5D4C\u5165\u56DE\u7B54\u7684\u76F8\u5E94\u4F4D\u7F6E\u3002" : "\u8C03\u7528\u5DF2\u7ED3\u675F\uFF0C\u4F46\u6CA1\u6709\u6536\u5230\u53EF\u5C55\u793A\u7684\u7F51\u9875\u56DE\u6267\u3002";
  const showDetails = settled && !complete;
  const details = showDetails ? resultText(block).slice(0, 8e3) : "";
  return /* @__PURE__ */ import_react3.default.createElement("div", { style: { padding: "8px 12px", fontSize: 13 } }, /* @__PURE__ */ import_react3.default.createElement("div", null, message), showDetails && details && /* @__PURE__ */ import_react3.default.createElement("details", { style: { marginTop: 6 } }, /* @__PURE__ */ import_react3.default.createElement("summary", null, "\u67E5\u770B\u7ED3\u679C\u8BE6\u60C5"), /* @__PURE__ */ import_react3.default.createElement("pre", { style: { whiteSpace: "pre-wrap", overflowWrap: "anywhere", font: "inherit" } }, details)), showDetails && inspect && /* @__PURE__ */ import_react3.default.createElement("button", { type: "button", onClick: inspect, style: { marginTop: 6 } }, "\u67E5\u770B\u5DE5\u5177\u8BE6\u60C5"));
}
var inject = ["slots", "uiConversation", "sessions", "conversation"];
function apply(ctx) {
  ctx.uiConversation.events.register(webAnswerDefinition);
  registerInlineAssistant(ctx);
  ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
    name: "conversation.chat.node",
    key: "web-answer",
    inject: (sessionId) => ({ sendMessage: (text) => ctx.sessions.scope(sessionId).conversation.send(text) })
  }, function WebAnswerNode({ node, sessionId, sendMessage }) {
    const canEmbedInline = (0, import_react3.useSyncExternalStore)(subscribeInlineReady, readInlineReady, readInlineReady);
    const notified = (0, import_react3.useRef)(/* @__PURE__ */ new Map());
    const allViews = node?.visibility === "hidden" ? EMPTY_VIEWS : node?.data?.views || EMPTY_VIEWS;
    const inlineIds = node?.data?.inlineIds || [];
    const views = canEmbedInline ? allViews.filter((view) => !inlineIds.includes(view.id)) : allViews;
    (0, import_react3.useEffect)(() => {
      for (const view of allViews) {
        const key = `${view.sessionId}:${view.id}`;
        if ((notified.current.get(key) ?? 0) >= view.revision) continue;
        notified.current.set(key, view.revision);
        window.dispatchEvent(new CustomEvent("web-answer:updated", { detail: { id: view.id, revision: view.revision } }));
      }
    }, [allViews]);
    if (views.length === 0) return null;
    return /* @__PURE__ */ import_react3.default.createElement("div", null, views.map((receipt) => /* @__PURE__ */ import_react3.default.createElement(AnswerView, { embedded: true, key: `${receipt.sessionId}:${receipt.id}`, sessionId: receipt.sessionId || sessionId, readOnly: Boolean(sessionId && receipt.sessionId && sessionId !== receipt.sessionId), receipt, api, sendMessage })));
  }));
  for (const tool of ["render_answer", "update_answer"]) {
    ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({ name: "tool.call.toolview", key: tool }, ToolReceipt));
  }
}
return module.exports;}});
