#!/usr/bin/env -S deno run -A --watch --node-modules-dir=auto
/**
 * @module support/learn/01-hello/counter-ce.ts
 *
 * ContinuUX “Hello World” (Counter) using Custom Elements as the primary
 * interactivity boundary.
 *
 * Stage 3 progression:
 * - SSR shell via Fluent HTML
 * - <counter-ce> owns dynamic behavior
 * - POST /ce/action for commands
 * - GET  /ce/sse?sessionId=... for server push
 *
 * The client module is plain JS (counter-ce.js) and uses
 * /.cx/browser-ua-aide.js (served by this app). No bundling.
 */

import { Application, textResponse } from "../../../lib/continuux/http.ts";
import { CxMiddlewareBuilder } from "../../../lib/continuux/interaction.ts";
import * as H from "../../../lib/natural-html/elements.ts";

type State = { count: number };
type Vars = Record<string, never>;
const appState: State = { count: 0 };

type CeSseEvents = {
  count: { value: number };
  status: { text: string };
};

const sseBuilder = new CxMiddlewareBuilder<CeSseEvents>({
  sseUrl: "/ce/sse",
  importUrl: "/.cx/browser-ua-aide.js",
  postUrl: "/ce/action",
});
const hub = sseBuilder.hub;

const here = new URL(".", import.meta.url);
const fsPath = (rel: string) => new URL(rel, here);

const pageHtml = (): string => {
  const aideAttrs = sseBuilder.userAgentAide.attrs;
  const { sseUrl, postUrl, sseWithCredentials } = sseBuilder.config;
  const sseCredValue = sseWithCredentials ? "true" : "false";

  return H.render(
    H.doctype(),
    H.html(
      {},
      H.head(
        H.meta({ charset: "utf-8" }),
        H.meta({
          name: "viewport",
          content: "width=device-width, initial-scale=1",
        }),
        H.title("ContinuUX Hello (Counter CE)"),
        H.link({
          rel: "stylesheet",
          href: "https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css",
        }),
      ),
      H.body(
        H.main(
          { class: "container", style: "max-width:720px; padding-top:2rem;" },
          H.hgroup(
            H.h1("ContinuUX Hello"),
            H.p("Counter app with Custom Element + SSE (no global UA)"),
          ),
          H.article(
            H.customElement("counter-ce")({
              [aideAttrs.sseUrl]: sseUrl,
              "data-cx-action-url": postUrl,
              [aideAttrs.postUrl]: postUrl,
              [aideAttrs.sseWithCredentials]: sseCredValue,
              style: "display:block;",
            }),
          ),
          H.small(
            { style: "display:block; margin-top:1rem;" },
            "Open two tabs to see shared in-memory state via SSE broadcasts.",
          ),
          H.script(
            { type: "module", id: "ceBoot" },
            H.javaScript`
              import { registerCounterCe } from "/counter-ce.js";
              registerCounterCe();
              window.__page_ready = "ok";
            `,
          ),
        ),
      ),
    ),
  );
};

const app = Application.sharedState<State, Vars>(appState);

app.use(
  sseBuilder.middleware<State, Vars>({
    uaCacheControl: "no-store",
    onConnect: async ({ session }) => {
      await session.sendWhenReady("count", { value: appState.count });
      await session.sendWhenReady("status", { text: "connected" });
    },
  }),
);

app.get("/", () =>
  new Response(pageHtml(), {
    headers: { "content-type": "text/html; charset=utf-8" },
  }));

// Serve the element module (plain JS).
app.get("/counter-ce.js", async () => {
  const p = await Deno.realPath(fsPath("./counter-ce.js"));
  let js = await Deno.readTextFile(p);

  // Rewrite ONLY what the browser can’t resolve (repo-relative -> served path).
  js = js.replace(
    "../../../lib/continuux/browser-ua-aide.js",
    "/.cx/browser-ua-aide.js",
  );

  return new Response(js, {
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "no-store",
    },
  });
});

// Command endpoint
app.post("/ce/action", async (c) => {
  const body = await c.readJson().catch(() => null);

  if (!body || typeof body !== "object") {
    return textResponse("bad request: JSON object expected", 400);
  }

  const action = (body as Record<string, unknown>).action;
  if (action !== "increment" && action !== "reset") {
    return textResponse(`bad request: unknown action ${String(action)}`, 400);
  }

  if (action === "increment") appState.count += 1;
  else appState.count = 0;

  hub.broadcast("count", { value: appState.count });
  hub.broadcast("status", { text: `ok:${action}` });

  return new Response(null, { status: 204 });
});

app.serve();
