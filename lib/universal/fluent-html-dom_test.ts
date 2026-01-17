/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
// lib/universal/fluent-html-dom_test.ts
//
// Deno + Playwright harness that:
// 1) starts a tiny HTTP server (Deno.serve, Deno 2.x)
// 2) serves an HTML fixture that uses lib/universal/fluent-html-dom.js
// 3) loads it in Chromium
// 4) captures:
//    - "view source" equivalent: the raw HTTP response body
//    - rendered DOM: page.content() after JS runs
// 5) pretty-prints DOM HTML in the browser via CDN (Prettier) and returns it to Deno
//
// Run:
//   deno test -A lib/universal/fluent-html-dom_test.ts

import { assertEquals } from "@std/assert";
// deno-lint-ignore no-import-prefix
import { chromium } from "npm:playwright@1";

// deno-lint-ignore no-explicit-any
type Any = any;

type ServerCtl = {
  readonly baseUrl: string;
  close(): void;
};

function normalizeNewlines(s: string): string {
  return s.replaceAll("\r\n", "\n");
}

function stripPlaywrightDoctypeQuirks(s: string): string {
  return s.replace(/^<!DOCTYPE html>/, "<!doctype html>");
}

function trimTrailingWhitespacePerLine(s: string): string {
  return s.split("\n").map((l) => l.replace(/\s+$/g, "")).join("\n");
}

function normalizeHtmlForCompare(s: string): string {
  let out = normalizeNewlines(s);
  out = stripPlaywrightDoctypeQuirks(out);
  out = trimTrailingWhitespacePerLine(out);
  return out;
}

async function startServer(): Promise<ServerCtl> {
  const domLibUrlPath = "/lib/universal/fluent-html-dom.js";

  // CDN pretty printer (Prettier standalone + HTML parser)
  // Note: this requires network access from the browser.
  const prettierStandalone = "https://unpkg.com/prettier@3.3.3/standalone.mjs";
  const prettierHtmlParser =
    "https://unpkg.com/prettier@3.3.3/plugins/html.mjs";

  const fixtureHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>fluent-html-dom fixture</title>
  </head>
  <body>
    <main id="app"></main>

    <script type="module">
      import * as F from "${domLibUrlPath}";

      const app = document.getElementById("app");

      const nav = [
        { href: "#main", label: "Main" },
        { href: "#footer", label: "Footer" },
      ];

      const node = F.div(
        { class: F.cls("container", { compact: true }) },
        F.header(
          F.nav(
            F.ul(F.li(F.strong("Fluent DOM"))),
            F.ul(
              F.each(nav, (it) => F.li(F.a({ href: it.href }, it.label))),
            ),
          ),
        ),
        F.main(
          { id: "main" },
          F.h1("Hello"),
          F.p("This page is rendered in the browser using fluent DOM."),
          F.section(
            F.h2("Actions"),
            F.button({ type: "button", id: "btn" }, "Click me"),
            F.p(F.small("JS will update the status below.")),
            F.p({ id: "status" }, "idle"),
          ),
        ),
        F.footer(
          { id: "footer" },
          F.small("© 2026"),
        ),
        F.script(
          F.javaScript\`
            (() => {
              const btn = document.getElementById('btn');
              const status = document.getElementById('status');
              if (!btn || !status) return;
              btn.addEventListener('click', () => { status.textContent = 'clicked'; });
            })();
          \`,
        ),
      );

      if (app) app.replaceWith(node);
    </script>

    <script type="module">
      import prettier from "${prettierStandalone}";
      import htmlPlugin from "${prettierHtmlParser}";

      // Expose a small pretty-printer hook to Playwright.
      // We keep it narrowly scoped to avoid globals, but Playwright can call this.
      window.__prettyHtml = async (html) => {
        // Prettier returns a Promise for ESM builds; await handles both sync/async.
        return await prettier.format(String(html ?? ""), {
          parser: "html",
          plugins: [htmlPlugin],
        });
      };

      window.__prettyFirstDivInBody = async () => {
        const div = document.body.querySelector("div");
        const html = div ? div.outerHTML : "";
        return await window.__prettyHtml(html);
      };
    </script>
  </body>
</html>
`;

  const domLib = await Deno.readTextFile(
    new URL("./fluent-html-dom.js", import.meta.url),
  );

  const handler = (req: Request): Response => {
    const url = new URL(req.url);

    if (url.pathname === "/") {
      return new Response("ok", { status: 200 });
    }

    if (url.pathname === "/fixture.html") {
      return new Response(fixtureHtml, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    if (url.pathname === domLibUrlPath) {
      return new Response(domLib, {
        status: 200,
        headers: { "content-type": "text/javascript; charset=utf-8" },
      });
    }

    return new Response("not found", { status: 404 });
  };

  const abort = new AbortController();

  const server = Deno.serve(
    {
      hostname: "127.0.0.1",
      port: 0,
      signal: abort.signal,
      onListen: () => {},
    },
    handler,
  );

  const addr = server.addr as Deno.NetAddr;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  return {
    baseUrl,
    close() {
      abort.abort();
    },
  };
}

const goldenHTML = `
<div class="container compact">
  <header>
    <nav>
      <ul>
        <li><strong>Fluent DOM</strong></li>
      </ul>
      <ul>
        <li><a href="#main">Main</a></li>
        <li><a href="#footer">Footer</a></li>
      </ul>
    </nav>
  </header>
  <main id="main">
    <h1>Hello</h1>
    <p>This page is rendered in the browser using fluent DOM.</p>
    <section>
      <h2>Actions</h2>
      <button id="btn" type="button">Click me</button>
      <p><small>JS will update the status below.</small></p>
      <p id="status">idle</p>
    </section>
  </main>
  <footer id="footer"><small>© 2026</small></footer>
  <script>
    (() => {
      const btn = document.getElementById('btn');
      const status = document.getElementById('status');
      if (!btn || !status) return;
      btn.addEventListener('click', () => { status.textContent = 'clicked'; });
    })();
  </script>
</div>`.trim();

Deno.test("fluent-html-dom: end-to-end server fixture → browser DOM → pretty HTML snapshot", async () => {
  const server = await startServer();

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    const fixtureUrl = `${server.baseUrl}/fixture.html`;

    // "View source" equivalent (unused here, but kept as a sanity fetch)
    const sourceRes = await fetch(fixtureUrl);
    const _sourceHtml = normalizeHtmlForCompare(await sourceRes.text());

    await page.goto(fixtureUrl, { waitUntil: "networkidle" });

    await page.waitForSelector("text=Fluent DOM");

    // Wait until the pretty-printer hook is available (CDN modules loaded)
    await page.waitForFunction(() =>
      typeof (window as Any).__prettyFirstDivInBody === "function"
    );

    const prettyFirstDivHtml = await page.evaluate(async () => {
      const fn = (window as Any)
        .__prettyFirstDivInBody as (() => Promise<string>);
      return await fn();
    });

    const prettyNorm = normalizeHtmlForCompare(prettyFirstDivHtml);
    assertEquals(prettyNorm.trim(), goldenHTML);
  } finally {
    await page.close();
    await browser.close();
    server.close();
  }
});
