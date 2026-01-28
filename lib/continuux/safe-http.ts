// lib/continuux/safe-http.ts
import type {
  Application,
  EmptyRecord,
  Handler,
  HttpMethod,
  ParamsOf,
  RouteMiddleware,
  VarsRecord,
} from "./http.ts";

/**
 * Branded string so it can be used anywhere a string is expected, while still
 * carrying a type signal that it came from safe-http.
 */
export type SafeHref = string & { readonly __safeHrefBrand: unique symbol };

export type HrefQueryValue = string | number | boolean | null | undefined;

export type HrefOptions = {
  readonly query?: Readonly<Record<string, HrefQueryValue>>;
  readonly hash?: string; // with or without leading '#'
};

export type SafeHttpOptions = {
  /**
   * If hosted under a sub-path (e.g. "/ui"), this prefix is prepended in href()
   * and stripped in parse(). Use "" or "/" for root.
   */
  readonly sitePrefix?: string;
};

type RouteElabRecord = Record<string, unknown>;

export type RouteMatch<Id extends string> = {
  readonly id: Id;
  readonly params: Record<string, string>;
};

const asSafeHref = (s: string): SafeHref => s as SafeHref;

const normalizePrefix = (sitePrefix?: string) => {
  const p = (sitePrefix ?? "").trim();
  if (!p || p === "/") return "";
  const noTrail = p.replace(/\/+$/g, "");
  return noTrail.startsWith("/") ? noTrail : `/${noTrail}`;
};

const joinPath = (prefix: string, path: string) => {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!prefix) return p;
  return `${prefix}${p}`;
};

const encodeQuery = (q?: Readonly<Record<string, HrefQueryValue>>) => {
  if (!q) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v == null) continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
};

const encodeHash = (hash?: string) => {
  if (!hash) return "";
  const h = hash.startsWith("#") ? hash.slice(1) : hash;
  return h ? `#${h}` : "";
};

const stripConstraint = (seg: string) => {
  const i = seg.indexOf("{");
  return i >= 0 ? seg.slice(0, i) : seg;
};

const fillTemplate = (template: string, params: Record<string, string>) => {
  const parts = template.split("/").filter((p) => p.length > 0);
  const out: string[] = [];

  for (const part of parts) {
    if (part.startsWith("*")) {
      const name = part.slice(1) || "wildcard";
      const v = params[name];
      if (v == null) {
        throw new Error(`Missing wildcard "${name}" for "${template}"`);
      }
      out.push(...v.split("/").map(encodeURIComponent));
      continue;
    }

    if (part.startsWith(":")) {
      const raw = part.slice(1);
      const name = stripConstraint(raw);
      const v = params[name];
      if (v == null) {
        throw new Error(`Missing param "${name}" for "${template}"`);
      }
      out.push(encodeURIComponent(v));
      continue;
    }

    out.push(part);
  }

  return `/${out.join("/")}`;
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const compileTemplate = (template: string) => {
  const keys: string[] = [];
  const parts = template.split("/").filter((p) => p.length > 0);
  const reParts: string[] = [];
  let sawWildcard = false;

  parts.forEach((part, idx) => {
    if (part.startsWith("*")) {
      if (sawWildcard) {
        throw new Error(`Only one wildcard segment allowed: ${template}`);
      }
      if (idx !== parts.length - 1) {
        throw new Error(`Wildcard must be last: ${template}`);
      }
      sawWildcard = true;
      const name = part.slice(1) || "wildcard";
      keys.push(name);
      reParts.push("(.*)");
      return;
    }

    if (part.startsWith(":")) {
      const m = /^:([^{}]+)(?:\{(.+)\})?$/.exec(part);
      if (!m) throw new Error(`Invalid param segment "${part}" in ${template}`);
      const [, name, pattern] = m;
      keys.push(name);
      reParts.push(`(${pattern ?? "[^/]+"})`);
      return;
    }

    reParts.push(escapeRe(part));
  });

  const re = new RegExp(`^/${reParts.join("/")}/?$`);
  return { re, keys };
};

const decodeParams = (keys: string[], match: RegExpMatchArray) => {
  const params: Record<string, string> = {};
  for (let i = 0; i < keys.length; i++) {
    params[keys[i]] = decodeURIComponent(match[i + 1] ?? "");
  }
  return params;
};

type StoredRoute = {
  readonly method: HttpMethod;
  readonly template: string;
  readonly re: RegExp;
  readonly keys: string[];
};

export type SafeApplication<
  State extends Record<string, unknown>,
  Vars extends VarsRecord,
  KnownIds extends string,
  Elabs extends RouteElabRecord,
> = {
  readonly app: Application<State, Vars>;
  readonly sitePrefix: string;

  href<Id extends KnownIds>(
    id: Id,
    opts?: HrefOptions,
  ): ParamsOf<Id> extends EmptyRecord ? SafeHref : never;

  href<Id extends KnownIds>(
    id: Id,
    params: ParamsOf<Id>,
    opts?: HrefOptions,
  ): SafeHref;

  parse(pathOrUrl: string): RouteMatch<KnownIds> | null;

  ids(): ReadonlyArray<KnownIds>;
  elaboration<Id extends KnownIds>(id: Id): Elabs[Id] | undefined;

  assertNoDrift(): void;

  get<Path extends string, E = unknown>(
    path: Path,
    handler: Handler<Path, State, Vars>,
  ): SafeApplication<State, Vars, KnownIds | Path, Elabs & Record<Path, E>>;

  get<Path extends string, E>(
    path: Path,
    elaboration: E,
    handler: Handler<Path, State, Vars>,
  ): SafeApplication<State, Vars, KnownIds | Path, Elabs & Record<Path, E>>;

  get<Path extends string, E = unknown>(
    path: Path,
    ...handlers: [
      ...RouteMiddleware<Path, State, Vars>[],
      Handler<Path, State, Vars>,
    ]
  ): SafeApplication<State, Vars, KnownIds | Path, Elabs & Record<Path, E>>;

  get<Path extends string, E>(
    path: Path,
    elaboration: E,
    ...handlers: [
      ...RouteMiddleware<Path, State, Vars>[],
      Handler<Path, State, Vars>,
    ]
  ): SafeApplication<State, Vars, KnownIds | Path, Elabs & Record<Path, E>>;

  post<Path extends string, E = unknown>(
    path: Path,
    handler: Handler<Path, State, Vars>,
  ): SafeApplication<State, Vars, KnownIds | Path, Elabs & Record<Path, E>>;

  post<Path extends string, E>(
    path: Path,
    elaboration: E,
    handler: Handler<Path, State, Vars>,
  ): SafeApplication<State, Vars, KnownIds | Path, Elabs & Record<Path, E>>;

  post<Path extends string, E = unknown>(
    path: Path,
    ...handlers: [
      ...RouteMiddleware<Path, State, Vars>[],
      Handler<Path, State, Vars>,
    ]
  ): SafeApplication<State, Vars, KnownIds | Path, Elabs & Record<Path, E>>;

  post<Path extends string, E>(
    path: Path,
    elaboration: E,
    ...handlers: [
      ...RouteMiddleware<Path, State, Vars>[],
      Handler<Path, State, Vars>,
    ]
  ): SafeApplication<State, Vars, KnownIds | Path, Elabs & Record<Path, E>>;

  put<Path extends string, E = unknown>(
    path: Path,
    handler: Handler<Path, State, Vars>,
  ): SafeApplication<State, Vars, KnownIds | Path, Elabs & Record<Path, E>>;

  put<Path extends string, E>(
    path: Path,
    elaboration: E,
    handler: Handler<Path, State, Vars>,
  ): SafeApplication<State, Vars, KnownIds | Path, Elabs & Record<Path, E>>;

  put<Path extends string, E = unknown>(
    path: Path,
    ...handlers: [
      ...RouteMiddleware<Path, State, Vars>[],
      Handler<Path, State, Vars>,
    ]
  ): SafeApplication<State, Vars, KnownIds | Path, Elabs & Record<Path, E>>;

  put<Path extends string, E>(
    path: Path,
    elaboration: E,
    ...handlers: [
      ...RouteMiddleware<Path, State, Vars>[],
      Handler<Path, State, Vars>,
    ]
  ): SafeApplication<State, Vars, KnownIds | Path, Elabs & Record<Path, E>>;

  patch<Path extends string, E = unknown>(
    path: Path,
    handler: Handler<Path, State, Vars>,
  ): SafeApplication<State, Vars, KnownIds | Path, Elabs & Record<Path, E>>;

  patch<Path extends string, E>(
    path: Path,
    elaboration: E,
    handler: Handler<Path, State, Vars>,
  ): SafeApplication<State, Vars, KnownIds | Path, Elabs & Record<Path, E>>;

  patch<Path extends string, E = unknown>(
    path: Path,
    ...handlers: [
      ...RouteMiddleware<Path, State, Vars>[],
      Handler<Path, State, Vars>,
    ]
  ): SafeApplication<State, Vars, KnownIds | Path, Elabs & Record<Path, E>>;

  patch<Path extends string, E>(
    path: Path,
    elaboration: E,
    ...handlers: [
      ...RouteMiddleware<Path, State, Vars>[],
      Handler<Path, State, Vars>,
    ]
  ): SafeApplication<State, Vars, KnownIds | Path, Elabs & Record<Path, E>>;

  delete<Path extends string, E = unknown>(
    path: Path,
    handler: Handler<Path, State, Vars>,
  ): SafeApplication<State, Vars, KnownIds | Path, Elabs & Record<Path, E>>;

  delete<Path extends string, E>(
    path: Path,
    elaboration: E,
    handler: Handler<Path, State, Vars>,
  ): SafeApplication<State, Vars, KnownIds | Path, Elabs & Record<Path, E>>;

  delete<Path extends string, E = unknown>(
    path: Path,
    ...handlers: [
      ...RouteMiddleware<Path, State, Vars>[],
      Handler<Path, State, Vars>,
    ]
  ): SafeApplication<State, Vars, KnownIds | Path, Elabs & Record<Path, E>>;

  delete<Path extends string, E>(
    path: Path,
    elaboration: E,
    ...handlers: [
      ...RouteMiddleware<Path, State, Vars>[],
      Handler<Path, State, Vars>,
    ]
  ): SafeApplication<State, Vars, KnownIds | Path, Elabs & Record<Path, E>>;

  all<Path extends string, E = unknown>(
    path: Path,
    handler: Handler<Path, State, Vars>,
  ): SafeApplication<State, Vars, KnownIds | Path, Elabs & Record<Path, E>>;

  all<Path extends string, E>(
    path: Path,
    elaboration: E,
    handler: Handler<Path, State, Vars>,
  ): SafeApplication<State, Vars, KnownIds | Path, Elabs & Record<Path, E>>;

  all<Path extends string, E = unknown>(
    path: Path,
    ...handlers: [
      ...RouteMiddleware<Path, State, Vars>[],
      Handler<Path, State, Vars>,
    ]
  ): SafeApplication<State, Vars, KnownIds | Path, Elabs & Record<Path, E>>;

  all<Path extends string, E>(
    path: Path,
    elaboration: E,
    ...handlers: [
      ...RouteMiddleware<Path, State, Vars>[],
      Handler<Path, State, Vars>,
    ]
  ): SafeApplication<State, Vars, KnownIds | Path, Elabs & Record<Path, E>>;
};

type SplitResult = {
  elaboration: unknown | undefined;
  handlers: readonly unknown[];
};

const splitElaborationAndHandlers = (rest: readonly unknown[]): SplitResult => {
  if (rest.length === 0) throw new Error("Route requires a handler.");

  const first = rest[0];
  if (typeof first === "function") {
    return { elaboration: undefined, handlers: rest };
  }

  const elaboration = first;
  const handlers = rest.slice(1);
  if (handlers.length === 0) {
    throw new Error("Route with elaboration requires a handler.");
  }
  const last = handlers[handlers.length - 1];
  if (typeof last !== "function") {
    throw new Error("Final route argument must be a handler function.");
  }
  return { elaboration, handlers };
};

const isHrefOptions = (v: unknown): v is HrefOptions => {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return ("query" in o) || ("hash" in o);
};

const asRouteHandlers = <
  Path extends string,
  State extends Record<string, unknown>,
  Vars extends VarsRecord,
>(
  handlers: readonly unknown[],
): readonly [
  ...RouteMiddleware<Path, State, Vars>[],
  Handler<Path, State, Vars>,
] => {
  return handlers as unknown as readonly [
    ...RouteMiddleware<Path, State, Vars>[],
    Handler<Path, State, Vars>,
  ];
};

export const safeHttp = <
  State extends Record<string, unknown>,
  Vars extends VarsRecord = EmptyRecord,
  Elaboration = unknown,
>(
  app: Application<State, Vars>,
  opts: SafeHttpOptions = {},
): SafeApplication<State, Vars, never, Record<never, Elaboration>> => {
  const prefix = normalizePrefix(opts.sitePrefix);
  const registry = new Map<string, StoredRoute[]>();
  const elab = new Map<string, unknown>();

  const addStoredRoute = (method: HttpMethod, template: string) => {
    const p = template.startsWith("/") ? template : `/${template}`;
    const { re, keys } = compileTemplate(p);
    const list = registry.get(p) ?? [];
    list.push({ method, template: p, re, keys });
    registry.set(p, list);
  };

  const idsRuntime = (): string[] => Array.from(registry.keys());

  const assertNoDrift = () => {
    const safeIds = new Set(idsRuntime());
    const appIds = new Set(app.routes().map((r) => r.path));

    const missingInApp: string[] = [];
    for (const id of safeIds) if (!appIds.has(id)) missingInApp.push(id);

    const missingInSafe: string[] = [];
    for (const id of appIds) if (!safeIds.has(id)) missingInSafe.push(id);

    if (missingInApp.length || missingInSafe.length) {
      const lines: string[] = [];
      lines.push("safe-http drift detected.");
      if (missingInApp.length) {
        lines.push("");
        lines.push(
          "Routes registered via safe-http but not present in app.routes():",
        );
        for (const r of missingInApp.sort()) lines.push(`  ${r}`);
      }
      if (missingInSafe.length) {
        lines.push("");
        lines.push(
          "Routes present in app.routes() but not registered via safe-http:",
        );
        for (const r of missingInSafe.sort()) lines.push(`  ${r}`);
      }
      throw new Error(lines.join("\n"));
    }
  };

  const parse = (pathOrUrl: string): RouteMatch<string> | null => {
    const u = (() => {
      try {
        return new URL(pathOrUrl);
      } catch {
        return null;
      }
    })();

    const pathname = u ? u.pathname : pathOrUrl;
    const path = pathname.startsWith(prefix)
      ? pathname.slice(prefix.length) || "/"
      : pathname;

    for (const [id, entries] of registry.entries()) {
      for (const entry of entries) {
        const m = path.match(entry.re);
        if (!m) continue;
        return { id, params: decodeParams(entry.keys, m) };
      }
    }
    return null;
  };

  const hrefImpl = (
    id: string,
    paramsOrOpts?: unknown,
    maybeOpts?: HrefOptions,
  ): SafeHref => {
    if (!registry.has(id)) {
      throw new Error(`Unknown route id for href(): ${id}`);
    }

    const params = isHrefOptions(paramsOrOpts)
      ? undefined
      : (paramsOrOpts as Record<string, string> | undefined);

    const opts2 = isHrefOptions(paramsOrOpts)
      ? (paramsOrOpts as HrefOptions)
      : maybeOpts;

    const pathname = joinPath(prefix, fillTemplate(id, params ?? {}));
    return asSafeHref(
      `${pathname}${encodeQuery(opts2?.query)}${encodeHash(opts2?.hash)}`,
    );
  };

  const registerGet = <Path extends string>(
    path: Path,
    rest: readonly unknown[],
  ) => {
    addStoredRoute("GET", path);
    const { elaboration, handlers } = splitElaborationAndHandlers(rest);
    if (elaboration !== undefined) elab.set(path, elaboration);
    app.get(path, ...asRouteHandlers<Path, State, Vars>(handlers));
  };

  const registerPost = <Path extends string>(
    path: Path,
    rest: readonly unknown[],
  ) => {
    addStoredRoute("POST", path);
    const { elaboration, handlers } = splitElaborationAndHandlers(rest);
    if (elaboration !== undefined) elab.set(path, elaboration);
    app.post(path, ...asRouteHandlers<Path, State, Vars>(handlers));
  };

  const registerPut = <Path extends string>(
    path: Path,
    rest: readonly unknown[],
  ) => {
    addStoredRoute("PUT", path);
    const { elaboration, handlers } = splitElaborationAndHandlers(rest);
    if (elaboration !== undefined) elab.set(path, elaboration);
    app.put(path, ...asRouteHandlers<Path, State, Vars>(handlers));
  };

  const registerPatch = <Path extends string>(
    path: Path,
    rest: readonly unknown[],
  ) => {
    addStoredRoute("PATCH", path);
    const { elaboration, handlers } = splitElaborationAndHandlers(rest);
    if (elaboration !== undefined) elab.set(path, elaboration);
    app.patch(path, ...asRouteHandlers<Path, State, Vars>(handlers));
  };

  const registerDelete = <Path extends string>(
    path: Path,
    rest: readonly unknown[],
  ) => {
    addStoredRoute("DELETE", path);
    const { elaboration, handlers } = splitElaborationAndHandlers(rest);
    if (elaboration !== undefined) elab.set(path, elaboration);
    app.delete(path, ...asRouteHandlers<Path, State, Vars>(handlers));
  };

  const registerAll = <Path extends string>(
    path: Path,
    rest: readonly unknown[],
  ) => {
    const methods: HttpMethod[] = [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
      "HEAD",
    ];
    for (const m of methods) addStoredRoute(m, path);
    const { elaboration, handlers } = splitElaborationAndHandlers(rest);
    if (elaboration !== undefined) elab.set(path, elaboration);
    app.all(path, ...asRouteHandlers<Path, State, Vars>(handlers));
  };

  const build = <
    KnownIds extends string,
    Elabs extends RouteElabRecord,
  >(): SafeApplication<State, Vars, KnownIds, Elabs> => {
    const api = {
      app,
      sitePrefix: prefix,

      href: hrefImpl as unknown as SafeApplication<
        State,
        Vars,
        KnownIds,
        Elabs
      >["href"],

      parse:
        ((pathOrUrl: string) =>
          parse(pathOrUrl) as RouteMatch<KnownIds> | null),

      // FIX: go through unknown first to satisfy TS's "may be a mistake" guard.
      ids: (() => idsRuntime() as unknown as ReadonlyArray<KnownIds>),

      elaboration:
        (<Id extends KnownIds>(id: Id) =>
          elab.get(id) as Elabs[Id] | undefined),

      assertNoDrift,

      get: (<Path extends string>(path: Path, ...rest: unknown[]) => {
        registerGet(path, rest);
        return build<KnownIds | Path, Elabs & Record<Path, unknown>>();
      }) as unknown as SafeApplication<State, Vars, KnownIds, Elabs>["get"],

      post: (<Path extends string>(path: Path, ...rest: unknown[]) => {
        registerPost(path, rest);
        return build<KnownIds | Path, Elabs & Record<Path, unknown>>();
      }) as unknown as SafeApplication<State, Vars, KnownIds, Elabs>["post"],

      put: (<Path extends string>(path: Path, ...rest: unknown[]) => {
        registerPut(path, rest);
        return build<KnownIds | Path, Elabs & Record<Path, unknown>>();
      }) as unknown as SafeApplication<State, Vars, KnownIds, Elabs>["put"],

      patch: (<Path extends string>(path: Path, ...rest: unknown[]) => {
        registerPatch(path, rest);
        return build<KnownIds | Path, Elabs & Record<Path, unknown>>();
      }) as unknown as SafeApplication<State, Vars, KnownIds, Elabs>["patch"],

      delete: (<Path extends string>(path: Path, ...rest: unknown[]) => {
        registerDelete(path, rest);
        return build<KnownIds | Path, Elabs & Record<Path, unknown>>();
      }) as unknown as SafeApplication<State, Vars, KnownIds, Elabs>["delete"],

      all: (<Path extends string>(path: Path, ...rest: unknown[]) => {
        registerAll(path, rest);
        return build<KnownIds | Path, Elabs & Record<Path, unknown>>();
      }) as unknown as SafeApplication<State, Vars, KnownIds, Elabs>["all"],
    } satisfies SafeApplication<State, Vars, KnownIds, Elabs>;

    return api;
  };

  return build<never, Record<never, Elaboration>>() as SafeApplication<
    State,
    Vars,
    never,
    Record<never, Elaboration>
  >;
};
