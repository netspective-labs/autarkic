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
import type {
  NamingStrategy,
  RenderCtx,
} from "../../../lib/natural-html/design-system.ts";
import {
  bodyText,
  breadcrumbItem,
  callout,
  codeBlock,
  contextBrand,
  contextHeaderContent,
  contextNavLink,
  contextUser,
  featureCard,
  featureGrid,
  naturalDesignSystem,
  navLink,
  navSection,
  pageHeader,
  searchBar,
  sidebarHeader,
  tocLink,
  tocList,
} from "../../../lib/natural-ds/mod.ts";
import { icons } from "../../../lib/natural-html/assets.ts";
import * as H from "../../../lib/natural-html/elements.ts";
import {
  combineHast,
  headSlots,
  type RenderInput,
} from "../../../lib/natural-html/patterns.ts";

type State = Record<string, never>;
type Vars = Record<string, never>;

const app = Application.sharedState<State, Vars>({});
const ds = naturalDesignSystem();

const exampleMarkdown = `# Hello Markdown

This page demonstrates:

- Natural DS layout and components
- Remark (markdown -> HTML) in the browser
- Strongly typed client TS, auto-bundled to JS by the server

## Try editing this markdown

If you change \`/example.md\`, refresh the page and you will see the updated render.
`;

const docsPageHtml = (): string => {
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
    styleAttributeEmitStrategy: "head",
  });

  return H.render(page);
};

type DsCtx = RenderCtx<RenderInput, NamingStrategy>;

const pitchHeroButton = (
  ctx: DsCtx,
  label: string,
  href: string,
  primary = true,
) =>
  H.a(
    {
      href,
      style: ctx.css({
        borderRadius: "999px",
        padding: "14px 34px",
        fontSize: "0.95rem",
        fontWeight: 600,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        letterSpacing: "0.01em",
        textDecoration: "none",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
        backgroundColor: primary ? "#1c1b1a" : "transparent",
        color: primary ? "#fefcf7" : "#1b1a17",
        border: primary ? "none" : "1px solid rgba(27, 26, 22, 0.35)",
        boxShadow: primary
          ? "0 12px 30px rgba(27, 26, 22, 0.35)"
          : "0 0 0 rgba(0, 0, 0, 0)",
      }),
    },
    H.text(label),
  );

const pitchFeatureCards = (ctx: DsCtx) =>
  featureGrid(ctx, {
    cards: [
      featureCard(ctx, {
        icon: "📚",
        title: "Autarkic",
        description: "Deno-first UI shell for docs, automation, and dashboards.",
      }),
      featureCard(ctx, {
        icon: "🚀",
        title: "ContinuUX",
        description:
          "Typed HTTP routing, proxies, and bundlers designed for curated experiences.",
      }),
      featureCard(ctx, {
        icon: "🎨",
        title: "Natural DS",
        description:
          "Structural layouts, regions, and components for docs-quality design.",
      }),
      featureCard(ctx, {
        icon: "🧬",
        title: "Natural HTML",
        description:
          "Runtime primitives with deterministic rendering and head slot control.",
      }),
    ],
  });

const pitchDocsHighlights = (ctx: DsCtx) =>
  H.div(
    {
      style: ctx.css({
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: "18px",
      }),
    },
    callout(ctx, {
      title: "Library-grade services",
      icon: icons.info,
      variant: "info",
      content:
        "Autarkic pairs Natural DS with ContinuUX bundles so you can ship docs and APIs from the same runtime.",
    }),
    callout(ctx, {
      title: "ContinuUX HTTP first",
      icon: icons.tip,
      variant: "tip",
      content:
        "Typed routing, proxies, and bundlers keep documentation, GitHub previews, and APIs in sync.",
    }),
    callout(ctx, {
      title: "Design system confidence",
      icon: icons.info,
      variant: "info",
      content:
        "Natural HTML, Natural DS, and custom layout slots deliver deterministic styles with no runtime magic.",
    }),
  );

const pitchHeroVisual = (ctx: DsCtx) =>
  H.div(
    {
      style: ctx.css({
        borderRadius: "28px",
        minHeight: "220px",
        background:
          "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.65), rgba(187, 147, 96, 0.4)), linear-gradient(180deg, #0a0a0a, #191616)",
        padding: "24px 32px",
        color: "#f4f1ea",
        boxShadow: "0 30px 60px rgba(0,0,0,0.35)",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        fontFamily: "SF Mono, Monaco, 'Courier New', monospace",
      }),
    },
    H.span(
      {
        style: ctx.css({
          letterSpacing: "0.25em",
          textTransform: "uppercase",
          fontSize: "0.65rem",
          color: "#f97316",
        }),
      },
      "Launch stack",
    ),
    H.div(
      { style: ctx.css({ fontSize: "1.8rem", lineHeight: 1.2 }) },
      "Autarkic · ContinuUX · Natural DS",
    ),
    H.codeTag("deno run -A --watch support/learn/03-natural-ds/guide.ts"),
    H.div(
      {
        style: ctx.css({
          display: "flex",
          justifyContent: "space-between",
          marginTop: "auto",
          fontSize: "0.85rem",
        }),
      },
      H.span("Docs ready"),
      H.span("CI friendly"),
    ),
  );

const pitchTryItSnippet = (ctx: DsCtx) =>
  codeBlock(ctx, {
    content: H.codeTag("deno run -A --watch support/learn/03-natural-ds/guide.ts"),
  });

const pitchCtaActions = (ctx: DsCtx) =>
  H.div(
    {
      style: ctx.css({
        display: "flex",
        gap: "16px",
        flexWrap: "wrap",
        justifyContent: "center",
      }),
    },
    pitchHeroButton(ctx, "View docs", "/docs", true),
    pitchHeroButton(
      ctx,
      "Open GitHub",
      "https://github.com/netspective-labs/autarkic",
      false,
    ),
  );

const pitchPageHtml = (): string => {
  const page = ds.page("NaturalPitch", {}, {
    slots: {
      heroBadge: () => H.text("Autarkic library"),
      heroTitle: () => H.text("Autarkic is the sales-ready docs shell"),
      heroSubtitle: () =>
        H.text(
          "Ship documentation, APIs, and automation with a single Deno-native runtime powered by ContinuUX and Natural Design System.",
        ),
      heroPrimaryAction: (ctx) =>
        pitchHeroButton(ctx, "View docs", "/docs", true),
      heroSecondaryAction: (ctx) =>
        pitchHeroButton(
          ctx,
          "Explore GitHub",
          "https://github.com/netspective-labs/autarkic",
          false,
        ),
      heroVisual: pitchHeroVisual,
      featureIntro: (ctx) =>
        bodyText(ctx, {
          content:
            "Autarkic bundles Natural DS layouts, Natural HTML primitives, and ContinuUX services so your docs, demos, and proxies stay in sync.",
        }),
      featureCards: pitchFeatureCards,
      tryItSnippet: pitchTryItSnippet,
      docsHighlights: pitchDocsHighlights,
      ctaTitle: () => H.text("Ready to launch your docs and APIs?"),
      ctaActions: pitchCtaActions,
      footerNote: () =>
        H.text(
          "Built for product teams, automation engineers, and documentation squads who need a predictable UI shell.",
        ),
    },
    headSlots: headSlots({
      title: "Autarkic Pitch",
      meta: [
        H.meta({ charset: "utf-8" }),
        H.meta({
          name: "viewport",
          content: "width=device-width, initial-scale=1",
        }),
      ],
    }),
    styleAttributeEmitStrategy: "head",
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
  new Response(pitchPageHtml(), {
    headers: { "content-type": "text/html; charset=utf-8" },
  }));

app.get("/docs", () =>
  new Response(docsPageHtml(), {
    headers: { "content-type": "text/html; charset=utf-8" },
  }));

app.get("/example.md", () =>
  new Response(exampleMarkdown, {
    headers: { "content-type": "text/markdown; charset=utf-8" },
  }));

app.serve({ port: 7456 });
