/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

// src/html/browser-ua/runtime.ts
//
// Dependency-free hypermedia runtime for Fluent + custom elements.
// Supports:
//
// Actions (via data-on:*):
//   data-on:click='@get("/path")'   (also post/put/patch/delete)
//   data-on:click='signals.setPath("x", 1)' (optional expressions)
//
// Signals:
//   data-signals='{"count":1}'
//   data-bind:foo.bar=""            (two-way for inputs, one-way for others)
//
// Simple directives:
//   data-text="expr"
//   data-show="expr"
//   data-class:active="expr"
//   data-attr:href="expr"
//   data-effect="expr"
//
// Swaps from fetch responses (headers):
//   datastar-selector
//   datastar-mode: replace | inner | append | prepend | before | after
//   datastar-only-if-missing
//   datastar-use-view-transition
//   Datastar-Request: true (request header)
//
// SSE (opt-in):
//   data-sse="/events"
//   Optional:
//     data-sse-event="message"            (default "message")
//     data-sse-signals="true"             (default true; merge JSON objects into signals)
//     data-sse-selector="#target"         (swap target; default closest data-target / currentTarget / root host)
//     data-sse-mode="inner|append|..."    (default "append")
//     data-sse-only-if-missing="true"
//
// Exports used by custom elements:
//   enhance({ root })
//   closeSseIfPresent(rootOrElement)

type Mode = "replace" | "inner" | "append" | "prepend" | "before" | "after";

export type RuntimeOptions = {
  headerSelector?: string;
  headerMode?: string;
  headerOnlyIfMissing?: string;
  headerUseViewTransition?: string;
  headerRequest?: string;
  allowExpressions?: boolean;
  credentials?: RequestCredentials;
};

const DEFAULTS: Required<RuntimeOptions> = {
  headerSelector: "datastar-selector",
  headerMode: "datastar-mode",
  headerOnlyIfMissing: "datastar-only-if-missing",
  headerUseViewTransition: "datastar-use-view-transition",
  headerRequest: "Datastar-Request",
  allowExpressions: true,
  credentials: "same-origin",
};

type SignalListener = (path: string, value: unknown) => void;

class SignalStore {
  #root: Record<string, unknown>;
  #listeners = new Set<SignalListener>();

  constructor(initial?: Record<string, unknown>) {
    this.#root = initial ? structuredClone(initial) : {};
  }

  get root(): Record<string, unknown> {
    return this.#root;
  }

  subscribe(fn: SignalListener): () => void {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  #notify(path: string, value: unknown) {
    for (const fn of this.#listeners) fn(path, value);
  }

  getPath(path: string): unknown {
    const parts = path.split(".").filter(Boolean);
    let cur: unknown = this.#root;
    for (const p of parts) {
      if (cur == null || typeof cur !== "object") return undefined;
      cur = (cur as Record<string, unknown>)[p];
    }
    return cur;
  }

  setPath(path: string, value: unknown) {
    const parts = path.split(".").filter(Boolean);
    if (parts.length === 0) return;

    let cur = this.#root as Record<string, unknown>;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = parts[i];
      const v = cur[k];
      if (v == null || typeof v !== "object" || Array.isArray(v)) cur[k] = {};
      cur = cur[k] as Record<string, unknown>;
    }

    cur[parts[parts.length - 1]] = value;
    this.#notify(path, value);
  }

  merge(obj: Record<string, unknown>) {
    const walk = (
      base: Record<string, unknown>,
      add: Record<string, unknown>,
      prefix = "",
    ) => {
      for (const [k, v] of Object.entries(add)) {
        const p = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === "object" && !Array.isArray(v)) {
          const bv = base[k];
          if (!bv || typeof bv !== "object" || Array.isArray(bv)) base[k] = {};
          walk(
            base[k] as Record<string, unknown>,
            v as Record<string, unknown>,
            p,
          );
        } else {
          base[k] = v as unknown;
          this.#notify(p, v);
        }
      }
    };
    walk(this.#root, obj);
  }
}

const parseJsonObject = (s: string): Record<string, unknown> | null => {
  try {
    const v = JSON.parse(s);
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return v as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
};

const parseAction = (expr: string): { method: string; url: string } | null => {
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
  return { method, url };
};

const truthy = (v: string | null) =>
  v != null && /^(1|true|yes|on)$/i.test(v.trim());

const normalizeMode = (v: string | null): Mode => {
  const s = (v ?? "").trim().toLowerCase();
  if (
    s === "replace" || s === "inner" || s === "append" || s === "prepend" ||
    s === "before" || s === "after"
  ) {
    return s;
  }
  return "inner";
};

const isFormLike = (
  el: Element,
): el is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement =>
  el instanceof HTMLInputElement || el instanceof HTMLSelectElement ||
  el instanceof HTMLTextAreaElement;

const readBoundValue = (el: Element): unknown => {
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

const writeBoundValue = (el: Element, value: unknown) => {
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

const parseDirectiveName = (attrName: string) => {
  if (attrName.startsWith("data-on:")) {
    return { kind: "on" as const, arg: attrName.slice("data-on:".length) };
  }
  if (attrName.startsWith("data-bind:")) {
    return { kind: "bind" as const, arg: attrName.slice("data-bind:".length) };
  }
  if (attrName.startsWith("data-class:")) {
    return {
      kind: "class" as const,
      arg: attrName.slice("data-class:".length),
    };
  }
  if (attrName.startsWith("data-attr:")) {
    return { kind: "attr" as const, arg: attrName.slice("data-attr:".length) };
  }
  return null;
};

type CompileCtx = { signals: SignalStore; allowExpressions: boolean };

const compileExpr = (source: string, ctx: CompileCtx) => {
  const trimmed = source.trim();
  const action = parseAction(trimmed);

  if (!ctx.allowExpressions) return { kind: "action-only" as const, action };

  const fn = (() => {
    try {
      return new Function(
        "signals",
        "event",
        "el",
        `"use strict"; return (${trimmed});`,
      ) as (signals: SignalStore, event: Event | null, el: Element) => unknown;
    } catch {
      try {
        return new Function(
          "signals",
          "event",
          "el",
          `"use strict"; ${trimmed};`,
        ) as (
          signals: SignalStore,
          event: Event | null,
          el: Element,
        ) => unknown;
      } catch {
        return null;
      }
    }
  })();

  return { kind: "expr" as const, fn, action };
};

const applyHtmlUpdate = (htmlText: string, target: Element, mode: Mode) => {
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

const rootDocumentOf = (root: ParentNode): Document => {
  if (root instanceof Document) return root;
  if (root instanceof ShadowRoot) return root.ownerDocument;
  return root.ownerDocument ?? document;
};

const defaultSwapTarget = (event: Event | null, root: ParentNode): Element => {
  const doc = rootDocumentOf(root);
  const t = (event?.target instanceof Element) ? event.target : null;
  const ct = (event?.currentTarget instanceof Element)
    ? event.currentTarget
    : null;

  const find = (start: Element | null) => {
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
    const inShadow = (sel: string) => root.querySelector(sel);
    const direct = t?.getAttribute("data-target") ??
      ct?.getAttribute("data-target");
    if (direct) {
      const f = inShadow(direct);
      if (f instanceof Element) return f;
    }
    const f2 = find(t) ?? find(ct);
    if (f2) return f2;
    return root.host instanceof Element
      ? root.host
      : doc.body ?? doc.documentElement;
  }

  return find(t) ?? find(ct) ?? ct ?? (doc.body ?? doc.documentElement);
};

type RuntimeState = {
  options: Required<RuntimeOptions>;
  signals: SignalStore;
  mo: MutationObserver | null;
  unsub: (() => void) | null;
  scheduled: boolean;
};

const createState = (options?: RuntimeOptions): RuntimeState => ({
  options: { ...DEFAULTS, ...(options ?? {}) },
  signals: new SignalStore(),
  mo: null,
  unsub: null,
  scheduled: false,
});

const scheduleUpdate = (root: ParentNode, state: RuntimeState) => {
  if (state.scheduled) return;
  state.scheduled = true;
  queueMicrotask(() => {
    state.scheduled = false;
    updateDirectives(root, state);
  });
};

const collectSignals = (root: ParentNode, signals: SignalStore) => {
  const scope = root instanceof Document
    ? root
    : (root as unknown as Element | ShadowRoot);
  const els = (scope as Document | Element | ShadowRoot).querySelectorAll?.(
    "[data-signals]",
  );
  if (!els) return;
  for (const el of els) {
    const txt = el.getAttribute("data-signals");
    if (!txt) continue;
    const obj = parseJsonObject(txt);
    if (obj) signals.merge(obj);
  }
};

const scanAndWireEvents = (root: ParentNode, state: RuntimeState) => {
  const scope = root instanceof Document
    ? root
    : (root as unknown as Element | ShadowRoot);
  const all = (scope as Document | Element | ShadowRoot).querySelectorAll?.(
    "*",
  );
  if (!all) return;

  for (const el of all) {
    for (const { name, value } of Array.from(el.attributes)) {
      const d = parseDirectiveName(name);
      if (!d || d.kind !== "on") continue;

      const eventName = d.arg;
      const exprText = value ?? "";

      const key = `__fluent_on_${eventName}_${exprText}`;
      const anyEl = el as unknown as Record<string, unknown>;
      if (anyEl[key]) continue;
      anyEl[key] = true;

      el.addEventListener(eventName, async (ev) => {
        const compiled = compileExpr(exprText, {
          signals: state.signals,
          allowExpressions: state.options.allowExpressions,
        });

        if (compiled.action) {
          await performAction(
            compiled.action.method,
            compiled.action.url,
            ev,
            el,
            root,
            state,
          );
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
      const anyEl = el as unknown as Record<string, unknown>;
      if (anyEl[key]) continue;
      anyEl[key] = true;

      const onInput = () => state.signals.setPath(path, readBoundValue(el));
      const eventName = isFormLike(el) ? "input" : "blur";
      el.addEventListener(eventName, onInput);
    }
  }
};

const updateDirectives = (root: ParentNode, state: RuntimeState) => {
  const scope = root instanceof Document
    ? root
    : (root as unknown as Element | ShadowRoot);
  const all = (scope as Document | Element | ShadowRoot).querySelectorAll?.(
    "*",
  );
  if (!all) return;

  for (const el of all) {
    if (el.hasAttribute("data-text")) {
      const expr = el.getAttribute("data-text") ?? "";
      const compiled = compileExpr(expr, {
        signals: state.signals,
        allowExpressions: state.options.allowExpressions,
      });
      if (compiled.kind === "expr" && compiled.fn) {
        try {
          const v = compiled.fn(state.signals, null, el);
          el.textContent = v == null ? "" : String(v);
        } catch {
          // ignore
        }
      }
    }

    if (el.hasAttribute("data-show")) {
      const expr = el.getAttribute("data-show") ?? "";
      const compiled = compileExpr(expr, {
        signals: state.signals,
        allowExpressions: state.options.allowExpressions,
      });
      if (compiled.kind === "expr" && compiled.fn) {
        try {
          const v = compiled.fn(state.signals, null, el);
          const show = Boolean(v);
          (el as HTMLElement).style.display = show ? "" : "none";
        } catch {
          // ignore
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
        allowExpressions: state.options.allowExpressions,
      });
      if (compiled.kind === "expr" && compiled.fn) {
        try {
          const v = compiled.fn(state.signals, null, el);
          el.classList.toggle(clsName, Boolean(v));
        } catch {
          // ignore
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
        allowExpressions: state.options.allowExpressions,
      });
      if (compiled.kind === "expr" && compiled.fn) {
        try {
          const v = compiled.fn(state.signals, null, el);
          if (v == null || v === false) el.removeAttribute(attrName);
          else if (v === true) el.setAttribute(attrName, "");
          else el.setAttribute(attrName, String(v));
        } catch {
          // ignore
        }
      }
    }
  }

  for (
    const el of Array.from(
      (scope as Document | Element | ShadowRoot).querySelectorAll?.(
        "[data-effect]",
      ) ?? [],
    )
  ) {
    const expr = el.getAttribute("data-effect") ?? "";
    const compiled = compileExpr(expr, {
      signals: state.signals,
      allowExpressions: state.options.allowExpressions,
    });
    if (compiled.kind === "expr" && compiled.fn) {
      try {
        compiled.fn(state.signals, null, el);
      } catch {
        // ignore
      }
    }
  }

  scanAndWireEvents(root, state);
};

const performAction = async (
  method: string,
  url: string,
  ev: Event,
  el: Element,
  root: ParentNode,
  state: RuntimeState,
) => {
  if (ev.type === "submit") ev.preventDefault();
  if (ev.type === "click" && el instanceof HTMLAnchorElement) {
    ev.preventDefault();
  }

  const headers = new Headers();
  headers.set(state.options.headerRequest, "true");

  let fetchUrl = url;
  let body: BodyInit | null = null;

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
    credentials: state.options.credentials,
  });

  const selector = res.headers.get(state.options.headerSelector);
  const mode = normalizeMode(res.headers.get(state.options.headerMode));
  const onlyIfMissing = truthy(
    res.headers.get(state.options.headerOnlyIfMissing),
  );
  const useViewTransition = truthy(
    res.headers.get(state.options.headerUseViewTransition),
  );

  const ct = (res.headers.get("content-type") ?? "").toLowerCase();
  if (ct.includes("application/json")) {
    const json = await res.json().catch(() => null);
    if (json && typeof json === "object" && !Array.isArray(json)) {
      state.signals.merge(json as Record<string, unknown>);
      scheduleUpdate(root, state);
    }
    return;
  }

  const text = await res.text();

  const target =
    (selector
      ? (root instanceof ShadowRoot
        ? root.querySelector(selector)
        : doc.querySelector(selector))
      : null) ??
      defaultSwapTarget(ev, root);

  if (!(target instanceof Element)) return;
  if (onlyIfMissing && target.childNodes.length > 0) return;

  // deno-lint-ignore require-await
  const doUpdate = async () => {
    applyHtmlUpdate(text, target, mode);
    collectSignals(root, state.signals);
    scheduleUpdate(root, state);
  };

  const startVT = (doc as unknown as {
    startViewTransition?: (cb: () => Promise<void> | void) => unknown;
  })
    .startViewTransition;

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

export type EnhanceOptions = {
  root?: ParentNode;
  options?: RuntimeOptions;
};

type RootRuntime = {
  state: RuntimeState;
  root: ParentNode;
};

const runtimes = new WeakMap<object, RootRuntime>();

const getOrCreateRootRuntime = (root: ParentNode, options?: RuntimeOptions) => {
  const key: object = root instanceof Document ? root : root;
  const existing = runtimes.get(key);
  if (existing) return existing;

  const rr: RootRuntime = { root, state: createState(options) };
  runtimes.set(key, rr);
  return rr;
};

// Public: wire directives and handlers for a root (Document or ShadowRoot).
export const enhance = ({ root, options }: EnhanceOptions = {}) => {
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
      enhanceSse({ root: r });
    });

    const observeTarget = r instanceof Document
      ? r.documentElement
      : (r as ShadowRoot).host;

    rr.state.mo.observe(observeTarget, { subtree: true, childList: true });
  }

  if (!rr.state.unsub) {
    rr.state.unsub = rr.state.signals.subscribe(() =>
      scheduleUpdate(r, rr.state)
    );
  }

  enhanceSse({ root: r });
};

// ------------------------------
// SSE support
// ------------------------------

const SSE_KEY = Symbol.for("fluent.sse");

type SseRecord = {
  source: EventSource;
  root: ParentNode;
};

const getSseRecord = (el: Element): SseRecord | null =>
  (el as unknown as Record<string | symbol, unknown>)[SSE_KEY] as SseRecord ??
    null;

const setSseRecord = (el: Element, rec: SseRecord | null) => {
  const obj = el as unknown as Record<string | symbol, unknown>;
  if (!rec) delete obj[SSE_KEY];
  else obj[SSE_KEY] = rec;
};

const resolveSseTarget = (
  root: ParentNode,
  el: Element,
  selector: string | null,
): Element | null => {
  const doc = rootDocumentOf(root);
  if (selector) {
    if (root instanceof ShadowRoot) return root.querySelector(selector);
    return doc.querySelector(selector);
  }
  return el;
};

const enhanceSse = ({ root }: { root: ParentNode }) => {
  const scope = root instanceof Document
    ? root
    : (root as unknown as Element | ShadowRoot);
  const els = (scope as Document | Element | ShadowRoot).querySelectorAll?.(
    "[data-sse]",
  );
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
        // ignore
      }
      setSseRecord(el, null);
    }

    const rr = getOrCreateRootRuntime(root);
    const eventName = el.getAttribute("data-sse-event") ?? "message";
    const mergeSignals = el.hasAttribute("data-sse-signals")
      ? truthy(el.getAttribute("data-sse-signals"))
      : true;

    const selector = el.getAttribute("data-sse-selector");
    const mode = normalizeMode(el.getAttribute("data-sse-mode"));
    const onlyIfMissing = truthy(el.getAttribute("data-sse-only-if-missing"));

    const src = new EventSource(url);

    const handler = (ev: MessageEvent) => {
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

    // EventSource only has "message" as a strongly typed property, but addEventListener covers named events.
    src.addEventListener(eventName, handler as EventListener);

    setSseRecord(el, { source: src, root });
  }
};

export const closeSseIfPresent = (rootOrElement: ParentNode | Element) => {
  const scope: ParentNode = rootOrElement instanceof Element
    ? (rootOrElement.getRootNode() as ParentNode)
    : rootOrElement;

  const doc = rootDocumentOf(scope);
  const base: ParentNode = rootOrElement instanceof Element
    ? rootOrElement
    : scope;

  const all = (base as unknown as Element | Document | ShadowRoot)
    .querySelectorAll?.("[data-sse]");
  if (all) {
    for (const el of all) {
      const rec = getSseRecord(el);
      if (!rec) continue;
      try {
        rec.source.close();
      } catch {
        // ignore
      }
      setSseRecord(el, null);
    }
  } else {
    // Fallback: if it’s a single element
    if (rootOrElement instanceof Element) {
      const rec = getSseRecord(rootOrElement);
      if (rec) {
        try {
          rec.source.close();
        } catch {
          // ignore
        }
        setSseRecord(rootOrElement, null);
      }
    }
  }

  // Keep unused refs from being optimized away in some bundlers.
  void doc;
};
