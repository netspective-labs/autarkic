// lib/universal/fluent-ds-sematic_test.ts

import { assertEquals } from "@std/assert";
import {
  a,
  type BreadcrumbItem,
  cls,
  type ContentApi,
  createDesignSystem,
  defaultDesignSystem,
  type DsChild,
  type FooterApi,
  type FooterLink,
  fragment,
  type HeaderApi,
  li,
  type NavItem,
  p,
  renderPretty,
  type RightRailApi,
  section,
  semanticLayout,
  type SidebarApi,
  span,
  ul,
  type VariantFn,
} from "./fluent-ds-sematic.ts";

/* --------------------------------- Logging -------------------------------- */

const registeredHtml: Array<{
  testCase: string;
  suggestFileName: string;
  html: string;
}> = [];

function registerHTML(
  html: string,
  opts: { testCase: string; suggestFileName: string },
) {
  registeredHtml.push({ ...opts, html });
}

/* ---------------------------------- Tests --------------------------------- */

Deno.test("cls() and fragment() basic behavior", () => {
  const classes = cls("a", false, undefined, "b", ["c", false, "d"]);
  const node = fragment(
    span({ class: classes }, "hello"),
    section({ class: "x" }, "world"),
  );

  const actual = renderPretty(node).trim();
  registerHTML(actual, {
    testCase: "cls and fragment basic behavior",
    suggestFileName: "cls-fragment.html",
  });

  assertEquals(
    actual.trim(),
    `<template><span class="a b c d">hello</span><section class="x">world</section></template>`,
  );
});

Deno.test("defaultDesignSystem: built-in variants render (all regions)", () => {
  const headerBasic = defaultDesignSystem.header.use("basic", {
    title: "Docs",
    breadcrumbs: [
      { label: "Home", href: "/" },
      { label: "Docs" },
    ] satisfies BreadcrumbItem[],
    actions: fragment(
      a({ href: "/profile" }, "Profile"),
      span(" | "),
      a({ href: "/logout" }, "Logout"),
    ),
  });

  const headerMinimal = defaultDesignSystem.header.use("minimal", {
    title: "Minimal",
  });

  const sidebarNav = defaultDesignSystem.sidebar.use("nav", {
    title: "Menu",
    items: [
      { label: "Dashboard", href: "/dash", active: true },
      { label: "Reports", href: "/reports" },
    ] satisfies NavItem[],
  });

  const sidebarEmpty = defaultDesignSystem.sidebar.use("empty", {});

  const contentStandard = defaultDesignSystem.content.use("standard", {
    pageTitle: "Dashboard",
    description: p("Welcome back."),
    actions: fragment(
      a({ href: "/new" }, "New"),
      span(" "),
      a({ href: "/help" }, "Help"),
    ),
    body: fragment(
      section({ class: "card" }, p("Card A")),
      section({ class: "card" }, p("Card B")),
    ),
  });

  const rightRailPanel = defaultDesignSystem.rightRail.use("panel", {
    title: "Tips",
    body: ul(
      { class: "tips" },
      [li({}, "Use semantic tags."), li({}, "Keep variants small.")],
    ),
  });

  const rightRailEmpty = defaultDesignSystem.rightRail.use("empty", {});

  const footerBasic = defaultDesignSystem.footer.use("basic", {
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ] satisfies FooterLink[],
    smallPrint: "© 2026",
  });

  const footerEmpty = defaultDesignSystem.footer.use("empty", {});

  {
    const actual = renderPretty(headerBasic).trim();
    registerHTML(actual, {
      testCase: "header basic variant",
      suggestFileName: "header-basic.html",
    });

    assertEquals(
      actual.trim(),
      `<header class="ds-header">
  <header class="ds-header-inner">
    <nav aria-label="Breadcrumbs" class="ds-breadcrumbs">
      <ol class="ds-breadcrumbs-list">
        <li class="ds-breadcrumbs-item"><a href="/">Home</a></li>
        <li class="ds-breadcrumbs-item"><span>Docs</span></li>
      </ol>
    </nav><span class="ds-header-title">Docs</span>
    <section class="ds-header-actions"><template><a href="/profile">Profile</a><span> | </span><a href="/logout">Logout</a></template></section>
  </header>
</header>`,
    );
  }

  {
    const actual = renderPretty(headerMinimal).trim();
    registerHTML(actual, {
      testCase: "header minimal variant",
      suggestFileName: "header-minimal.html",
    });

    assertEquals(
      actual.trim(),
      `<header class="ds-header">
  <header class="ds-header-inner"><span class="ds-header-title">Minimal</span></header>
</header>`,
    );
  }

  {
    const actual = renderPretty(sidebarNav).trim();
    registerHTML(actual, {
      testCase: "sidebar nav variant",
      suggestFileName: "sidebar-nav.html",
    });

    assertEquals(
      actual.trim(),
      `<nav class="ds-sidebar">
  <section class="ds-sidebar-inner"><span class="ds-sidebar-title">Menu</span>
    <ul class="ds-nav-list">
      <li class="ds-nav-item is-active"><a aria-current="page" href="/dash">Dashboard</a></li>
      <li class="ds-nav-item"><a href="/reports">Reports</a></li>
    </ul>
  </section>
</nav>`,
    );
  }

  {
    const actual = renderPretty(sidebarEmpty).trim();
    registerHTML(actual, {
      testCase: "sidebar empty variant",
      suggestFileName: "sidebar-empty.html",
    });

    assertEquals(
      actual.trim(),
      `<nav class="ds-sidebar">
  <section class="ds-sidebar-inner"></section>
</nav>`,
    );
  }

  {
    const actual = renderPretty(contentStandard).trim();
    registerHTML(actual, {
      testCase: "content standard variant",
      suggestFileName: "content-standard.html",
    });

    assertEquals(
      actual.trim(),
      `<main class="ds-content">
  <section class="ds-content-inner">
    <header class="ds-page-header">
      <section class="ds-page-header-text"><span class="ds-page-title">Dashboard</span>
        <section class="ds-page-description">
          <p>Welcome back.</p>
        </section>
      </section>
      <section class="ds-page-actions"><template><a href="/new">New</a><span> </span><a href="/help">Help</a></template></section>
    </header>
    <section class="ds-content-body"><template><section class="card"><p>Card A</p></section><section class="card"><p>Card B</p></section></template></section>
  </section>
</main>`,
    );
  }

  {
    const actual = renderPretty(rightRailPanel).trim();
    registerHTML(actual, {
      testCase: "rightRail panel variant",
      suggestFileName: "right-rail-panel.html",
    });

    assertEquals(
      actual.trim(),
      `<aside class="ds-rightRail">
  <section class="ds-rail-panel">
    <header class="ds-rail-panel-header"><span>Tips</span></header>
    <section class="ds-rail-panel-body">
      <ul class="tips">
        <li>Use semantic tags.</li>
        <li>Keep variants small.</li>
      </ul>
    </section>
  </section>
</aside>`,
    );
  }

  {
    const actual = renderPretty(rightRailEmpty).trim();
    registerHTML(actual, {
      testCase: "rightRail empty variant",
      suggestFileName: "right-rail-empty.html",
    });

    assertEquals(
      actual.trim(),
      `<aside class="ds-rightRail">
  <section class="ds-rail-empty"></section>
</aside>`,
    );
  }

  {
    const actual = renderPretty(footerBasic).trim();
    registerHTML(actual, {
      testCase: "footer basic variant",
      suggestFileName: "footer-basic.html",
    });

    assertEquals(
      actual.trim(),
      `<footer class="ds-footer">
  <section class="ds-footer-inner">
    <nav aria-label="Footer links" class="ds-footer-links">
      <ul class="ds-footer-links-list">
        <li class="ds-footer-links-item"><a href="/privacy">Privacy</a></li>
        <li class="ds-footer-links-item"><a href="/terms">Terms</a></li>
      </ul>
    </nav><span class="ds-footer-smallprint">© 2026</span>
  </section>
</footer>`,
    );
  }

  {
    const actual = renderPretty(footerEmpty).trim();
    registerHTML(actual, {
      testCase: "footer empty variant",
      suggestFileName: "footer-empty.html",
    });

    assertEquals(
      actual.trim(),
      `<footer class="ds-footer">
  <section class="ds-footer-empty"></section>
</footer>`,
    );
  }
});

Deno.test("semanticLayout(): app-shell", () => {
  const page = semanticLayout({
    variant: "app-shell",
    lang: "en",
    title: "App Shell",
    shell: ({ header, sidebar, content, rightRail, footer }) => ({
      header: header.use("basic", { title: "App" }),
      sidebar: sidebar.use("empty", {}),
      content: content.use("standard", { pageTitle: "Home", body: p("Hello") }),
      rightRail: rightRail.use("empty", {}),
      footer: footer.use("empty", {}),
    }),
  });

  const actual = renderPretty(page).trim();
  registerHTML(actual, {
    testCase: "semanticLayout app-shell",
    suggestFileName: "layout-app-shell.html",
  });

  assertEquals(
    actual.trim(),
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta content="width=device-width, initial-scale=1" name="viewport">
    <meta content="light dark" name="color-scheme">
    <title>App Shell</title>
  </head>
  <body class="ds-body">
    <div class="ds-shell">
      <header class="ds-header">
        <header class="ds-header-inner"><span class="ds-header-title">App</span></header>
      </header>
      <section class="ds-workspace">
        <nav class="ds-sidebar">
          <section class="ds-sidebar-inner"></section>
        </nav>
        <main class="ds-content">
          <section class="ds-content-inner">
            <header class="ds-page-header">
              <section class="ds-page-header-text"><span class="ds-page-title">Home</span></section>
            </header>
            <section class="ds-content-body">
              <p>Hello</p>
            </section>
          </section>
        </main>
        <aside class="ds-rightRail">
          <section class="ds-rail-empty"></section>
        </aside>
      </section>
      <footer class="ds-footer">
        <section class="ds-footer-empty"></section>
      </footer>
    </div>
  </body>
</html>`,
  );
});

Deno.test("semanticLayout(): centered layout", () => {
  const page = semanticLayout({
    variant: "centered",
    lang: "en",
    title: "Centered",
    shell: ({ header, sidebar, content, rightRail, footer }) => ({
      header: header.use("minimal", { title: "Centered App" }),
      sidebar: sidebar.use("empty", {}),
      content: content.use("standard", {
        pageTitle: "Welcome",
        body: p("Hi"),
      }),
      rightRail: rightRail.use("empty", {}),
      footer: footer.use("empty", {}),
    }),
  });

  const actual = renderPretty(page).trim();
  registerHTML(actual, {
    testCase: "semanticLayout centered layout",
    suggestFileName: "layout-centered.html",
  });

  assertEquals(
    actual.trim(),
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta content="width=device-width, initial-scale=1" name="viewport">
    <meta content="light dark" name="color-scheme">
    <title>Centered</title>
  </head>
  <body class="ds-body">
    <section class="ds-centered">
      <header class="ds-header">
        <header class="ds-header-inner"><span class="ds-header-title">Centered App</span></header>
      </header>
      <section class="ds-centered-container">
        <main class="ds-content">
          <section class="ds-content-inner">
            <header class="ds-page-header">
              <section class="ds-page-header-text"><span class="ds-page-title">Welcome</span></section>
            </header>
            <section class="ds-content-body">
              <p>Hi</p>
            </section>
          </section>
        </main>
      </section>
      <footer class="ds-footer">
        <section class="ds-footer-empty"></section>
      </footer>
    </section>
  </body>
</html>`,
  );
});

Deno.test("semanticLayout(): marketing layout", () => {
  const page = semanticLayout({
    variant: "marketing",
    lang: "en",
    title: "Marketing",
    shell: ({ header, sidebar, content, rightRail, footer }) => ({
      header: header.use("minimal", { title: "Marketing Site" }),
      sidebar: sidebar.use("empty", {}),
      content: content.use("standard", {
        pageTitle: "Welcome",
        body: p("Hello from marketing."),
      }),
      rightRail: rightRail.use("empty", {}),
      footer: footer.use("empty", {}),
    }),
  });

  const actual = renderPretty(page).trim();
  registerHTML(actual, {
    testCase: "semanticLayout marketing layout",
    suggestFileName: "layout-marketing.html",
  });

  assertEquals(
    actual.trim(),
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta content="width=device-width, initial-scale=1" name="viewport">
    <meta content="light dark" name="color-scheme">
    <title>Marketing</title>
  </head>
  <body class="ds-body">
    <section class="ds-marketing">
      <header class="ds-header">
        <header class="ds-header-inner"><span class="ds-header-title">Marketing Site</span></header>
      </header>
      <section class="ds-marketing-content">
        <main class="ds-content">
          <section class="ds-content-inner">
            <header class="ds-page-header">
              <section class="ds-page-header-text"><span class="ds-page-title">Welcome</span></section>
            </header>
            <section class="ds-content-body">
              <p>Hello from marketing.</p>
            </section>
          </section>
        </main>
      </section>
      <footer class="ds-footer">
        <section class="ds-footer-empty"></section>
      </footer>
    </section>
  </body>
</html>`,
  );
});

Deno.test("custom variants: type safety and extended rendering", () => {
  const toKids = (k: DsChild | DsChild[]) => (Array.isArray(k) ? k : [k]);

  type CustomExtensions = {
    header: {
      hero: VariantFn<
        HeaderApi,
        { title: string; tagline?: string; actions?: DsChild }
      >;
    };
    sidebar: {
      links: VariantFn<SidebarApi, { items: NavItem[]; title?: string }>;
    };
    content: {
      spotlight: VariantFn<
        ContentApi,
        { headline: string; body: DsChild | DsChild[] }
      >;
    };
    rightRail: {
      alert: VariantFn<
        RightRailApi,
        { title: string; body: DsChild | DsChild[] }
      >;
    };
    footer: {
      note: VariantFn<FooterApi, { text: string }>;
    };
  };

  const customDesignSystem = createDesignSystem<CustomExtensions>({
    header: {
      hero: (
        api: HeaderApi,
        o: { title: string; tagline?: string; actions?: DsChild },
      ) =>
        section(
          { class: "ds-header-inner ds-hero" },
          api.title(o.title),
          o.tagline ? span({ class: "ds-hero-tagline" }, o.tagline) : "",
          o.actions ? api.actions(o.actions) : "",
        ),
    },
    sidebar: {
      links: (api: SidebarApi, o: { items: NavItem[]; title?: string }) =>
        section(
          { class: "ds-sidebar-inner ds-sidebar-links" },
          o.title ? api.sectionTitle(o.title) : "",
          api.navList(o.items),
        ),
    },
    content: {
      spotlight: (
        api: ContentApi,
        o: { headline: string; body: DsChild | DsChild[] },
      ) =>
        section(
          { class: "ds-content-inner ds-spotlight" },
          api.pageHeader(o.headline),
          section({ class: "ds-content-body" }, ...toKids(o.body)),
        ),
    },
    rightRail: {
      alert: (
        api: RightRailApi,
        o: { title: string; body: DsChild | DsChild[] },
      ) => api.panel({ title: o.title, class: "ds-rail-alert" }, o.body),
    },
    footer: {
      note: (_api: FooterApi, o: { text: string }) =>
        section({ class: "ds-footer-inner ds-footer-note" }, span(o.text)),
    },
  });

  // deno-lint-ignore no-constant-condition
  if (false) {
    // @ts-expect-error unknown variant name
    customDesignSystem.header.use("unknown", {});
    // @ts-expect-error invalid option type
    customDesignSystem.header.use("hero", { title: 123 });
    // @ts-expect-error missing required option
    customDesignSystem.footer.use("note", {});
  }

  const page = semanticLayout(
    {
      variant: "marketing",
      lang: "en",
      title: "Custom Marketing",
      shell: ({ header, sidebar, content, rightRail, footer }) => ({
        header: header.use("hero", {
          title: "Acme",
          tagline: "Ship faster",
          actions: fragment(a({ href: "/start" }, "Get started")),
        }),
        sidebar: sidebar.use("links", {
          title: "Explore",
          items: [
            { label: "Overview", href: "/overview", active: true },
            { label: "Pricing", href: "/pricing" },
          ],
        }),
        content: content.use("spotlight", {
          headline: "Launch",
          body: p("Build with confidence."),
        }),
        rightRail: rightRail.use("alert", {
          title: "Beta",
          body: p("Invite only."),
        }),
        footer: footer.use("note", { text: "© 2026 Acme" }),
      }),
    },
    customDesignSystem,
  );

  const actual = renderPretty(page).trim();
  registerHTML(actual, {
    testCase: "custom variants marketing layout",
    suggestFileName: "layout-marketing-custom.html",
  });

  assertEquals(
    actual.trim(),
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta content="width=device-width, initial-scale=1" name="viewport">
    <meta content="light dark" name="color-scheme">
    <title>Custom Marketing</title>
  </head>
  <body class="ds-body">
    <section class="ds-marketing">
      <header class="ds-header">
        <section class="ds-header-inner ds-hero"><span class="ds-header-title">Acme</span><span class="ds-hero-tagline">Ship faster</span>
          <section class="ds-header-actions"><template><a href="/start">Get started</a></template></section>
        </section>
      </header>
      <section class="ds-marketing-content">
        <main class="ds-content">
          <section class="ds-content-inner ds-spotlight">
            <header class="ds-page-header">
              <section class="ds-page-header-text"><span class="ds-page-title">Launch</span></section>
            </header>
            <section class="ds-content-body">
              <p>Build with confidence.</p>
            </section>
          </section>
        </main>
      </section>
      <footer class="ds-footer">
        <section class="ds-footer-inner ds-footer-note"><span>© 2026 Acme</span></section>
      </footer>
    </section>
  </body>
</html>`,
  );
});
