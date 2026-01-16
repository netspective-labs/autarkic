// lib/continuux/http.ts
/**
 * ContinuUX HTTP utilities (server-side) for pure TypeScript web UIs.
 *
 * What this module gives you:
 * - Small response helpers (html/js/text/json)
 * - In-memory module bundling (Deno.bundle) with caching
 * - SSE helpers (safe on disconnect, type-safe events, abort-aware)
 * - A tiny Hono-inspired router with full type inference (no "GET /x" key strings)
 * - Typed per-request vars (middleware-friendly) + basic observability hooks
 *
 * Important: Application state semantics are explicit.
 * You must choose one of these when creating an Application:
 * - sharedState(state): every request sees the same object reference (mutations persist)
 * - snapshotState(state): each request receives a cloned snapshot (mutations do NOT persist)
 * - stateFactory(fn): each request receives state produced by a factory (request-scoped, etc.)
 *
 * This prevents the classic confusion of “does c.state persist between requests?”
 */

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

/* =========================
 * small internal helpers
 * ========================= */

export type EmptyRecord = Record<PropertyKey, never>;
export type AnyParams = Record<string, string>;
export type VarsRecord = Record<string, unknown>;

const asError = (err: unknown) =>
  err instanceof Error ? err : new Error(String(err));

const stackIfAny = (err: Error) => (err.stack ? `\n\n${err.stack}` : "");

/* =========================
 * in-memory bundling
 * ========================= */

export type BundleOptions = {
  cacheKey?: string;
  minify?: boolean;
  cacheControl?: string; // default "no-store"
};

export type BundleOk = { ok: true; js: string; cacheKey: string };
export type BundleErr = {
  ok: false;
  status: number;
  message: string;
  details?: string;
};
export type BundleResult = BundleOk | BundleErr;

export type InMemoryBundlerConfig = {
  defaultMinify?: boolean;
};

export class InMemoryBundler {
  readonly #cache = new Map<string, string>();
  readonly #defaultMinify: boolean;

  constructor(cfg: InMemoryBundlerConfig = {}) {
    this.#defaultMinify = cfg.defaultMinify ?? true;
  }

  get cacheSize(): number {
    return this.#cache.size;
  }

  clearCache(): void {
    this.#cache.clear();
  }

  prime(cacheKey: string, js: string): void {
    this.#cache.set(cacheKey, js);
  }

  peek(cacheKey: string): string | undefined {
    return this.#cache.get(cacheKey);
  }

  async bundle(entry: string, opts: BundleOptions = {}): Promise<BundleResult> {
    const cacheKey = opts.cacheKey ?? entry;
    const cached = this.#cache.get(cacheKey);
    if (cached) return { ok: true, js: cached, cacheKey };

    let result: Awaited<ReturnType<typeof Deno.bundle>>;
    try {
      result = await Deno.bundle({
        entrypoints: [entry],
        outputDir: "dist",
        platform: "browser",
        minify: opts.minify ?? this.#defaultMinify,
        write: false,
      });
    } catch (err) {
      const e = asError(err);
      return {
        ok: false,
        status: 500,
        message:
          `Bundle error: Deno.bundle failed\n\nEntry:\n${entry}\n\n${e.message}${
            stackIfAny(e)
          }`,
      };
    }

    const outputs = result.outputFiles ?? [];
    if (outputs.length === 0) {
      return {
        ok: false,
        status: 500,
        message:
          `Bundle error: no output files produced\n\nEntry:\n${entry}\n\nTip: verify the module exists and that imports resolve.`,
      };
    }

    const jsFile = outputs.find((f) => f.path.endsWith(".js")) ?? outputs[0];
    const jsText = jsFile?.text?.() ?? "";
    if (!jsText.trim()) {
      return {
        ok: false,
        status: 500,
        message:
          `Bundle error: JavaScript output is empty\n\nEntry:\n${entry}\n\nTip: check import graph and bundler errors.`,
      };
    }

    this.#cache.set(cacheKey, jsText);
    return { ok: true, js: jsText, cacheKey };
  }

  async jsModuleResponse(
    entry: string,
    opts: BundleOptions = {},
  ): Promise<Response> {
    const r = await this.bundle(entry, opts);
    if (!r.ok) return textResponse(r.message, r.status);
    const cc = opts.cacheControl ?? "no-store";
    return jsResponse(r.js, cc);
  }
}

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

type ExtractParamName<S extends string> = S extends
  `${string}:${infer P}/${infer Rest}` ? P | ExtractParamName<`/${Rest}`>
  : S extends `${string}:${infer P}` ? P
  : never;

export type ParamsOf<Path extends string> = IsWideString<Path> extends true
  ? AnyParams
  : [ExtractParamName<Path>] extends [never] ? EmptyRecord
  : { [K in ExtractParamName<Path>]: string };

export type SchemaLike<T> = { parse: (u: unknown) => T };

export type ObservabilityHooks<V extends VarsRecord> = {
  onRequest?: (c: HandlerCtx<string, VarsRecord, V>) => void;
  onResponse?: (
    c: HandlerCtx<string, VarsRecord, V>,
    r: Response,
    ms: number,
  ) => void;
  onError?: (c: HandlerCtx<string, VarsRecord, V>, err: unknown) => void;
};

type HandlerCtx<Path extends string, State, Vars extends VarsRecord> = {
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

type Middleware<State, Vars extends VarsRecord> = (
  c: HandlerCtx<string, State, Vars>,
  next: () => Promise<Response>,
) => Response | Promise<Response>;

type CompiledRoute<State, Vars extends VarsRecord> = {
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
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const compilePath = (template: string): { re: RegExp; keys: string[] } => {
  const keys: string[] = [];
  const parts = template.split("/").filter((p) => p.length > 0);
  const reParts = parts.map((p) => {
    if (p.startsWith(":")) {
      keys.push(p.slice(1));
      return "([^/]+)";
    }
    return escapeRe(p);
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
    hooks.onError?.(c as unknown as HandlerCtx<string, VarsRecord, Vars>, err);
    throw err;
  }
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
  readonly #routes: CompiledRoute<State, Vars>[] = [];
  readonly #mw: Array<{ base: string; fn: Middleware<State, Vars> }> = [];
  readonly #stateProvider: StateProvider<State>;

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

  get<Path extends string>(path: Path, h: Handler<Path, State, Vars>): this {
    return this.#add("GET", path, h);
  }
  post<Path extends string>(path: Path, h: Handler<Path, State, Vars>): this {
    return this.#add("POST", path, h);
  }
  put<Path extends string>(path: Path, h: Handler<Path, State, Vars>): this {
    return this.#add("PUT", path, h);
  }
  patch<Path extends string>(path: Path, h: Handler<Path, State, Vars>): this {
    return this.#add("PATCH", path, h);
  }
  delete<Path extends string>(path: Path, h: Handler<Path, State, Vars>): this {
    return this.#add("DELETE", path, h);
  }

  all<Path extends string>(path: Path, h: Handler<Path, State, Vars>): this {
    this.#add("GET", path, h);
    this.#add("POST", path, h);
    this.#add("PUT", path, h);
    this.#add("PATCH", path, h);
    this.#add("DELETE", path, h);
    this.#add("OPTIONS", path, h);
    this.#add("HEAD", path, h);
    return this;
  }

  route<Base extends string>(
    base: Base,
    fn: (r: RouteBuilder<State, Vars, Base>) => void,
  ): this {
    fn(new RouteBuilder<State, Vars, Base>(this, base));
    return this;
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const method = req.method.toUpperCase() as HttpMethod;
    const path = url.pathname;

    const match = this.#match(method, path);
    if (!match) {
      const allow = this.#allowList(path);
      if (allow) return methodNotAllowed(path, allow);
      return textResponse(`Not found: ${req.method} ${path}`, 404);
    }

    const { route, params } = match;

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

    // Explicit, per-request state creation.
    const state = this.#stateProvider.getState(req);

    const run = (i: number): Promise<Response> => {
      if (i >= mw.length) {
        return route.handler(req, url, params, state, vars, requestId);
      }
      const ctx = this.#ctx(req, url, params, state, vars, requestId);
      const fn = mw[i];
      return Promise.resolve(fn(ctx, () => run(i + 1)));
    };

    return await run(0);
  }

  serve(options?: Deno.ServeOptions): void {
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
  ): { route: CompiledRoute<State, Vars>; params: AnyParams } | null {
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

  #add<M extends HttpMethod, Path extends string>(
    method: M,
    path: Path,
    h: Handler<Path, State, Vars>,
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
      return await h(ctx);
    };

    this.#routes.push({ method, template: p, keys, re, handler });
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
