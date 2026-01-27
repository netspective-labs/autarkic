#!/usr/bin/env -S deno run -A --watch --unstable-bundle --node-modules-dir=auto
/**
 * ContinuUX “Hello World” (Counter) app.
 *
 * Demonstrates:
 * - Fluent HTML on the server (no templating engine)
 * - Type-safe HTTP routing + typed SSE
 * - ContinuUX interaction model end-to-end
 * - Explicit shared application state semantics
 *
 * Styling:
 * - PicoCSS via CDN
 *
 * Run:
 *   deno run -A support/learn/01-hello/counter.ts
 */

import {
  createSseDiagnostics,
  type SseDiagnosticEntry,
} from "../../../lib/continuux/http-ux/aide.ts";
import { Application } from "../../../lib/continuux/http.ts";
import {
  createCx,
  type CxActionHandlers,
  defineSchemas,
} from "../../../lib/continuux/interaction-html.ts";
import {
  CxMiddlewareBuilder,
  decodeCxEnvelope,
} from "../../../lib/continuux/interaction.ts";
import * as H from "../../../lib/natural-html/elements.ts";
import { customElement } from "../../../lib/natural-html/elements.ts";

type State = { count: number };
type Vars = Record<string, never>;

const appState: State = { count: 0 };

const sseInspectorTag = customElement("sse-inspector");
const sseDiagId = `sse-diagnostics`;

const schemas = defineSchemas({
  increment: (u: unknown) => decodeCxEnvelope(u),
  reset: (u: unknown) => decodeCxEnvelope(u),
});

type ServerEvents = {
  readonly js: string;
  readonly message: string;
  readonly diag: SseDiagnosticEntry;
  readonly connection: SseDiagnosticEntry;
};

const cx = createCx<State, Vars, typeof schemas, ServerEvents>(schemas);
const hub = cx.server.sseHub();
const builder = new CxMiddlewareBuilder<ServerEvents>({
  hub,
  postUrl: "/cx",
  sseUrl: "/cx/sse",
  importUrl: "/browser-ua-aide.js",
});
const { setText, setDataset } = builder.domJs;
const sseDiagnostics = createSseDiagnostics(hub, "diag", "connection");

const handlers: CxActionHandlers<
  State,
  Vars,
  typeof schemas,
  ServerEvents,
  "action"
> = {
  increment: ({ cx: env, sessionId }) => {
    appState.count += 1;
    const js = [
      setText("count", String(appState.count)),
      setText("status", "ok:increment"),
      setDataset("lastSpec", env.spec),
      setDataset("lastCount", String(appState.count)),
    ].join("\n");
    hub.broadcast("js", js);
    if (sessionId) {
      sseDiagnostics.diag(sessionId, {
        message: `increment`,
        level: "info",
        payload: { sessionId, count: appState.count, execDomJS: js },
      });
    }
    return { ok: true };
  },
  reset: ({ cx: env, sessionId }) => {
    appState.count = 0;
    const js = [
      setText("count", "0"),
      setText("status", "ok:reset"),
      setDataset("lastSpec", env.spec),
      setDataset("lastCount", "0"),
    ].join("\n");
    hub.broadcast("js", js);
    if (sessionId) {
      sseDiagnostics.diag(sessionId, {
        message: `reset`,
        level: "info",
        payload: { sessionId, count: appState.count, execDomJS: js },
      });
    }
    return { ok: true };
  },
};

const pageHtml = (): string => {
  const boot = cx.html.bootModuleScriptTag({
    diagnostics: false,
    debug: false,
    autoConnect: true,
    attrs: { id: "cxBoot" },
  });

  return H.render(
    H.doctype(),
    H.html(
      H.head(
        H.meta({ charset: "utf-8" }),
        H.meta({
          name: "viewport",
          content: "width=device-width, initial-scale=1",
        }),
        H.title("ContinuUX Hello (Counter)"),
        H.link({
          rel: "stylesheet",
          href: "https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css",
        }),
        H.style(`:root { font-size: 85%; }`),
      ),
      H.body(
        H.main(
          {
            class: "container",
            style: "max-width:720px; padding-top:2rem;",
          },
          H.div(
            H.hgroup(
              H.h1("ContinuUX Hello"),
              H.p("Counter app using SSE + server-executed JS"),
            ),
            H.article(
              H.div(
                { id: "countWrap" },
                H.p({ style: "margin-bottom:.25rem;" }, "Count"),
                H.p(
                  { style: "font-size:2.2rem; margin-top:0;" },
                  H.strong({ id: "count" }, "0"),
                ),
              ),
              H.div(
                { style: "display:flex; gap:.75rem; flex-wrap:wrap;" },
                H.button(
                  { id: "inc", ...cx.html.click("increment") },
                  "Increment",
                ),
                H.button(
                  {
                    id: "reset",
                    ...cx.html.click("reset"),
                    class: "secondary",
                  },
                  "Reset",
                ),
              ),
              H.div(
                {
                  id: "status",
                  style: "margin-top:1rem; color:var(--pico-muted-color);",
                },
                "",
              ),
            ),
            H.small(
              { style: "display:block; margin-top:1rem;" },
              "Open two tabs to see shared in-memory state.",
            ),
            H.section(
              { class: "dialog-diagnostics", id: sseDiagId },
              H.h3("SSE diagnostics"),
              H.p(
                "Watch how ContinuUX SSE updates carry validation and submission events.",
              ),
              sseInspectorTag(),
            ),
          ),
          boot,
          H.script(
            { type: "module" },
            H.trustedRaw(sseDiagnostics.inspectorScript()),
          ),
          H.script(
            { type: "module" },
            H.trustedRaw(`window.__page_ready = "ok";`),
          ),
        ),
      ),
    ),
  );
};

const app = Application.sharedState<State, Vars>(appState);

// Serve the inspector module via middleware (instead of app.get(...)).
app.use(sseDiagnostics.middleware<State, Vars>());

app.use(
  builder.middleware<State, Vars, typeof schemas, "action">({
    uaCacheControl: "no-store",
    onConnect: async ({ session, sessionId }) => {
      await session.sendWhenReady(
        "js",
        setText("count", String(appState.count)),
      );
      await session.sendWhenReady(
        "js",
        setDataset("lastCount", String(appState.count)),
      );
      await session.sendWhenReady("js", setDataset("lastSpec", "init"));
      await session.sendWhenReady("js", setText("status", "connected"));
      await session.sendWhenReady("message", `connected:${sessionId}`);
      sseDiagnostics.connection(sessionId, {
        message: "SSE diagnostics channel established",
        level: "info",
      });
    },
    post: {
      cx,
      handlers,
    },
  }),
);
app.get(
  "/",
  () =>
    new Response(pageHtml(), {
      headers: { "content-type": "text/html; charset=utf-8" },
    }),
);

app.serve({ port: 7681 });
