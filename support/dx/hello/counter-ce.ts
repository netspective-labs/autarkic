#!/usr/bin/env -S deno run -A --watch --node-modules-dir=auto
// support/dx/hello/counter-ce.ts
/**
 * @module support/dx/hello/counter-ce
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
import * as H from "../../../lib/natural-html/elements.ts";

type State = { count: number };
type Vars = Record<string, never>;
const appState: State = { count: 0 };

type CeSseEvents = {
  count: { value: number };
  status: { text: string };
};

const here = new URL(".", import.meta.url);
const fsPath = (rel: string) => new URL(rel, here);

const normalizeSid = (sid: string | null | undefined) => {
  const s = String(sid ?? "").trim();
  if (!s || s === "unknown") return null;
  return s;
};

// SSE hub (typed server -> client events)
type Session = {
  send: <K extends keyof CeSseEvents>(e: K, d: CeSseEvents[K]) => boolean;
  sendWhenReady: <K extends keyof CeSseEvents>(
    e: K,
    d: CeSseEvents[K],
  ) => Promise<boolean>;
  isClosed: () => boolean;
  close: () => void;
  ready: Promise<void>;
};

const sessions = new Map<string, Session>();

const broadcast = <K extends keyof CeSseEvents>(
  event: K,
  data: CeSseEvents[K],
) => {
  for (const [sid, s] of sessions) {
    if (s.isClosed()) {
      sessions.delete(sid);
      continue;
    }
    const ok = s.send(event, data);
    if (!ok) sessions.delete(sid);
  }
};

const pageHtml = (): string =>
  H.render(
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
              // what CxAide expects
              "data-cx-sse-url": "/ce/sse",
              "data-cx-action-url": "/ce/action", // if CxAide uses action-url
              "data-cx-post-url": "/ce/action", // if CxAide uses post-url (safe to include both)
              "data-cx-sse-with-credentials": "true",

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

const app = Application.sharedState<State, Vars>(appState);

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

// Serve the reusable aide module (plain JS).
app.get("/.cx/browser-ua-aide.js", async () => {
  const p = await Deno.realPath(
    fsPath("../../../lib/continuux/browser-ua-aide.js"),
  );
  const js = await Deno.readTextFile(p);
  return new Response(js, {
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "no-store",
    },
  });
});

app.get("/ce/sse", (c) =>
  c.sse<CeSseEvents>(async (session) => {
    const sid = normalizeSid(c.query("sessionId"));
    if (!sid) {
      try {
        session.close();
      } catch {
        // ignore
      }
      return;
    }

    // Replace existing session for same sid
    const prior = sessions.get(sid);
    if (prior) {
      try {
        prior.close();
      } catch {
        // ignore
      }
      sessions.delete(sid);
    }

    sessions.set(sid, session as unknown as Session);

    await session.sendWhenReady("count", { value: appState.count });
    await session.sendWhenReady("status", { text: "connected" });

    void session.ready.then(() => {
      queueMicrotask(() => {
        if ((session as unknown as Session).isClosed()) sessions.delete(sid);
      });
    });
  }));

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

  broadcast("count", { value: appState.count });
  broadcast("status", { text: `ok:${action}` });

  return new Response(null, { status: 204 });
});

app.serve();
