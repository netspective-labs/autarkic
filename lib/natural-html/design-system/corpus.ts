/**
 * @module lib/natural-html/design-system/corpus.ts
 *
 * Corpus design system: documentation and knowledge-base layouts and regions
 * built on Natural DS primitives.
 */
import {
  createDesignSystem,
  defineLayout,
  defineRegion,
  NamingStrategy,
  RenderCtx,
  SlotBuilder,
  slots,
} from "../design-system.ts";
import * as h from "../elements.ts";
import {
  DocNavSubject,
  docNavTree,
  DocNavTrees,
  docSubjectSelect,
  HeadSlotInput,
  headSlots,
  headSlotSpec,
  selectDocNavTree,
} from "../patterns.ts";

type RenderInput = Record<PropertyKey, never>;

const picoCssUrl =
  "https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css";
const corpusJsUrl =
  "https://cdn.jsdelivr.net/npm/@corpus-ds/client@0/dist/corpus.min.js";

const naming: NamingStrategy = {
  elemIdValue: (suggested, kind) => `${kind}-${suggested}`,
  elemDataAttr: (suggestedKeyName, _suggestedValue, _kind) =>
    `data-${suggestedKeyName}`,
  className: (suggested, kind) => `${kind}-${suggested}`,
};

function optionalSlots<
  Ctx extends object,
  N extends NamingStrategy,
  K extends string,
>(
  slots: Record<K, SlotBuilder<Ctx, N> | undefined>,
): Partial<Record<K, SlotBuilder<Ctx, N>>> {
  const out: Partial<Record<K, SlotBuilder<Ctx, N>>> = {};
  for (const key in slots) {
    const value = slots[key];
    if (value !== undefined) out[key] = value;
  }
  return out;
}

export type CorpusSidebarProps<Id extends string = string> = {
  readonly subjects: readonly DocNavSubject<Id>[];
  readonly trees: DocNavTrees<Id>;
  readonly activeSubjectId: Id;
  readonly subjectLabel?: string;
  readonly navLabel?: string;
  readonly selectId?: string;
};

export function corpusSidebar<
  Ctx extends object,
  NS extends NamingStrategy,
  Id extends string,
>(
  props: CorpusSidebarProps<Id>,
): {
  readonly navSubject: SlotBuilder<Ctx, NS>;
  readonly navTree: SlotBuilder<Ctx, NS>;
} {
  return {
    navSubject: (ctx) =>
      docSubjectSelect(ctx, {
        subjects: props.subjects,
        activeSubjectId: props.activeSubjectId,
        label: props.subjectLabel ?? "Subject",
        selectId: props.selectId,
      }),
    navTree: (ctx) =>
      docNavTree(ctx, {
        items: selectDocNavTree(props.trees, props.activeSubjectId),
        label: props.navLabel ?? "Sections",
      }),
  };
}

export type DocPageComposition<
  Ctx extends object,
  NS extends NamingStrategy,
  Id extends string = string,
> = {
  readonly title: SlotBuilder<Ctx, NS>;
  readonly content: SlotBuilder<Ctx, NS>;
  readonly nav: CorpusSidebarProps<Id>;
  readonly toc?: SlotBuilder<Ctx, NS>;
  readonly pageMeta?: SlotBuilder<Ctx, NS>;
  readonly globalNav?: SlotBuilder<Ctx, NS>;
  readonly searchBox?: SlotBuilder<Ctx, NS>;
  readonly footer?: SlotBuilder<Ctx, NS>;
};

export function docPageSlots<
  Ctx extends object,
  NS extends NamingStrategy,
  Id extends string,
>(
  input: DocPageComposition<Ctx, NS, Id>,
): {
  readonly title: SlotBuilder<Ctx, NS>;
  readonly navSubject: SlotBuilder<Ctx, NS>;
  readonly navTree: SlotBuilder<Ctx, NS>;
  readonly content: SlotBuilder<Ctx, NS>;
  readonly toc?: SlotBuilder<Ctx, NS>;
  readonly pageMeta?: SlotBuilder<Ctx, NS>;
  readonly globalNav?: SlotBuilder<Ctx, NS>;
  readonly searchBox?: SlotBuilder<Ctx, NS>;
  readonly footer?: SlotBuilder<Ctx, NS>;
} {
  const sidebar = corpusSidebar<Ctx, NS, Id>(input.nav);
  return {
    title: input.title,
    navSubject: sidebar.navSubject,
    navTree: sidebar.navTree,
    content: input.content,
    toc: input.toc,
    pageMeta: input.pageMeta,
    globalNav: input.globalNav,
    searchBox: input.searchBox,
    footer: input.footer,
  };
}

export const corpusHeaderRegion = defineRegion({
  name: "Header",
  slots: slots({
    required: ["title"] as const,
    optional: ["globalNav", "searchBox"] as const,
  }),
  render: (ctx: RenderCtx<RenderInput, NamingStrategy>, s) => {
    return h.header(
      { class: "container" },
      h.nav(
        h.ul(h.li(h.strong(s.title(ctx)))),
        s.globalNav ? s.globalNav(ctx) : null,
        s.searchBox ? h.form({ role: "search" }, s.searchBox(ctx)) : null,
      ),
    );
  },
});

export const corpusMainRegion = defineRegion({
  name: "Main",
  slots: slots({
    required: ["navSubject", "navTree", "content"] as const,
    optional: ["toc", "pageMeta"] as const,
  }),
  render: (ctx: RenderCtx<RenderInput, NamingStrategy>, s) => {
    return h.main(
      { class: "container" },
      h.div(
        { class: "grid" },
        h.aside(
          h.nav(
            { "aria-label": "Documentation" },
            s.navSubject(ctx),
            s.navTree(ctx),
          ),
        ),
        h.article(
          s.content(ctx),
          s.pageMeta ? h.footer(s.pageMeta(ctx)) : null,
        ),
        s.toc
          ? h.aside(
            h.nav(
              { "aria-label": "On this page" },
              s.toc(ctx),
            ),
          )
          : null,
      ),
    );
  },
});

export const corpusFooterRegion = defineRegion({
  name: "Footer",
  slots: slots({
    optional: ["content"] as const,
  }),
  render: (ctx, s) => {
    return h.footer(
      { class: "container" },
      s.content ? s.content(ctx) : null,
    );
  },
});

export const docsShellLayout = defineLayout({
  name: "DocsShell",
  slots: slots({
    required: ["title", "navSubject", "navTree", "content"] as const,
    optional: ["toc", "pageMeta", "globalNav", "searchBox", "footer"] as const,
  }),
  headSlots: headSlotSpec,
  render: (_ctx, api, s) =>
    h.div(
      api.region(
        "Header",
        optionalSlots({
          title: s.title,
          globalNav: s.globalNav,
          searchBox: s.searchBox,
        }),
      ),
      api.region(
        "Main",
        optionalSlots({
          navSubject: s.navSubject,
          navTree: s.navTree,
          content: s.content,
          toc: s.toc,
          pageMeta: s.pageMeta,
        }),
      ),
      api.region("Footer", optionalSlots({ content: s.footer })),
    ),
});

export const docPageLayout = defineLayout({
  name: "DocPage",
  slots: slots({
    required: ["title", "navSubject", "navTree", "content"] as const,
    optional: ["toc", "pageMeta", "globalNav", "searchBox", "footer"] as const,
  }),
  headSlots: headSlotSpec,
  render: (_ctx, api, s) =>
    api.layout(
      "DocsShell",
      optionalSlots({
        title: s.title,
        navSubject: s.navSubject,
        navTree: s.navTree,
        content: s.content,
        toc: s.toc,
        pageMeta: s.pageMeta,
        globalNav: s.globalNav,
        searchBox: s.searchBox,
        footer: s.footer,
      }),
    ),
});

export const docLandingLayout = defineLayout({
  name: "DocLanding",
  slots: slots({
    required: ["title", "hero", "sections"] as const,
    optional: ["globalNav", "searchBox", "featured", "footer"] as const,
  }),
  headSlots: headSlotSpec,
  render: (ctx: RenderCtx<RenderInput, NamingStrategy>, api, s) =>
    h.div(
      api.region(
        "Header",
        optionalSlots({
          title: s.title,
          globalNav: s.globalNav,
          searchBox: s.searchBox,
        }),
      ),
      h.main(
        { class: "container" },
        h.article(
          h.header(s.hero(ctx)),
          s.featured ? h.aside(s.featured(ctx)) : null,
          s.sections(ctx),
        ),
      ),
      api.region("Footer", optionalSlots({ content: s.footer })),
    ),
});

export function corpusDesignSystem(dsName = "corpus-ds") {
  const ds = createDesignSystem<RenderInput>(dsName, naming)
    .policies({ wrappers: { enabled: false } })
    .uaDependencies([
      {
        mountPoint: picoCssUrl,
        canonicalSource: picoCssUrl,
        nature: "reference",
        mimeType: "text/css",
      },
      {
        mountPoint: corpusJsUrl,
        canonicalSource: corpusJsUrl,
        nature: "reference",
        mimeType: "application/javascript",
        as: "module",
      },
    ])
    .region(corpusHeaderRegion)
    .region(corpusMainRegion)
    .region(corpusFooterRegion)
    .layout(docsShellLayout)
    .layout(docPageLayout)
    .layout(docLandingLayout)
    .build();

  const defaultHead = headSlots({
    styles: [
      h.style(`
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
      `),
    ],
  });

  const mergeHead = (
    input?: HeadSlotInput<RenderInput, NamingStrategy>,
  ) => {
    const overrides = input ? headSlots(input) : {};
    const merged = { ...defaultHead } as Record<string, unknown>;
    for (const [key, value] of Object.entries(overrides)) {
      if (value) merged[key] = value;
    }
    return merged;
  };

  const page: typeof ds.page = (layoutName, renderCtx, options) =>
    ds.page(layoutName, renderCtx, {
      ...options,
      headSlots: mergeHead(options.headSlots),
    });

  return {
    ...ds,
    page,
  };
}
