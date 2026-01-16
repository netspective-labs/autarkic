// lib/html/server/fluent-integration_test.ts
//
// Server-side integration tests (separate from browser harness).
// No third-party frameworks.
//
// This file is also "living documentation" for junior engineers.
// It shows how to:
// - Build full HTML pages using fluent tag functions (no JSX, no template strings)
// - Use builders (imperative children) for loops/conditionals
// - Compose attrs safely (attrs/cls/css helpers)
// - Emit DataStar-style data-* hypermedia attributes via JunxionUX
// - Serve HTML, JSON, SSE, and "partial HTML" endpoints from one Deno server
//
// Run:
//   deno test -A lib/html/server/fluent-integration_test.ts

import { assert, assertMatch } from "@std/assert";
import * as F from "./fluent.ts";

const getFreePort = () => {
  const l = Deno.listen({ hostname: "127.0.0.1", port: 0 });
  const port = (l.addr as Deno.NetAddr).port;
  l.close();
  return port;
};

const startTestServer = (handler: (req: Request) => Response) => {
  const port = getFreePort();
  const ac = new AbortController();
  const server = Deno.serve(
    { hostname: "127.0.0.1", port, signal: ac.signal },
    handler,
  );

  return {
    port,
    close: async () => {
      ac.abort();
      await server.finished.catch(() => {});
    },
  };
};

const htmlResponse = (html: string) =>
  new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });

const textResponse = (text: string) =>
  new Response(text, { headers: { "content-type": "text/plain" } });

const jsonResponse = (obj: unknown) =>
  new Response(JSON.stringify(obj), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });

Deno.test("integration: HTML route includes data-on:* attributes (builders + attrs merge)", async (t) => {
  const appName = "JunxionUX demo";
  const nav = [
    { href: "/", label: "Home" },
    { href: "/about", label: "About" },
    { href: "/items", label: "Items" },
  ];
  const items = ["alpha", "beta", "gamma"];

  // A tiny app router that returns HTML for some routes, JSON for others.
  const handler = (req: Request): Response => {
    const url = new URL(req.url);

    // Common page wrapper so every route returns consistent HTML.
    // This is a good pattern for juniors: build “layout” once and reuse it.
    const page = (title: string, body: F.RawHtml) =>
      F.render(
        F.doctype(),
        F.html({ lang: "en" }, (e) => {
          e(
            F.head((e) => {
              e(
                F.meta({ charset: "utf-8" }),
                F.meta({
                  name: "viewport",
                  content: "width=device-width, initial-scale=1",
                }),
                F.title(title),
                // Pico CSS (optional) keeps the sample readable.
                F.link({
                  rel: "stylesheet",
                  href:
                    "https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css",
                }),
              );
            }),
          );

          e(
            F.body((e) => {
              e(
                F.header({ class: "container" }, (e) => {
                  e(
                    F.nav((e) => {
                      e(F.ul(F.li(F.strong(appName))));
                      e(
                        F.ul(
                          // Use each() to avoid common mistakes:
                          // - forgetting to return from .map()
                          // - accidentally creating nested arrays
                          F.each(nav, (it) =>
                            F.li(F.a({ href: it.href }, it.label))),
                        ),
                      );
                    }),
                  );
                }),
              );

              e(body);

              e(
                F.footer({ class: "container" }, (e) => {
                  e(F.small("integration test page"));
                }),
              );
            }),
          );
        }),
      );

    // Home page: demonstrates JunxionUX clickGet.
    if (url.pathname === "/") {
      const hx = F.JunxionUX.clickGet("/ping");

      const body = F.main({ class: "container" }, (e) => {
        e(
          F.h1("Home"),
          F.p(
            "This page shows a button wired to a server route using data-on:* attributes.",
          ),
          // attrs() merges objects deterministically, later wins.
          F.button(F.attrs({ id: "ping", type: "button" }, hx), "Ping"),
          F.p({ id: "result" }, "not clicked"),
          // Inline JS using scriptJs() (no raw() required)
          F.scriptJs(
            [
              "(() => {",
              "  const btn = document.getElementById('ping');",
              "  const out = document.getElementById('result');",
              "  if (!btn || !out) return;",
              "  btn.addEventListener('click', () => { out.textContent = 'clicked'; });",
              "})();",
            ].join("\n"),
          ),
        );
      });

      return htmlResponse(page("Home", body));
    }

    // About page: demonstrates style and class helpers.
    if (url.pathname === "/about") {
      const body = F.main({ class: "container" }, (e) => {
        e(
          F.h1("About"),
          F.p("This page demonstrates cls() and css() helpers."),
          F.div(
            {
              class: F.cls("notice", { highlight: true, muted: false }),
              style: F.css({ backgroundColor: "#f6f6f6", padding: "1rem" }),
            },
            (e) => {
              e(
                F.p("cls() accepts strings, arrays, and {name:boolean} maps."),
                F.p(
                  "css() accepts a simple style object and produces stable output.",
                ),
              );
            },
          ),
        );
      });

      return htmlResponse(page("About", body));
    }

    // Items page: demonstrates builder loops, conditional rendering, and partial HTML route.
    if (url.pathname === "/items") {
      const body = F.main({ class: "container" }, (e) => {
        e(
          F.h1("Items"),
          F.p(
            "This page demonstrates builder loops and conditional rendering.",
          ),
          F.ul((e) => {
            for (const it of items) {
              // Typical “looped children” pattern:
              e(F.li(F.codeTag(it)));
            }
          }),
          // Conditional rendering: just do it in normal TypeScript.
          F.children((e) => {
            if (items.length >= 3) e(F.p(F.small("We have at least 3 items.")));
          }),
          F.hr(),
          F.p("You can also fetch partial HTML from /partials/items-list."),
        );
      });

      return htmlResponse(page("Items", body));
    }

    // This “partial HTML” route is useful for hypermedia systems:
    // return an HTML fragment the client can morph/replace into an existing DOM node.
    if (url.pathname === "/partials/items-list") {
      const partial = F.render(
        F.ul((e) => {
          for (const it of items) e(F.li(it));
        }),
      );
      return htmlResponse(partial);
    }

    // JSON route for completeness (not required by the fluent builder, but common in real apps).
    if (url.pathname === "/api/items") {
      return jsonResponse({ items });
    }

    // Ping used by the JunxionUX button.
    if (url.pathname === "/ping") {
      return textResponse("ok");
    }

    return new Response("not found", { status: 404 });
  };

  const srv = startTestServer(handler);
  try {
    await t.step(
      "home page includes JunxionUX clickGet attribute",
      async () => {
        const res = await fetch(`http://127.0.0.1:${srv.port}/`);
        const text = await res.text();

        // We validate the exact attribute vocabulary this library is designed to emit.
        assertMatch(text, /id="ping"/);
        assertMatch(text, /data-on:click="@get\(&quot;\/ping&quot;\)"/);

        // Also show that we can include script content via scriptJs().
        assertMatch(
          text,
          /<script>[\s\S]*addEventListener\('click'[\s\S]*<\/script>/,
        );
      },
    );

    await t.step(
      "about page shows cls() and css() output in attributes",
      async () => {
        const res = await fetch(`http://127.0.0.1:${srv.port}/about`);
        const text = await res.text();

        // class contains tokens generated by cls().
        assertMatch(text, /class="notice highlight"/);

        // css() is stable and kebab-cases keys; we just spot-check presence.
        assertMatch(text, /style="background-color:#f6f6f6;padding:1rem;"/);
      },
    );

    await t.step(
      "items page includes list items rendered via builder loop",
      async () => {
        const res = await fetch(`http://127.0.0.1:${srv.port}/items`);
        const text = await res.text();

        // Spot-check the loop output.
        assertMatch(text, /<li><code>alpha<\/code><\/li>/);
        assertMatch(text, /<li><code>beta<\/code><\/li>/);
        assertMatch(text, /<li><code>gamma<\/code><\/li>/);

        // Conditional message included.
        assertMatch(text, /We have at least 3 items\./);
      },
    );

    await t.step(
      "partial HTML route returns an HTML fragment (no doctype/html/body)",
      async () => {
        const res = await fetch(
          `http://127.0.0.1:${srv.port}/partials/items-list`,
        );
        const text = await res.text();

        // This is intentionally a fragment, not a full document.
        assert(!text.toLowerCase().includes("<!doctype html>"));
        assertMatch(text, /<ul>[\s\S]*<\/ul>/);
        assertMatch(text, /<li>alpha<\/li>/);
      },
    );

    await t.step("JSON route returns application/json", async () => {
      const res = await fetch(`http://127.0.0.1:${srv.port}/api/items`);
      const ct = res.headers.get("content-type") ?? "";
      assert(ct.includes("application/json"));

      const json = await res.json() as { items: string[] };
      assert(json.items.length === 3);
    });
  } finally {
    await srv.close();
  }
});

Deno.test("integration: SSE endpoint returns event-stream and yields events", async (t) => {
  const handler = (req: Request): Response => {
    const url = new URL(req.url);

    if (url.pathname === "/sse") {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const enc = new TextEncoder();

          controller.enqueue(enc.encode("event: message\n"));
          controller.enqueue(enc.encode("data: hello\n\n"));

          controller.enqueue(enc.encode("event: message\n"));
          controller.enqueue(enc.encode("data: world\n\n"));

          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          "connection": "keep-alive",
        },
      });
    }

    return new Response("not found", { status: 404 });
  };

  const srv = startTestServer(handler);
  try {
    await t.step("fetch returns event-stream content-type", async () => {
      const res = await fetch(`http://127.0.0.1:${srv.port}/sse`);
      const ct = res.headers.get("content-type") ?? "";
      assert(ct === "text/event-stream" || ct.startsWith("text/event-stream"));

      // IMPORTANT (Deno leak detector):
      // If we only inspect headers, we still must close/cancel the body stream.
      await res.body?.cancel();
    });

    await t.step("reader yields all SSE chunks", async () => {
      const res = await fetch(`http://127.0.0.1:${srv.port}/sse`);
      const reader = res.body?.getReader();
      assert(reader);

      const chunks: string[] = [];
      const dec = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        chunks.push(dec.decode(value));
      }

      const all = chunks.join("");
      assertMatch(all, /data: hello/);
      assertMatch(all, /data: world/);
    });
  } finally {
    await srv.close();
  }
});

Deno.test("integration: HTML route can use scriptJs helper without raw()", async (t) => {
  const handler = (req: Request): Response => {
    const url = new URL(req.url);

    if (url.pathname === "/") {
      const html = F.render(
        F.doctype(),
        F.html(
          { lang: "en" },
          F.head(F.title("js")),
          F.body((e) => {
            // This test exists because juniors often try to inline JS as a string child
            // under <script> and then wonder why it gets escaped. Use scriptJs().
            e(F.button({ id: "b", type: "button" }, "B"));
            e(F.p({ id: "s" }, "idle"));
            e(
              F.scriptJs(
                [
                  "(() => {",
                  "  const b = document.getElementById('b');",
                  "  const s = document.getElementById('s');",
                  "  if (!b || !s) return;",
                  "  b.addEventListener('click', () => { s.textContent = 'ok'; });",
                  "})();",
                ].join("\n"),
              ),
            );
          }),
        ),
      );

      return htmlResponse(html);
    }

    return new Response("not found", { status: 404 });
  };

  const srv = startTestServer(handler);
  try {
    await t.step("html includes script body", async () => {
      const res = await fetch(`http://127.0.0.1:${srv.port}/`);
      const text = await res.text();
      assertMatch(
        text,
        /<script>[\s\S]*addEventListener\('click'[\s\S]*<\/script>/,
      );
    });
  } finally {
    await srv.close();
  }
});
