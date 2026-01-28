/**
 * Development aids for ContinuUX apps that need hot-reload behavior without a JS build pipeline.
 *
 * This module injects a tiny SSE watcher script into every HTML response, exposes a reload
 * stream endpoint, and provides helpers to broadcast reload events so browsers refresh whenever
 * the backend restarts or you trigger a manual push.
 *
 * ## Usage
 *
 * 1. Import the helper and create a hub once (shared state or per-application):
 *
 *    ```ts
 *    import { devExperienceAide } from "../natural-dx/aide.ts";
 *
 *    const devHub = devExperienceAide();
 *    ```
 *
 * 2. Mount the hub middleware before your routes so it can serve the SSE stream, the
 *    reload POST endpoint, and inject the inline watcher into every HTML response:
 *
 *    ```ts
 *    app.use(devHub.middleware);
 *    ```
 *
 * 3. Restarting the process (e.g., via `deno run --watch`) terminates the SSE stream,
 *    which triggers the injected watcher to reload the page automatically.
 *
 * 4. Optionally trigger manual reloads from anywhere on the server:
 *
 *    ```ts
 *    app.post("/_natural/dev/reload", () => {
 *      devHub.broadcastReloadEvent();
 *      return new Response("reload broadcast");
 *    });
 *    ```
 *
 * The hub exposes `assets` for advanced use (custom stream/reload paths or manual script
 * placement) and `broadcastReloadEvent()` for server-driven refreshes.
 */
import type { Middleware, VarsRecord } from "../continuux/http.ts";
import type { RawHtml } from "../natural-html/elements.ts";
import { scriptJs } from "../natural-html/elements.ts";

const DEFAULT_STREAM_PATH = "/_natural/dev/reload-stream";
const DEFAULT_RELOAD_PATH = "/_natural/dev/reload";
const DEFAULT_RELOAD_EVENT = "natural:reload";

export type DevExperienceOptions = {
  readonly streamPath?: string;
  readonly reloadPath?: string;
  readonly reloadEvent?: string;
  readonly withCredentials?: boolean;
};

export type SseEventFields = {
  readonly id?: string;
  readonly retry?: number;
  readonly data?: string;
};

export type DevExperienceAssets = {
  readonly streamPath: string;
  readonly reloadEvent: string;
  readonly reloadPath: string;
  readonly clientScript: RawHtml;
  readonly formatEvent: (
    eventName: string,
    fields?: SseEventFields,
  ) => string;
  readonly formatReloadEvent: (fields?: SseEventFields) => string;
};

export function formatSseEvent(
  eventName: string,
  fields: SseEventFields = {},
): string {
  const lines: string[] = [];
  if (fields.id) lines.push(`id: ${fields.id}`);
  if (fields.retry !== undefined) lines.push(`retry: ${fields.retry}`);
  lines.push(`event: ${eventName}`);

  const dataLines = (fields.data ?? "").split(/\r?\n/);
  if (dataLines.length === 0) dataLines.push("");
  for (const chunk of dataLines) {
    lines.push(`data: ${chunk}`);
  }

  lines.push("");
  return lines.join("\n");
}

export function devExperience(
  options: DevExperienceOptions = {},
): DevExperienceAssets {
  const streamPath = options.streamPath ?? DEFAULT_STREAM_PATH;
  const reloadEvent = options.reloadEvent ?? DEFAULT_RELOAD_EVENT;
  const reloadPath = options.reloadPath ?? DEFAULT_RELOAD_PATH;
  const withCredentials = options.withCredentials === true;
  const initOptionsLiteral = withCredentials
    ? JSON.stringify({ withCredentials: true })
    : "null";

  const scriptBody = `
(() => {
  if (typeof window === "undefined") return;
  if (!("EventSource" in window)) return;
  const streamUrl = ${JSON.stringify(streamPath)};
  const eventName = ${JSON.stringify(reloadEvent)};
  const initOptions = ${initOptionsLiteral};
  let reloadScheduled = false;
  const log = (...args) => {
    if (typeof console === "object" && typeof console.debug === "function") {
      console.debug("[natural:reload]", ...args);
    }
  };
  const reloadNow = () => {
    if (reloadScheduled) return;
    reloadScheduled = true;
    log("reloading page");
    window.location.reload();
  };
  const source = initOptions
    ? new EventSource(streamUrl, initOptions)
    : new EventSource(streamUrl);
  source.addEventListener("open", () => {
    log("connected to reload stream", streamUrl);
  });
  source.addEventListener("error", (event) => {
    log("reload stream error", event);
    if (source.readyState === EventSource.CONNECTING) {
      log("reload stream reconnecting → forcing reload");
      reloadNow();
    }
  });
  source.addEventListener(eventName, () => {
    log("reload event received", eventName);
    reloadNow();
  });
  window.addEventListener("beforeunload", () => {
    if (source.readyState !== EventSource.CLOSED) {
      source.close();
      log("closed due to navigation");
    }
  });
})();
`;

  return {
    streamPath,
    reloadEvent,
    reloadPath,
    clientScript: scriptJs(scriptBody),
    formatEvent: formatSseEvent,
    formatReloadEvent: (fields?: SseEventFields) =>
      formatSseEvent(reloadEvent, fields),
  };
}

export type DevExperienceHub<
  State extends Record<string, unknown> = Record<string, never>,
  Vars extends VarsRecord = VarsRecord,
> = {
  readonly assets: DevExperienceAssets;
  readonly middleware: Middleware<State, Vars>;
  readonly broadcastReloadEvent: (fields?: SseEventFields) => void;
};

const DEFAULT_SSE_HEADERS = {
  "content-type": "text/event-stream; charset=utf-8",
  "cache-control": "no-cache",
  connection: "keep-alive",
};

export function devExperienceAide<
  State extends Record<string, unknown> = Record<string, never>,
  Vars extends VarsRecord = VarsRecord,
>(options?: DevExperienceOptions): DevExperienceHub<State, Vars> {
  const assets = devExperience(options);
  const streamClients = new Set<ReadableStreamDefaultController<string>>();

  function createReloadStream(): ReadableStream<string> {
    let controllerRef: ReadableStreamDefaultController<string> | null = null;
    return new ReadableStream({
      start(controller) {
        controllerRef = controller;
        streamClients.add(controller);
        controller.enqueue(": connected\n\n");
      },
      cancel() {
        if (controllerRef) {
          streamClients.delete(controllerRef);
          controllerRef = null;
        }
      },
    });
  }

  function broadcastReloadEvent(fields?: SseEventFields) {
    const payload = assets.formatReloadEvent(fields);
    for (const controller of streamClients) {
      try {
        controller.enqueue(payload);
      } catch {
        streamClients.delete(controller);
      }
    }
  }

  type SignalStream = AsyncIterableIterator<unknown> & {
    dispose?: () => void;
  };

  const denoLike = globalThis as {
    signal?: (name: string) => SignalStream;
  };

  const signalNames = ["SIGTERM", "SIGINT", "SIGHUP"];

  if (typeof denoLike.signal === "function") {
    for (const name of signalNames) {
      const stream = denoLike.signal(name);
      (async () => {
        for await (const _ of stream) {
          broadcastReloadEvent();
        }
      })().catch(() => {
        /* ignore */
      });
      stream.dispose?.();
    }
  }

  const injectScriptIntoHtml = async (res: Response): Promise<Response> => {
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("text/html")) return res;
    const text = await res.text();
    if (!text) return res;
    const scriptMarkup = assets.clientScript.__rawHtml;
    if (text.includes(scriptMarkup)) {
      return new Response(text, {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
      });
    }

    const injected = text.includes("</head>")
      ? text.replace(/<\/head>/i, `${scriptMarkup}\n</head>`)
      : `${text}${scriptMarkup}`;

    const headers = new Headers(res.headers);
    headers.delete("content-length");

    return new Response(injected, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  };

  const middleware: Middleware<State, Vars> = async (ctx, next) => {
    const url = new URL(ctx.req.url);
    if (ctx.req.method === "GET" && url.pathname === assets.streamPath) {
      return new Response(createReloadStream(), {
        headers: DEFAULT_SSE_HEADERS,
      });
    }
    if (ctx.req.method === "POST" && url.pathname === assets.reloadPath) {
      broadcastReloadEvent();
      return new Response("reload broadcast");
    }
    const res = await next();
    return injectScriptIntoHtml(res);
  };

  return {
    assets,
    middleware,
    broadcastReloadEvent,
  };
}
