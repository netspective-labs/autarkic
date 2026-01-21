#!/usr/bin/env -S deno run -A --watch --unstable-bundle --node-modules-dir=auto
/**
 * ContinuUX "Fancy Hello World" (Natural DS + Markdown) app.
 *
 * What this demonstrates end-to-end:
 * - Natural DS layout on the server (no templating engine).
 * - Fully type-safe HTTP routing (Application).
 * - Natural DS styles via DS head slots.
 * - Browser-only Markdown rendering using remark from CDN:
 *   - Fetch /example.md (example markdown)
 *   - Render it to HTML in the browser
 *
 * Run:
 *   deno run -A --unstable-bundle support/learn/03-natural-ds/hello-fancy.ts
 *
 * Then open:
 *   http://127.0.0.1:7456
 */

import { autoTsJsBundler } from "../../../lib/continuux/bundle.ts";
import { Application } from "../../../lib/continuux/http.ts";
import {
  bodyText,
  breadcrumbItem,
  contextBrand,
  contextHeaderContent,
  contextNavLink,
  contextUser,
  naturalDesignSystem,
  navLink,
  navSection,
  pageHeader,
  searchBar,
  sidebarHeader,
  tocLink,
  tocList,
} from "../../../lib/natural-ds/mod.ts";
import * as H from "../../../lib/natural-html/elements.ts";
import { combineHast, headSlots } from "../../../lib/natural-html/patterns.ts";

type State = Record<string, never>;
type Vars = Record<string, never>;

const app = Application.sharedState<State, Vars>({});
const ds = naturalDesignSystem();

const svg = (markup: string) => H.trustedRaw(markup);

const icons = {
  search: svg(
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
  ),
  toggle: svg(
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line></svg>',
  ),
};

const exampleMarkdown = `# Hello Markdown

This page demonstrates:

- Natural DS layout and components
- Remark (markdown -> HTML) in the browser
- Strongly typed client TS, auto-bundled to JS by the server

## Try editing this markdown

If you change \`/example.md\`, refresh the page and you will see the updated render.
`;

const pageHtml = (): string => {
  const page = ds.page("NaturalDoc", {}, {
    slots: {
      contextHeader: (ctx) =>
        contextHeaderContent(ctx, {
          brand: contextBrand(ctx, {
            label: "ContinuUX",
            iconText: "DS",
          }),
          nav: [
            contextNavLink(ctx, {
              label: "Hello",
              active: true,
            }),
          ],
          actions: [],
          user: contextUser(ctx, {
            initials: "UX",
            name: "ContinuUX",
          }),
        }),
      sidebar: (ctx) =>
        H.div(
          sidebarHeader(ctx, {
            label: "Natural DS",
            iconText: "ND",
            toggleIcon: icons.toggle,
          }),
          searchBar(ctx, {
            placeholder: "Search docs...",
            icon: icons.search,
            shortcut: ["Cmd", "K"],
          }),
          navSection(ctx, {
            children: [
              navLink(ctx, {
                label: "Hello Markdown",
                href: "#hello",
                active: true,
              }),
              navLink(ctx, { label: "Example Markdown", href: "#example" }),
            ],
          }),
        ),
      breadcrumbs: (ctx) =>
        combineHast(
          breadcrumbItem(ctx, { label: "Home", href: "#", home: true }),
          H.span(
            { class: "breadcrumb-separator", "aria-hidden": "true" },
            ">",
          ),
          breadcrumbItem(ctx, { label: "Hello DS", current: true }),
        ),
      content: (ctx) =>
        H.div(
          pageHeader(ctx, {
            title: "Hello Markdown",
            description:
              "Natural DS layout with in-browser markdown rendering.",
          }),
          H.section(
            { id: "hello" },
            bodyText(ctx, {
              content:
                "This page serves a TypeScript client bundle that fetches and renders markdown on the client.",
            }),
          ),
          H.section(
            { id: "example", style: "margin-top: 24px;" },
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
        ),
      toc: (ctx) =>
        tocList(ctx, {
          title: "On this page",
          items: [
            tocLink(ctx, {
              label: "Hello Markdown",
              href: "#hello",
              active: true,
            }),
            tocLink(ctx, { label: "Example Markdown", href: "#example" }),
          ],
        }),
    },
    headSlots: headSlots({
      title: "ContinuUX Hello Markdown (Natural DS)",
      meta: [
        H.meta({ charset: "utf-8" }),
        H.meta({
          name: "viewport",
          content: "width=device-width, initial-scale=1",
        }),
      ],
      scripts: [H.script({ type: "module", src: "/markdown.client.ts" })],
    }),
    cssStyleEmitStrategy: "class-style-head",
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

app.serve({ port: 7456 });
