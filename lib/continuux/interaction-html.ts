/**
 * lib/continuux/interaction-html.ts
 *
 * This module provides the type-safe “surface area” for ContinuUX interactivity,
 * roughly analogous to what HTMX or Datastar offer, but built around a typed
 * interaction protocol and server-controlled instructions rather than ad hoc
 * string attributes and client-owned logic.
 *
 * The intent is simple: application code should not require developers to know
 * or type low-level attribute names (for example `data-cx-on-click`) or wiring
 * endpoints (for example `/cx`). Instead, developers use strongly typed helpers
 * that generate the correct attributes and provide matching server-side dispatch
 * and SSE helpers.
 *
 * ContinuUX uses Fluent HTML, not React (or JSX). HTML is generated on the server
 * using `../natural-html/elements.ts`, which provides a tiny, dependency-free,
 * safe-by-default HTML builder (escaping, deterministic output, optional AST
 * for pretty rendering). This module builds on that foundation to attach
 * hypermedia-style interaction metadata to Fluent HTML output.
 *
 * Hypermedia model (HTMX/Datastar lineage):
 * - Server-rendered HTML is the default.
 * - Elements are annotated with declarative interaction metadata.
 * - The browser user agent observes DOM events and posts a structured envelope
 *   to the server describing the event and the requested “action”.
 * - The server validates, dispatches, and responds with instructions.
 * - When needed, SSE is used as the continuous channel for server-to-client
 *   events (including privileged JavaScript instructions via a `js` event).
 *
 * What you get here:
 *
 * 1) createCx(): a typed “kit” that binds HTML generation and server wiring
 * - `cx.html.*` produces `Attrs` objects to attach to Fluent HTML tags.
 *   It includes helpers for:
 *   - booting the browser user agent module (`bootModuleCode`, `bootModuleScriptTag`)
 *   - configuring the SSE bus (`sse`)
 *   - attaching optional context to envelopes (`signals`, `headers`, `cxId`)
 *   - binding DOM events to action specs (`on`, plus `click`, `submit`, etc.)
 *   - producing action specs with a typed prefix (`spec`)
 *
 * 2) Typed action registry
 * - You define a `schemas` object whose keys are action names.
 * - Each action has a schema (Zod-like `parse()` or a parser function).
 * - `CxActionHandlers` derives handler signatures from those schemas, so handlers
 *   receive strongly typed `data` and consistent interaction context.
 *
 * 3) Server-side dispatch helpers
 * - `dispatchFromRequestJson` decodes and validates inbound envelopes, ensures
 *   the action prefix matches, validates payloads with the corresponding schema,
 *   then calls the matching typed handler.
 * - `toResponse` converts the handler result to an HTTP `Response` (204 on ok).
 * - `uaModuleResponse` serves the browser UA module with the correct headers.
 *
 * 4) SSE hub (typed server -> client events)
 * - `sseHub()` creates a lightweight in-memory registry of sessions keyed by
 *   `sessionId`.
 * - You can send to one session or broadcast to all.
 * - A privileged `js` helper is provided to emit JavaScript instructions if your
 *   SSE event map includes `"js"`. This should remain deterministic and strictly
 *   server-controlled.
 *
 * Convenience utilities:
 * - `defineSchemas()` preserves literal keys for better inference and DX.
 * - `cxPostHandler()` is a ready-to-plug helper for POST /cx.
 * - `cxSseRegister()` is a ready-to-plug helper for GET /cx/sse.
 *
 * Relationship to other ContinuUX modules:
 * - `../natural-html/elements.ts` supplies the HTML builder, attribute typing,
 *   and safe rendering.
 * - `./http.ts` supplies the Fetch-native router and SSE session primitives.
 * - `./interaction.ts` supplies envelope decoding and browser UA module support.
 *
 * Overall, this module is the “developer-facing hypermedia layer”: it makes the
 * HTMX/Datastar-style approach feel natural in TypeScript by replacing stringly
 * attributes and loosely coupled wiring with a single, typed kit that spans
 * HTML generation, action validation/dispatch, and SSE-driven interactivity.
 */

import type { Attrs, RawHtml } from "../natural-html/elements.ts";
import { script, trustedRaw } from "../natural-html/elements.ts";
import type { SseEventMap } from "./http.ts";
import type {
  CxDomEventName,
  CxHandlerResult,
  CxInbound,
  CxSseHub,
  SchemaLike,
  UserAgentAide,
} from "./interaction.ts";
import {
  createSseHub,
  decodeCxEnvelope,
  userAgentAide,
} from "./interaction.ts";

/* =========================
 * shared types
 * ========================= */

export type CxSpecPrefix = "action" | (string & { readonly __cxPrefix: never });

export type SpecFor<
  Prefix extends string,
  Name extends string,
> = `${Prefix}:${Name}`;

export type InferSchema<S> = S extends SchemaLike<infer T> ? T
  : S extends (u: unknown) => infer T ? T
  : never;

export type CxActionSchemas = Record<
  string,
  SchemaLike<unknown> | ((u: unknown) => unknown)
>;

export type CxActionHandlers<
  State,
  Vars extends Record<string, unknown>,
  Schemas extends CxActionSchemas,
  SseOut extends SseEventMap,
  Prefix extends string,
> = {
  [K in keyof Schemas]: (
    ctx: {
      name: K;
      spec: SpecFor<Prefix, Extract<K, string>>;
      req: Request;
      cx: CxInbound;
      state: State;
      vars: Vars;
      data: InferSchema<Schemas[K]>;
      scratch: Record<string, unknown>;

      // SSE helpers (may be undefined if you did not wire SSE).
      sse?: CxSseHub<SseOut>;
      sessionId: string;
      requestId: string;

      emit: {
        send: <K2 extends keyof SseOut>(event: K2, data: SseOut[K2]) => boolean;
        broadcast: <K2 extends keyof SseOut>(
          event: K2,
          data: SseOut[K2],
        ) => void;
        js: (jsText: string) => boolean;
      };
    },
  ) => Promise<CxHandlerResult> | CxHandlerResult;
};

/* =========================
 * internal helpers
 * ========================= */

const isPlainObject = (v: unknown): v is Record<string, unknown> => {
  if (v == null || typeof v !== "object") return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

const safeJson = (v: unknown): string => JSON.stringify(v ?? null);

const parseWith = <T>(
  schema: SchemaLike<T> | ((u: unknown) => T),
  u: unknown,
): T => {
  if (typeof schema === "function") return schema(u);
  return schema.parse(u);
};

/* =========================
 * CX attribute building (type-safe, no strings)
 * ========================= */

export type CxHtmlConfig<Prefix extends string> = {
  // action prefix (e.g. "action")
  prefix?: Prefix; // default "action"

  // endpoints
  postUrl?: string; // default "/cx"
  sseUrl?: string; // default "/cx/sse"
  importUrl?: string; // default "/browser-ua-aide.js"

  // UA behavior defaults
  sseWithCredentials?: boolean; // default true
  attrPrefix?: string; // default "data-cx" (must match browser UA default)
};

/**
 * Typed actions API returned by createCx().
 * - html: helpers that generate Attrs to attach to fluent HTML tags
 * - server: helpers to decode/dispatch and manage SSE
 */
export type CxKit<
  State,
  Vars extends Record<string, unknown>,
  Schemas extends CxActionSchemas,
  SseOut extends SseEventMap,
  Prefix extends string,
> = {
  config: Required<CxHtmlConfig<Prefix>>;

  // HTML-side helpers (Attrs and boot script)
  html: {
    // Boot UA in a module script (defaults are configured here).
    // Use inside <script type="module"> ... </script>.
    bootModuleCode: (opts?: {
      debug?: boolean;
      diagnostics?: boolean;
      autoConnect?: boolean;
      appVersion?: string;
      events?: readonly CxDomEventName[];
      preventDefaultSubmit?: boolean;
      sseJsEventName?: string;
      attrPrefix?: string;
      sseWithCredentials?: boolean;
      postUrl?: string;
      sseUrl?: string;
    }) => string;

    bootModuleScriptTag: (opts?: {
      debug?: boolean;
      diagnostics?: boolean;
      autoConnect?: boolean;
      appVersion?: string;
      events?: readonly CxDomEventName[];
      preventDefaultSubmit?: boolean;
      sseJsEventName?: string;
      attrPrefix?: string;
      sseWithCredentials?: boolean;
      postUrl?: string;
      sseUrl?: string;
      attrs?: Attrs;
    }) => RawHtml;

    // Root-level overrides for the delegated UA network bus
    // (set on <html> or <body>, read by the UA).
    bus: (opts?: {
      postUrl?: string;
      sseUrl?: string;
      withCredentials?: boolean;
    }) => Attrs;

    // Attach optional context that rides along with the CX envelope.
    // These are read by the UA from the target element.
    signals: (obj: Record<string, unknown>) => Attrs;
    headers: (obj: Record<string, string>) => Attrs;
    cxId: (id: string) => Attrs;

    // Action specs (type-safe names)
    spec: <K extends keyof Schemas & string>(name: K) => SpecFor<Prefix, K>;

    // Per-event action binding (type-safe)
    on: <K extends keyof Schemas & string>(
      domEvent: CxDomEventName,
      name: K,
      extra?: {
        signals?: Record<string, unknown>;
        headers?: Record<string, string>;
        cxId?: string;
      },
    ) => Attrs;

    // Convenience wrappers for common DOM events
    click: <K extends keyof Schemas & string>(
      name: K,
      extra?: {
        signals?: Record<string, unknown>;
        headers?: Record<string, string>;
        cxId?: string;
      },
    ) => Attrs;

    submit: <K extends keyof Schemas & string>(
      name: K,
      extra?: {
        signals?: Record<string, unknown>;
        headers?: Record<string, string>;
        cxId?: string;
      },
    ) => Attrs;

    change: <K extends keyof Schemas & string>(
      name: K,
      extra?: {
        signals?: Record<string, unknown>;
        headers?: Record<string, string>;
        cxId?: string;
      },
    ) => Attrs;

    input: <K extends keyof Schemas & string>(
      name: K,
      extra?: {
        signals?: Record<string, unknown>;
        headers?: Record<string, string>;
        cxId?: string;
      },
    ) => Attrs;

    keydown: <K extends keyof Schemas & string>(
      name: K,
      extra?: {
        signals?: Record<string, unknown>;
        headers?: Record<string, string>;
        cxId?: string;
      },
    ) => Attrs;
  };

  // Server-side helpers: decode + dispatch + SSE hub
  server: {
    uaModuleResponse: (cacheControl?: string) => Promise<Response>;

    dispatchFromRequestJson: (
      req: Request,
      body: unknown,
      state: State,
      vars: Vars,
      handlers: CxActionHandlers<State, Vars, Schemas, SseOut, Prefix>,
      opts?: { sse?: CxSseHub<SseOut> },
    ) => Promise<CxHandlerResult>;

    toResponse: (r: CxHandlerResult) => Response;

    sseHub: () => CxSseHub<SseOut>;
  };
};

/* =========================
 * createCx(): the main entrypoint
 * ========================= */

export const createCx = <
  State,
  Vars extends Record<string, unknown>,
  Schemas extends CxActionSchemas,
  SseOut extends SseEventMap = { message: string; js: string },
  Prefix extends string = "action",
>(
  schemas: Schemas,
  cfg: CxHtmlConfig<Prefix> = {},
): CxKit<State, Vars, Schemas, SseOut, Prefix> => {
  const aide: UserAgentAide = userAgentAide({
    attrPrefix: cfg.attrPrefix ?? "data-cx",
    defaultPostUrl: cfg.postUrl ?? "/cx",
    defaultSseUrl: cfg.sseUrl ?? "/cx/sse",
    defaultImportUrl: cfg.importUrl ?? "/browser-ua-aide.js",
  });

  const config: Required<CxHtmlConfig<Prefix>> = {
    prefix: (cfg.prefix ?? "action") as Prefix,
    postUrl: cfg.postUrl ?? "/cx",
    sseUrl: cfg.sseUrl ?? "/cx/sse",
    importUrl: cfg.importUrl ?? "/browser-ua-aide.js",
    sseWithCredentials: cfg.sseWithCredentials ?? true,
    attrPrefix: cfg.attrPrefix ?? "data-cx",
  };

  // Canonical attribute names from interaction.ts (single source of truth).
  const attr = aide.attrs;

  const spec = <K extends keyof Schemas & string>(
    name: K,
  ): SpecFor<Prefix, K> => `${config.prefix}:${name}` as SpecFor<Prefix, K>;

  const mergeExtras = (extra?: {
    signals?: Record<string, unknown>;
    headers?: Record<string, string>;
    cxId?: string;
  }): Attrs => {
    const out: Attrs = {};
    if (!extra) return out;
    if (extra.cxId) out[attr.id] = extra.cxId;
    if (extra.signals) out[attr.signals] = safeJson(extra.signals);
    if (extra.headers) out[attr.headers] = safeJson(extra.headers);
    return out;
  };

  const on = <K extends keyof Schemas & string>(
    domEvent: CxDomEventName,
    name: K,
    extra?: {
      signals?: Record<string, unknown>;
      headers?: Record<string, string>;
      cxId?: string;
    },
  ): Attrs => ({
    [attr.on(domEvent)]: spec(name),
    ...mergeExtras(extra),
  });

  const html = {
    bootModuleCode: (opts: {
      debug?: boolean;
      diagnostics?: boolean;
      autoConnect?: boolean;
      appVersion?: string;
      events?: readonly CxDomEventName[];
      preventDefaultSubmit?: boolean;
      sseJsEventName?: string;
      attrPrefix?: string;
      sseWithCredentials?: boolean;
      postUrl?: string;
      sseUrl?: string;
    } = {}): string => {
      // Delegate to interaction.ts aide for consistent boot snippet.
      // Then optionally layer in additional keys your browser UA supports.
      //
      // (We keep this “boring”: you can always override by writing your own module.)
      const base = aide.bootModuleSnippet({
        importUrl: config.importUrl,
        postUrl: opts.postUrl ?? config.postUrl,
        sseUrl: opts.sseUrl ?? config.sseUrl,
        sseWithCredentials: typeof opts.sseWithCredentials === "boolean"
          ? opts.sseWithCredentials
          : config.sseWithCredentials,
        debug: !!opts.debug,
        diagnostics: !!opts.diagnostics,
        autoConnect: opts.autoConnect ?? true,
        appVersion: opts.appVersion,
        events: opts.events,
        preventDefaultSubmit: opts.preventDefaultSubmit,
        sseJsEventName: opts.sseJsEventName,
        attrPrefix: opts.attrPrefix ?? config.attrPrefix,
      });

      return base;
    },

    bootModuleScriptTag: (opts: {
      debug?: boolean;
      diagnostics?: boolean;
      autoConnect?: boolean;
      appVersion?: string;
      events?: readonly CxDomEventName[];
      preventDefaultSubmit?: boolean;
      sseJsEventName?: string;
      attrPrefix?: string;
      sseWithCredentials?: boolean;
      postUrl?: string;
      sseUrl?: string;
      attrs?: Attrs;
    } = {}): RawHtml => {
      const code = html.bootModuleCode(opts);
      return script(
        { type: "module", ...(opts.attrs ?? {}) },
        trustedRaw(code),
      );
    },

    // Root-level bus overrides (read by browser-ua-aide.js from <html>/<body>)
    bus: (opts?: {
      postUrl?: string;
      sseUrl?: string;
      withCredentials?: boolean;
    }): Attrs => {
      const out: Attrs = {};
      if (opts?.postUrl) out[attr.postUrl] = opts.postUrl;
      if (opts?.sseUrl) out[attr.sseUrl] = opts.sseUrl;
      if (typeof opts?.withCredentials === "boolean") {
        out[attr.sseWithCredentials] = opts.withCredentials ? "true" : "false";
      }
      return out;
    },

    signals: (obj: Record<string, unknown>): Attrs => ({
      [attr.signals]: safeJson(obj),
    }),

    headers: (obj: Record<string, string>): Attrs => ({
      [attr.headers]: safeJson(obj),
    }),

    cxId: (id: string): Attrs => ({ [attr.id]: id }),

    spec,

    on,

    click: <K extends keyof Schemas & string>(
      name: K,
      extra?: {
        signals?: Record<string, unknown>;
        headers?: Record<string, string>;
        cxId?: string;
      },
    ): Attrs => on("click", name, extra),

    submit: <K extends keyof Schemas & string>(
      name: K,
      extra?: {
        signals?: Record<string, unknown>;
        headers?: Record<string, string>;
        cxId?: string;
      },
    ): Attrs => on("submit", name, extra),

    change: <K extends keyof Schemas & string>(
      name: K,
      extra?: {
        signals?: Record<string, unknown>;
        headers?: Record<string, string>;
        cxId?: string;
      },
    ): Attrs => on("change", name, extra),

    input: <K extends keyof Schemas & string>(
      name: K,
      extra?: {
        signals?: Record<string, unknown>;
        headers?: Record<string, string>;
        cxId?: string;
      },
    ): Attrs => on("input", name, extra),

    keydown: <K extends keyof Schemas & string>(
      name: K,
      extra?: {
        signals?: Record<string, unknown>;
        headers?: Record<string, string>;
        cxId?: string;
      },
    ): Attrs => on("keydown", name, extra),
  } as const;

  const server = {
    uaModuleResponse: async (cacheControl = "no-store"): Promise<Response> => {
      return await aide.moduleResponse(cacheControl);
    },

    dispatchFromRequestJson: async (
      req: Request,
      body: unknown,
      state: State,
      vars: Vars,
      handlers: CxActionHandlers<State, Vars, Schemas, SseOut, Prefix>,
      opts?: { sse?: CxSseHub<SseOut> },
    ): Promise<CxHandlerResult> => {
      let cx: CxInbound;
      try {
        cx = decodeCxEnvelope(body);
      } catch (err) {
        const msg = String(
          err && (err as Error).message ? (err as Error).message : err,
        );
        return { ok: false, status: 400, message: `bad cx envelope: ${msg}` };
      }

      const sp = cx.spec;
      if (typeof sp !== "string" || !sp.includes(":")) {
        return {
          ok: false,
          status: 400,
          message: `bad cx spec: ${String(sp)}`,
        };
      }

      const [pfx, nm] = sp.split(":", 2);
      if (pfx !== config.prefix) {
        return {
          ok: false,
          status: 400,
          message: `unsupported cx prefix: ${pfx}`,
        };
      }

      const actionName = nm as keyof Schemas & string;
      const schema = (schemas as Record<string, unknown>)[actionName];
      const handler = (handlers as Record<string, unknown>)[actionName];

      if (!schema || typeof handler !== "function") {
        return {
          ok: false,
          status: 404,
          message: `cx action not found: ${sp}`,
        };
      }

      let data: unknown;
      try {
        // Keep legacy semantics: schema parses the full inbound env.
        data = parseWith(schema as never, body);
      } catch (err) {
        const msg = String(
          err && (err as Error).message ? (err as Error).message : err,
        );
        return {
          ok: false,
          status: 400,
          message: `cx validation failed: ${msg}`,
        };
      }

      const sessionId = cx.client.sessionId;
      const requestId = cx.client.requestId;
      const hub = opts?.sse;

      const emit = {
        send: <K extends keyof SseOut>(event: K, data: SseOut[K]) => {
          if (!hub) return false;
          return hub.send(sessionId, event, data);
        },
        broadcast: <K extends keyof SseOut>(event: K, data: SseOut[K]) => {
          if (!hub) return;
          hub.broadcast(event, data);
        },
        js: (jsText: string) => {
          if (!hub) return false;
          return hub.js(sessionId, jsText);
        },
      } as const;

      const ctx = {
        name: actionName,
        spec: sp as SpecFor<Prefix, typeof actionName>,
        req,
        cx,
        state,
        vars,
        data: data as never,
        scratch: Object.create(null) as Record<string, unknown>,
        sse: opts?.sse,
        sessionId,
        requestId,
        emit,
      };

      try {
        return await (handler as (
          x: typeof ctx,
        ) => Promise<CxHandlerResult> | CxHandlerResult)(ctx);
      } catch (err) {
        const msg = String(
          err && (err as Error).message ? (err as Error).message : err,
        );
        return { ok: false, status: 500, message: `cx handler error: ${msg}` };
      }
    },

    toResponse: (r: CxHandlerResult): Response => {
      if (r.ok) {
        if ("headers" in r && r.headers) {
          return new Response(null, { status: 204, headers: r.headers });
        }
        return new Response(null, { status: 204 });
      }
      return new Response(r.message, {
        status: r.status,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    },

    sseHub: (): CxSseHub<SseOut> => createSseHub<SseOut>(),
  } as const;

  return { config, html, server };
};

/* =========================
 * Convenience: defineSchemas()
 * ========================= */

export const actionSchemas = <S extends CxActionSchemas>(schemas: S): S =>
  schemas;

/* =========================
 * Convenience: cxPostHandler()
 * ========================= */

export const cxPostHandler = async <
  State,
  Vars extends Record<string, unknown>,
  Schemas extends CxActionSchemas,
  SseOut extends SseEventMap,
  Prefix extends string,
>(
  cx: CxKit<State, Vars, Schemas, SseOut, Prefix>,
  args: {
    req: Request;
    body: unknown;
    state: State;
    vars: Vars;
    handlers: CxActionHandlers<State, Vars, Schemas, SseOut, Prefix>;
    sse?: CxSseHub<SseOut>;
  },
): Promise<CxHandlerResult> =>
  await cx.server.dispatchFromRequestJson(
    args.req,
    args.body,
    args.state,
    args.vars,
    args.handlers,
    { sse: args.sse },
  );

/* =========================
 * OPTIONAL: stricter header/signals helpers
 * ========================= */

export const cxSignals = (obj: Record<string, unknown>): Attrs => {
  if (!isPlainObject(obj)) {
    throw new Error("cxSignals expects a plain object");
  }
  return { "data-cx-signals": safeJson(obj) };
};

export const cxHeaders = (obj: Record<string, string>): Attrs => {
  if (!isPlainObject(obj)) {
    throw new Error("cxHeaders expects a plain object");
  }
  return { "data-cx-headers": safeJson(obj) };
};

export { cxSseRegister } from "./interaction.ts";
