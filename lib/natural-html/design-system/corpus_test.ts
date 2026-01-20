// lib/natural-html/design-system/corpus_test.ts
import { assertEquals } from "@std/assert";
import * as h from "../elements.ts";
import { corpusDesignSystem, docPageSlots } from "./corpus.ts";
import { headSlots } from "../patterns.ts";

Deno.test("fluent-ds-corpus: doc page layout", () => {
  const ds = corpusDesignSystem();

  const slots = docPageSlots({
    title: () => h.span("Corpus DS"),
    content: () =>
      h.div(
        h.h1("Getting Started"),
        h.p("Corpus is a docs-first system for structured knowledge."),
        h.h2("Why Corpus"),
        h.p("Navigation, TOC, and metadata are first-class slots."),
      ),
    nav: {
      subjects: [
        { id: "core", label: "Core", href: "/docs" },
        { id: "labs", label: "Labs", href: "/labs" },
      ],
      trees: {
        core: [
          { label: "Getting Started", href: "/docs/getting-started" },
          {
            label: "Guides",
            children: [
              { label: "Installation", href: "/docs/install", active: true },
              { label: "Configuration", href: "/docs/config" },
            ],
          },
          { label: "API", href: "/docs/api" },
        ],
        labs: [
          { label: "Experiments", href: "/labs/experiments" },
          { label: "Prototypes", href: "/labs/prototypes" },
        ],
      },
      activeSubjectId: "core",
      subjectLabel: "Subject",
      navLabel: "Chapters",
      selectId: "corpus-subject",
    },
    toc: () =>
      h.ol(
        h.li(h.a({ href: "#why-corpus" }, "Why Corpus")),
        h.li(h.a({ href: "#slots" }, "Slots and semantics")),
      ),
    pageMeta: () => h.p(h.small("Updated: 2026-01-02")),
    globalNav: () =>
      h.ul(
        h.li(h.a({ href: "/docs" }, "Docs")),
        h.li(h.a({ href: "/api" }, "API")),
        h.li(h.a({ href: "/blog" }, "Blog")),
      ),
    searchBox: () => h.input({ type: "search", placeholder: "Search docs" }),
    footer: () => h.small("© 2026 Corpus DS"),
  });

  const page = h.renderPretty(
    ds.page("DocPage", {}, {
      slots,
      headSlots: headSlots({
        title: "Corpus DS",
      }),
    }),
  );

  assertEquals(
    page.trim(),
    `<!doctype html>
<html>
  <head>
    <link href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/@corpus-ds/client@0/dist/corpus.min.js" type="module"></script>
    <title>Corpus DS</title>
    <style>
        :root {
          font-size: 85%;
        }

        header nav {
          align-items: center;
          gap: 1rem;
          padding: 0.75rem 0;
        }

        header nav ul {
          gap: 0.75rem;
          margin: 0;
        }

        header nav ul:first-of-type {
          margin-right: 0.5rem;
        }

        header nav ul:first-of-type strong {
          font-size: 1rem;
        }

        header form[role="search"] {
          margin-left: auto;
          min-width: 16rem;
        }

        header form[role="search"] input[type="search"] {
          border-radius: 999px;
          background: var(--pico-card-background-color);
        }

        main .grid {
          gap: 1.5rem;
          grid-template-columns: 220px minmax(0, 1fr) 200px;
          align-items: start;
        }

        main aside {
          position: relative;
        }

        main article {
          background: var(--pico-card-background-color);
          border: 1px solid var(--pico-card-border-color);
          border-radius: var(--pico-border-radius);
          box-shadow: var(--pico-box-shadow);
          padding: 1.5rem;
        }

        main article h1 {
          font-size: 2rem;
          margin-bottom: 0.35rem;
        }

        main article h2 {
          font-size: 1.25rem;
          margin-top: 1.75rem;
        }

        .component-doc-subject label {
          display: block;
          margin-bottom: 0.25rem;
          color: var(--pico-muted-color);
          font-size: 0.85rem;
          letter-spacing: 0.02em;
        }

        .component-doc-subject select {
          width: 100%;
          background-color: var(--pico-card-background-color);
        }

        .component-doc-tree__list {
          list-style: none;
          padding-left: 0;
          margin: 0.5rem 0 0;
        }

        .component-doc-tree__item {
          margin: 0.35rem 0;
        }

        .component-doc-tree__list--d0 > .component-doc-tree__item > a,
        .component-doc-tree__list--d0 > .component-doc-tree__item > span {
          font-weight: 600;
        }

        .component-doc-tree__link {
          display: inline-block;
          padding: 0.15rem 0;
        }

        .component-doc-tree__item--active > a {
          font-weight: 600;
          color: var(--pico-primary);
        }

        .component-doc-tree__list--d1 {
          border-left: 1px solid var(--pico-muted-border-color);
          margin-left: 0.5rem;
          padding-left: 0.75rem;
        }

        .component-doc-tree__list--d1 a,
        .component-doc-tree__label {
          color: var(--pico-muted-color);
          font-size: 0.95rem;
        }

        aside nav[aria-label="On this page"] ol {
          padding-left: 1rem;
        }

        @media (max-width: 960px) {
          header form[role="search"] {
            margin-left: 0;
            width: 100%;
          }

          main .grid {
            grid-template-columns: 1fr;
          }
        }
      </style>
  </head>
  <body>
    <div>
      <header class="container">
        <nav>
          <ul>
            <li><strong><span>Corpus DS</span></strong></li>
          </ul>
          <ul>
            <li><a href="/docs">Docs</a></li>
            <li><a href="/api">API</a></li>
            <li><a href="/blog">Blog</a></li>
          </ul>
          <form role="search"><input placeholder="Search docs" type="search"></form>
        </nav>
      </header>
      <main class="container">
        <div class="grid">
          <aside>
            <nav aria-label="Documentation">
              <div class="component-doc-subject" data-element-id="component-DocSubjectSelect"><label class="component-doc-subject__label" for="corpus-subject">Subject</label><select class="component-doc-subject__select" data-active-subject="core" id="corpus-subject"><option data-href="/docs" selected value="core">Core</option><option data-href="/labs" value="labs">Labs</option></select></div>
              <nav aria-label="Chapters" class="component-doc-tree" data-element-id="component-DocNavTree">
                <ul class="component-doc-tree__list component-doc-tree__list--d0">
                  <li class="component-doc-tree__item"><a class="component-doc-tree__link" href="/docs/getting-started">Getting Started</a></li>
                  <li class="component-doc-tree__item"><span class="component-doc-tree__label">Guides</span>
                    <ul class="component-doc-tree__list component-doc-tree__list--d1">
                      <li class="component-doc-tree__item component-doc-tree__item--active"><a class="component-doc-tree__link" href="/docs/install">Installation</a></li>
                      <li class="component-doc-tree__item"><a class="component-doc-tree__link" href="/docs/config">Configuration</a></li>
                    </ul>
                  </li>
                  <li class="component-doc-tree__item"><a class="component-doc-tree__link" href="/docs/api">API</a></li>
                </ul>
              </nav>
            </nav>
          </aside>
          <article>
            <div>
              <h1>Getting Started</h1>
              <p>Corpus is a docs-first system for structured knowledge.</p>
              <h2>Why Corpus</h2>
              <p>Navigation, TOC, and metadata are first-class slots.</p>
            </div>
            <footer>
              <p><small>Updated: 2026-01-02</small></p>
            </footer>
          </article>
          <aside>
            <nav aria-label="On this page">
              <ol>
                <li><a href="#why-corpus">Why Corpus</a></li>
                <li><a href="#slots">Slots and semantics</a></li>
              </ol>
            </nav>
          </aside>
        </div>
      </main>
      <footer class="container"><small>© 2026 Corpus DS</small></footer>
    </div>
  </body>
</html>`,
  );
});
