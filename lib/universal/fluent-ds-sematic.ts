/**
 * @module lib/universal/fluent-ds-sematic.ts
 *
 * A small “semantic design system” layer for building consistent page layouts and
 * regions (header, sidebar, content, right rail, footer) on top of `fluent-html.ts`
 * (HAST-native).
 *
 * What a design system is
 * A design system is a reusable set of layout primitives, component patterns, and
 * conventions that help a team produce consistent UI. In this module, the “system”
 * is expressed as:
 * - region composers (header/sidebar/content/rightRail/footer) that wrap semantic tags
 * - typed variant registries (e.g. header.basic, sidebar.nav) that render consistent markup
 * - predictable class naming hooks (ds-*) for styling via CSS
 *
 * What “semantic” means (HTML sense)
 * “Semantic” means using elements that describe meaning and document structure,
 * not just appearance. This module prefers tags like `<header>`, `<nav>`, `<main>`,
 * `<aside>`, `<footer>`, `<section>`, plus ARIA labeling where appropriate.
 * The goal is better accessibility, clearer structure for tooling, and more reliable
 * styling and automation.
 *
 * HAST-native output model
 * Everything produced is `RawHtml` from `fluent-html.ts`, which carries real HAST nodes
 * (via `__nodes`). This avoids inventing a parallel AST. For “fragments” (groups of nodes),
 * `fragment()` wraps children in `<template>` so the result remains a concrete, deterministic
 * HAST subtree without needing a non-HAST fragment node.
 *
 * How to use it
 * - Use `defaultDesignSystem` or create your own with `createDesignSystem()` to add/override
 *   region variants.
 * - Use `semanticLayout()` to emit a full document (doctype + html/head/body) as a single `RawHtml`.
 * - Inside your `shell()` callback, compose regions with `ds.<region>.use(<variant>, opts, init?)`
 *   or `ds.<region>.wrap(init, children)` when you want direct control.
 *
 * Minimal example
 * ```ts
 * import { semanticLayout, defaultDesignSystem as ds, renderPretty } from "./fluent-ds-sematic.ts";
 *
 * const page = semanticLayout({
 *   title: "My App",
 *   shell: ({ header, sidebar, content, rightRail, footer }) => ({
 *     header: header.use("basic", { title: "My App" }),
 *     sidebar: sidebar.use("nav", { title: "Menu", items: [{ label: "Home", href: "/", active: true }] }),
 *     content: content.use("standard", { pageTitle: "Dashboard", body: "Hello" }),
 *     rightRail: rightRail.use("empty", {}),
 *     footer: footer.use("basic", { smallPrint: "© 2026" }),
 *   }),
 * }, ds);
 *
 * console.log(renderPretty(page));
 * ```
 *
 * Extending variants
 * `createDesignSystem({ header: { ... }, sidebar: { ... } })` lets you register new variants
 * per region with strong typing, while keeping the built-in ones available.
 */
import type { Attrs, Child, ClassSpec, RawHtml } from "./fluent-html.ts";

import {
  a,
  aside,
  attrs,
  body,
  classNames,
  div,
  doctype,
  footer,
  head,
  header,
  html,
  li,
  link,
  main,
  meta,
  nav,
  ol,
  p,
  render,
  renderPretty,
  section,
  span,
  title,
  trustedRaw,
  ul,
} from "./fluent-html.ts";

/* ------------------------------ Basic types ------------------------------ */

export type DsHtml = RawHtml;
export type DsChild = Child | DsHtml;

export const cls = (...parts: ClassSpec[]) => classNames(...parts);

function asKids(k: DsChild | DsChild[] | undefined): DsChild[] {
  if (k === undefined) return [];
  return Array.isArray(k) ? k : [k];
}

/**
 * Concatenate RawHtml node-lists without introducing a wrapper element.
 * Useful for doctype + html as siblings.
 */
function concatRaw(...chunks: RawHtml[]): RawHtml {
  return {
    __rawHtml: "",
    __nodes: chunks.flatMap((c) => c.__nodes ?? []),
  } as RawHtml;
}

/**
 * Fragment helper that preserves a concrete HAST node list by using `<template>`.
 * Children are preserved; `renderPretty` will show them.
 */
export const fragment = (...children: DsChild[]): DsHtml =>
  trustedRaw(
    `<template>${
      render(div(...children))
        .replace(/^<div>/, "")
        .replace(/<\/div>$/, "")
    }</template>`,
    "fragment",
  );

/* ------------------------ Variant registry utilities --------------------- */

type BivariantFn<Args extends unknown[], R> = {
  bivarianceHack(...args: Args): R;
}["bivarianceHack"];

export type VariantFn<Api, Opt> = BivariantFn<[Api, Opt], DsHtml>;

export type VariantRegistry<Api> = Record<string, VariantFn<Api, unknown>>;
type VariantName<V> = Extract<keyof V, string>;

type VariantOpts<Api, V, K extends VariantName<V>> = V[K] extends
  VariantFn<Api, infer Opt> ? Opt : never;

/* ------------------------------ Region types ----------------------------- */

export interface RegionInit {
  attrs?: Attrs;
  class?: string;
  ariaLabel?: string;
}

export interface RegionComposer<Api, V extends VariantRegistry<Api>> {
  wrap: (init: RegionInit, children: DsChild | DsChild[]) => DsHtml;

  use: <K extends VariantName<V>>(
    name: K,
    opts: VariantOpts<Api, V, K>,
    init?: RegionInit,
  ) => DsHtml;

  variants: V;

  cls: (...parts: ClassSpec[]) => string;
  attrs: (...parts: Array<Attrs | null | undefined | false>) => Attrs;
}

/* ------------------------------- Region APIs ----------------------------- */

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface NavItem {
  label: string;
  href: string;
  active?: boolean;
}

export interface FooterLink {
  label: string;
  href: string;
}

export interface HeaderApi {
  title: (t: string, init?: { class?: string }) => DsHtml;
  actions: (children: DsChild | DsChild[], init?: { class?: string }) => DsHtml;
  breadcrumbs: (items: BreadcrumbItem[], init?: { class?: string }) => DsHtml;

  cls: (...parts: ClassSpec[]) => string;
  attrs: (...parts: Array<Attrs | null | undefined | false>) => Attrs;
}

export interface SidebarApi {
  sectionTitle: (t: string, init?: { class?: string }) => DsHtml;
  navList: (items: NavItem[], init?: { class?: string }) => DsHtml;

  cls: (...parts: ClassSpec[]) => string;
  attrs: (...parts: Array<Attrs | null | undefined | false>) => Attrs;
}

export interface ContentApi {
  pageHeader: (
    titleText: string,
    init?: {
      description?: DsChild | DsChild[];
      actions?: DsChild | DsChild[];
      class?: string;
    },
  ) => DsHtml;

  contentSection: (
    init: { title?: string; class?: string },
    children: DsChild | DsChild[],
  ) => DsHtml;

  cls: (...parts: ClassSpec[]) => string;
  attrs: (...parts: Array<Attrs | null | undefined | false>) => Attrs;
}

export interface RightRailApi {
  panel: (
    init: { title?: string; class?: string },
    children: DsChild | DsChild[],
  ) => DsHtml;

  cls: (...parts: ClassSpec[]) => string;
  attrs: (...parts: Array<Attrs | null | undefined | false>) => Attrs;
}

export interface FooterApi {
  links: (items: FooterLink[], init?: { class?: string }) => DsHtml;
  smallPrint: (t: string, init?: { class?: string }) => DsHtml;

  cls: (...parts: ClassSpec[]) => string;
  attrs: (...parts: Array<Attrs | null | undefined | false>) => Attrs;
}

/* --------------------------- Built-in variants --------------------------- */

export type EmptyObject = Record<PropertyKey, never>;

export type HeaderVariants = {
  basic: VariantFn<
    HeaderApi,
    {
      title?: string;
      breadcrumbs?: BreadcrumbItem[];
      actions?: DsChild | DsChild[];
    }
  >;
  minimal: VariantFn<HeaderApi, { title?: string }>;
};

export type SidebarVariants = {
  nav: VariantFn<SidebarApi, { items: NavItem[]; title?: string }>;
  empty: VariantFn<SidebarApi, EmptyObject>;
};

export type ContentVariants = {
  standard: VariantFn<
    ContentApi,
    {
      pageTitle?: string;
      description?: DsChild | DsChild[];
      actions?: DsChild | DsChild[];
      body: DsChild | DsChild[];
    }
  >;
};

export type RightRailVariants = {
  panel: VariantFn<RightRailApi, { title?: string; body: DsChild | DsChild[] }>;
  empty: VariantFn<RightRailApi, EmptyObject>;
};

export type FooterVariants = {
  basic: VariantFn<FooterApi, { links?: FooterLink[]; smallPrint?: string }>;
  empty: VariantFn<FooterApi, EmptyObject>;
};

type Merge<A, B> = A & B;

export interface DesignSystem<
  HV extends VariantRegistry<HeaderApi>,
  SV extends VariantRegistry<SidebarApi>,
  CV extends VariantRegistry<ContentApi>,
  RV extends VariantRegistry<RightRailApi>,
  FV extends VariantRegistry<FooterApi>,
> {
  header: RegionComposer<HeaderApi, HV>;
  sidebar: RegionComposer<SidebarApi, SV>;
  content: RegionComposer<ContentApi, CV>;
  rightRail: RegionComposer<RightRailApi, RV>;
  footer: RegionComposer<FooterApi, FV>;
}

export type AnyDesignSystem = DesignSystem<
  VariantRegistry<HeaderApi>,
  VariantRegistry<SidebarApi>,
  VariantRegistry<ContentApi>,
  VariantRegistry<RightRailApi>,
  VariantRegistry<FooterApi>
>;

export interface DesignSystemExtensions {
  header?: VariantRegistry<HeaderApi>;
  sidebar?: VariantRegistry<SidebarApi>;
  content?: VariantRegistry<ContentApi>;
  rightRail?: VariantRegistry<RightRailApi>;
  footer?: VariantRegistry<FooterApi>;
}

/* ---------------------------- DS construction ---------------------------- */

function makeRegionComposer<Api, V extends VariantRegistry<Api>>(args: {
  regionName: "header" | "sidebar" | "content" | "rightRail" | "footer";
  api: Api;
  variants: V;
  wrapTag: (a: Attrs, ...kids: DsChild[]) => DsHtml;
}): RegionComposer<Api, V> {
  const at = (...p: Array<Attrs | null | undefined | false>) => attrs(...p);
  const c = (...p: ClassSpec[]) => classNames(...p);

  const wrap = (init: RegionInit, kids: DsChild | DsChild[]) => {
    const a = at(
      { class: c(`ds-${args.regionName}`, init.class) },
      init.attrs,
      init.ariaLabel ? { "aria-label": init.ariaLabel } : undefined,
    );
    return args.wrapTag(a, ...asKids(kids));
  };

  const use = <K extends VariantName<V>>(
    name: K,
    opts: VariantOpts<Api, V, K>,
    init?: RegionInit,
  ) => {
    const fn = args.variants[name] as unknown as (
      api: Api,
      o: VariantOpts<Api, V, K>,
    ) => DsHtml;
    return wrap(init ?? {}, fn(args.api, opts));
  };

  return { wrap, use, variants: args.variants, cls: c, attrs: at };
}

export function createDesignSystem<
  Ext extends DesignSystemExtensions = Record<PropertyKey, never>,
>(
  ext?: Ext,
): DesignSystem<
  Merge<
    HeaderVariants,
    Ext["header"] extends VariantRegistry<HeaderApi> ? Ext["header"]
      : EmptyObject
  >,
  Merge<
    SidebarVariants,
    Ext["sidebar"] extends VariantRegistry<SidebarApi> ? Ext["sidebar"]
      : EmptyObject
  >,
  Merge<
    ContentVariants,
    Ext["content"] extends VariantRegistry<ContentApi> ? Ext["content"]
      : EmptyObject
  >,
  Merge<
    RightRailVariants,
    Ext["rightRail"] extends VariantRegistry<RightRailApi> ? Ext["rightRail"]
      : EmptyObject
  >,
  Merge<
    FooterVariants,
    Ext["footer"] extends VariantRegistry<FooterApi> ? Ext["footer"]
      : EmptyObject
  >
> {
  const at = (...p: Array<Attrs | null | undefined | false>) => attrs(...p);
  const c = (...p: ClassSpec[]) => classNames(...p);

  const headerApi: HeaderApi = {
    title: (t, init) => span({ class: c("ds-header-title", init?.class) }, t),
    actions: (kids, init) =>
      section({ class: c("ds-header-actions", init?.class) }, ...asKids(kids)),
    breadcrumbs: (items, init) =>
      nav(
        {
          class: c("ds-breadcrumbs", init?.class),
          "aria-label": "Breadcrumbs",
        },
        ol(
          { class: "ds-breadcrumbs-list" },
          items.map((it) =>
            li(
              { class: "ds-breadcrumbs-item" },
              it.href ? a({ href: it.href }, it.label) : span(it.label),
            )
          ),
        ),
      ),
    cls: c,
    attrs: at,
  };

  const sidebarApi: SidebarApi = {
    sectionTitle: (t, init) =>
      span({ class: c("ds-sidebar-title", init?.class) }, t),
    navList: (items, init) =>
      ul(
        { class: c("ds-nav-list", init?.class) },
        items.map((it) =>
          li(
            { class: c("ds-nav-item", it.active && "is-active") },
            a(
              {
                href: it.href,
                "aria-current": it.active ? "page" : undefined,
              },
              it.label,
            ),
          )
        ),
      ),
    cls: c,
    attrs: at,
  };

  const contentApi: ContentApi = {
    pageHeader: (t, init) =>
      header(
        { class: c("ds-page-header", init?.class) },
        section(
          { class: "ds-page-header-text" },
          span({ class: "ds-page-title" }, t),
          init?.description
            ? section(
              { class: "ds-page-description" },
              ...asKids(init.description),
            )
            : "",
        ),
        init?.actions
          ? section({ class: "ds-page-actions" }, ...asKids(init.actions))
          : "",
      ),
    contentSection: (init, kids) =>
      section(
        { class: c("ds-section", init.class) },
        init.title
          ? header({ class: "ds-section-header" }, span(init.title))
          : "",
        section({ class: "ds-section-body" }, ...asKids(kids)),
      ),
    cls: c,
    attrs: at,
  };

  const rightRailApi: RightRailApi = {
    panel: (init, kids) =>
      section(
        { class: c("ds-rail-panel", init.class) },
        init.title
          ? header({ class: "ds-rail-panel-header" }, span(init.title))
          : "",
        section({ class: "ds-rail-panel-body" }, ...asKids(kids)),
      ),
    cls: c,
    attrs: at,
  };

  const footerApi: FooterApi = {
    links: (items, init) =>
      nav(
        {
          class: c("ds-footer-links", init?.class),
          "aria-label": "Footer links",
        },
        ul(
          { class: "ds-footer-links-list" },
          items.map((it) =>
            li(
              { class: "ds-footer-links-item" },
              a({ href: it.href }, it.label),
            )
          ),
        ),
      ),
    smallPrint: (t, init) =>
      span({ class: c("ds-footer-smallprint", init?.class) }, t),
    cls: c,
    attrs: at,
  };

  const builtInHeader: HeaderVariants = {
    basic: (api, o) =>
      header(
        { class: "ds-header-inner" },
        o.breadcrumbs?.length ? api.breadcrumbs(o.breadcrumbs) : "",
        o.title ? api.title(o.title) : "",
        o.actions ? api.actions(o.actions) : "",
      ),
    minimal: (api, o) =>
      header(
        { class: "ds-header-inner" },
        o.title ? api.title(o.title) : "",
      ),
  };

  const builtInSidebar: SidebarVariants = {
    nav: (api, o) =>
      section(
        { class: "ds-sidebar-inner" },
        o.title ? api.sectionTitle(o.title) : "",
        api.navList(o.items),
      ),
    empty: () => section({ class: "ds-sidebar-inner" }),
  };

  const builtInContent: ContentVariants = {
    standard: (api, o) =>
      section(
        { class: "ds-content-inner" },
        o.pageTitle
          ? api.pageHeader(o.pageTitle, {
            description: o.description,
            actions: o.actions,
          })
          : "",
        section({ class: "ds-content-body" }, ...asKids(o.body)),
      ),
  };

  const builtInRightRail: RightRailVariants = {
    panel: (api, o) => api.panel({ title: o.title }, o.body),
    empty: () => section({ class: "ds-rail-empty" }),
  };

  const builtInFooter: FooterVariants = {
    basic: (api, o) =>
      section(
        { class: "ds-footer-inner" },
        o.links?.length ? api.links(o.links) : "",
        o.smallPrint ? api.smallPrint(o.smallPrint) : "",
      ),
    empty: () => section({ class: "ds-footer-empty" }),
  };

  const headerVariants = {
    ...builtInHeader,
    ...(ext?.header ?? ({} as EmptyObject)),
  } as Merge<
    HeaderVariants,
    Ext["header"] extends VariantRegistry<HeaderApi> ? Ext["header"]
      : EmptyObject
  >;

  const sidebarVariants = {
    ...builtInSidebar,
    ...(ext?.sidebar ?? ({} as EmptyObject)),
  } as Merge<
    SidebarVariants,
    Ext["sidebar"] extends VariantRegistry<SidebarApi> ? Ext["sidebar"]
      : EmptyObject
  >;

  const contentVariants = {
    ...builtInContent,
    ...(ext?.content ?? ({} as EmptyObject)),
  } as Merge<
    ContentVariants,
    Ext["content"] extends VariantRegistry<ContentApi> ? Ext["content"]
      : EmptyObject
  >;

  const rightRailVariants = {
    ...builtInRightRail,
    ...(ext?.rightRail ?? ({} as EmptyObject)),
  } as Merge<
    RightRailVariants,
    Ext["rightRail"] extends VariantRegistry<RightRailApi> ? Ext["rightRail"]
      : EmptyObject
  >;

  const footerVariants = {
    ...builtInFooter,
    ...(ext?.footer ?? ({} as EmptyObject)),
  } as Merge<
    FooterVariants,
    Ext["footer"] extends VariantRegistry<FooterApi> ? Ext["footer"]
      : EmptyObject
  >;

  return {
    header: makeRegionComposer({
      regionName: "header",
      api: headerApi,
      variants: headerVariants,
      wrapTag: (a2, ...kids) => header(a2, ...kids),
    }),
    sidebar: makeRegionComposer({
      regionName: "sidebar",
      api: sidebarApi,
      variants: sidebarVariants,
      wrapTag: (a2, ...kids) => nav(a2, ...kids),
    }),
    content: makeRegionComposer({
      regionName: "content",
      api: contentApi,
      variants: contentVariants,
      wrapTag: (a2, ...kids) => main(a2, ...kids),
    }),
    rightRail: makeRegionComposer({
      regionName: "rightRail",
      api: rightRailApi,
      variants: rightRailVariants,
      wrapTag: (a2, ...kids) => aside(a2, ...kids),
    }),
    footer: makeRegionComposer({
      regionName: "footer",
      api: footerApi,
      variants: footerVariants,
      wrapTag: (a2, ...kids) => footer(a2, ...kids),
    }),
  };
}

export const defaultDesignSystem = createDesignSystem();
export type DefaultDesignSystem = typeof defaultDesignSystem;

/* --------------------------------- Layout -------------------------------- */

export type LayoutVariant = "app-shell" | "centered" | "marketing";

export interface ShellParts {
  header?: DsHtml;
  sidebar?: DsHtml;
  content: DsHtml;
  rightRail?: DsHtml;
  footer?: DsHtml;
  shellAttrs?: Attrs;
}

export interface ThemeApi {
  htmlClass: (...parts: ClassSpec[]) => string;
  bodyClass: (...parts: ClassSpec[]) => string;
  attrs: (...parts: Array<Attrs | null | undefined | false>) => Attrs;
}

export interface ThemeParts {
  htmlAttrs?: Attrs;
  bodyAttrs?: Attrs;
  htmlClass?: string;
  bodyClass?: string;
  head?: DsHtml;
}

export interface HeadApi {
  stylesheet: (href: string, extra?: Attrs) => DsHtml;
  preconnect: (href: string, extra?: Attrs) => DsHtml;
  icon: (href: string, extra?: Attrs) => DsHtml;
  attrs: (...parts: Array<Attrs | null | undefined | false>) => Attrs;
}

export interface LayoutInit<DS extends AnyDesignSystem = DefaultDesignSystem> {
  variant?: LayoutVariant;
  lang?: string;
  title?: string;

  theme?: (t: ThemeApi) => ThemeParts | void;
  head?: (h: HeadApi) => DsHtml | void;

  meta?: {
    charset?: string;
    viewport?: string;
    colorScheme?: string;
  };

  shell: (
    r: Pick<DS, "header" | "sidebar" | "content" | "rightRail" | "footer">,
  ) => ShellParts;
}

const themeApi: ThemeApi = {
  htmlClass: (...p) => classNames(...p),
  bodyClass: (...p) => classNames(...p),
  attrs: (...p) => attrs(...p),
};

const headApi: HeadApi = {
  stylesheet: (href, extra) =>
    link(attrs({ rel: "stylesheet", href }, extra ?? {})),
  preconnect: (href, extra) =>
    link(attrs({ rel: "preconnect", href }, extra ?? {})),
  icon: (href, extra) => link(attrs({ rel: "icon", href }, extra ?? {})),
  attrs: (...p) => attrs(...p),
};

export function semanticLayout<
  DS extends AnyDesignSystem = DefaultDesignSystem,
>(
  init: LayoutInit<DS>,
  ds: DS = defaultDesignSystem as unknown as DS,
): DsHtml {
  const variant = init.variant ?? "app-shell";

  const themeParts = (init.theme?.(themeApi) ?? {}) as ThemeParts;
  const extraHead = init.head?.(headApi) ?? "";

  const metaCharset = init.meta?.charset ?? "utf-8";
  const metaViewport = init.meta?.viewport ??
    "width=device-width, initial-scale=1";
  const metaColorScheme = init.meta?.colorScheme ?? "light dark";

  const parts = init.shell({
    header: ds.header,
    sidebar: ds.sidebar,
    content: ds.content,
    rightRail: ds.rightRail,
    footer: ds.footer,
  });

  const bodyNode = buildBody(variant, parts);

  return concatRaw(
    doctype(),
    html(
      attrs(
        { lang: init.lang ?? "en" },
        themeParts.htmlAttrs,
        themeParts.htmlClass ? { class: themeParts.htmlClass } : undefined,
      ),
      head(
        meta({ charset: metaCharset }),
        meta({ name: "viewport", content: metaViewport }),
        meta({ name: "color-scheme", content: metaColorScheme }),
        init.title ? title(init.title) : "",
        themeParts.head ?? "",
        extraHead,
      ),
      body(
        attrs(
          { class: classNames("ds-body", themeParts.bodyClass) },
          themeParts.bodyAttrs,
        ),
        bodyNode,
      ),
    ),
  );
}

function buildBody(variant: LayoutVariant, parts: ShellParts): DsHtml {
  switch (variant) {
    case "centered":
      return section(
        attrs({ class: "ds-centered" }, parts.shellAttrs),
        parts.header ?? "",
        section({ class: "ds-centered-container" }, parts.content),
        parts.footer ?? "",
      );

    case "marketing":
      return section(
        attrs({ class: "ds-marketing" }, parts.shellAttrs),
        parts.header ?? "",
        section({ class: "ds-marketing-content" }, parts.content),
        parts.footer ?? "",
      );

    case "app-shell":
    default:
      return div(
        attrs({ class: "ds-shell" }, parts.shellAttrs),
        parts.header ?? "",
        section(
          { class: "ds-workspace" },
          parts.sidebar ?? "",
          parts.content,
          parts.rightRail ?? "",
        ),
        parts.footer ?? "",
      );
  }
}

/* ------------------------------ Re-exports ------------------------------ */

export { a, li, p, render, renderPretty, section, span, ul };
