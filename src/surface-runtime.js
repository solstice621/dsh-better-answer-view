import { DEFAULT_STYLE } from './presentation-style.js';

/** Sandboxed, dependency-free HTML answer runtime. No model HTML enters the host DOM. */
export const SURFACE_LIMITS = Object.freeze({ html: 256 * 1024, state: 16 * 1024, text: 8 * 1024 });

export function byteLength(value) {
  return new TextEncoder().encode(value).byteLength;
}

export function copyState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('State must be a JSON object.');
  const seen = new Set();
  function check(item, depth) {
    if (depth > 64) throw new TypeError('State is nested too deeply.');
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return;
    if (typeof item === 'number' && Number.isFinite(item)) return;
    if (typeof item !== 'object') throw new TypeError('State must contain only JSON values.');
    if (seen.has(item)) throw new TypeError('State must not contain cycles.');
    if (!Array.isArray(item) && Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) {
      throw new TypeError('State must contain only plain JSON objects.');
    }
    seen.add(item);
    for (const key of Object.keys(item)) check(item[key], depth + 1);
    seen.delete(item);
  }
  check(value, 0);
  const json = JSON.stringify(value);
  if (byteLength(json) > SURFACE_LIMITS.state) throw new RangeError('State exceeds 16 KiB.');
  return JSON.parse(json);
}

export function validateView(view) {
  if (!view || typeof view !== 'object') throw new TypeError('A view is required.');
  if (typeof view.id !== 'string' || !view.id || byteLength(view.id) > 256) throw new TypeError('Invalid view id.');
  if (!Number.isSafeInteger(view.revision) || view.revision < 1) throw new TypeError('Invalid view revision.');
  if (typeof view.html !== 'string' || byteLength(view.html) > SURFACE_LIMITS.html) throw new RangeError('HTML must be a string of at most 256 KiB.');
  if (typeof view.title !== 'string' || byteLength(view.title) > 1024) throw new TypeError('Invalid view title.');
  return {
    id: view.id,
    revision: view.revision,
    title: view.title,
    html: view.html,
    summary: typeof view.summary === 'string' ? view.summary.slice(0, 8192) : '',
    stateSchemaVersion: view.stateSchemaVersion ?? 1,
  };
}


// This function is trusted source. Model content is received over a private port,
// never interpolated into this function or the receiver's srcdoc.
function receiver() {
  'use strict';
  const nativeStringify = JSON.stringify.bind(JSON);
  const nativeParse = JSON.parse.bind(JSON);
  const NativePromise = Promise;
  const encode = new TextEncoder();
  const root = document.getElementById('answer-content');
  const pending = new Map();
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
    if (send && errorCount++ < 20) send({ type: 'error', session, message: String(message).slice(0, 2048) });
  };
  const validateState = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('State must be a JSON object.');
    const json = nativeStringify(value);
    if (encode.encode(json).length > 16384) throw new RangeError('State exceeds 16 KiB.');
    return nativeParse(json);
  };
  const request = (type, payload) => new NativePromise((resolve, reject) => {
    if (!send) { reject(new Error('Answer bridge is not ready.')); return; }
    if (pending.size >= 64) { reject(new Error('Too many pending answer actions.')); return; }
    const id = String(++counter);
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error('Host did not respond within 30 seconds.'));
    }, 30000);
    pending.set(id, { resolve, reject, timeout });
    send({ type, session, id, ...payload });
  });
  Object.defineProperty(window, 'answer', {
    configurable: false,
    writable: false,
    value: Object.freeze({
      getState() { return jsonCopy(state); },
      setState(value) {
        let next;
        try { next = validateState(value); } catch (error) { return NativePromise.reject(error); }
        const change = ++stateChange;
        state = next;
        return request('state', { state: next }).then((result) => {
          savedState = next;
          return result;
        }).catch((error) => {
          if (stateChange === change) state = savedState;
          throw error;
        });
      },
      ask(text) {
        if (typeof text !== 'string' || !text.trim() || encode.encode(text).length > 8192) {
          return NativePromise.reject(new TypeError('Question must contain 1–8192 UTF-8 bytes.'));
        }
        return request('ask', { text, state: jsonCopy(state) });
      },
    }),
  });

  window.addEventListener('error', (event) => report(event.message || 'Page script failed.'));
  window.addEventListener('unhandledrejection', (event) => report(event.reason?.message || event.reason || 'Unhandled page error.'));
  document.addEventListener('securitypolicyviolation', (event) => report(`Blocked by page policy: ${event.violatedDirective}`));
  // Keep ordinary links and forms inside the interaction contract. Sandboxing
  // also denies popups and all top-level navigation. This is not a JS sanitizer.
  document.addEventListener('click', (event) => {
    const anchor = event.target?.closest?.('a[href],area[href]');
    if (!anchor) return;
    event.preventDefault();
    const href = anchor.getAttribute('href');
    if (href?.startsWith('#')) {
      try { document.getElementById(decodeURIComponent(href.slice(1)))?.scrollIntoView({ behavior: 'smooth' }); } catch { /* malformed fragment */ }
    }
  }, true);
  document.addEventListener('submit', (event) => event.preventDefault(), true);

  // Inline answers have intrinsic document height. A generated full-page shell
  // must not make the iframe's viewport its own sizing input (100vh -> a larger
  // iframe -> a larger 100vh). Keep intentional controls and graphics intact.
  const controlSelector = 'textarea,select,input,button,canvas,img,video,audio,[role="listbox"],[role="menu"],[role="tree"],[role="grid"],[role="slider"],[data-answer-scroll]';
  let controlledPanelIds = new Set();
  const labelTranslations = new WeakMap();
  const isClippedAlternative = (node) => {
    for (let current = node; current && current !== root; current = current.parentElement) {
      const style = getComputedStyle(current);
      if (style.display === 'none' || style.visibility === 'hidden' || style.contentVisibility === 'hidden') return true;
      if (current.tagName === 'DETAILS' && !current.open && node !== current) {
        const summary = Array.from(current.children).find(child => child.tagName === 'SUMMARY');
        if (!summary?.contains(node)) return true;
      }
      if (style.clip !== 'auto' || (style.clipPath !== 'none' && (current.clientWidth <= 2 || current.clientHeight <= 2))) return true;
    }
    return false;
  };
  const isLayoutBox = (node) => node.namespaceURI === 'http://www.w3.org/1999/xhtml' && !node.matches(controlSelector) && !node.closest('[data-answer-scroll]') && !isClippedAlternative(node);
  const setLayout = (node, property, value) => {
    if (node.style.getPropertyValue(property) !== value || node.style.getPropertyPriority(property) !== 'important') node.style.setProperty(property, value, 'important');
  };
  const isGrid = (style) => style.display === 'grid' || style.display === 'inline-grid';
  function preserveMetricNumbers(nodes) {
    for (const node of nodes) {
      if (node.childElementCount || !/^[+\-−]?(?:[¥$€£]\s*)?\d[\d.,]*(?:\s*[%％倍])?$/.test(node.textContent.trim())) continue;
      const style = getComputedStyle(node);
      if (style.position === 'absolute' || (!node.matches('strong,b,output') && parseFloat(style.fontSize) < 18)) continue;
      // A metric's decimal point and percent sign belong to the same value.
      // Make room by reflowing the metric group, rather than breaking the token.
      setLayout(node, 'white-space', 'nowrap');
      setLayout(node, 'overflow-wrap', 'normal');
      if (/flex/.test(getComputedStyle(node.parentElement).display)) setLayout(node, 'flex-shrink', '0');
      const range = document.createRange();
      range.selectNodeContents(node);
      const required = range.getBoundingClientRect().width;
      if (required <= node.getBoundingClientRect().width + 1) continue;
      for (let cell = node, parent = node.parentElement; parent && parent !== root; cell = parent, parent = parent.parentElement) {
        const parentStyle = getComputedStyle(parent);
        if (!isGrid(parentStyle)) continue;
        const cellStyle = getComputedStyle(cell);
        const minimum = Math.max(120, Math.ceil(required + parseFloat(cellStyle.paddingLeft) + parseFloat(cellStyle.paddingRight)));
        setLayout(parent, 'grid-template-columns', `repeat(auto-fit, minmax(min(${minimum}px, 100%), 1fr))`);
        break;
      }
    }
  }
  function fitPositionedLabels(nodes) {
    for (const node of nodes) {
      const style = getComputedStyle(node);
      if (style.position !== 'absolute' || node.childElementCount || !node.textContent.trim()) continue;
      if (style.translate !== 'none' && !labelTranslations.has(node)) continue;
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
        // If an outside bar label no longer fits, put the whole value inside
        // its bar with contrasting text. Moving just half a label across a
        // bar edge is difficult to read; changing a row's plot width is wrong.
        for (const sibling of parent.children) {
          if (sibling === node || sibling.childElementCount || sibling.textContent.trim()) continue;
          const siblingStyle = getComputedStyle(sibling);
          if (siblingStyle.position !== 'absolute') continue;
          const bar = sibling.getBoundingClientRect();
          const color = siblingStyle.backgroundColor.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
          if (!color || (color[4] && Number(color[4]) !== 1) || bar.width < rect.width + 8 || bar.bottom <= rect.top || bar.top >= rect.bottom) continue;
          const luminance = color.slice(1, 4).map(Number).map(value => { value /= 255; return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4; }).reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0);
          translation = bar.right - 4 - rect.width - originalLeft;
          insideColor = luminance > 0.179 ? '#000' : '#fff';
          break;
        }
      }
      if (Math.abs(translation - previous) < 0.5 && insideColor === (adjustment?.insideColor || null)) continue;
      // Translate only the label. The original percent/calc anchor and every
      // bar's geometry stay intact, including after a viewport resize.
      const next = adjustment || { color: node.style.getPropertyValue('color'), colorPriority: node.style.getPropertyPriority('color') };
      next.translation = translation;
      next.insideColor = insideColor;
      labelTranslations.set(node, next);
      setLayout(node, 'translate', `${Math.round(translation * 100) / 100}px`);
      if (insideColor) setLayout(node, 'color', insideColor);
      else if (next.color) node.style.setProperty('color', next.color, next.colorPriority);
      else node.style.removeProperty('color');
    }
  }
  function normalizeViewportDeclaration(style, nodes) {
    for (const property of Array.from(style)) {
      const value = style.getPropertyValue(property);
      if (!/\b(?:\d*\.)?\d+(?:dvh|svh|lvh|vh)\b/i.test(value)) continue;
      const priority = style.getPropertyPriority(property);
      // Non-shell dimensions (for example a 30vh chart) use a stable outer
      // viewport, never the iframe's growing height.
      style.setProperty(property, value.replace(/(-?(?:\d*\.)?\d+)(?:dvh|svh|lvh|vh)\b/gi, (_, amount) => `${Number(amount) * viewportHeight / 100}px`), priority);
      if (!/^(?:height|min-height|max-height|block-size|min-block-size|max-block-size)$/.test(property)) continue;
      if (![...value.matchAll(/((?:\d*\.)?\d+)(?:dvh|svh|lvh|vh)\b/gi)].some(match => Number(match[1]) >= 90)) continue;
      for (const node of nodes()) if (isLayoutBox(node)) {
        setLayout(node, property, property.startsWith('min-') ? '0px' : property.startsWith('max-') ? 'none' : 'auto');
      }
    }
  }
  function normalizeInlineLayout() {
    controlledPanelIds = new Set(Array.from(root.querySelectorAll('[aria-controls][aria-expanded]')).flatMap(node => node.getAttribute('aria-controls').split(/\s+/)));
    for (const styleNode of root.querySelectorAll('style')) {
      const visit = (rules) => {
        for (const rule of rules) {
          if (rule.style && rule.selectorText) normalizeViewportDeclaration(rule.style, () => {
            try { return Array.from(document.querySelectorAll(rule.selectorText)); } catch { return []; }
          });
          if (rule.cssRules) visit(rule.cssRules);
        }
      };
      if (styleNode.sheet) visit(styleNode.sheet.cssRules);
    }
    const nodes = Array.from(root.querySelectorAll('*')).filter(isLayoutBox);
    preserveMetricNumbers(nodes);
    for (const node of nodes) {
      normalizeViewportDeclaration(node.style, () => [node]);
      const computed = getComputedStyle(node);
      if (computed.position === 'fixed') setLayout(node, 'position', 'static');
      // Expand explanatory scroll panes. Textareas, selection widgets and
      // explicitly marked control surfaces keep their own interaction model.
      // Zero-height panes and size transitions are disclosure interactions,
      // not constrained reading areas. Overriding them would force them open.
      const sizeTransition = computed.transitionDuration.split(',').some(value => parseFloat(value) > 0) && /(?:all|height|block-size)/.test(computed.transitionProperty);
      const collapsed = node.clientHeight <= 1 || parseFloat(computed.maxHeight) === 0 || node.closest('[hidden],[inert],[aria-hidden="true"]');
      const disclosure = controlledPanelIds.has(node.id) || sizeTransition;
      if (!collapsed && !disclosure && /(?:auto|scroll|hidden|clip)/.test(computed.overflowY) && node.scrollHeight > node.clientHeight + 1) {
        setLayout(node, 'height', 'auto');
        setLayout(node, 'max-height', 'none');
        setLayout(node, 'overflow-y', 'visible');
      }
      if (node.clientWidth && node.scrollWidth > node.clientWidth + 1) {
        if (isGrid(computed)) {
          const bounds = node.getBoundingClientRect();
          const left = bounds.left + node.clientLeft;
          const right = left + node.clientWidth;
          const tracksOverflow = Array.from(node.children).some(child => {
            const childStyle = getComputedStyle(child);
            if (childStyle.position === 'absolute' || childStyle.position === 'fixed' || childStyle.display === 'none') return false;
            const childBox = child.getBoundingClientRect();
            return childBox.right > right + 1 || childBox.left < left - 1;
          });
          // Absolute chart labels can overflow a track even though the grid's
          // columns fit. Reflowing just that row would change its data scale.
          if (tracksOverflow) setLayout(node, 'grid-template-columns', 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))');
        }
        if (computed.display === 'flex' || computed.display === 'inline-flex') setLayout(node, 'flex-wrap', 'wrap');
        if (node.tagName === 'PRE') setLayout(node, 'white-space', 'pre-wrap');
        setLayout(node, 'overflow-wrap', 'anywhere');
      }
      const available = node.parentElement?.clientWidth;
      if (available && node.getBoundingClientRect().width > available + 1) {
        setLayout(node, 'min-width', '0px');
        setLayout(node, 'max-width', '100%');
        setLayout(node, 'width', '100%');
      }
    }
    fitPositionedLabels(nodes);
  }
  function measure() {
    measurementPending = false;
    if (!rendered) return;
    if (embedded) normalizeInlineLayout();
    const bodyBox = document.body.getBoundingClientRect();
    // body is intrinsically sized; documentElement.scrollHeight is deliberately
    // not used because it is at least the *previous* iframe height and prevents
    // shrinking. Include generated body padding and overflowing positioned
    // content, which the old root-only measurement omitted.
    let bottom = bodyBox.bottom;
    // The scrollHeight of a visually clipped, absolutely positioned accessible
    // table can be enormous. Measure visible boxes instead, respecting clipping
    // and interactive scroll controls while retaining absolute chart labels.
    for (const node of root.querySelectorAll('*')) {
      if (node.matches('script,style,template') || isClippedAlternative(node) || node.parentElement?.closest(controlSelector)) continue;
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
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
    if (send && height !== lastHeight) { lastHeight = height; send({ type: 'height', session, height }); }
  }
  function scheduleMeasure() {
    if (measurementPending) return;
    measurementPending = true;
    requestAnimationFrame(measure);
  }
  const resizeObserver = new ResizeObserver(scheduleMeasure);
  resizeObserver.observe(root);
  resizeObserver.observe(document.body);
  new MutationObserver(scheduleMeasure).observe(root, { subtree: true, childList: true, characterData: true, attributes: true });
  window.addEventListener('resize', scheduleMeasure);
  document.addEventListener('load', scheduleMeasure, true);

  function render(message) {
    if (rendered) throw new Error('A surface can render only once; replace it to update a revision.');
    if (typeof message.html !== 'string' || encode.encode(message.html).length > 262144) throw new Error('Invalid HTML payload.');
    state = validateState(message.state);
    savedState = state;
    embedded = message.embedded === true;
    viewportHeight = Number.isFinite(message.viewportHeight) && message.viewportHeight > 0 ? message.viewportHeight : 800;
    if (embedded) document.documentElement.dataset.answerLayout = 'inline';
    document.documentElement.dataset.theme = message.theme === 'dark' ? 'dark' : 'light';
    const template = document.createElement('template');
    template.innerHTML = message.html;
    // Removing these before insertion also prevents meta refresh and resource
    // preloads. CSP is still the enforcement layer for generated scripts.
    template.content.querySelectorAll('base,meta,link,iframe,frame,frameset,object,embed').forEach((node) => node.remove());
    const scripts = [];
    for (const original of template.content.querySelectorAll('script')) {
      if (original.hasAttribute('src')) throw new Error('External scripts are not supported. Use inline JavaScript.');
      const type = (original.getAttribute('type') || '').toLowerCase().trim();
      if (type && type !== 'text/javascript' && type !== 'application/javascript') {
        if (type === 'module') throw new Error('Module scripts are not supported. Use inline classic JavaScript without imports.');
        continue; // JSON and other inert script data remain available to the page.
      }
      const placeholder = document.createComment('answer-script');
      original.replaceWith(placeholder);
      scripts.push({ placeholder, source: original.textContent });
    }
    root.replaceChildren(template.content);
    if (embedded) {
      const guard = document.createElement('style');
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
      const script = document.createElement('script');
      script.textContent = source;
      placeholder.replaceWith(script);
    }
    measure();
    send({ type: 'rendered', session, errorCount });
  }

  function initialize(event) {
    if (event.source !== window.parent || send || event.data?.type !== 'answer:init' || event.data?.version !== 1 || event.ports.length !== 1) return;
    if (typeof event.data.session !== 'string' || event.data.session.length > 128) return;
    session = event.data.session;
    const port = event.ports[0];
    // Capture the bound sender before generated code can modify prototypes.
    send = port.postMessage.bind(port);
    window.removeEventListener('message', initialize);
    port.onmessage = (portEvent) => {
      const message = portEvent.data;
      if (!message || message.session !== session) return;
      try {
        if (message.type === 'render') render(message);
        else if (message.type === 'theme') {
          document.documentElement.dataset.theme = message.theme === 'dark' ? 'dark' : 'light';
        } else if (message.type === 'response' && typeof message.id === 'string') {
          const action = pending.get(message.id);
          if (!action) return;
          clearTimeout(action.timeout);
          pending.delete(message.id);
          if (message.ok === true) action.resolve(message.result);
          else action.reject(new Error(String(message.error || 'Host rejected the action.').slice(0, 2048)));
        }
      } catch (error) {
        report(error.message);
        if (message.type === 'render') send({ type: 'failed', session });
      }
    };
    port.start();
    send({ type: 'ready', session });
  }
  window.addEventListener('message', initialize);
}

const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src 'none'; connect-src 'none'; media-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";

export function receiverDocument() {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${DEFAULT_STYLE}</style></head><body><div id="answer-content"></div><script>(${receiver.toString()})();<\/script></body></html>`;
}

/**
 * Create a fresh iframe for one immutable view revision. Append element to mount.
 * onState and onAsk run serially and may return promises; rejection reaches the
 * page and onError. Call dispose before removing/replacing the iframe.
 */
export function createSurfaceFrame({ view, state = {}, theme = 'light', embedded = false, onState, onAsk, onError, onHeight, onReady } = {}) {
  const safeView = validateView(view);
  const initialState = copyState(state);
  if (typeof document === 'undefined' || typeof MessageChannel === 'undefined') throw new Error('Surface frames require a browser.');
  const frame = document.createElement('iframe');
  frame.title = safeView.title;
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.setAttribute('referrerpolicy', 'no-referrer');
  frame.setAttribute('allow', "camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'");
  frame.style.width = '100%';
  frame.style.height = '180px';
  frame.style.border = '0';
  frame.style.display = 'block';
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
  let currentTheme = theme === 'dark' ? 'dark' : 'light';
  let operations = Promise.resolve();
  const requestIds = new Set();
  const report = (error) => {
    if (!active) return;
    try { onError?.(error instanceof Error ? error : new Error(String(error))); } catch { /* consumer error must not break cleanup */ }
  };
  const send = (message) => {
    if (active) channel.port1.postMessage({ ...message, session });
  };
  const timeout = setTimeout(() => {
    if (!rendered && active) { report(new Error('Answer page did not become ready within 10 seconds.')); dispose(); }
  }, 10000);

  function dispose() {
    if (!active) return;
    active = false;
    clearTimeout(timeout);
    frame.removeEventListener('load', onLoad);
    channel.port1.onmessage = null;
    channel.port1.onmessageerror = null;
    channel.port1.close();
    channel.port2.close();
    requestIds.clear();
  }

  function onLoad() {
    if (!active) return;
    if (initialized) {
      report(new Error('Answer page attempted to navigate; its bridge was closed.'));
      dispose();
      // Remove navigated content from view. Same-frame navigation cannot be
      // fully prevented by iframe sandbox in current browsers.
      frame.srcdoc = '<!doctype html><p>页面已停止：不支持页面导航。</p>';
      return;
    }
    initialized = true;
    frame.contentWindow.postMessage({ type: 'answer:init', version: 1, session }, '*', [channel.port2]);
  }

  channel.port1.onmessageerror = () => report(new Error('Invalid message from answer page.'));
  channel.port1.onmessage = ({ data: message }) => {
    if (!active || !message || typeof message !== 'object' || message.session !== session || typeof message.type !== 'string') return;
    if (message.type === 'ready') {
      if (!initialized || ready) return;
      ready = true;
      send({ type: 'render', html: safeView.html, state: initialState, theme: currentTheme, embedded, viewportHeight: globalThis.innerHeight || 800 });
      return;
    }
    if (!ready) return;
    if (message.type === 'rendered') {
      if (rendered) return;
      rendered = true;
      clearTimeout(timeout);
      if (message.errorCount === 0) {
        try { onReady?.({ viewId: safeView.id, revision: safeView.revision }); } catch (error) { report(error); }
      }
      return;
    }
    if (message.type === 'failed') { clearTimeout(timeout); return; }
    if (message.type === 'height') {
      if (!Number.isFinite(message.height) || message.height < 1 || !Number.isSafeInteger(Math.ceil(message.height))) return;
      frame.style.height = `${Math.ceil(message.height)}px`;
      try { onHeight?.(Math.ceil(message.height)); } catch (error) { report(error); }
      return;
    }
    if (message.type === 'error') {
      if (typeof message.message === 'string' && byteLength(message.message) <= 8192) report(new Error(message.message));
      return;
    }
    if (message.type !== 'state' && message.type !== 'ask') return;
    if (typeof message.id !== 'string' || !/^\d{1,16}$/.test(message.id) || requestIds.has(message.id)) return;
    const id = message.id;
    const numericId = Number(id);
    if (!Number.isSafeInteger(numericId) || numericId <= lastRequestId) return;
    lastRequestId = numericId;
    if (pendingCount >= 64) { send({ type: 'response', id, ok: false, error: 'Too many pending answer actions.' }); return; }
    let nextState;
    try {
      nextState = copyState(message.state);
      if (message.type === 'ask' && (typeof message.text !== 'string' || !message.text.trim() || byteLength(message.text) > SURFACE_LIMITS.text)) {
        throw new TypeError('Question must contain 1–8192 UTF-8 bytes.');
      }
    } catch (error) {
      send({ type: 'response', id, ok: false, error: error.message });
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
        if (type === 'state') {
          if (typeof onState !== 'function') throw new Error('This host does not support saving state.');
          result = await onState(nextState);
        } else {
          if (typeof onAsk !== 'function') throw new Error('This host does not support follow-up questions.');
          result = await onAsk({ text: question, state: nextState });
        }
        send({ type: 'response', id, ok: true, result: result === undefined ? undefined : copyState(result) });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        send({ type: 'response', id, ok: false, error: reason.slice(0, 2048) });
        report(error);
      } finally {
        requestIds.delete(id);
        pendingCount--;
      }
    });
  };
  channel.port1.start();
  frame.addEventListener('load', onLoad);
  frame.srcdoc = receiverDocument();
  return {
    element: frame,
    dispose,
    setTheme(nextTheme) {
      currentTheme = nextTheme === 'dark' ? 'dark' : 'light';
      if (ready) send({ type: 'theme', theme: currentTheme });
    },
  };
}
