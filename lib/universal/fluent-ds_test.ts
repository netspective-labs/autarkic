// lib/universal/fluent-ds_test.ts
import { assertEquals } from "@std/assert";
import {
  createDesignSystem,
  defineLayout,
  defineRegion,
  NamingStrategy,
  RenderCtx,
  slots,
} from "./fluent-ds.ts";
import * as h from "./fluent-html.ts";
import { breadcrumbs, card } from "./fluent-patterns.ts";

type RenderInput = Record<PropertyKey, never>;

const naming: NamingStrategy = {
  elemIdValue: (suggested, kind) => `${kind}-${suggested}`,
  elemDataAttr: (suggestedKeyName, _suggestedValue, _kind) =>
    `data-${suggestedKeyName}`,
  className: (suggested, kind) => `${kind}-${suggested}`,
};

Deno.test("fluent-ds: semantic body-only layout", () => {
  const uaDeps: h.UaDependency[] = [
    {
      mountPoint: "/_ua/body-only.css",
      canonicalSource: "https://example.test/body-only.css",
      nature: "reference",
      mimeType: "text/css",
    },
    {
      mountPoint: "/_ua/body-only.js",
      canonicalSource: "https://example.test/body-only.js",
      nature: "reference",
      mimeType: "application/javascript",
    },
  ];

  const bodyOnly = defineLayout({
    name: "BodyOnly",
    slots: slots({ required: ["content"] as const }),
    render: (ctx: RenderCtx<RenderInput, NamingStrategy>, _api, s) =>
      h.main(
        {
          class: ctx.cls("body"),
          id: ctx.naming.elemIdValue("body", "layout"),
        },
        s.content(ctx),
      ),
  });

  const ds = createDesignSystem<RenderInput>("body-only", naming)
    .policies({ wrappers: { enabled: false } })
    .uaDependencies(uaDeps)
    .layout(bodyOnly)
    .build();

  const page = h.renderPretty(
    ds.page("BodyOnly", {}, {
      slots: { content: () => h.p("Hello") },
    }),
  );

  assertEquals(
    page.trim(),
    `<!doctype html>
<html>
  <head>
    <link href="/_ua/body-only.css" rel="stylesheet">
    <script src="/_ua/body-only.js" type="module"></script>
  </head>
  <body>
    <main class="layout-body" id="layout-body">
      <p>Hello</p>
    </main>
  </body>
</html>`,
  );
});

Deno.test("fluent-ds: semantic header/main/footer layout", () => {
  const uaDeps: h.UaDependency[] = [
    {
      mountPoint: "/_ua/header-main-footer.css",
      canonicalSource: "https://example.test/header-main-footer.css",
      nature: "reference",
      mimeType: "text/css",
    },
    {
      mountPoint: "/_ua/header-main-footer.js",
      canonicalSource: "https://example.test/header-main-footer.js",
      nature: "reference",
      mimeType: "application/javascript",
    },
  ];

  const header = defineRegion({
    name: "Header",
    slots: slots({ required: ["title"] as const }),
    render: (ctx: RenderCtx<RenderInput, NamingStrategy>, s) =>
      h.header(
        {
          class: ctx.cls("site-header"),
          id: ctx.naming.elemIdValue("site-header", "region"),
        },
        h.h1(s.title(ctx)),
      ),
  });

  const main = defineRegion({
    name: "Main",
    slots: slots({ required: ["content"] as const }),
    render: (ctx: RenderCtx<RenderInput, NamingStrategy>, s) =>
      h.main(
        {
          class: ctx.cls("site-main"),
          id: ctx.naming.elemIdValue("site-main", "region"),
        },
        s.content(ctx),
      ),
  });

  const footer = defineRegion({
    name: "Footer",
    slots: slots({ required: ["content"] as const }),
    render: (ctx: RenderCtx<RenderInput, NamingStrategy>, s) =>
      h.footer(
        {
          class: ctx.cls("site-footer"),
          id: ctx.naming.elemIdValue("site-footer", "region"),
        },
        s.content(ctx),
      ),
  });

  const pageLayout = defineLayout({
    name: "PageLayout",
    slots: slots({
      required: ["title", "content", "footer"] as const,
    }),
    render: (ctx: RenderCtx<RenderInput, NamingStrategy>, api, s) =>
      h.section(
        { class: ctx.cls("page") },
        api.region("Header", { title: s.title }),
        api.region("Main", { content: s.content }),
        api.region("Footer", { content: s.footer }),
      ),
  });

  const ds = createDesignSystem<RenderInput>("header-main-footer", naming)
    .policies({ wrappers: { enabled: false } })
    .uaDependencies(uaDeps)
    .region(header)
    .region(main)
    .region(footer)
    .layout(pageLayout)
    .build();

  const page = h.renderPretty(
    ds.page("PageLayout", {}, {
      slots: {
        title: () => h.span("My Site"),
        content: () => h.p("Welcome"),
        footer: () => h.small("© 2026"),
      },
    }),
  );

  assertEquals(
    page.trim(),
    `<!doctype html>
<html>
  <head>
    <link href="/_ua/header-main-footer.css" rel="stylesheet">
    <script src="/_ua/header-main-footer.js" type="module"></script>
  </head>
  <body>
    <section class="layout-page">
      <header class="region-site-header" id="region-site-header">
        <h1><span>My Site</span></h1>
      </header>
      <main class="region-site-main" id="region-site-main">
        <p>Welcome</p>
      </main>
      <footer class="region-site-footer" id="region-site-footer"><small>© 2026</small></footer>
    </section>
  </body>
</html>`,
  );
});

Deno.test("fluent-ds: full semantic layout with components", () => {
  const uaDeps: h.UaDependency[] = [
    {
      mountPoint: "/_ua/full-layout.css",
      canonicalSource: "https://example.test/full-layout.css",
      nature: "reference",
      mimeType: "text/css",
    },
    {
      mountPoint: "/_ua/full-layout.js",
      canonicalSource: "https://example.test/full-layout.js",
      nature: "reference",
      mimeType: "application/javascript",
    },
  ];

  const header = defineRegion({
    name: "Header",
    slots: slots({ required: ["breadcrumbs"] as const }),
    render: (ctx: RenderCtx<RenderInput, NamingStrategy>, s) =>
      h.header(
        {
          class: ctx.cls("app-header"),
          id: ctx.naming.elemIdValue("app-header", "region"),
        },
        h.div({ class: ctx.cls("app-nav") }, s.breadcrumbs(ctx)),
      ),
  });

  const main = defineRegion({
    name: "Main",
    slots: slots({ required: ["content", "aside"] as const }),
    render: (ctx: RenderCtx<RenderInput, NamingStrategy>, s) =>
      h.main(
        {
          class: ctx.cls("app-main"),
          id: ctx.naming.elemIdValue("app-main", "region"),
        },
        h.article({ class: ctx.cls("app-article") }, s.content(ctx)),
        h.aside({ class: ctx.cls("app-aside") }, s.aside(ctx)),
      ),
  });

  const footer = defineRegion({
    name: "Footer",
    slots: slots({ required: ["content"] as const }),
    render: (ctx: RenderCtx<RenderInput, NamingStrategy>, s) =>
      h.footer(
        {
          class: ctx.cls("app-footer"),
          id: ctx.naming.elemIdValue("app-footer", "region"),
        },
        s.content(ctx),
      ),
  });

  const fullLayout = defineLayout({
    name: "FullLayout",
    slots: slots({
      required: ["breadcrumbs", "content", "aside", "footer"] as const,
    }),
    render: (ctx: RenderCtx<RenderInput, NamingStrategy>, api, s) =>
      h.section(
        { class: ctx.cls("app-shell") },
        api.region("Header", { breadcrumbs: s.breadcrumbs }),
        api.region("Main", { content: s.content, aside: s.aside }),
        api.region("Footer", { content: s.footer }),
      ),
  });

  const ds = createDesignSystem<RenderInput>("full-layout", naming)
    .policies({ wrappers: { enabled: false } })
    .uaDependencies(uaDeps)
    .region(header)
    .region(main)
    .region(footer)
    .layout(fullLayout)
    .build();

  const page = h.renderPretty(
    ds.page("FullLayout", {}, {
      slots: {
        breadcrumbs: (ctx) =>
          breadcrumbs(ctx, {
            items: [
              { label: "Home", href: "/" },
              { label: "Docs" },
            ],
          }),
        content: (ctx) =>
          card(ctx, {
            title: "Welcome",
            subtitle: "Getting started",
            class: "featured",
            body: () => h.p("Card body"),
            footer: () => h.a({ href: "/start" }, "Start"),
          }),
        aside: (ctx) =>
          h.ul(
            { class: ctx.cls("app-aside__list") },
            h.li("Item A"),
            h.li("Item B"),
          ),
        footer: () => h.small("Built with fluent-ds"),
      },
    }),
  );

  assertEquals(
    page.trim(),
    `<!doctype html>
<html>
  <head>
    <link href="/_ua/full-layout.css" rel="stylesheet">
    <script src="/_ua/full-layout.js" type="module"></script>
  </head>
  <body>
    <section class="layout-app-shell">
      <header class="region-app-header" id="region-app-header">
        <div class="region-app-nav">
          <nav aria-label="Breadcrumb" class="component-breadcrumbs" data-element-id="component-Breadcrumbs">
            <ol class="component-breadcrumbs__list">
              <li class="component-breadcrumbs__item"><a class="component-breadcrumbs__link" href="/">Home</a><span class="component-breadcrumbs__sep">/</span></li>
              <li class="component-breadcrumbs__item"><span>Docs</span></li>
            </ol>
          </nav>
        </div>
      </header>
      <main class="region-app-main" id="region-app-main">
        <article class="region-app-article">
          <section class="component-card component-featured" data-element-id="component-Card">
            <div class="component-card__header">
              <div class="component-card__heading">
                <div class="component-card__title">Welcome</div>
                <div class="component-card__subtitle">Getting started</div>
              </div>
            </div>
            <div class="component-card__body">
              <p>Card body</p>
            </div>
            <div class="component-card__footer"><a href="/start">Start</a></div>
          </section>
        </article>
        <aside class="region-app-aside">
          <ul class="region-app-aside__list">
            <li>Item A</li>
            <li>Item B</li>
          </ul>
        </aside>
      </main>
      <footer class="region-app-footer" id="region-app-footer"><small>Built with fluent-ds</small></footer>
    </section>
  </body>
</html>`,
  );
});
