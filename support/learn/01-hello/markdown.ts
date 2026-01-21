#!/usr/bin/env -S deno run -A --watch --unstable-bundle --node-modules-dir=auto
/**
 * ContinuUX “Hello World” (Markdown) app.
 *
 * What this demonstrates end-to-end:
 * - Fluent HTML on the server (no templating engine).
 * - Fully type-safe HTTP routing (Application).
 * - PicoCSS via CDN (no build step).
 * - Browser-only Markdown rendering using remark from CDN:
 *   - Fetch /README.md (example markdown)
 *   - Render it to HTML in the browser
 *
 * Run:
 *   deno run -A --unstable-bundle support/learn/01-hello/markdown.ts
 *
 * Then open:
 *   http://127.0.0.1:7690
 */

import { autoTsJsBundler } from "../../../lib/continuux/bundle.ts";
import * as H from "../../../lib/natural-html/elements.ts";
import { Application } from "../../../lib/continuux/http.ts";

type State = Record<string, never>;
type Vars = Record<string, never>;

const app = Application.sharedState<State, Vars>({});

const exampleMarkdown = `# Hello Markdown 👋

This page demonstrates:

- PicoCSS from CDN
- Remark (markdown -> HTML) in the browser
- Strongly typed client TS, auto-bundled to JS by the server

## Try editing this markdown

If you change \`/example.md\`, refresh the page and you’ll see the updated render.
`;

const pageHtml = (): string => {
  const picoHref =
    "https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css";

  return H.render(
    H.doctype(),
    H.html(
      { lang: "en" },
      H.head(
        H.meta({ charset: "utf-8" }),
        H.meta({
          name: "viewport",
          content: "width=device-width, initial-scale=1",
        }),
        H.title("ContinuUX Hello Markdown"),
        H.link({ rel: "stylesheet", href: picoHref }),
        H.style(`
          :root {
            font-size: 85%;
          }
        `),
      ),
      H.body(
        H.main(
          { class: "container", style: "max-width: 820px; padding-top: 2rem;" },
          H.hgroup(
            H.h1("ContinuUX Hello Markdown"),
            H.p("PicoCSS + Remark in-browser markdown rendering (bundled TS)"),
          ),
          H.article(
            H.div({ id: "status", "aria-busy": "true" }, "Loading markdown..."),
            H.div({ id: "content" }, ""),
          ),
          H.small(
            { style: "display:block; margin-top: 1rem;" },
            "Client code is served from ",
            H.codeTag("/markdown.client.ts"),
            " (bundled from TypeScript).",
          ),
        ),
        // Load bundled client JS
        H.script({ type: "module", src: "/markdown.client.ts" }),
      ),
    ),
  );
};

// Put middleware BEFORE routes.
// 1) Add a top-level request logger middleware FIRST.
app.use(async (c, next) => {
  const u = new URL(c.req.url);
  console.log("[req]", c.req.method, u.pathname);
  return await next();
});

// Bundle the strongly-typed client TS into browser JS on demand (cached in memory).
app.use(
  autoTsJsBundler({
    isCandidate: (url) =>
      url.pathname == "/markdown.client.ts"
        ? new URL("./markdown.client.ts", import.meta.url).pathname
        : false,
    jsThrowStatus: () => 200, // show message in the browser
  }),
);

app.get("/", () =>
  new Response(pageHtml(), {
    headers: { "content-type": "text/html; charset=utf-8" },
  }));

app.get("/example.md", () =>
  new Response(exampleMarkdown, {
    headers: { "content-type": "text/markdown; charset=utf-8" },
  }));

app.serve({ port: 7690 });
