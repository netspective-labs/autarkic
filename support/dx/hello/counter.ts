#!/usr/bin/env -S deno run -A --watch --unstable-bundle --node-modules-dir=auto
// support/assurance/hello/counter.ts
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
 *   deno run -A support/assurance/hello/counter.ts
 */

import * as H from "../../../lib/natural-html/elements.ts";
import { Application, textResponse } from "../../../lib/continuux/http.ts";
import {
  createCx,
  cxPostHandler,
  cxSseRegister,
  defineSchemas,
} from "../../../lib/continuux/interaction-html.ts";
import { decodeCxEnvelope } from "../../../lib/continuux/interaction.ts";

type State = { count: number };
type Vars = Record<string, never>;

const appState: State = { count: 0 };

const schemas = defineSchemas({
  increment: (u: unknown) => decodeCxEnvelope(u),
  reset: (u: unknown) => decodeCxEnvelope(u),
});

type ServerEvents = { js: string; message: string };

const cx = createCx<State, Vars, typeof schemas, ServerEvents>(schemas);
const hub = cx.server.sseHub();

const setTextJs = (id: string, text: string) =>
  `{
  const __el = document.getElementById(${JSON.stringify(id)});
  if (__el) __el.textContent = ${JSON.stringify(text)};
}`;

const setDatasetJs = (k: string, v: string) =>
  `{
  try { document.body.dataset[${JSON.stringify(k)}] = ${JSON.stringify(v)}; }
  catch {}
}`;

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
      ),
      H.body(
        H.main(
          {
            class: "container",
            style: "max-width:720px; padding-top:2rem;",
          },
          H.div(
            {},
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
          ),
          boot,
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

// Serve the unified UA module at the URL used by the page boot script.
app.get("/browser-ua-aide.js", async () => {
  // createCx(...).server.uaModuleResponse now serves browser-ua-aide.js
  return await cx.server.uaModuleResponse("no-store");
});

app.get(
  "/",
  () =>
    new Response(pageHtml(), {
      headers: { "content-type": "text/html; charset=utf-8" },
    }),
);

app.get(
  "/cx/sse",
  (c) =>
    c.sse<ServerEvents>(async (session) => {
      const sessionId = c.query("sessionId") ?? "unknown";
      cxSseRegister(hub, sessionId, session);

      await session.sendWhenReady(
        "js",
        setTextJs("count", String(appState.count)),
      );
      await session.sendWhenReady(
        "js",
        setDatasetJs("lastCount", String(appState.count)),
      );
      await session.sendWhenReady("js", setDatasetJs("lastSpec", "init"));
      await session.sendWhenReady("js", setTextJs("status", "connected"));
      await session.sendWhenReady("message", `connected:${sessionId}`);
    }),
);

app.post("/cx", async (c) => {
  const bodyU = await c.readJson();

  const r = await cxPostHandler(cx, {
    req: c.req,
    body: bodyU,
    state: appState,
    vars: c.vars,
    sse: hub,
    handlers: {
      increment: ({ cx: env }) => {
        appState.count += 1;
        hub.broadcast(
          "js",
          [
            setTextJs("count", String(appState.count)),
            setTextJs("status", "ok:increment"),
            setDatasetJs("lastSpec", env.spec),
            setDatasetJs("lastCount", String(appState.count)),
          ].join("\n"),
        );
        return { ok: true };
      },

      reset: ({ cx: env }) => {
        appState.count = 0;
        hub.broadcast(
          "js",
          [
            setTextJs("count", "0"),
            setTextJs("status", "ok:reset"),
            setDatasetJs("lastSpec", env.spec),
            setDatasetJs("lastCount", "0"),
          ].join("\n"),
        );
        return { ok: true };
      },
    },
  });

  if (r.ok) return new Response(null, { status: 204 });
  return textResponse(r.message, r.status);
});

app.serve();
