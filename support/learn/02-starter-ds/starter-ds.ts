#!/usr/bin/env -S deno run -A --watch --unstable-bundle --node-modules-dir=auto
/**
 * ContinuUX "Hello World" (Starter DS + Markdown) app.
 *
 * What this demonstrates end-to-end:
 * - Fluent DS starter layout on the server (no templating engine).
 * - Fully type-safe HTTP routing (Application).
 * - PicoCSS via DS UA dependencies.
 * - Browser-only Markdown rendering using remark from CDN:
 *   - Fetch /example.md (example markdown)
 *   - Render it to HTML in the browser
 *
 * Run:
 *   deno run -A --unstable-bundle support/learn/02-starter-ds/starter-ds.ts
 *
 * Then open:
 *   http://127.0.0.1:7665
 */

import { autoTsJsBundler } from "../../../lib/continuux/bundle.ts";
import { Application } from "../../../lib/continuux/http.ts";
import * as H from "../../../lib/natural-html/elements.ts";
import { headSlots } from "../../../lib/natural-html/patterns.ts";
import { starterDesignSystem } from "../../../lib/natural-html/starter-ds.ts";

type State = Record<string, never>;
type Vars = Record<string, never>;

const app = Application.sharedState<State, Vars>({});
const ds = starterDesignSystem();

const exampleMarkdown = `# Hello Markdown 👋

This page demonstrates:

- PicoCSS from CDN
- Remark (markdown -> HTML) in the browser
- Strongly typed client TS, auto-bundled to JS by the server

## Try editing this markdown

If you change \`/example.md\`, refresh the page and you’ll see the updated render.
`;

const pageHtml = (): string => {
  const page = ds.page("Starter", {}, {
    slots: {
      title: () => H.span("ContinuUX Hello Markdown"),
      lead: () =>
        H.p("PicoCSS + Remark in-browser markdown rendering (bundled TS)."),
      content: () =>
        H.div(
          H.article(
            H.div(
              { id: "status", "aria-busy": "true" },
              "Loading markdown...",
            ),
            H.div({ id: "content" }, ""),
          ),
          H.small(
            { style: "display:block; margin-top: 1rem;" },
            "Client code is served from ",
            H.codeTag("/markdown.client.ts"),
            " (bundled from TypeScript).",
          ),
        ),
    },
    headSlots: headSlots({
      title: "ContinuUX Hello Markdown (Starter DS)",
      meta: [
        H.meta({ charset: "utf-8" }),
        H.meta({
          name: "viewport",
          content: "width=device-width, initial-scale=1",
        }),
      ],
      scripts: [H.script({ type: "module", src: "/markdown.client.ts" })],
    }),
  });

  return H.render(page);
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
        ? new URL("../01-hello/markdown.client.ts", import.meta.url).pathname
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

app.serve({ port: 7665 });
