#!/usr/bin/env -S deno run -A --watch --node-modules-dir=auto
/**
 * @module support/learn/01-hello/counter-ce.ts
 *
 * ContinuUX “Hello World” (Counter) using Custom Elements as the primary
 * interactivity boundary.
 */

import { Application } from "../../../lib/continuux/http.ts";
import {
  actionSchemas,
  createCx,
} from "../../../lib/continuux/interaction-html.ts";
import {
  type CxHandlerResult,
  CxMiddlewareBuilder,
  decodeCxEnvelope,
} from "../../../lib/continuux/interaction.ts";
import * as H from "../../../lib/natural-html/elements.ts";

const here = new URL(".", import.meta.url);
const counterScriptUrl = new URL("./counter-ce.js", here);

const appState = { count: 0 };

type State = typeof appState;
type Vars = Record<string, never>;

const interactivityAide = <
  State extends { count: number },
  Vars extends Record<string, unknown>,
>(
  state: State,
) => {
  const actions = actionSchemas({
    increment: decodeCxEnvelope,
    reset: decodeCxEnvelope,
  });

  type ServerEvents = {
    readonly count: { value: number };
    readonly status: { text: string };
  };

  const cx = createCx<State, Vars, typeof actions, ServerEvents>(actions);
  const builder = new CxMiddlewareBuilder<ServerEvents>({
    sseUrl: "/ce/sse",
    postUrl: "/ce/action",
    importUrl: "/.cx/browser-ua-aide.js",
  });
  const hub = builder.hub;

  const commitAction = (
    action: "increment" | "reset",
    nextValue?: number,
  ): CxHandlerResult => {
    if (typeof nextValue === "number") {
      state.count = nextValue;
    } else {
      state.count += 1;
    }

    hub.broadcast("count", { value: state.count });
    hub.broadcast("status", { text: `ok:${action}` });
    return { ok: true };
  };

  const middleware = builder.middleware<State, Vars, typeof actions, "action">({
    uaCacheControl: "no-store",
    onConnect: async ({ session }) => {
      await session.sendWhenReady("count", { value: state.count });
      await session.sendWhenReady("status", { text: "connected" });
    },
    interaction: {
      cx,
      handlers: {
        increment: () => commitAction("increment"),
        reset: () => commitAction("reset", 0),
      },
    },
  });

  return { cx, builder, middleware };
};

const { builder, middleware: interactivityMiddleware } = interactivityAide<
  State,
  Vars
>(appState);
const pageHtml = (): string => {
  const { sseUrl, postUrl, sseWithCredentials } = builder.config;
  const sseCredValue = sseWithCredentials ? "true" : "false";
  const aideAttrs = builder.userAgentAide.attrs;

  return H.render(
    H.doctype(),
    H.html(
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
app.use(interactivityMiddleware);
app.get(
  "/",
  () =>
    new Response(pageHtml(), {
      headers: { "content-type": "text/html; charset=utf-8" },
    }),
);

// this is necessary because in counter-ce.js we import "../../../lib/continuux/browser-ua-aide.js"
// so that the IDE editor can give us code completion and linting but
// browser-ua-aide.js is mounted at "/.cx/browser-ua-aide.js" when being browsed
// so we have to translate it here.
app.get("/counter-ce.js", async () => {
  const path = await Deno.realPath(counterScriptUrl);
  let js = await Deno.readTextFile(path);
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

app.serve();
