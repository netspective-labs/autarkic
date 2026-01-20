#!/usr/bin/env -S deno run -A --watch --unstable-bundle --node-modules-dir=auto
// support/dx/ds/corpus.ts
/**
 * ContinuUX "Hello World" (Corpus DS + Markdown) app.
 *
 * What this demonstrates end-to-end:
 * - Fluent DS docs layout on the server (no templating engine).
 * - Fully type-safe HTTP routing (Application).
 * - PicoCSS + Corpus DS UA dependencies.
 * - Browser-only Markdown rendering using remark from CDN:
 *   - Fetch /example.md (example markdown)
 *   - Render it to HTML in the browser
 *
 * Run:
 *   deno run -A --unstable-bundle support/dx/ds/corpus.ts
 *
 * Then open:
 *   http://127.0.0.1:8000
 */

import { autoTsJsBundler } from "../../../lib/continuux/bundle.ts";
import { Application } from "../../../lib/continuux/http.ts";
import * as H from "../../../lib/universal/fluent-html.ts";
import {
  corpusDesignSystem,
  docPageSlots,
} from "../../../lib/universal/fluent-ds-corpus.ts";
import { headSlots } from "../../../lib/universal/fluent-patterns.ts";

type State = Record<string, never>;
type Vars = Record<string, never>;

const app = Application.sharedState<State, Vars>({});
const ds = corpusDesignSystem();

const exampleMarkdown = `# Hello Markdown 👋

This page demonstrates:

- PicoCSS from CDN
- Remark (markdown -> HTML) in the browser
- Strongly typed client TS, auto-bundled to JS by the server

## Try editing this markdown

If you change \`/example.md\`, refresh the page and you’ll see the updated render.
`;

const pageHtml = (): string => {
  const slots = docPageSlots({
    title: () => H.span("ContinuUX Hello Markdown"),
    content: () =>
      H.div(
        H.div({ id: "status", "aria-busy": "true" }, "Loading markdown..."),
        H.div({ id: "content" }, ""),
        H.small(
          { style: "display:block; margin-top: 1rem;" },
          "Client code is served from ",
          H.codeTag("/markdown.client.ts"),
          " (bundled from TypeScript).",
        ),
      ),
    nav: {
      subjects: [
        { id: "docs", label: "Docs", href: "/docs" },
        { id: "guides", label: "Guides", href: "/guides" },
      ],
      trees: {
        docs: [
          {
            label: "Getting Started",
            href: "/docs/getting-started",
            active: true,
          },
          { label: "Reference", href: "/docs/reference" },
        ],
        guides: [
          { label: "Patterns", href: "/guides/patterns" },
          { label: "Recipes", href: "/guides/recipes" },
        ],
      },
      activeSubjectId: "docs",
      subjectLabel: "Subject",
      navLabel: "Chapters",
      selectId: "corpus-subject",
    },
    toc: () =>
      H.ol(
        H.li(H.a({ href: "#hello-markdown" }, "Hello Markdown")),
        H.li(
          H.a(
            { href: "#try-editing-this-markdown" },
            "Try editing this markdown",
          ),
        ),
      ),
    pageMeta: () => H.p(H.small("Updated: 2026-01-02")),
    globalNav: () =>
      H.ul(
        H.li(H.a({ href: "/docs" }, "Docs")),
        H.li(H.a({ href: "/api" }, "API")),
        H.li(H.a({ href: "/blog" }, "Blog")),
      ),
    searchBox: () => H.input({ type: "search", placeholder: "Search docs" }),
    footer: () => H.small("© 2026 Corpus DS"),
  });

  const page = ds.page("DocPage", {}, {
    slots,
    headSlots: headSlots({
      title: "ContinuUX Hello Markdown (Corpus DS)",
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
        ? new URL("../hello/markdown.client.ts", import.meta.url).pathname
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

app.serve();
