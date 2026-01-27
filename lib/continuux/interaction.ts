/**
 * lib/continuux/interaction.ts
 *
 * This module is the foundation of ContinuUX’s SSE-based interactivity layer and
 * is designed to work in lockstep with `lib/continuux/http.ts`. Together, these
 * modules enable a hypermedia-style interaction model where the server remains
 * the primary source of truth and the browser executes instructions rather than
 * owning application logic.
 *
 * Conceptually, this follows the same lineage as HTMX or Datastar, but with an
 * explicit, typed JavaScript contract instead of HTML attributes or opaque
 * string commands. Interactions are expressed as small, structured “actions”
 * embedded in DOM metadata and posted back to the server. These actions form a
 * tiny, inspectable DSL that the server decodes, validates, and evaluates.
 *
 * Core ideas:
 *
 * 1) Hypermedia via typed JavaScript instructions
 * Instead of shipping large client-side frameworks, the browser user agent
 * (“browser-ua”) acts as a thin executor. It observes DOM events, packages them
 * into structured interaction envelopes, and sends them to the server. The
 * server responds with JavaScript-based instructions that describe *what should
 * happen next*, not how to reimplement application state in the browser.
 *
 * All meaningful interactivity flows through:
 * - signals emitted by the browser
 * - actions evaluated by the server
 * - JavaScript snippets returned as instructions
 *
 * 2) Interaction envelopes as the hypermedia contract
 * Each browser interaction is captured as a `CxInteractionEnvelope` describing:
 * - the DOM event and the associated action spec
 * - element, client, and navigation context
 * - optional pointer, key, input, and form data
 *
 * These envelopes are decoded defensively to ensure the server only evaluates
 * well-formed, intentional interactions.
 *
 * 3) Typed interaction routing and evaluation
 * The `cxRouter` provides a typed dispatch layer for interaction “actions”:
 * - routes are registered by name, not by URL
 * - payloads are validated via schemas or parsers
 * - handlers run with full access to request state, per-request vars, and
 *   decoded interaction context
 *
 * The result of a handler is not UI state, but instructions that guide the
 * browser’s next step.
 *
 * 4) SSE as the continuity channel
 * When needed, server-sent events are used as a continuous coordination channel
 * between server and browser. This allows the server to push instruction streams
 * to the client, enabling progressive updates, long-running workflows, and
 * reactive UI behavior without client-side state machines.
 *
 * 5) User agent aide and attribute conventions
 * The `userAgentAide` exposes canonical `data-cx-*` attributes for annotating
 * server-rendered HTML, along with helpers to serve and bootstrap the browser
 * user agent module. This keeps markup declarative while leaving interpretation
 * and execution to the server.
 *
 * Architectural intent:
 * - Server-driven hypermedia, not client-owned application logic
 * - Typed, inspectable interaction contracts instead of stringly-typed commands
 * - JavaScript as the instruction format, not a framework runtime
 * - Plain SSR when interactivity is unnecessary; continuous SSE-driven behavior
 *   when it is
 *
 * This module is not a UI framework. It is a protocol and dispatch layer that
 * enables continuous, server-directed UX using hypermedia principles expressed
 * through typed JavaScript instructions.
 */

import type {
  HandlerCtx,
  Middleware,
  SseEventMap,
  SseOptions,
  SseSession,
} from "./http.ts";
import type {
  CxActionHandlers,
  CxActionSchemas,
  CxKit,
} from "./interaction-html.ts";
import { cxPostHandler } from "./interaction-html.ts";

export type AttrValue = string | number | boolean | null | undefined;
export type Attrs = Record<string, AttrValue>;

export type CxDomEventName =
  | "click"
  | "dblclick"
  | "submit"
  | "change"
  | "input"
  | "keydown"
  | "keyup"
  | "focusin"
  | "focusout"
  | "pointerdown"
  | "pointerup";

export type CxEnvelopeKind = "cx/interaction";

export type CxClientMeta = {
  sessionId: string;
  requestId: string;
  userAgent?: string;
  href: string;
  pathname: string;
  search: string; // may be ""
  referrer?: string;
  ts: number;
  appVersion?: string;
};

export type CxElementMeta = {
  tag: string;
  id?: string;
  name?: string;
  className?: string;
  role?: string | null;
  cxId?: string;
};

export type CxPointerMeta = {
  x?: number;
  y?: number;
  button?: number;
  buttons?: number;
};

export type CxKeyMeta = {
  key?: string;
  code?: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  repeat?: boolean;
};

export type CxInputMeta = {
  value?: string;
  checked?: boolean;
};

export type CxFormValue = string | string[];
export type CxFormDataObject = Record<string, CxFormValue>;

export type CxInteractionEnvelope = {
  kind: CxEnvelopeKind;
  domEvent: CxDomEventName;
  spec: string;

  element: CxElementMeta;
  client: CxClientMeta;

  pointer?: CxPointerMeta;
  key?: CxKeyMeta;
  input?: CxInputMeta;
  form?: CxFormDataObject;

  signals?: Record<string, unknown>;
  headers?: Record<string, string>;
};

export type CxInbound = CxInteractionEnvelope;

export type SchemaLike<T> = { parse: (u: unknown) => T };

export type CxHandlerCtx<State, Vars extends Record<string, unknown>> = {
  state: State;
  vars: Vars;
  cx: CxInbound;
  req: Request;
  scratch: Record<string, unknown>;
};

export type CxHandlerResult =
  | { ok: true }
  | { ok: true; headers?: HeadersInit }
  | { ok: false; status: number; message: string };

export type CxHandler<State, Vars extends Record<string, unknown>, T> = (
  ctx: CxHandlerCtx<State, Vars> & { data: T },
) => Promise<CxHandlerResult> | CxHandlerResult;

export type CxRoute<State, Vars extends Record<string, unknown>, T> = {
  name: string;
  schema: SchemaLike<T> | ((u: unknown) => T);
  handler: CxHandler<State, Vars, T>;
};

export type CxRouter<State, Vars extends Record<string, unknown>> = {
  add<T>(route: CxRoute<State, Vars, T>): CxRouter<State, Vars>;
  has(name: string): boolean;
  decodeEnvelope(env: unknown): CxInbound;
  dispatch(
    name: string,
    req: Request,
    env: unknown,
    state: State,
    vars: Vars,
  ): Promise<CxHandlerResult>;
};

const asError = (err: unknown) =>
  err instanceof Error ? err : new Error(String(err));

const isPlainObject = (v: unknown): v is Record<string, unknown> => {
  if (v == null || typeof v !== "object") return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

const mustNonEmptyString = (o: Record<string, unknown>, k: string): string => {
  const v = o[k];
  if (typeof v !== "string" || v.length === 0) {
    throw new Error(`cx envelope: ${k} missing`);
  }
  return v;
};

const mustString = (o: Record<string, unknown>, k: string): string => {
  const v = o[k];
  if (typeof v !== "string") throw new Error(`cx envelope: ${k} missing`);
  return v;
};

const optString = (o: Record<string, unknown>, k: string): string | undefined =>
  typeof o[k] === "string" ? (o[k] as string) : undefined;

const mustNumber = (o: Record<string, unknown>, k: string): number => {
  const v = o[k];
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new Error(`cx envelope: ${k} missing`);
  }
  return v;
};

export const decodeCxEnvelope = (env: unknown): CxInbound => {
  if (!isPlainObject(env)) throw new Error("cx envelope: object expected");

  const kind = mustNonEmptyString(env, "kind");
  if (kind !== "cx/interaction") {
    throw new Error(`cx envelope: bad kind ${kind}`);
  }

  const domEvent = mustNonEmptyString(env, "domEvent") as CxDomEventName;
  const spec = mustNonEmptyString(env, "spec");

  const elementU = env["element"];
  if (!isPlainObject(elementU)) throw new Error("cx envelope: element missing");
  const element: CxElementMeta = {
    tag: mustNonEmptyString(elementU, "tag"),
    id: optString(elementU, "id"),
    name: optString(elementU, "name"),
    className: optString(elementU, "className"),
    role: typeof elementU["role"] === "string"
      ? (elementU["role"] as string)
      : null,
    cxId: optString(elementU, "cxId"),
  };

  const clientU = env["client"];
  if (!isPlainObject(clientU)) throw new Error("cx envelope: client missing");
  const client: CxClientMeta = {
    sessionId: mustNonEmptyString(clientU, "sessionId"),
    requestId: mustNonEmptyString(clientU, "requestId"),
    userAgent: optString(clientU, "userAgent"),
    href: mustNonEmptyString(clientU, "href"),
    pathname: mustNonEmptyString(clientU, "pathname"),
    search: mustString(clientU, "search"), // allow ""
    referrer: optString(clientU, "referrer"),
    ts: mustNumber(clientU, "ts"),
    appVersion: optString(clientU, "appVersion"),
  };

  const out: CxInbound = {
    kind: "cx/interaction",
    domEvent,
    spec,
    element,
    client,
  };

  if (isPlainObject(env["pointer"])) {
    out.pointer = env["pointer"] as CxPointerMeta;
  }
  if (isPlainObject(env["key"])) out.key = env["key"] as CxKeyMeta;
  if (isPlainObject(env["input"])) out.input = env["input"] as CxInputMeta;
  if (isPlainObject(env["form"])) out.form = env["form"] as CxFormDataObject;

  if (isPlainObject(env["signals"])) {
    out.signals = env["signals"] as Record<string, unknown>;
  }

  if (isPlainObject(env["headers"])) {
    const h = env["headers"] as Record<string, unknown>;
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(h)) {
      if (typeof v === "string") headers[k] = v;
    }
    out.headers = headers;
  }

  return out;
};

export const cxRouter = <
  State,
  Vars extends Record<string, unknown>,
>(): CxRouter<State, Vars> => {
  const routes = new Map<string, CxRoute<State, Vars, unknown>>();

  const parseWith = <T>(
    schema: SchemaLike<T> | ((u: unknown) => T),
    u: unknown,
  ): T => {
    if (typeof schema === "function") return schema(u);
    return schema.parse(u);
  };

  return {
    add<T>(route: CxRoute<State, Vars, T>) {
      routes.set(route.name, route as unknown as CxRoute<State, Vars, unknown>);
      return this;
    },

    has(name) {
      return routes.has(name);
    },

    decodeEnvelope: decodeCxEnvelope,

    async dispatch(name, req, env, state, vars) {
      const r = routes.get(name);
      if (!r) {
        return {
          ok: false,
          status: 404,
          message: `cx route not found: ${name}`,
        };
      }

      let cx: CxInbound;
      try {
        cx = decodeCxEnvelope(env);
      } catch (err) {
        const e = asError(err);
        return { ok: false, status: 400, message: e.message };
      }

      let data: unknown;
      try {
        // NOTE: current routing keeps the existing semantics: schema parses the full env.
        // If you later split payload vs envelope, update this line accordingly.
        data = parseWith(r.schema as unknown as SchemaLike<unknown>, env);
      } catch (err) {
        const e = asError(err);
        return {
          ok: false,
          status: 400,
          message: `cx validation failed: ${e.message}`,
        };
      }

      const ctx: CxHandlerCtx<State, Vars> & { data: unknown } = {
        state,
        vars,
        cx,
        req,
        scratch: Object.create(null),
        data,
      };

      try {
        return await r.handler(ctx as never);
      } catch (err) {
        const e = asError(err);
        return {
          ok: false,
          status: 500,
          message: `cx handler error: ${e.message}`,
        };
      }
    },
  };
};

/* =========================
 * Diagnostics helpers (shared by tests and tools)
 * ========================= */

export const CX_DIAG_PREFIX = "[cx:diag]";

export type CxDiagEvent = {
  kind: string;
  ts: number;
  data: unknown;
};

export const parseCxDiagLine = (line: string): CxDiagEvent | null => {
  if (!line.startsWith(CX_DIAG_PREFIX)) return null;
  const jsonText = line.slice(CX_DIAG_PREFIX.length).trim();
  try {
    const obj = JSON.parse(jsonText) as CxDiagEvent;
    if (!obj || typeof obj.kind !== "string" || typeof obj.ts !== "number") {
      return null;
    }
    return obj;
  } catch {
    return null;
  }
};

export const tail = <T>(arr: T[], n: number): T[] =>
  arr.slice(Math.max(0, arr.length - n));

export type CxDiagnosticsDumpInput = {
  title: string;

  diags: CxDiagEvent[];
  diagRawLines: string[];

  consoleLogs: string[];
  pageErrors: string[];

  posts?: Array<{ domEvent: string; spec: string }>;
};

export const formatCxDiagnosticsDump = (i: CxDiagnosticsDumpInput): string => {
  const postsLine = i.posts && i.posts.length
    ? i.posts.map((p) => `${p.domEvent}:${p.spec}`).join(", ")
    : "";

  return [
    i.title,
    "",
    `diag count: ${i.diags.length}`,
    ...tail(i.diagRawLines, 80).map((s) => `  ${s}`),
    "",
    "Console logs:",
    ...tail(i.consoleLogs, 120),
    "",
    "Page errors:",
    ...tail(i.pageErrors, 80),
    "",
    `posts: ${postsLine}`,
  ].join("\n");
};

export const sawDiag = (
  diags: CxDiagEvent[],
  kind: string,
  pred?: (d: CxDiagEvent) => boolean,
): boolean => diags.some((d) => d.kind === kind && (!pred || pred(d)));

const setTextDomJs = (id: string, text: string) =>
  `{
  const __el = document.getElementById(${JSON.stringify(id)});
  if (__el) __el.textContent = ${JSON.stringify(text)};
}`;

const setDatasetDomJs = (key: string, value: string) =>
  `{
  try { document.body.dataset[${JSON.stringify(key)}] = ${
    JSON.stringify(value)
  }; } catch {}
}`;

export const cxDomJs = {
  setText: setTextDomJs,
  setDataset: setDatasetDomJs,
} as const;

/* =========================
 * SSE hub helpers
 * ========================= */

export type CxSseHub<E extends SseEventMap> = {
  register: (sessionId: string, session: SseSession<E>) => void;
  unregister: (sessionId: string) => void;

  send: <K extends keyof E>(sessionId: string, event: K, data: E[K]) => boolean;
  broadcast: <K extends keyof E>(event: K, data: E[K]) => void;

  js: (sessionId: string, jsText: string) => boolean;
  broadcastJs: (jsText: string) => void;

  size: () => number;
};

const normalizeSessionId = (
  sessionId: string | null | undefined,
): string | null => {
  const s = (sessionId ?? "").trim();
  if (!s) return null;
  if (s === "unknown") return null;
  return s;
};

export const createSseHub = <E extends SseEventMap>(): CxSseHub<E> => {
  const sessions = new Map<string, SseSession<E>>();

  const unregister = (sessionId: string) => {
    const sid = normalizeSessionId(sessionId);
    if (!sid) return;

    const s = sessions.get(sid);
    if (s) {
      try {
        s.close();
      } catch {
        // ignore
      }
    }
    sessions.delete(sid);
  };

  const register = (sessionId: string, session: SseSession<E>) => {
    const sid = normalizeSessionId(sessionId);
    if (!sid) {
      try {
        session.close();
      } catch {
        // ignore
      }
      return;
    }

    unregister(sid);
    sessions.set(sid, session);

    queueMicrotask(() => {
      if (session.isClosed()) sessions.delete(sid);
    });
  };

  const send = <K extends keyof E>(sessionId: string, event: K, data: E[K]) => {
    const sid = normalizeSessionId(sessionId);
    if (!sid) return false;

    const s = sessions.get(sid);
    if (!s || s.isClosed()) {
      sessions.delete(sid);
      return false;
    }
    const ok = s.send(event, data);
    if (!ok) sessions.delete(sid);
    return ok;
  };

  const broadcast = <K extends keyof E>(event: K, data: E[K]) => {
    for (const [sid, s] of sessions) {
      if (s.isClosed()) {
        sessions.delete(sid);
        continue;
      }
      const ok = s.send(event, data);
      if (!ok) sessions.delete(sid);
    }
  };

  const js = (sessionId: string, jsText: string) =>
    // @ts-expect-error: only valid if E includes "js"
    send(sessionId, "js", jsText);

  const broadcastJs = (jsText: string) =>
    // @ts-expect-error: only valid if E includes "js"
    broadcast("js", jsText);

  return {
    register,
    unregister,
    send,
    broadcast,
    js,
    broadcastJs,
    size: () => sessions.size,
  };
};

export const cxSseRegister = <E extends SseEventMap>(
  hub: CxSseHub<E>,
  sessionId: string,
  session: SseSession<E>,
): void => {
  const sid = (sessionId ?? "").trim();

  if (!sid || sid === "unknown") {
    try {
      session.close();
    } catch {
      // ignore
    }
    return;
  }

  hub.register(sid, session);

  void session.ready.then(() => {
    queueMicrotask(() => {
      if (session.isClosed()) hub.unregister(sid);
    });
  });
};

/* =========================
 * Attributes and UA serving
 * ========================= */

export type UserAgentAideConfig = {
  attrPrefix?: string; // default "data-cx"
  defaultPostUrl?: string; // default "/cx"
  defaultSseUrl?: string; // default "/cx/sse"
  defaultImportUrl?: string; // default "/browser-ua-aide.js"
};

export type UserAgentAide = {
  attrs: {
    // interaction binding
    cx: string;
    on: (domEvent: CxDomEventName) => string;
    id: string;
    signals: string;
    headers: string;

    // delegated UA network bus overrides (root-level)
    postUrl: string; // `${prefix}-post-url`
    sseUrl: string; // `${prefix}-sse-url`
    sseWithCredentials: string; // `${prefix}-sse-with-credentials`
  };

  moduleSource: () => Promise<string>;
  moduleResponse: (cacheControl?: string) => Promise<Response>;

  bootModuleSnippet: (opts?: {
    importUrl?: string;
    postUrl?: string;
    sseUrl?: string;
    sseWithCredentials?: boolean;
    debug?: boolean;
    diagnostics?: boolean;
    autoConnect?: boolean;
    appVersion?: string;
    events?: readonly CxDomEventName[];
    preventDefaultSubmit?: boolean;
    sseJsEventName?: string;
    attrPrefix?: string;
  }) => string;
};

export const userAgentAide = (
  cfg: UserAgentAideConfig = {},
): UserAgentAide => {
  const prefix = cfg.attrPrefix ?? "data-cx";

  const attrs = {
    // interaction binding (same semantics as before)
    cx: `${prefix}`,
    on: (domEvent: CxDomEventName) => `${prefix}-on-${domEvent}`,
    id: `${prefix}-id`,
    signals: `${prefix}-signals`,
    headers: `${prefix}-headers`,

    // network bus overrides (now explicit in browser-ua-aide.js)
    postUrl: `${prefix}-post-url`,
    sseUrl: `${prefix}-sse-url`,
    sseWithCredentials: `${prefix}-sse-with-credentials`,
  } as const;

  const moduleSource = async (): Promise<string> => {
    const resolved = import.meta.resolve("./browser-ua-aide.js");
    const res = await fetch(resolved);
    if (!res.ok) {
      throw new Error(
        `Failed to load browser-ua-aide.js (${res.status} ${res.statusText}) from ${resolved}`,
      );
    }
    return await res.text();
  };

  const moduleResponse = async (
    cacheControl = "no-store",
  ): Promise<Response> => {
    const js = await moduleSource();
    return new Response(js, {
      headers: {
        "content-type": "text/javascript; charset=utf-8",
        "cache-control": cacheControl,
      },
    });
  };

  const bootModuleSnippet = (opts: {
    importUrl?: string;
    postUrl?: string;
    sseUrl?: string;
    sseWithCredentials?: boolean;
    debug?: boolean;
    diagnostics?: boolean;
    autoConnect?: boolean;
    appVersion?: string;
    events?: readonly CxDomEventName[];
    preventDefaultSubmit?: boolean;
    sseJsEventName?: string;
    attrPrefix?: string;
  } = {}): string => {
    const importUrl = opts.importUrl ?? cfg.defaultImportUrl ??
      "/browser-ua-aide.js";
    const postUrl = opts.postUrl ?? cfg.defaultPostUrl ?? "/cx";
    const sseUrl = opts.sseUrl ?? cfg.defaultSseUrl ?? "/cx/sse";

    const debug = !!opts.debug;
    const diagnostics = !!opts.diagnostics;
    const autoConnect = opts.autoConnect ?? true;

    const lines: string[] = [
      `import { createCxUserAgent } from ${JSON.stringify(importUrl)};`,
      `window.CX = createCxUserAgent({`,
      `  postUrl: ${JSON.stringify(postUrl)},`,
      `  sseUrl: ${JSON.stringify(sseUrl)},`,
      `  sseWithCredentials: ${
        typeof opts.sseWithCredentials === "boolean"
          ? String(opts.sseWithCredentials)
          : "undefined"
      },`,
      `  debug: ${String(debug)},`,
      `  diagnostics: ${String(diagnostics)},`,
      `  autoConnect: ${String(autoConnect)},`,
    ];

    if (opts.attrPrefix) {
      lines.push(`  attrPrefix: ${JSON.stringify(opts.attrPrefix)},`);
    }
    if (opts.sseJsEventName) {
      lines.push(`  sseJsEventName: ${JSON.stringify(opts.sseJsEventName)},`);
    }
    if (opts.appVersion) {
      lines.push(`  appVersion: ${JSON.stringify(opts.appVersion)},`);
    }
    if (opts.events && opts.events.length) {
      lines.push(`  events: ${JSON.stringify(Array.from(opts.events))},`);
    }
    if (typeof opts.preventDefaultSubmit === "boolean") {
      lines.push(
        `  preventDefaultSubmit: ${String(opts.preventDefaultSubmit)},`,
      );
    }

    lines.push(`});`);
    return lines.join("\n");
  };

  return { attrs, moduleSource, moduleResponse, bootModuleSnippet };
};

/* =========================
 * SSE middleware builder
 * ========================= */

export type CxMiddlewareBuilderConfig<E extends SseEventMap> = {
  hub?: CxSseHub<E>;
  attrPrefix?: string;
  postUrl?: string;
  sseUrl?: string;
  importUrl?: string;
  sseWithCredentials?: boolean;
  sessionIdParam?: string;
  sessionIdDefault?: string;
  sseOptions?: Omit<SseOptions, "signal">;
};

type CxMiddlewareBuilderResolvedConfig<E extends SseEventMap> = {
  attrPrefix: string;
  postUrl: string;
  sseUrl: string;
  importUrl: string;
  sseWithCredentials: boolean;
  sessionIdParam: string;
  sessionIdDefault: string;
  sseOptions?: Omit<SseOptions, "signal">;
};

export type CxMiddlewareBuilderSessionContext<
  State extends Record<string, unknown>,
  Vars extends Record<string, unknown>,
  E extends SseEventMap,
> = {
  c: HandlerCtx<string, State, Vars>;
  session: SseSession<E>;
  sessionId: string;
  hub: CxSseHub<E>;
};

export type CxMiddlewareBuilderPostOptions<
  State extends Record<string, unknown>,
  Vars extends Record<string, unknown>,
  Schemas extends CxActionSchemas,
  Prefix extends string,
  E extends SseEventMap,
> = {
  cx: CxKit<State, Vars, Schemas, E, Prefix>;
  handlers: CxActionHandlers<State, Vars, Schemas, E, Prefix>;
};

export type CxMiddlewareBuilderMiddlewareOptions<
  State extends Record<string, unknown>,
  Vars extends Record<string, unknown>,
  E extends SseEventMap,
  Schemas extends CxActionSchemas,
  Prefix extends string,
> = {
  onConnect?: (
    ctx: CxMiddlewareBuilderSessionContext<State, Vars, E>,
  ) => Promise<void> | void;
  sessionIdFrom?: (
    c: HandlerCtx<string, State, Vars>,
  ) => string | null;
  sseOptions?: Omit<SseOptions, "signal">;
  uaCacheControl?: string;
  post?: CxMiddlewareBuilderPostOptions<State, Vars, Schemas, Prefix, E>;
};

export class CxMiddlewareBuilder<E extends SseEventMap> {
  readonly config: CxMiddlewareBuilderResolvedConfig<E>;
  readonly hub: CxSseHub<E>;
  readonly userAgentAide: UserAgentAide;
  readonly domJs = cxDomJs;

  constructor(cfg: CxMiddlewareBuilderConfig<E> = {}) {
    this.hub = cfg.hub ?? createSseHub<E>();
    this.config = {
      attrPrefix: cfg.attrPrefix ?? "data-cx",
      postUrl: cfg.postUrl ?? "/cx",
      sseUrl: cfg.sseUrl ?? "/cx/sse",
      importUrl: cfg.importUrl ?? "/browser-ua-aide.js",
      sseWithCredentials: cfg.sseWithCredentials ?? true,
      sessionIdParam: cfg.sessionIdParam ?? "sessionId",
      sessionIdDefault: cfg.sessionIdDefault ?? "unknown",
      sseOptions: cfg.sseOptions,
    };
    this.userAgentAide = userAgentAide({
      attrPrefix: this.config.attrPrefix,
      defaultPostUrl: this.config.postUrl,
      defaultSseUrl: this.config.sseUrl,
      defaultImportUrl: this.config.importUrl,
    });
  }

  middleware<
    State extends Record<string, unknown>,
    Vars extends Record<string, unknown>,
    Schemas extends CxActionSchemas = CxActionSchemas,
    Prefix extends string = string,
  >(
    opts: CxMiddlewareBuilderMiddlewareOptions<
      State,
      Vars,
      E,
      Schemas,
      Prefix
    > = {},
  ): Middleware<State, Vars> {
    return async (c, next) => {
      const { req, url } = c;
      if (req.method === "GET") {
        if (url.pathname === this.config.importUrl) {
          return await this.userAgentAide.moduleResponse(
            opts.uaCacheControl ?? "no-store",
          );
        }
        if (url.pathname === this.config.sseUrl) {
          const sessionId = this.resolveSessionId(c, opts.sessionIdFrom);
          return await c.sse<E>(
            async (session) => {
              cxSseRegister(this.hub, sessionId, session);
              if (opts.onConnect) {
                await opts.onConnect({
                  c,
                  session,
                  sessionId,
                  hub: this.hub,
                });
              }
            },
            opts.sseOptions ?? this.config.sseOptions,
          );
        }
      }
      if (
        req.method === "POST" &&
        url.pathname === this.config.postUrl &&
        opts.post
      ) {
        const body = await c.readJson();
        const result = await cxPostHandler(opts.post.cx, {
          req: c.req,
          body,
          state: c.state,
          vars: c.vars,
          handlers: opts.post.handlers,
          sse: this.hub,
        });
        return opts.post.cx.server.toResponse(result);
      }
      return await next();
    };
  }

  private resolveSessionId<
    State extends Record<string, unknown>,
    Vars extends Record<string, unknown>,
  >(
    c: HandlerCtx<string, State, Vars>,
    from?: (c: HandlerCtx<string, State, Vars>) => string | null,
  ): string {
    const raw = from?.(c) ?? c.query(this.config.sessionIdParam);
    if (typeof raw === "string" && raw.trim()) return raw;
    return this.config.sessionIdDefault;
  }
}
