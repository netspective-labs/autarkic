import type { Middleware } from "../http.ts";
import type { CxSseHub } from "../interaction.ts";

export type SseDiagnosticLevel = "info" | "warn" | "error" | "debug";

export type SseDiagnosticEntry = {
  readonly message: string;
  readonly payload?: unknown;
  readonly level?: SseDiagnosticLevel;
  readonly id?: string;
  readonly timestamp?: number;
};

const normalizeEntry = (
  entry: Partial<SseDiagnosticEntry>,
  defaults: Partial<SseDiagnosticEntry> = {},
): SseDiagnosticEntry => ({
  message: entry.message ?? defaults.message ?? "",
  payload: entry.payload ?? defaults.payload,
  level: entry.level ?? defaults.level,
  id: entry.id ?? defaults.id,
  timestamp: entry.timestamp ?? defaults.timestamp ?? Date.now(),
});

export type SseDiagnosticsInspectorRuntimeOpts = {
  importUrl?: string;
  selector?: string;
  attempts?: number;
  delayMs?: number;
};

export type SseDiagnosticsMountOpts = {
  mountPoint?: string;
  cacheControl?: string;
};

export type SseDiagnosticsCreateOpts = {
  inspectorImportUrl?: string;
  inspectorSelector?: string;
  inspectorScriptAttempts?: number;
  inspectorScriptDelayMs?: number;
  inspectorMountPoint?: string;
  inspectorMountCacheControl?: string;
};

const DEFAULT_INSPECTOR_IMPORT = "/lib/continuux/http-ux/sse.js";
const DEFAULT_INSPECTOR_SELECTOR = "sse-inspector";
const DEFAULT_INSPECTOR_CACHE = "no-store";
const DEFAULT_INSPECTOR_ATTEMPTS = 20;
const DEFAULT_INSPECTOR_DELAY_MS = 150;

export const createSseDiagnostics = <
  E extends Record<string, unknown>,
  D extends keyof E,
  C extends keyof E = D,
>(
  hub: CxSseHub<E>,
  diagEvent: D,
  connectionEvent?: C,
  opts: SseDiagnosticsCreateOpts = {},
) => {
  const emitDiag = (
    sessionId: string,
    entry: Partial<SseDiagnosticEntry>,
  ) => {
    const payload = normalizeEntry(entry);
    return hub.send(sessionId, diagEvent, payload as E[D]);
  };

  const emitConnection = (
    sessionId: string,
    entry: Partial<SseDiagnosticEntry> = {},
  ) => {
    const payload = normalizeEntry(entry, { message: "SSE connection" });
    const targetEvent = connectionEvent ?? diagEvent;
    return hub.send(sessionId, targetEvent, payload as E[typeof targetEvent]);
  };

  const broadcastDiag = (entry: Partial<SseDiagnosticEntry>) => {
    const payload = normalizeEntry(entry);
    hub.broadcast(diagEvent, payload as E[D]);
  };

  const broadcastConnection = (entry: Partial<SseDiagnosticEntry> = {}) => {
    const payload = normalizeEntry(entry, { message: "SSE connection" });
    const targetEvent = connectionEvent ?? diagEvent;
    hub.broadcast(
      targetEvent,
      payload as E[typeof targetEvent],
    );
  };

  const inspectorConfig = {
    importUrl: opts.inspectorImportUrl ?? DEFAULT_INSPECTOR_IMPORT,
    selector: opts.inspectorSelector ?? DEFAULT_INSPECTOR_SELECTOR,
    mountPoint: opts.inspectorMountPoint ?? opts.inspectorImportUrl ??
      DEFAULT_INSPECTOR_IMPORT,
    mountCacheControl: opts.inspectorMountCacheControl ??
      DEFAULT_INSPECTOR_CACHE,
    scriptAttempts: opts.inspectorScriptAttempts ?? DEFAULT_INSPECTOR_ATTEMPTS,
    scriptDelayMs: opts.inspectorScriptDelayMs ?? DEFAULT_INSPECTOR_DELAY_MS,
  };

  const uniqueEvents = [
    diagEvent,
    connectionEvent ?? diagEvent,
  ].filter((value, index, arr) => arr.indexOf(value) === index);

  const inspectorScript = (
    runtime?: SseDiagnosticsInspectorRuntimeOpts,
  ): string => {
    const importUrl = runtime?.importUrl ?? inspectorConfig.importUrl;
    const selector = runtime?.selector ?? inspectorConfig.selector;
    const attempts = typeof runtime?.attempts === "number"
      ? runtime.attempts
      : inspectorConfig.scriptAttempts;
    const delayMs = typeof runtime?.delayMs === "number"
      ? runtime.delayMs
      : inspectorConfig.scriptDelayMs;

    const eventList = uniqueEvents
      .map((event) => JSON.stringify(String(event)))
      .join(", ");

    return `
      import ${JSON.stringify(importUrl)};

      let __sseInspectorAttempts = 0;
      const attachSseInspector = () => {
        const inspector = document.querySelector(${JSON.stringify(selector)});
        if (!inspector) return;
        const aide = window.CX;
        if (!aide || typeof aide.on !== "function") {
          if (__sseInspectorAttempts++ < ${attempts}) {
            setTimeout(attachSseInspector, ${delayMs});
          }
          return;
        }
        const handlerFor = (name) => (event) => {
          if (typeof inspector.recordEvent !== "function") return;
          inspector.recordEvent(event, {
            eventName: name,
            type: name,
            source: "inspector",
            diagConnection: name === ${JSON.stringify("connection")},
          });
        };
        const events = [${eventList}];
        for (const name of events) {
          aide.on(name, handlerFor(name));
        }
      };
      attachSseInspector();
    `;
  };

  const middleware = <
    State extends Record<string, unknown>,
    Vars extends Record<string, unknown>,
  >(
    runtime?: SseDiagnosticsMountOpts,
  ): Middleware<State, Vars> => {
    const scriptPath = runtime?.mountPoint ?? inspectorConfig.mountPoint;
    const cacheControl = runtime?.cacheControl ??
      inspectorConfig.mountCacheControl;

    if (typeof scriptPath !== "string" || !scriptPath.startsWith("/")) {
      return async (_c, next) => await next();
    }

    return async (c, next) => {
      if (c.req.method !== "GET") return await next();
      if (c.url.pathname !== scriptPath) return await next();

      const resolved = import.meta.resolve("./sse.js");
      const upstream = await fetch(resolved);

      const headers = new Headers(upstream.headers);
      headers.set("content-type", "text/javascript; charset=utf-8");
      headers.set("cache-control", cacheControl);
      headers.delete("content-length");

      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers,
      });
    };
  };

  return {
    diag: emitDiag,
    broadcast: broadcastDiag,
    connection: emitConnection,
    broadcastConnection,
    inspectorScript,
    middleware,
  };
};
