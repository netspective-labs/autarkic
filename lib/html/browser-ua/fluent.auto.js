// lib/html/shared.ts
var rawPolicy = {
  mode: "permissive"
};
var isDev = () => {
  const deno = globalThis.Deno;
  const env = deno?.env?.get?.("DENO_ENV");
  return env !== "production";
};
function raw(html2) {
  if (rawPolicy.mode === "dev-strict" && isDev()) {
    throw new Error(`raw() is disabled in dev-strict mode. Use trustedRaw(...) or setRawPolicy({ mode: "permissive" }).`);
  }
  return {
    __rawHtml: html2
  };
}
function trustedRaw(html2, _hint) {
  return {
    __rawHtml: html2
  };
}
function flattenChildren(children3) {
  const out = [];
  const visit = (c) => {
    if (c == null || c === false) return;
    if (typeof c === "function") {
      const emit = (...xs) => {
        for (const x of xs) visit(x);
      };
      c(emit);
      return;
    }
    if (Array.isArray(c)) {
      for (const x of c) visit(x);
      return;
    }
    if (typeof c === "object" && c && "__rawHtml" in c) {
      out.push(c);
      return;
    }
    if (c === true) return;
    out.push(String(c));
  };
  for (const c of children3) visit(c);
  return out;
}
function isPlainObject(value) {
  if (value == null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
function attrs(...parts) {
  const out = {};
  for (const p2 of parts) {
    if (!p2) continue;
    for (const [k, v] of Object.entries(p2)) out[k] = v;
  }
  return out;
}
function classNames(...parts) {
  const out = [];
  const visit = (p2) => {
    if (!p2) return;
    if (Array.isArray(p2)) {
      for (const x of p2) visit(x);
      return;
    }
    if (typeof p2 === "object") {
      for (const [k, v] of Object.entries(p2)) if (v) out.push(k);
      return;
    }
    const s2 = String(p2).trim();
    if (s2) out.push(s2);
  };
  for (const p2 of parts) visit(p2);
  return out.join(" ");
}
function styleText(style2) {
  const toKebab = (s3) => s3.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
  const keys = Object.keys(style2).sort();
  let s2 = "";
  for (const k of keys) {
    const v = style2[k];
    if (v == null || v === false) continue;
    s2 += `${toKebab(k)}:${String(v)};`;
  }
  return s2;
}
function children(builder) {
  return builder;
}
function each(items, fn) {
  return (e) => {
    let i2 = 0;
    for (const it of items) e(fn(it, i2++));
  };
}

// src/html/browser-ua/runtime.ts
var DEFAULTS = {
  headerSelector: "datastar-selector",
  headerMode: "datastar-mode",
  headerOnlyIfMissing: "datastar-only-if-missing",
  headerUseViewTransition: "datastar-use-view-transition",
  headerRequest: "Datastar-Request",
  allowExpressions: true,
  credentials: "same-origin"
};
var SignalStore = class {
  #root;
  #listeners = /* @__PURE__ */ new Set();
  constructor(initial) {
    this.#root = initial ? structuredClone(initial) : {};
  }
  get root() {
    return this.#root;
  }
  subscribe(fn) {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }
  #notify(path, value) {
    for (const fn of this.#listeners) fn(path, value);
  }
  getPath(path) {
    const parts = path.split(".").filter(Boolean);
    let cur = this.#root;
    for (const p2 of parts) {
      if (cur == null || typeof cur !== "object") return void 0;
      cur = cur[p2];
    }
    return cur;
  }
  setPath(path, value) {
    const parts = path.split(".").filter(Boolean);
    if (parts.length === 0) return;
    let cur = this.#root;
    for (let i2 = 0; i2 < parts.length - 1; i2++) {
      const k = parts[i2];
      const v = cur[k];
      if (v == null || typeof v !== "object" || Array.isArray(v)) cur[k] = {};
      cur = cur[k];
    }
    cur[parts[parts.length - 1]] = value;
    this.#notify(path, value);
  }
  merge(obj) {
    const walk = (base2, add, prefix = "") => {
      for (const [k, v] of Object.entries(add)) {
        const p2 = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === "object" && !Array.isArray(v)) {
          const bv = base2[k];
          if (!bv || typeof bv !== "object" || Array.isArray(bv)) base2[k] = {};
          walk(base2[k], v, p2);
        } else {
          base2[k] = v;
          this.#notify(p2, v);
        }
      }
    };
    walk(this.#root, obj);
  }
};
var parseJsonObject = (s2) => {
  try {
    const v = JSON.parse(s2);
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return v;
    }
    return null;
  } catch {
    return null;
  }
};
var parseAction = (expr) => {
  const m = expr.trim().match(/^@([a-zA-Z]+)\((.*)\)\s*$/);
  if (!m) return null;
  const name = m[1].toLowerCase();
  const arg = m[2].trim();
  if (!arg) return null;
  let url = "";
  try {
    const v = JSON.parse(arg);
    if (typeof v !== "string") return null;
    url = v;
  } catch {
    return null;
  }
  const method = (() => {
    switch (name) {
      case "get":
        return "GET";
      case "post":
        return "POST";
      case "put":
        return "PUT";
      case "patch":
        return "PATCH";
      case "delete":
        return "DELETE";
      default:
        return "";
    }
  })();
  if (!method) return null;
  return {
    method,
    url
  };
};
var truthy = (v) => v != null && /^(1|true|yes|on)$/i.test(v.trim());
var normalizeMode = (v) => {
  const s2 = (v ?? "").trim().toLowerCase();
  if (s2 === "replace" || s2 === "inner" || s2 === "append" || s2 === "prepend" || s2 === "before" || s2 === "after") {
    return s2;
  }
  return "inner";
};
var isFormLike = (el2) => el2 instanceof HTMLInputElement || el2 instanceof HTMLSelectElement || el2 instanceof HTMLTextAreaElement;
var readBoundValue = (el2) => {
  if (isFormLike(el2)) {
    if (el2 instanceof HTMLInputElement) {
      if (el2.type === "checkbox") return el2.checked;
      if (el2.type === "number") {
        return el2.value === "" ? null : Number(el2.value);
      }
      return el2.value;
    }
    return el2.value;
  }
  return el2.textContent ?? "";
};
var writeBoundValue = (el2, value) => {
  if (isFormLike(el2)) {
    if (el2 instanceof HTMLInputElement) {
      if (el2.type === "checkbox") {
        el2.checked = Boolean(value);
        return;
      }
      el2.value = value == null ? "" : String(value);
      return;
    }
    el2.value = value == null ? "" : String(value);
    return;
  }
  el2.textContent = value == null ? "" : String(value);
};
var parseDirectiveName = (attrName) => {
  if (attrName.startsWith("data-on:")) {
    return {
      kind: "on",
      arg: attrName.slice("data-on:".length)
    };
  }
  if (attrName.startsWith("data-bind:")) {
    return {
      kind: "bind",
      arg: attrName.slice("data-bind:".length)
    };
  }
  if (attrName.startsWith("data-class:")) {
    return {
      kind: "class",
      arg: attrName.slice("data-class:".length)
    };
  }
  if (attrName.startsWith("data-attr:")) {
    return {
      kind: "attr",
      arg: attrName.slice("data-attr:".length)
    };
  }
  return null;
};
var compileExpr = (source2, ctx) => {
  const trimmed = source2.trim();
  const action = parseAction(trimmed);
  if (!ctx.allowExpressions) return {
    kind: "action-only",
    action
  };
  const fn = (() => {
    try {
      return new Function("signals", "event", "el", `"use strict"; return (${trimmed});`);
    } catch {
      try {
        return new Function("signals", "event", "el", `"use strict"; ${trimmed};`);
      } catch {
        return null;
      }
    }
  })();
  return {
    kind: "expr",
    fn,
    action
  };
};
var applyHtmlUpdate = (htmlText, target, mode) => {
  const tpl = document.createElement("template");
  tpl.innerHTML = htmlText;
  const nodes = Array.from(tpl.content.childNodes);
  switch (mode) {
    case "replace":
      target.replaceWith(...nodes);
      break;
    case "inner":
      target.replaceChildren(...nodes);
      break;
    case "append":
      target.append(...nodes);
      break;
    case "prepend":
      target.prepend(...nodes);
      break;
    case "before":
      target.before(...nodes);
      break;
    case "after":
      target.after(...nodes);
      break;
  }
};
var rootDocumentOf = (root) => {
  if (root instanceof Document) return root;
  if (root instanceof ShadowRoot) return root.ownerDocument;
  return root.ownerDocument ?? document;
};
var defaultSwapTarget = (event, root) => {
  const doc = rootDocumentOf(root);
  const t = event?.target instanceof Element ? event.target : null;
  const ct = event?.currentTarget instanceof Element ? event.currentTarget : null;
  const find = (start) => {
    for (let el2 = start; el2; el2 = el2.parentElement) {
      const sel = el2.getAttribute("data-target");
      if (sel) {
        const found = doc.querySelector(sel);
        if (found instanceof Element) return found;
      }
      if (el2 instanceof HTMLElement) {
        const host = el2.getRootNode?.();
        if (host instanceof ShadowRoot) {
          const s2 = el2.getAttribute("data-target");
          if (s2) {
            const found2 = host.querySelector(s2);
            if (found2 instanceof Element) return found2;
          }
        }
      }
    }
    return null;
  };
  if (root instanceof ShadowRoot) {
    const inShadow = (sel) => root.querySelector(sel);
    const direct = t?.getAttribute("data-target") ?? ct?.getAttribute("data-target");
    if (direct) {
      const f = inShadow(direct);
      if (f instanceof Element) return f;
    }
    const f2 = find(t) ?? find(ct);
    if (f2) return f2;
    return root.host instanceof Element ? root.host : doc.body ?? doc.documentElement;
  }
  return find(t) ?? find(ct) ?? ct ?? doc.body ?? doc.documentElement;
};
var createState = (options) => ({
  options: {
    ...DEFAULTS,
    ...options ?? {}
  },
  signals: new SignalStore(),
  mo: null,
  unsub: null,
  scheduled: false
});
var scheduleUpdate = (root, state) => {
  if (state.scheduled) return;
  state.scheduled = true;
  queueMicrotask(() => {
    state.scheduled = false;
    updateDirectives(root, state);
  });
};
var collectSignals = (root, signals) => {
  const scope = root instanceof Document ? root : root;
  const els = scope.querySelectorAll?.("[data-signals]");
  if (!els) return;
  for (const el2 of els) {
    const txt = el2.getAttribute("data-signals");
    if (!txt) continue;
    const obj = parseJsonObject(txt);
    if (obj) signals.merge(obj);
  }
};
var scanAndWireEvents = (root, state) => {
  const scope = root instanceof Document ? root : root;
  const all = scope.querySelectorAll?.("*");
  if (!all) return;
  for (const el2 of all) {
    for (const { name, value } of Array.from(el2.attributes)) {
      const d = parseDirectiveName(name);
      if (!d || d.kind !== "on") continue;
      const eventName = d.arg;
      const exprText = value ?? "";
      const key = `__fluent_on_${eventName}_${exprText}`;
      const anyEl = el2;
      if (anyEl[key]) continue;
      anyEl[key] = true;
      el2.addEventListener(eventName, async (ev) => {
        const compiled = compileExpr(exprText, {
          signals: state.signals,
          allowExpressions: state.options.allowExpressions
        });
        if (compiled.action) {
          await performAction(compiled.action.method, compiled.action.url, ev, el2, root, state);
          return;
        }
        if (compiled.kind === "expr" && compiled.fn) {
          try {
            compiled.fn(state.signals, ev, el2);
          } catch (e) {
            console.warn("fluent runtime: expression failed:", e);
          } finally {
            scheduleUpdate(root, state);
          }
        }
      });
    }
    for (const { name } of Array.from(el2.attributes)) {
      const d = parseDirectiveName(name);
      if (!d || d.kind !== "bind") continue;
      const path = d.arg;
      const key = `__fluent_bind_${path}`;
      const anyEl = el2;
      if (anyEl[key]) continue;
      anyEl[key] = true;
      const onInput = () => state.signals.setPath(path, readBoundValue(el2));
      const eventName = isFormLike(el2) ? "input" : "blur";
      el2.addEventListener(eventName, onInput);
    }
  }
};
var updateDirectives = (root, state) => {
  const scope = root instanceof Document ? root : root;
  const all = scope.querySelectorAll?.("*");
  if (!all) return;
  for (const el2 of all) {
    if (el2.hasAttribute("data-text")) {
      const expr = el2.getAttribute("data-text") ?? "";
      const compiled = compileExpr(expr, {
        signals: state.signals,
        allowExpressions: state.options.allowExpressions
      });
      if (compiled.kind === "expr" && compiled.fn) {
        try {
          const v = compiled.fn(state.signals, null, el2);
          el2.textContent = v == null ? "" : String(v);
        } catch {
        }
      }
    }
    if (el2.hasAttribute("data-show")) {
      const expr = el2.getAttribute("data-show") ?? "";
      const compiled = compileExpr(expr, {
        signals: state.signals,
        allowExpressions: state.options.allowExpressions
      });
      if (compiled.kind === "expr" && compiled.fn) {
        try {
          const v = compiled.fn(state.signals, null, el2);
          const show = Boolean(v);
          el2.style.display = show ? "" : "none";
        } catch {
        }
      }
    }
    for (const { name } of Array.from(el2.attributes)) {
      const d = parseDirectiveName(name);
      if (!d || d.kind !== "bind") continue;
      const path = d.arg;
      writeBoundValue(el2, state.signals.getPath(path));
    }
    for (const { name, value } of Array.from(el2.attributes)) {
      const d = parseDirectiveName(name);
      if (!d || d.kind !== "class") continue;
      const clsName = d.arg;
      const expr = value ?? "";
      const compiled = compileExpr(expr, {
        signals: state.signals,
        allowExpressions: state.options.allowExpressions
      });
      if (compiled.kind === "expr" && compiled.fn) {
        try {
          const v = compiled.fn(state.signals, null, el2);
          el2.classList.toggle(clsName, Boolean(v));
        } catch {
        }
      }
    }
    for (const { name, value } of Array.from(el2.attributes)) {
      const d = parseDirectiveName(name);
      if (!d || d.kind !== "attr") continue;
      const attrName = d.arg;
      const expr = value ?? "";
      const compiled = compileExpr(expr, {
        signals: state.signals,
        allowExpressions: state.options.allowExpressions
      });
      if (compiled.kind === "expr" && compiled.fn) {
        try {
          const v = compiled.fn(state.signals, null, el2);
          if (v == null || v === false) el2.removeAttribute(attrName);
          else if (v === true) el2.setAttribute(attrName, "");
          else el2.setAttribute(attrName, String(v));
        } catch {
        }
      }
    }
  }
  for (const el2 of Array.from(scope.querySelectorAll?.("[data-effect]") ?? [])) {
    const expr = el2.getAttribute("data-effect") ?? "";
    const compiled = compileExpr(expr, {
      signals: state.signals,
      allowExpressions: state.options.allowExpressions
    });
    if (compiled.kind === "expr" && compiled.fn) {
      try {
        compiled.fn(state.signals, null, el2);
      } catch {
      }
    }
  }
  scanAndWireEvents(root, state);
};
var performAction = async (method, url, ev, el2, root, state) => {
  if (ev.type === "submit") ev.preventDefault();
  if (ev.type === "click" && el2 instanceof HTMLAnchorElement) {
    ev.preventDefault();
  }
  const headers = new Headers();
  headers.set(state.options.headerRequest, "true");
  let fetchUrl = url;
  let body2 = null;
  const doc = rootDocumentOf(root);
  const form2 = el2 instanceof HTMLFormElement ? el2 : el2.closest?.("form");
  if (form2 instanceof HTMLFormElement) {
    const fd = new FormData(form2);
    if (method === "GET") {
      const u2 = new URL(fetchUrl, doc.baseURI);
      for (const [k, v] of fd.entries()) {
        if (typeof v === "string") u2.searchParams.set(k, v);
      }
      fetchUrl = u2.toString();
    } else {
      body2 = fd;
    }
  }
  const res = await fetch(fetchUrl, {
    method,
    headers,
    body: body2,
    credentials: state.options.credentials
  });
  const selector = res.headers.get(state.options.headerSelector);
  const mode = normalizeMode(res.headers.get(state.options.headerMode));
  const onlyIfMissing = truthy(res.headers.get(state.options.headerOnlyIfMissing));
  const useViewTransition = truthy(res.headers.get(state.options.headerUseViewTransition));
  const ct = (res.headers.get("content-type") ?? "").toLowerCase();
  if (ct.includes("application/json")) {
    const json = await res.json().catch(() => null);
    if (json && typeof json === "object" && !Array.isArray(json)) {
      state.signals.merge(json);
      scheduleUpdate(root, state);
    }
    return;
  }
  const text = await res.text();
  const target = (selector ? root instanceof ShadowRoot ? root.querySelector(selector) : doc.querySelector(selector) : null) ?? defaultSwapTarget(ev, root);
  if (!(target instanceof Element)) return;
  if (onlyIfMissing && target.childNodes.length > 0) return;
  const doUpdate = async () => {
    applyHtmlUpdate(text, target, mode);
    collectSignals(root, state.signals);
    scheduleUpdate(root, state);
  };
  const startVT = doc.startViewTransition;
  if (useViewTransition && typeof startVT === "function") {
    try {
      startVT(() => void doUpdate());
    } catch {
      await doUpdate();
    }
  } else {
    await doUpdate();
  }
};
var runtimes = /* @__PURE__ */ new WeakMap();
var getOrCreateRootRuntime = (root, options) => {
  const key = root instanceof Document ? root : root;
  const existing = runtimes.get(key);
  if (existing) return existing;
  const rr = {
    root,
    state: createState(options)
  };
  runtimes.set(key, rr);
  return rr;
};
var enhance = ({ root, options } = {}) => {
  const r = root ?? document;
  const rr = getOrCreateRootRuntime(r, options);
  collectSignals(r, rr.state.signals);
  scanAndWireEvents(r, rr.state);
  updateDirectives(r, rr.state);
  if (!rr.state.mo) {
    rr.state.mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const n of Array.from(m.addedNodes)) {
          if (!(n instanceof Element)) continue;
          if (n.hasAttribute("data-signals")) {
            const obj = parseJsonObject(n.getAttribute("data-signals") ?? "");
            if (obj) rr.state.signals.merge(obj);
          }
        }
      }
      scanAndWireEvents(r, rr.state);
      scheduleUpdate(r, rr.state);
      enhanceSse({
        root: r
      });
    });
    const observeTarget = r instanceof Document ? r.documentElement : r.host;
    rr.state.mo.observe(observeTarget, {
      subtree: true,
      childList: true
    });
  }
  if (!rr.state.unsub) {
    rr.state.unsub = rr.state.signals.subscribe(() => scheduleUpdate(r, rr.state));
  }
  enhanceSse({
    root: r
  });
};
var SSE_KEY = Symbol.for("fluent.sse");
var getSseRecord = (el2) => el2[SSE_KEY] ?? null;
var setSseRecord = (el2, rec) => {
  const obj = el2;
  if (!rec) delete obj[SSE_KEY];
  else obj[SSE_KEY] = rec;
};
var resolveSseTarget = (root, el2, selector) => {
  const doc = rootDocumentOf(root);
  if (selector) {
    if (root instanceof ShadowRoot) return root.querySelector(selector);
    return doc.querySelector(selector);
  }
  return el2;
};
var enhanceSse = ({ root }) => {
  const scope = root instanceof Document ? root : root;
  const els = scope.querySelectorAll?.("[data-sse]");
  if (!els) return;
  for (const el2 of els) {
    const url = el2.getAttribute("data-sse");
    if (!url) continue;
    const existing = getSseRecord(el2);
    if (existing && existing.source.url === url) continue;
    if (existing) {
      try {
        existing.source.close();
      } catch {
      }
      setSseRecord(el2, null);
    }
    const rr = getOrCreateRootRuntime(root);
    const eventName = el2.getAttribute("data-sse-event") ?? "message";
    const mergeSignals = el2.hasAttribute("data-sse-signals") ? truthy(el2.getAttribute("data-sse-signals")) : true;
    const selector = el2.getAttribute("data-sse-selector");
    const mode = normalizeMode(el2.getAttribute("data-sse-mode"));
    const onlyIfMissing = truthy(el2.getAttribute("data-sse-only-if-missing"));
    const src = new EventSource(url);
    const handler = (ev) => {
      const dataText = typeof ev.data === "string" ? ev.data : "";
      if (mergeSignals) {
        const obj = parseJsonObject(dataText);
        if (obj) {
          rr.state.signals.merge(obj);
          scheduleUpdate(root, rr.state);
          return;
        }
      }
      const target = resolveSseTarget(root, el2, selector);
      if (!target) return;
      if (onlyIfMissing && target.childNodes.length > 0) return;
      applyHtmlUpdate(dataText, target, mode);
      collectSignals(root, rr.state.signals);
      scheduleUpdate(root, rr.state);
    };
    src.addEventListener(eventName, handler);
    setSseRecord(el2, {
      source: src,
      root
    });
  }
};

// src/html/browser-ua/fluent.ts
var attrs2 = attrs;
var cls = classNames;
var css = styleText;
var children2 = children;
var each2 = each;
var isAttrs = (v) => {
  if (!isPlainObject(v)) return false;
  if ("__rawHtml" in v) return false;
  return true;
};
var VOID_ELEMENTS = /* @__PURE__ */ new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr"
]);
var isVoidElement = (t) => VOID_ELEMENTS.has(t.toLowerCase());
var el = (tagName, ...args) => {
  let attrs3;
  let children3;
  if (args.length > 0 && isAttrs(args[0])) {
    attrs3 = args[0];
    children3 = args.slice(1);
  } else {
    children3 = args;
  }
  const node = document.createElement(tagName);
  if (attrs3) {
    const keys = Object.keys(attrs3).sort();
    for (const k of keys) {
      const v = attrs3[k];
      if (v == null || v === false) continue;
      node.setAttribute(k, v === true ? "" : String(v));
    }
  }
  if (isVoidElement(tagName) && children3.length > 0) {
    console.warn(`Void element <${tagName}> should not have children.`);
  }
  for (const c of flattenChildren(children3)) {
    if (typeof c === "string") {
      node.appendChild(document.createTextNode(c));
    } else {
      const t = document.createElement("template");
      t.innerHTML = c.__rawHtml;
      node.appendChild(t.content);
    }
  }
  return node;
};
var tag = (name) => (...args) => el(name, ...args);
var legacyTag = (name) => (...args) => el(name, ...args);
var mount = (target, node) => target.appendChild(node);
var replace = (target, node) => target.replaceWith(node);
var fragment = (...children3) => {
  const frag = document.createDocumentFragment();
  for (const c of flattenChildren(children3)) {
    if (typeof c === "string") {
      frag.appendChild(document.createTextNode(c));
    } else {
      const t = document.createElement("template");
      t.innerHTML = c.__rawHtml;
      frag.appendChild(t.content);
    }
  }
  return frag;
};
var scriptJs = (code, attrs3) => {
  const s2 = document.createElement("script");
  if (attrs3) {
    const keys = Object.keys(attrs3).sort();
    for (const k of keys) {
      const v = attrs3[k];
      if (v == null || v === false) continue;
      s2.setAttribute(k, v === true ? "" : String(v));
    }
  }
  s2.textContent = code;
  return s2;
};
var styleCss = (cssText, attrs3) => {
  const s2 = document.createElement("style");
  if (attrs3) {
    const keys = Object.keys(attrs3).sort();
    for (const k of keys) {
      const v = attrs3[k];
      if (v == null || v === false) continue;
      s2.setAttribute(k, v === true ? "" : String(v));
    }
  }
  s2.textContent = cssText;
  return s2;
};
var autoEnhance = () => {
  const boot = () => enhance({
    root: document
  });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, {
      once: true
    });
  } else {
    boot();
  }
};
autoEnhance();
var a = tag("a");
var abbr = tag("abbr");
var address = tag("address");
var area = tag("area");
var article = tag("article");
var aside = tag("aside");
var audio = tag("audio");
var b = tag("b");
var base = tag("base");
var bdi = tag("bdi");
var bdo = tag("bdo");
var blockquote = tag("blockquote");
var body = tag("body");
var br = tag("br");
var button = tag("button");
var canvas = tag("canvas");
var caption = tag("caption");
var cite = tag("cite");
var codeTag = tag("code");
var col = tag("col");
var colgroup = tag("colgroup");
var data = tag("data");
var datalist = tag("datalist");
var dd = tag("dd");
var del = tag("del");
var details = tag("details");
var dfn = tag("dfn");
var dialog = tag("dialog");
var div = tag("div");
var dl = tag("dl");
var dt = tag("dt");
var em = tag("em");
var embed = tag("embed");
var fieldset = tag("fieldset");
var figcaption = tag("figcaption");
var figure = tag("figure");
var footer = tag("footer");
var form = tag("form");
var h1 = tag("h1");
var h2 = tag("h2");
var h3 = tag("h3");
var h4 = tag("h4");
var h5 = tag("h5");
var h6 = tag("h6");
var head = tag("head");
var header = tag("header");
var hgroup = tag("hgroup");
var hr = tag("hr");
var html = tag("html");
var i = tag("i");
var iframe = tag("iframe");
var img = tag("img");
var input = tag("input");
var ins = tag("ins");
var kbd = tag("kbd");
var label = tag("label");
var legend = tag("legend");
var li = tag("li");
var link = tag("link");
var main = tag("main");
var map = tag("map");
var mark = tag("mark");
var menu = tag("menu");
var meta = tag("meta");
var meter = tag("meter");
var nav = tag("nav");
var noscript = tag("noscript");
var object = tag("object");
var ol = tag("ol");
var optgroup = tag("optgroup");
var option = tag("option");
var output = tag("output");
var p = tag("p");
var param = legacyTag("param");
var picture = tag("picture");
var pre = tag("pre");
var progress = tag("progress");
var qTag = tag("q");
var rp = tag("rp");
var rt = tag("rt");
var ruby = tag("ruby");
var s = tag("s");
var samp = tag("samp");
var script = tag("script");
var search = tag("search");
var section = tag("section");
var select = tag("select");
var slot = tag("slot");
var small = tag("small");
var source = tag("source");
var span = tag("span");
var strong = tag("strong");
var style = tag("style");
var sub = tag("sub");
var summary = tag("summary");
var sup = tag("sup");
var table = tag("table");
var tbody = tag("tbody");
var td = tag("td");
var template = tag("template");
var textarea = tag("textarea");
var tfoot = tag("tfoot");
var th = tag("th");
var thead = tag("thead");
var time = tag("time");
var title = tag("title");
var tr = tag("tr");
var track = tag("track");
var u = tag("u");
var ul = tag("ul");
var varTag = tag("var");
var video = tag("video");
var wbr = tag("wbr");
export {
  a,
  abbr,
  address,
  area,
  article,
  aside,
  attrs2 as attrs,
  audio,
  b,
  base,
  bdi,
  bdo,
  blockquote,
  body,
  br,
  button,
  canvas,
  caption,
  children2 as children,
  cite,
  cls,
  codeTag,
  col,
  colgroup,
  css,
  data,
  datalist,
  dd,
  del,
  details,
  dfn,
  dialog,
  div,
  dl,
  dt,
  each2 as each,
  em,
  embed,
  fieldset,
  figcaption,
  figure,
  footer,
  form,
  fragment,
  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  head,
  header,
  hgroup,
  hr,
  html,
  i,
  iframe,
  img,
  input,
  ins,
  kbd,
  label,
  legend,
  li,
  link,
  main,
  map,
  mark,
  menu,
  meta,
  meter,
  mount,
  nav,
  noscript,
  object,
  ol,
  optgroup,
  option,
  output,
  p,
  param,
  picture,
  pre,
  progress,
  qTag,
  raw,
  replace,
  rp,
  rt,
  ruby,
  s,
  samp,
  script,
  scriptJs,
  search,
  section,
  select,
  slot,
  small,
  source,
  span,
  strong,
  style,
  styleCss,
  sub,
  summary,
  sup,
  table,
  tbody,
  td,
  template,
  textarea,
  tfoot,
  th,
  thead,
  time,
  title,
  tr,
  track,
  trustedRaw,
  u,
  ul,
  varTag,
  video,
  wbr
};
