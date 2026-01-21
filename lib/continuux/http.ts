/**
 * lib/continuux/http.ts
 *
 * This module provides a small, explicit, and fully type-safe HTTP foundation
 * for building pure TypeScript web UIs on Deno. It is intentionally minimal,
 * framework-light, and Fetch-native, with a strong emphasis on deterministic
 * behavior, explicit state semantics, and end-to-end type inference.
 *
 * Design goals:
 * - No hidden globals, registries, or implicit state
 * - Explicit request and application state lifetimes
 * - Strong typing for routes, params, SSE events, and per-request variables
 * - Safe defaults for streaming, abort handling, and observability
 * - Compatibility with Deno.serve and standard Fetch APIs
 *
 * What this module provides:
 *
 * Response helpers:
 * - Convenience helpers for text, HTML, JSON, and JavaScript responses
 * - Correct handling of Fetch edge cases (e.g. 204 / 304 with no body)
 *
 * Server-Sent Events (SSE):
 * - Type-safe SSE sessions via event maps
 * - Abort-aware lifecycle management using AbortSignal
 * - Automatic keepalive comments and optional retry hints
 * - Safe cleanup on disconnect to prevent leaked intervals or streams
 *
 * Typed router:
 * - Hono-inspired router without stringly-typed route keys
 * - Compile-time inference of path parameters from literal route strings
 * - Middleware with access to matched params
 * - Route grouping via typed base paths
 *
 * Application state semantics (explicit by construction):
 * - sharedState: one shared mutable object across all requests
 * - snapshotState: cloned state per request (mutations do not persist)
 * - stateFactory: per-request state produced by a factory
 *
 * These strategies remove ambiguity about whether state persists between
 * requests and make lifecycle choices explicit and inspectable.
 *
 * Per-request variables:
 * - Typed, mutable vars scoped to a single request
 * - Middleware-friendly storage for cross-cutting concerns
 *
 * Observability hooks:
 * - Optional hooks for request start, response completion, timing, and errors
 * - Minimal surface area, no imposed logging or tracing framework
 *
 * Architectural stance:
 * - No static file serving from disk
 * - Browser assets are expected to be served as bundled modules
 * - Encourages fully TypeScript-driven UI delivery
 *
 * Intended usage:
 * - Small to medium servers where correctness, clarity, and type safety matter
 * - Pure TypeScript UI stacks without heavyweight frameworks
 * - Systems that value explicit state and deterministic behavior
 *
 * This module is not a general-purpose web framework. It is a focused,
 * composable HTTP core designed to stay understandable, auditable, and
 * predictable as applications grow.
 */

// deno-lint-ignore no-explicit-any
type Any = any;

/* =========================
 * response helpers
 * ========================= */

export const textResponse = (
  text: string,
  status = 200,
  headers?: HeadersInit,
) => {
  const h: HeadersInit = {
    "content-type": "text/plain; charset=utf-8",
    ...(headers ?? {}),
  };

  // Per Fetch spec, these status codes must not have a body.
  if (status === 204 || status === 304) {
    return new Response(null, { status, headers: h });
  }

  return new Response(text, { status, headers: h });
};

export const htmlResponse = (
  html: string,
  status = 200,
  headers?: HeadersInit,
) =>
  new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      ...(headers ?? {}),
    },
  });

export const jsonResponse = (
  obj: unknown,
  status = 200,
  headers?: HeadersInit,
) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(headers ?? {}),
    },
  });

export const jsResponse = (
  js: string,
  cacheControl = "no-store",
  status = 200,
  headers?: HeadersInit,
) =>
  new Response(js, {
    status,
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": cacheControl,
      ...(headers ?? {}),
    },
  });

export const methodNotAllowed = (path: string, allow: string) =>
  textResponse(
    ["Method not allowed.", "", `Endpoint: ${path}`, `Allowed: ${allow}`].join(
      "\n",
    ),
    405,
    { allow },
  );

export type HttpTransformContext<State, Vars extends VarsRecord> =
  & HandlerCtx<string, State, Vars>
  & {
    // The *already-computed* downstream response.
    response: Response;
  };

export type HttpTransformResult = {
  body?: string | Uint8Array;
  headers?: HeadersInit;
  status?: number;
};

export type HttpTransform<State, Vars extends VarsRecord> = (
  ctx: HttpTransformContext<State, Vars>,
) =>
  | HttpTransformResult
  | null
  | undefined
  | Promise<HttpTransformResult | null | undefined>;

export async function applyTransforms<State, Vars extends VarsRecord>(
  ctx: HttpTransformContext<State, Vars>,
  transforms: HttpTransform<State, Vars>[],
) {
  if (transforms.length === 0) return ctx.response;

  let current = ctx.response;
  let bodyText: string | Uint8Array | null = null;

  // Lazy-read body only if a transform asks for it.
  const readBodyIfNeeded = async () => {
    if (bodyText != null) return bodyText;
    if (current.bodyUsed) return null;
    const ct = current.headers.get("content-type") ?? "";
    if (/\btext\/|\/json\b/i.test(ct)) {
      bodyText = await current.text();
    } else {
      bodyText = new Uint8Array(await current.arrayBuffer());
    }
    return bodyText;
  };

  for (const t of transforms) {
    const ctxWithRes: HttpTransformContext<State, Vars> = {
      ...(ctx as HandlerCtx<string, State, Vars>),
      response: current,
    };

    const result = await t(ctxWithRes);
    if (!result) continue;

    const nextHeaders = new Headers(current.headers);
    if (result.headers) {
      for (const [k, v] of Object.entries(result.headers)) {
        nextHeaders.set(k, v as string);
      }
    }

    let nextBody: BodyInit | null = null;

    if (result.body != null) {
      const b = result.body;
      nextBody = typeof b === "string" ? b : (b as unknown as BodyInit);
    } else {
      // If no body override was provided, try to preserve existing body.
      // If it is already consumed, we leave it null (most layout transforms
      // will override body explicitly anyway).
      if (!current.bodyUsed) {
        const originalBody = await readBodyIfNeeded();
        if (originalBody != null) {
          nextBody = typeof originalBody === "string"
            ? originalBody
            : originalBody as unknown as BodyInit;
        }
      }
    }

    const status = result.status ?? current.status;
    nextHeaders.delete("content-length");

    current = new Response(nextBody, { status, headers: nextHeaders });
  }

  return current;
}

/* =========================
 * small internal helpers
 * ========================= */

export type EmptyRecord = Record<PropertyKey, never>;
export type AnyParams = Record<string, string>;
export type VarsRecord = Record<string, unknown>;

export const asError = (err: unknown) =>
  err instanceof Error ? err : new Error(String(err));

/* =========================
 * SSE (type-safe + abort-aware)
 * ========================= */

export type SseEventMap = Record<string, unknown>;

export type SseOptions = {
  headers?: HeadersInit;
  retryMs?: number;
  disableProxyBuffering?: boolean; // default true
  keepAliveMs?: number; // default 15000
  keepAliveComment?: string; // default "keepalive"

  // If provided, session closes when signal aborts (prevents leaked intervals).
  signal?: AbortSignal;
};

export type SseSession<E extends SseEventMap> = {
  response: Response;
  ready: Promise<void>;
  isClosed: () => boolean;
  close: () => void;

  send: <K extends keyof E>(event: K, data: E[K]) => boolean;
  sendWhenReady: <K extends keyof E>(event: K, data: E[K]) => Promise<boolean>;

  comment: (text?: string) => boolean;

  // Always available. Uses SSE "error" event name.
  error: (message: string) => boolean;
};

const enc = new TextEncoder();
const sseEncode = (s: string) => enc.encode(s);

const sseDataToText = (v: unknown): string => {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (
    typeof v === "number" || typeof v === "boolean" || typeof v === "bigint"
  ) return String(v);
  if (v instanceof Uint8Array) return new TextDecoder().decode(v);
  return JSON.stringify(v);
};

const sseFrame = (event: string, dataText: string): Uint8Array => {
  const lines = dataText.split(/\r?\n/);
  let s = `event: ${event}\n`;
  for (const line of lines) s += `data: ${line}\n`;
  s += "\n";
  return sseEncode(s);
};

const sseCommentFrame = (comment: string): Uint8Array => {
  const c = comment.trim();
  return sseEncode(c ? `: ${c}\n\n` : `:\n\n`);
};

const sseRetryFrame = (retryMs: number): Uint8Array =>
  sseEncode(`retry: ${retryMs}\n\n`);

export const sseSession = <E extends SseEventMap = { message: string }>(
  opts: SseOptions = {},
): SseSession<E> => {
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let closed = false;

  let readyResolve!: () => void;
  const ready = new Promise<void>((r) => (readyResolve = r));

  const isClosed = () => closed;

  const cleanup: Array<() => void> = [];

  const close = () => {
    if (closed) return;
    closed = true;

    for (const fn of cleanup.splice(0)) {
      try {
        fn();
      } catch {
        // ignore
      }
    }

    try {
      controller?.close();
    } catch {
      // ignore
    } finally {
      controller = null;
    }
  };

  const enqueue = (chunk: Uint8Array): boolean => {
    if (closed || !controller) return false;
    try {
      controller.enqueue(chunk);
      return true;
    } catch {
      close();
      return false;
    }
  };

  const send = <K extends keyof E>(event: K, data: E[K]) =>
    enqueue(sseFrame(String(event), sseDataToText(data)));

  const error = (message: string) => enqueue(sseFrame("error", message));

  const comment = (text?: string) =>
    enqueue(sseCommentFrame(text ?? (opts.keepAliveComment ?? "keepalive")));

  const sendWhenReady = async <K extends keyof E>(event: K, data: E[K]) => {
    await ready;
    if (closed) return false;
    return send(event, data);
  };

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
      readyResolve();
    },
    cancel() {
      close();
    },
  });

  const disableProxyBuffering = opts.disableProxyBuffering ?? true;

  const headers: HeadersInit = {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    "connection": "keep-alive",
    "content-encoding": "identity",
    ...(disableProxyBuffering ? { "x-accel-buffering": "no" } : {}),
    ...(opts.headers ?? {}),
  };

  const response = new Response(stream, { headers });

  if (typeof opts.retryMs === "number" && opts.retryMs >= 0) {
    void ready.then(() => enqueue(sseRetryFrame(opts.retryMs!)));
  }

  const keepAliveMs = opts.keepAliveMs ?? 15_000;
  const kaId = setInterval(() => {
    if (closed) return;
    comment(opts.keepAliveComment ?? "keepalive");
  }, keepAliveMs);
  cleanup.push(() => clearInterval(kaId));

  const signal = opts.signal;
  if (signal) {
    const onAbort = () => close();
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
    cleanup.push(() => signal.removeEventListener("abort", onAbort));
  }

  return {
    response,
    ready,
    isClosed,
    close,
    send,
    sendWhenReady,
    comment,
    error,
  };
};

export const sseEvery = <E extends SseEventMap, K extends keyof E>(
  session: SseSession<E>,
  intervalMs: number,
  event: K,
  fn: () => E[K] | null,
): () => void => {
  const id = setInterval(() => {
    if (session.isClosed()) {
      clearInterval(id);
      return;
    }
    const data = fn();
    if (data == null) return;
    const ok = session.send(event, data);
    if (!ok) clearInterval(id);
  }, intervalMs);

  return () => {
    clearInterval(id);
    session.close();
  };
};

/* =========================
 * Hono-inspired router (typed params + typed vars + observability)
 * ========================= */

export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "OPTIONS"
  | "HEAD";

type IsWideString<S extends string> = string extends S ? true : false;

// Strip optional `{...}` constraint from a param segment, e.g.
// "id{[0-9]+}" -> "id"
type StripConstraint<S extends string> = S extends `${infer Name}{${string}}`
  ? Name
  : S;

// Extract param names from a path template, supporting:
// - :id
// - :id{[0-9]+}
// - *path (wildcard segment)
type ExtractParamName<S extends string> =
  // segment with ":" (param)
  S extends `${string}:${infer P}/${infer Rest}`
    ? StripConstraint<P> | ExtractParamName<`/${Rest}`>
    : S extends `${string}:${infer P}` ? StripConstraint<P>
    // segment with "*" (wildcard)
    : S extends `${string}*${infer W}/${infer Rest}`
      ? W | ExtractParamName<`/${Rest}`>
    : S extends `${string}*${infer W}` ? W
    : never;

export type ParamsOf<Path extends string> = IsWideString<Path> extends true
  ? AnyParams
  : [ExtractParamName<Path>] extends [never] ? EmptyRecord
  : { [K in ExtractParamName<Path>]: string };

export type SchemaLike<T> = { parse: (u: unknown) => T };

export type RouteSchemas = {
  params?: unknown;
  query?: unknown;
  json?: unknown;
  response?: unknown;
};

export type RouteMeta = {
  summary?: string;
  description?: string;
  tags?: string[];
  auth?: string;
  [key: string]: unknown;
};

export type RouteConfig = {
  meta?: RouteMeta;
  schemas?: RouteSchemas;
};

export type ObservabilityHooks<V extends VarsRecord> = {
  onRequest?: (c: HandlerCtx<string, VarsRecord, V>) => void;
  onResponse?: (
    c: HandlerCtx<string, VarsRecord, V>,
    r: Response,
    ms: number,
  ) => void;
  onError?: (c: HandlerCtx<string, VarsRecord, V>, err: unknown) => void;
};

export type HandlerCtx<Path extends string, State, Vars extends VarsRecord> = {
  req: Request;
  url: URL;
  params: ParamsOf<Path>;

  /**
   * Request state as defined by Application state semantics:
   * - sharedState: shared reference across requests
   * - snapshotState: cloned snapshot per request
   * - stateFactory: produced per request
   */
  state: State;

  // Typed per-request vars (middleware-friendly).
  vars: Vars;
  getVar: <K extends keyof Vars>(key: K) => Vars[K];
  setVar: <K extends keyof Vars>(key: K, value: Vars[K]) => void;

  // Basic request correlation.
  requestId: string;

  text: (body: string, init?: ResponseInit) => Response;
  html: (body: string, init?: ResponseInit) => Response;
  json: (body: unknown, init?: ResponseInit) => Response;

  query: (name: string) => string | null;
  queryAll: () => URLSearchParams;

  readText: () => Promise<string>;
  readJson: () => Promise<unknown>;
  readJsonParsed: <T>(parser: (u: unknown) => T) => Promise<T>;
  readJsonWith: <T>(schema: SchemaLike<T>) => Promise<T>;
  readFormData: () => Promise<FormData>;

  sse: <E extends SseEventMap>(
    producer: (
      session: SseSession<E>,
      c: HandlerCtx<Path, State, Vars>,
    ) => void | Promise<void>,
    opts?: Omit<SseOptions, "signal">,
  ) => Response;
};

export type Handler<
  Path extends string,
  State,
  Vars extends VarsRecord,
> = (
  c: HandlerCtx<Path, State, Vars>,
) => Response | Promise<Response>;

export type Middleware<State, Vars extends VarsRecord> = (
  c: HandlerCtx<string, State, Vars>,
  next: () => Promise<Response>,
) => Response | Promise<Response>;

export type RouteMiddleware<
  Path extends string,
  State,
  Vars extends VarsRecord,
> = (
  c: HandlerCtx<Path, State, Vars>,
  next: () => Promise<Response>,
) => Response | Promise<Response>;

type InternalRoute<State, Vars extends VarsRecord> = {
  method: HttpMethod;
  template: string;
  keys: string[];
  re: RegExp;
  handler: (
    req: Request,
    url: URL,
    params: AnyParams,
    state: State,
    vars: Vars,
    requestId: string,
  ) => Promise<Response>;
  meta?: RouteMeta;
  schemas?: RouteSchemas;
};

export type CompiledRoute<State, Vars extends VarsRecord> = InternalRoute<
  State,
  Vars
>;

export type RouteInfo = {
  method: HttpMethod;
  path: string;
  keys: string[];
  meta?: RouteMeta;
  schemas?: RouteSchemas;
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Compile a path template like:
 *   /users/:id
 *   /files/*path
 *   /orders/:id{[0-9]+}
 *
 * Supported patterns:
 * - :name          → single segment param
 * - :name{regex}   → single segment param with custom regex
 * - *rest          → wildcard capturing the rest of the path (must be last)
 */
const compilePath = (
  template: string,
): { re: RegExp; keys: string[] } => {
  const keys: string[] = [];
  const parts = template.split("/").filter((p) => p.length > 0);
  const reParts: string[] = [];
  let sawWildcard = false;

  parts.forEach((part, idx) => {
    // Wildcard: *rest
    if (part.startsWith("*")) {
      if (sawWildcard) {
        throw new Error(
          `Only one wildcard segment is allowed in path: ${template}`,
        );
      }
      if (idx !== parts.length - 1) {
        throw new Error(
          `Wildcard segment must be last in path: ${template}`,
        );
      }
      sawWildcard = true;
      const name = part.slice(1) || "wildcard";
      keys.push(name);
      reParts.push("(.*)");
      return;
    }

    // Param: :id or :id{[0-9]+}
    if (part.startsWith(":")) {
      const m = /^:([^{}]+)(?:\{(.+)\})?$/.exec(part);
      if (!m) {
        throw new Error(`Invalid param segment in path: ${part}`);
      }
      const [, name, pattern] = m;
      keys.push(name);
      const body = pattern ?? "[^/]+";
      reParts.push(`(${body})`);
      return;
    }

    // Literal
    reParts.push(escapeRe(part));
  });

  const re = new RegExp(`^/${reParts.join("/")}/?$`);
  return { re, keys };
};

const withBase = (base: string, path: string): string => {
  const b = base.endsWith("/") ? base.slice(0, -1) : base;
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!b) return p;
  return `${b}${p}`;
};

type JoinPath<Base extends string, Path extends string> = `${Base}${Path extends
  `/${string}` ? Path : `/${Path}`}`;

const genRequestId = () => (globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

/**
 * Middleware helper: enable basic observability hooks with minimal boilerplate.
 * Usage:
 *   app.use(observe({ onResponse: (c,r,ms) => ... }))
 */
export const observe = <State, Vars extends VarsRecord>(
  hooks: ObservabilityHooks<Vars>,
): Middleware<State, Vars> =>
async (c, next) => {
  const t0 = performance.now();
  try {
    hooks.onRequest?.(c as unknown as HandlerCtx<string, VarsRecord, Vars>);
    const r = await next();
    const ms = performance.now() - t0;
    hooks.onResponse?.(
      c as unknown as HandlerCtx<string, VarsRecord, Vars>,
      r,
      ms,
    );
    return r;
  } catch (err) {
    hooks.onError?.(
      c as unknown as HandlerCtx<string, VarsRecord, Vars>,
      err,
    );
    throw err;
  }
};

/* =========================
 * Middleware composition helpers
 * ========================= */

export const composeMiddleware = <State, Vars extends VarsRecord>(
  ...mws: Middleware<State, Vars>[]
): Middleware<State, Vars> =>
(c, next) => {
  const run = (i: number): Promise<Response> => {
    if (i >= mws.length) return next();
    return Promise.resolve(mws[i](c, () => run(i + 1)));
  };
  return run(0);
};

/* =========================
 * Application state semantics (explicit)
 * ========================= */

export type StateStrategy = "shared" | "snapshot" | "factory";

export type StateProvider<State> = {
  readonly strategy: StateStrategy;
  getState: (req: Request) => State;
};

const defaultClone = <T>(v: T): T => {
  try {
    // deno-lint-ignore no-explicit-any
    return structuredClone(v as any);
  } catch {
    return JSON.parse(JSON.stringify(v)) as T;
  }
};

export class Application<
  State extends Record<string, unknown> = EmptyRecord,
  Vars extends VarsRecord = EmptyRecord,
> {
  readonly #routes: InternalRoute<State, Vars>[] = [];
  readonly #mw: Array<{ base: string; fn: Middleware<State, Vars> }> = [];
  readonly #stateProvider: StateProvider<State>;
  #onErrorHandler?: (
    err: unknown,
    c: HandlerCtx<string, State, Vars>,
  ) => Response | Promise<Response>;
  #notFoundHandler?: Handler<string, State, Vars>;

  private constructor(stateProvider: StateProvider<State>) {
    this.#stateProvider = stateProvider;
  }

  static sharedState<
    State extends Record<string, unknown> = EmptyRecord,
    Vars extends VarsRecord = EmptyRecord,
  >(state: State): Application<State, Vars> {
    return new Application<State, Vars>({
      strategy: "shared",
      getState: () => state,
    });
  }

  static snapshotState<
    State extends Record<string, unknown> = EmptyRecord,
    Vars extends VarsRecord = EmptyRecord,
  >(
    state: State,
    opts?: { clone?: (v: State) => State },
  ): Application<State, Vars> {
    const clone = opts?.clone ?? defaultClone;
    return new Application<State, Vars>({
      strategy: "snapshot",
      getState: () => clone(state),
    });
  }

  static stateFactory<
    State extends Record<string, unknown> = EmptyRecord,
    Vars extends VarsRecord = EmptyRecord,
  >(factory: (req: Request) => State): Application<State, Vars> {
    return new Application<State, Vars>({
      strategy: "factory",
      getState: (req) => factory(req),
    });
  }

  stateSemantics(): StateStrategy {
    return this.#stateProvider.strategy;
  }

  // If you want typed vars, do:
  //   const app = Application.sharedState(state).withVars<{ userId: string }>()
  withVars<More extends VarsRecord>(): Application<State, Vars & More> {
    return this as unknown as Application<State, Vars & More>;
  }

  use(fn: Middleware<State, Vars>): this;
  use<Base extends string>(base: Base, fn: Middleware<State, Vars>): this;
  use(a: string | Middleware<State, Vars>, b?: Middleware<State, Vars>): this {
    if (typeof a === "function") {
      this.#mw.push({ base: "", fn: a });
      return this;
    }
    if (typeof b !== "function") {
      throw new Error("use(base, fn) requires a function");
    }
    this.#mw.push({ base: a, fn: b });
    return this;
  }

  /**
   * Set a global error handler that receives any thrown error and
   * the current request context, and returns a Response.
   */
  onError(
    fn: (
      err: unknown,
      c: HandlerCtx<string, State, Vars>,
    ) => Response | Promise<Response>,
  ): this {
    this.#onErrorHandler = fn;
    return this;
  }

  /**
   * Set a global not-found handler for unmatched routes.
   */
  notFound(handler: Handler<string, State, Vars>): this {
    this.#notFoundHandler = handler;
    return this;
  }

  /**
   * Mount a child Application under a base path. The child Application
   * has its own state semantics and routes; the base path is stripped
   * from the URL path before dispatching to the child.
   */
  mount(base: string, child: Application<State, Vars>): this {
    const baseNorm = base.endsWith("/") ? base.slice(0, -1) : base;
    if (!baseNorm) {
      throw new Error("mount(base, child) requires non-empty base path");
    }

    this.use(baseNorm, async (c, _next) => {
      const url = new URL(c.req.url);
      if (!url.pathname.startsWith(baseNorm)) {
        return methodNotAllowed(url.pathname, "");
      }
      url.pathname = url.pathname.slice(baseNorm.length) || "/";
      const req2 = new Request(url.toString(), c.req);
      return await child.fetch(req2);
    });

    return this;
  }

  /* ============
   * Route verbs
   * ============
   *
   * Variants:
   * - app.get("/x", handler)
   * - app.get("/x", mw1, mw2, handler)
   * - app.get("/x", config, handler)
   */

  get<Path extends string>(
    path: Path,
    handler: Handler<Path, State, Vars>,
  ): this;
  get<Path extends string>(
    path: Path,
    ...handlers: [
      ...RouteMiddleware<Path, State, Vars>[],
      Handler<
        Path,
        State,
        Vars
      >,
    ]
  ): this;
  get<Path extends string>(
    path: Path,
    config: RouteConfig,
    handler: Handler<Path, State, Vars>,
  ): this;
  get<Path extends string>(path: Path, ...args: unknown[]): this {
    return this.#routeWithVerb("GET", path, args);
  }

  post<Path extends string>(
    path: Path,
    handler: Handler<Path, State, Vars>,
  ): this;
  post<Path extends string>(
    path: Path,
    ...handlers: [
      ...RouteMiddleware<Path, State, Vars>[],
      Handler<
        Path,
        State,
        Vars
      >,
    ]
  ): this;
  post<Path extends string>(
    path: Path,
    config: RouteConfig,
    handler: Handler<Path, State, Vars>,
  ): this;
  post<Path extends string>(path: Path, ...args: unknown[]): this {
    return this.#routeWithVerb("POST", path, args);
  }

  put<Path extends string>(
    path: Path,
    handler: Handler<Path, State, Vars>,
  ): this;
  put<Path extends string>(
    path: Path,
    ...handlers: [
      ...RouteMiddleware<Path, State, Vars>[],
      Handler<
        Path,
        State,
        Vars
      >,
    ]
  ): this;
  put<Path extends string>(
    path: Path,
    config: RouteConfig,
    handler: Handler<Path, State, Vars>,
  ): this;
  put<Path extends string>(path: Path, ...args: unknown[]): this {
    return this.#routeWithVerb("PUT", path, args);
  }

  patch<Path extends string>(
    path: Path,
    handler: Handler<Path, State, Vars>,
  ): this;
  patch<Path extends string>(
    path: Path,
    ...handlers: [
      ...RouteMiddleware<Path, State, Vars>[],
      Handler<
        Path,
        State,
        Vars
      >,
    ]
  ): this;
  patch<Path extends string>(
    path: Path,
    config: RouteConfig,
    handler: Handler<Path, State, Vars>,
  ): this;
  patch<Path extends string>(path: Path, ...args: unknown[]): this {
    return this.#routeWithVerb("PATCH", path, args);
  }

  delete<Path extends string>(
    path: Path,
    handler: Handler<Path, State, Vars>,
  ): this;
  delete<Path extends string>(
    path: Path,
    ...handlers: [
      ...RouteMiddleware<Path, State, Vars>[],
      Handler<
        Path,
        State,
        Vars
      >,
    ]
  ): this;
  delete<Path extends string>(
    path: Path,
    config: RouteConfig,
    handler: Handler<Path, State, Vars>,
  ): this;
  delete<Path extends string>(path: Path, ...args: unknown[]): this {
    return this.#routeWithVerb("DELETE", path, args);
  }

  all<Path extends string>(
    path: Path,
    handler: Handler<Path, State, Vars>,
  ): this;
  all<Path extends string>(
    path: Path,
    ...handlers: [
      ...RouteMiddleware<Path, State, Vars>[],
      Handler<
        Path,
        State,
        Vars
      >,
    ]
  ): this;
  all<Path extends string>(
    path: Path,
    config: RouteConfig,
    handler: Handler<Path, State, Vars>,
  ): this;
  all<Path extends string>(path: Path, ...args: unknown[]): this {
    const methods: HttpMethod[] = [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
      "HEAD",
    ];
    for (const m of methods) {
      this.#routeWithVerb(m, path, args);
    }
    return this;
  }

  route<Base extends string>(
    base: Base,
    fn: (r: RouteBuilder<State, Vars, Base>) => void,
  ): this {
    fn(new RouteBuilder<State, Vars, Base>(this, base));
    return this;
  }

  /**
   * Introspect all registered routes (method, path, keys, meta, schemas).
   */
  routes(): RouteInfo[] {
    return this.#routes.map((r) => ({
      method: r.method,
      path: r.template,
      keys: [...r.keys],
      meta: r.meta,
      schemas: r.schemas,
    }));
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const method = req.method.toUpperCase() as HttpMethod;
    const path = url.pathname;

    const match = this.#match(method, path);
    const params = match?.params ?? ({} as AnyParams);

    const mw = this.#mw
      .filter((m) =>
        path === m.base ||
        (m.base &&
          path.startsWith(m.base.endsWith("/") ? m.base : `${m.base}/`)) ||
        m.base === ""
      )
      .map((m) => m.fn);

    const requestId = genRequestId();
    const vars = Object.create(null) as Vars;
    const state = this.#stateProvider.getState(req);

    const dispatch = (): Promise<Response> => {
      if (match) {
        return match.route.handler(
          req,
          url,
          match.params,
          state,
          vars,
          requestId,
        );
      }

      const allow = this.#allowList(path);
      if (allow) return Promise.resolve(methodNotAllowed(path, allow));

      if (this.#notFoundHandler) {
        const ctx = this.#ctx(
          req,
          url,
          {} as AnyParams,
          state,
          vars,
          requestId,
        ) as HandlerCtx<string, State, Vars>;
        return Promise.resolve(this.#notFoundHandler(ctx));
      }

      return Promise.resolve(
        textResponse(`Not found: ${req.method} ${path}`, 404),
      );
    };

    const run = (i: number): Promise<Response> => {
      if (i >= mw.length) return dispatch();
      const ctx = this.#ctx(
        req,
        url,
        params,
        state,
        vars,
        requestId,
      );
      const fn = mw[i];
      return Promise.resolve(fn(ctx, () => run(i + 1)));
    };

    try {
      return await run(0);
    } catch (err) {
      if (this.#onErrorHandler) {
        const ctx = this.#ctx(
          req,
          url,
          params,
          state,
          vars,
          requestId,
        ) as HandlerCtx<string, State, Vars>;
        try {
          return await this.#onErrorHandler(err, ctx);
        } catch {
          return textResponse("Internal Server Error", 500);
        }
      }
      throw err;
    }
  }

  serve(
    options?: Pick<
      Parameters<typeof Deno.serve>[0],
      "port" | "hostname" | "onListen"
    >,
  ): void {
    Deno.serve(options ?? {}, (req) => this.fetch(req));
  }

  #allowList(path: string): string {
    const methods = new Set<HttpMethod>();
    for (const r of this.#routes) {
      if (path.match(r.re)) methods.add(r.method);
    }
    return Array.from(methods).sort().join(", ");
  }

  #match(
    method: HttpMethod,
    path: string,
  ): { route: InternalRoute<State, Vars>; params: AnyParams } | null {
    for (const r of this.#routes) {
      if (r.method !== method) continue;
      const m = path.match(r.re);
      if (!m) continue;
      const params: AnyParams = {};
      for (let i = 0; i < r.keys.length; i++) {
        params[r.keys[i]] = decodeURIComponent(m[i + 1] ?? "");
      }
      return { route: r, params };
    }
    return null;
  }

  #ctx(
    req: Request,
    url: URL,
    params: AnyParams,
    state: State,
    vars: Vars,
    requestId: string,
  ): HandlerCtx<string, State, Vars> {
    const initWith = (init?: ResponseInit) => init ?? {};
    return {
      req,
      url,
      params,
      state,

      vars,
      getVar: (k) => vars[k],
      setVar: (k, v) => {
        vars[k] = v;
      },

      requestId,

      text: (body, init) =>
        textResponse(
          body,
          initWith(init).status ?? 200,
          initWith(init).headers,
        ),
      html: (body, init) =>
        htmlResponse(
          body,
          initWith(init).status ?? 200,
          initWith(init).headers,
        ),
      json: (body, init) =>
        jsonResponse(
          body,
          initWith(init).status ?? 200,
          initWith(init).headers,
        ),

      query: (name) => url.searchParams.get(name),
      queryAll: () => url.searchParams,

      readText: async () => await req.text(),
      readJson: async () => (await req.json()) as unknown,
      readJsonParsed: async <T>(parser: (u: unknown) => T) => {
        const u = (await req.json()) as unknown;
        return parser(u);
      },
      readJsonWith: async <T>(schema: SchemaLike<T>) => {
        const u = (await req.json()) as unknown;
        return schema.parse(u);
      },
      readFormData: async () => await req.formData(),

      sse: <E extends SseEventMap>(
        producer: (
          session: SseSession<E>,
          c: HandlerCtx<string, State, Vars>,
        ) => void | Promise<void>,
        opts?: Omit<SseOptions, "signal">,
      ) => {
        const session = sseSession<E>({ ...(opts ?? {}), signal: req.signal });
        void (async () => {
          try {
            await session.ready;
            await producer(
              session,
              this.#ctx(req, url, params, state, vars, requestId),
            );
          } catch (err) {
            const e = asError(err);
            session.error(`SSE producer error: ${e.message}`);
            session.close();
          }
        })();
        return session.response;
      },
    };
  }

  #routeWithVerb<Path extends string, M extends HttpMethod>(
    method: M,
    path: Path,
    args: unknown[],
  ): this {
    if (args.length === 0) {
      throw new Error(`${method}(${path}) requires a handler`);
    }

    const first = args[0];

    // get(path, handler) or get(path, mw1, ..., handler)
    if (typeof first === "function") {
      const last = args[args.length - 1];
      if (typeof last !== "function") {
        throw new Error(
          `${method}(${path}) requires a final handler function`,
        );
      }
      const mws = args.slice(0, -1) as RouteMiddleware<Path, State, Vars>[];
      const handler = last as Handler<Path, State, Vars>;
      return this.#add(method, path, handler, undefined, mws);
    }

    // get(path, config, handler)
    const config = first as RouteConfig;
    if (args.length !== 2 || typeof args[1] !== "function") {
      throw new Error(
        `${method}(${path}) with config requires (config, handler)`,
      );
    }
    const handler = args[1] as Handler<Path, State, Vars>;
    return this.#add(method, path, handler, config, []);
  }

  #add<M extends HttpMethod, Path extends string>(
    method: M,
    path: Path,
    h: Handler<Path, State, Vars>,
    config?: RouteConfig,
    routeMws?: RouteMiddleware<Path, State, Vars>[],
  ): this {
    const p = path.startsWith("/") ? path : `/${path}`;
    const { re, keys } = compilePath(p);

    const handler = async (
      req: Request,
      url: URL,
      params: AnyParams,
      state: State,
      vars: Vars,
      requestId: string,
    ) => {
      const ctx = this.#ctx(
        req,
        url,
        params,
        state,
        vars,
        requestId,
      ) as unknown as HandlerCtx<
        Path,
        State,
        Vars
      >;

      const routeChain = async (i: number): Promise<Response> => {
        if (!routeMws || i >= routeMws.length) {
          return await h(ctx);
        }
        const mw = routeMws[i];
        return await mw(ctx, () => routeChain(i + 1));
      };

      return await routeChain(0);
    };

    this.#routes.push({
      method,
      template: p,
      keys,
      re,
      handler,
      meta: config?.meta,
      schemas: config?.schemas,
    });
    return this;
  }
}

export class RouteBuilder<
  State extends Record<string, unknown>,
  Vars extends VarsRecord,
  Base extends string,
> {
  constructor(private app: Application<State, Vars>, private base: Base) {}

  get<Path extends string>(
    path: Path,
    h: Handler<JoinPath<Base, Path>, State, Vars>,
  ): this {
    const full = withBase(this.base, path) as JoinPath<Base, Path>;
    this.app.get(full, h);
    return this;
  }
  post<Path extends string>(
    path: Path,
    h: Handler<JoinPath<Base, Path>, State, Vars>,
  ): this {
    const full = withBase(this.base, path) as JoinPath<Base, Path>;
    this.app.post(full, h);
    return this;
  }
  put<Path extends string>(
    path: Path,
    h: Handler<JoinPath<Base, Path>, State, Vars>,
  ): this {
    const full = withBase(this.base, path) as JoinPath<Base, Path>;
    this.app.put(full, h);
    return this;
  }
  patch<Path extends string>(
    path: Path,
    h: Handler<JoinPath<Base, Path>, State, Vars>,
  ): this {
    const full = withBase(this.base, path) as JoinPath<Base, Path>;
    this.app.patch(full, h);
    return this;
  }
  delete<Path extends string>(
    path: Path,
    h: Handler<JoinPath<Base, Path>, State, Vars>,
  ): this {
    const full = withBase(this.base, path) as JoinPath<Base, Path>;
    this.app.delete(full, h);
    return this;
  }
}

/* =========================
 * 404 helper (kept)
 * ========================= */

export const notFoundPureTsUi = (req: Request, hintRoutes: string[]) => {
  const url = new URL(req.url);
  const looksStatic = req.method === "GET" &&
    (url.pathname.endsWith(".js") ||
      url.pathname.endsWith(".css") ||
      url.pathname.endsWith(".map") ||
      url.pathname.endsWith(".html"));

  if (looksStatic) {
    return textResponse(
      [
        "Not found.",
        "",
        "This server does not serve static files from disk.",
        "All browser assets must be requested as bundled modules.",
        "",
        "Known module endpoints:",
        ...hintRoutes.map((r) => `  ${r}`),
        "",
        `Requested: ${req.method} ${url.pathname}`,
      ].join("\n"),
      404,
    );
  }

  return textResponse(`Not found: ${req.method} ${url.pathname}`, 404);
};

/* =========================
 * Convenience helpers: JSON routes, CORS, request-id, logger
 * ========================= */

export const postJson = <
  State extends Record<string, unknown>,
  Vars extends VarsRecord,
  Path extends string,
  Body,
>(
  app: Application<State, Vars>,
  path: Path,
  schema: SchemaLike<Body>,
  handler: (
    c: HandlerCtx<Path, State, Vars>,
    body: Body,
  ) => Response | Promise<Response>,
): void => {
  app.post(path, async (c) => {
    const body = await c.readJsonWith(schema);
    return await handler(
      c as unknown as HandlerCtx<Path, State, Vars>,
      body,
    );
  });
};

export const putJson = <
  State extends Record<string, unknown>,
  Vars extends VarsRecord,
  Path extends string,
  Body,
>(
  app: Application<State, Vars>,
  path: Path,
  schema: SchemaLike<Body>,
  handler: (
    c: HandlerCtx<Path, State, Vars>,
    body: Body,
  ) => Response | Promise<Response>,
): void => {
  app.put(path, async (c) => {
    const body = await c.readJsonWith(schema);
    return await handler(
      c as unknown as HandlerCtx<Path, State, Vars>,
      body,
    );
  });
};

// If you prefer methods, you can use these wrappers:
Application.prototype.postJson = function <
  Path extends string,
  Body,
>(
  this: Application<Any, Any>,
  path: Path,
  schema: SchemaLike<Body>,
  handler: (
    c: HandlerCtx<Path, Any, Any>,
    body: Body,
  ) => Response | Promise<Response>,
): Application<Any, Any> {
  postJson(this, path, schema, handler);
  return this;
} as Any;

Application.prototype.putJson = function <
  Path extends string,
  Body,
>(
  this: Application<Any, Any>,
  path: Path,
  schema: SchemaLike<Body>,
  handler: (
    c: HandlerCtx<Path, Any, Any>,
    body: Body,
  ) => Response | Promise<Response>,
): Application<Any, Any> {
  putJson(this, path, schema, handler);
  return this;
} as Any;

declare module "./http.ts" {
  interface Application<State, Vars extends VarsRecord> {
    postJson<
      Path extends string,
      Body,
    >(
      path: Path,
      schema: SchemaLike<Body>,
      handler: (
        c: HandlerCtx<Path, State, Vars>,
        body: Body,
      ) => Response | Promise<Response>,
    ): this;

    putJson<
      Path extends string,
      Body,
    >(
      path: Path,
      schema: SchemaLike<Body>,
      handler: (
        c: HandlerCtx<Path, State, Vars>,
        body: Body,
      ) => Response | Promise<Response>,
    ): this;
  }
}

export type CorsOptions = {
  origin?: string;
  methods?: HttpMethod[];
  headers?: string[];
  allowCredentials?: boolean;
  maxAgeSeconds?: number;
};

export const cors = <State, Vars extends VarsRecord>(
  opts: CorsOptions = {},
): Middleware<State, Vars> =>
async (c, next) => {
  const origin = opts.origin ?? "*";
  const methods = opts.methods ?? [
    "GET",
    "HEAD",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ];
  const headers = opts.headers ?? ["Content-Type", "Authorization"];

  if (c.req.method === "OPTIONS") {
    const h = new Headers();
    h.set("access-control-allow-origin", origin);
    h.set("access-control-allow-methods", methods.join(", "));
    h.set("access-control-allow-headers", headers.join(", "));
    if (opts.allowCredentials) {
      h.set("access-control-allow-credentials", "true");
    }
    if (opts.maxAgeSeconds != null) {
      h.set("access-control-max-age", String(opts.maxAgeSeconds));
    }
    return new Response(null, { status: 204, headers: h });
  }

  const res = await next();
  const h = new Headers(res.headers);
  h.set("access-control-allow-origin", origin);
  if (opts.allowCredentials) {
    h.set("access-control-allow-credentials", "true");
  }
  return new Response(res.body, { status: res.status, headers: h });
};

export const requestIdHeader = <State, Vars extends VarsRecord>(): Middleware<
  State,
  Vars
> =>
async (c, next) => {
  const res = await next();
  const h = new Headers(res.headers);
  h.set("x-request-id", c.requestId);
  return new Response(res.body, { status: res.status, headers: h });
};

// Basic request logger (method, path, status, ms, requestId).
export const logger = <State, Vars extends VarsRecord>(): Middleware<
  State,
  Vars
> =>
async (c, next) => {
  const start = performance.now();
  const method = c.req.method;
  const { pathname } = c.url;
  try {
    const res = await next();
    const ms = (performance.now() - start).toFixed(1);
    // eslint-disable-next-line no-console
    console.log(
      `[${c.requestId}] ${method} ${pathname} -> ${res.status} ${ms}ms`,
    );
    return res;
  } catch (err) {
    const ms = (performance.now() - start).toFixed(1);
    // eslint-disable-next-line no-console
    console.error(
      `[${c.requestId}] ${method} ${pathname} ERROR ${ms}ms`,
      err,
    );
    throw err;
  }
};
