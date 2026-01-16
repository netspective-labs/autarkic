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
    for (const p of parts) {
      if (cur == null || typeof cur !== "object") return void 0;
      cur = cur[p];
    }
    return cur;
  }
  setPath(path, value) {
    const parts = path.split(".").filter(Boolean);
    if (parts.length === 0) return;
    let cur = this.#root;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = parts[i];
      const v = cur[k];
      if (v == null || typeof v !== "object" || Array.isArray(v)) cur[k] = {};
      cur = cur[k];
    }
    cur[parts[parts.length - 1]] = value;
    this.#notify(path, value);
  }
  merge(obj) {
    const walk = (base, add, prefix = "") => {
      for (const [k, v] of Object.entries(add)) {
        const p = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === "object" && !Array.isArray(v)) {
          const bv = base[k];
          if (!bv || typeof bv !== "object" || Array.isArray(bv)) base[k] = {};
          walk(base[k], v, p);
        } else {
          base[k] = v;
          this.#notify(p, v);
        }
      }
    };
    walk(this.#root, obj);
  }
};
var parseJsonObject = (s) => {
  try {
    const v = JSON.parse(s);
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
  const s = (v ?? "").trim().toLowerCase();
  if (s === "replace" || s === "inner" || s === "append" || s === "prepend" || s === "before" || s === "after") {
    return s;
  }
  return "inner";
};
var isFormLike = (el) => el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement;
var readBoundValue = (el) => {
  if (isFormLike(el)) {
    if (el instanceof HTMLInputElement) {
      if (el.type === "checkbox") return el.checked;
      if (el.type === "number") {
        return el.value === "" ? null : Number(el.value);
      }
      return el.value;
    }
    return el.value;
  }
  return el.textContent ?? "";
};
var writeBoundValue = (el, value) => {
  if (isFormLike(el)) {
    if (el instanceof HTMLInputElement) {
      if (el.type === "checkbox") {
        el.checked = Boolean(value);
        return;
      }
      el.value = value == null ? "" : String(value);
      return;
    }
    el.value = value == null ? "" : String(value);
    return;
  }
  el.textContent = value == null ? "" : String(value);
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
var compileExpr = (source, ctx) => {
  const trimmed = source.trim();
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
    for (let el = start; el; el = el.parentElement) {
      const sel = el.getAttribute("data-target");
      if (sel) {
        const found = doc.querySelector(sel);
        if (found instanceof Element) return found;
      }
      if (el instanceof HTMLElement) {
        const host = el.getRootNode?.();
        if (host instanceof ShadowRoot) {
          const s2 = el.getAttribute("data-target");
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
  for (const el of els) {
    const txt = el.getAttribute("data-signals");
    if (!txt) continue;
    const obj = parseJsonObject(txt);
    if (obj) signals.merge(obj);
  }
};
var scanAndWireEvents = (root, state) => {
  const scope = root instanceof Document ? root : root;
  const all = scope.querySelectorAll?.("*");
  if (!all) return;
  for (const el of all) {
    for (const { name, value } of Array.from(el.attributes)) {
      const d = parseDirectiveName(name);
      if (!d || d.kind !== "on") continue;
      const eventName = d.arg;
      const exprText = value ?? "";
      const key = `__fluent_on_${eventName}_${exprText}`;
      const anyEl = el;
      if (anyEl[key]) continue;
      anyEl[key] = true;
      el.addEventListener(eventName, async (ev) => {
        const compiled = compileExpr(exprText, {
          signals: state.signals,
          allowExpressions: state.options.allowExpressions
        });
        if (compiled.action) {
          await performAction(compiled.action.method, compiled.action.url, ev, el, root, state);
          return;
        }
        if (compiled.kind === "expr" && compiled.fn) {
          try {
            compiled.fn(state.signals, ev, el);
          } catch (e) {
            console.warn("fluent runtime: expression failed:", e);
          } finally {
            scheduleUpdate(root, state);
          }
        }
      });
    }
    for (const { name } of Array.from(el.attributes)) {
      const d = parseDirectiveName(name);
      if (!d || d.kind !== "bind") continue;
      const path = d.arg;
      const key = `__fluent_bind_${path}`;
      const anyEl = el;
      if (anyEl[key]) continue;
      anyEl[key] = true;
      const onInput = () => state.signals.setPath(path, readBoundValue(el));
      const eventName = isFormLike(el) ? "input" : "blur";
      el.addEventListener(eventName, onInput);
    }
  }
};
var updateDirectives = (root, state) => {
  const scope = root instanceof Document ? root : root;
  const all = scope.querySelectorAll?.("*");
  if (!all) return;
  for (const el of all) {
    if (el.hasAttribute("data-text")) {
      const expr = el.getAttribute("data-text") ?? "";
      const compiled = compileExpr(expr, {
        signals: state.signals,
        allowExpressions: state.options.allowExpressions
      });
      if (compiled.kind === "expr" && compiled.fn) {
        try {
          const v = compiled.fn(state.signals, null, el);
          el.textContent = v == null ? "" : String(v);
        } catch {
        }
      }
    }
    if (el.hasAttribute("data-show")) {
      const expr = el.getAttribute("data-show") ?? "";
      const compiled = compileExpr(expr, {
        signals: state.signals,
        allowExpressions: state.options.allowExpressions
      });
      if (compiled.kind === "expr" && compiled.fn) {
        try {
          const v = compiled.fn(state.signals, null, el);
          const show = Boolean(v);
          el.style.display = show ? "" : "none";
        } catch {
        }
      }
    }
    for (const { name } of Array.from(el.attributes)) {
      const d = parseDirectiveName(name);
      if (!d || d.kind !== "bind") continue;
      const path = d.arg;
      writeBoundValue(el, state.signals.getPath(path));
    }
    for (const { name, value } of Array.from(el.attributes)) {
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
          const v = compiled.fn(state.signals, null, el);
          el.classList.toggle(clsName, Boolean(v));
        } catch {
        }
      }
    }
    for (const { name, value } of Array.from(el.attributes)) {
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
          const v = compiled.fn(state.signals, null, el);
          if (v == null || v === false) el.removeAttribute(attrName);
          else if (v === true) el.setAttribute(attrName, "");
          else el.setAttribute(attrName, String(v));
        } catch {
        }
      }
    }
  }
  for (const el of Array.from(scope.querySelectorAll?.("[data-effect]") ?? [])) {
    const expr = el.getAttribute("data-effect") ?? "";
    const compiled = compileExpr(expr, {
      signals: state.signals,
      allowExpressions: state.options.allowExpressions
    });
    if (compiled.kind === "expr" && compiled.fn) {
      try {
        compiled.fn(state.signals, null, el);
      } catch {
      }
    }
  }
  scanAndWireEvents(root, state);
};
var performAction = async (method, url, ev, el, root, state) => {
  if (ev.type === "submit") ev.preventDefault();
  if (ev.type === "click" && el instanceof HTMLAnchorElement) {
    ev.preventDefault();
  }
  const headers = new Headers();
  headers.set(state.options.headerRequest, "true");
  let fetchUrl = url;
  let body = null;
  const doc = rootDocumentOf(root);
  const form = el instanceof HTMLFormElement ? el : el.closest?.("form");
  if (form instanceof HTMLFormElement) {
    const fd = new FormData(form);
    if (method === "GET") {
      const u = new URL(fetchUrl, doc.baseURI);
      for (const [k, v] of fd.entries()) {
        if (typeof v === "string") u.searchParams.set(k, v);
      }
      fetchUrl = u.toString();
    } else {
      body = fd;
    }
  }
  const res = await fetch(fetchUrl, {
    method,
    headers,
    body,
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
var getSseRecord = (el) => el[SSE_KEY] ?? null;
var setSseRecord = (el, rec) => {
  const obj = el;
  if (!rec) delete obj[SSE_KEY];
  else obj[SSE_KEY] = rec;
};
var resolveSseTarget = (root, el, selector) => {
  const doc = rootDocumentOf(root);
  if (selector) {
    if (root instanceof ShadowRoot) return root.querySelector(selector);
    return doc.querySelector(selector);
  }
  return el;
};
var enhanceSse = ({ root }) => {
  const scope = root instanceof Document ? root : root;
  const els = scope.querySelectorAll?.("[data-sse]");
  if (!els) return;
  for (const el of els) {
    const url = el.getAttribute("data-sse");
    if (!url) continue;
    const existing = getSseRecord(el);
    if (existing && existing.source.url === url) continue;
    if (existing) {
      try {
        existing.source.close();
      } catch {
      }
      setSseRecord(el, null);
    }
    const rr = getOrCreateRootRuntime(root);
    const eventName = el.getAttribute("data-sse-event") ?? "message";
    const mergeSignals = el.hasAttribute("data-sse-signals") ? truthy(el.getAttribute("data-sse-signals")) : true;
    const selector = el.getAttribute("data-sse-selector");
    const mode = normalizeMode(el.getAttribute("data-sse-mode"));
    const onlyIfMissing = truthy(el.getAttribute("data-sse-only-if-missing"));
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
      const target = resolveSseTarget(root, el, selector);
      if (!target) return;
      if (onlyIfMissing && target.childNodes.length > 0) return;
      applyHtmlUpdate(dataText, target, mode);
      collectSignals(root, rr.state.signals);
      scheduleUpdate(root, rr.state);
    };
    src.addEventListener(eventName, handler);
    setSseRecord(el, {
      source: src,
      root
    });
  }
};
var closeSseIfPresent = (rootOrElement) => {
  const scope = rootOrElement instanceof Element ? rootOrElement.getRootNode() : rootOrElement;
  const doc = rootDocumentOf(scope);
  const base = rootOrElement instanceof Element ? rootOrElement : scope;
  const all = base.querySelectorAll?.("[data-sse]");
  if (all) {
    for (const el of all) {
      const rec = getSseRecord(el);
      if (!rec) continue;
      try {
        rec.source.close();
      } catch {
      }
      setSseRecord(el, null);
    }
  } else {
    if (rootOrElement instanceof Element) {
      const rec = getSseRecord(rootOrElement);
      if (rec) {
        try {
          rec.source.close();
        } catch {
        }
        setSseRecord(rootOrElement, null);
      }
    }
  }
  void doc;
};
export {
  closeSseIfPresent,
  enhance
};
