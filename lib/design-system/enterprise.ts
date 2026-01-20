/**
 * @module lib/design-system/enterprise.ts
 *
 * Enterprise design system primitives derived from support/rfc/design-system-spec.md.
 * This module provides semantic layout regions (header, sidebar, content, right rail, footer)
 * with typed variants for enterprise app shells.
 */
import type {
  Attrs,
  Child,
  ClassSpec,
  RawHtml,
} from "../natural-html/elements.ts";

import {
  a,
  aside,
  attrs,
  body,
  button,
  classNames,
  details,
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
  summary,
  title,
  trustedRaw,
  ul,
} from "../natural-html/elements.ts";

/* ------------------------------ Basic types ------------------------------ */

export type DsHtml = RawHtml;
export type DsChild = Child | DsHtml;

export const cls = (...parts: ClassSpec[]) => classNames(...parts);

function asKids(k: DsChild | DsChild[] | undefined): DsChild[] {
  if (k === undefined) return [];
  return Array.isArray(k) ? k : [k];
}

function concatRaw(...chunks: RawHtml[]): RawHtml {
  return {
    __rawHtml: "",
    __nodes: chunks.flatMap((c) => c.__nodes ?? []),
  } as RawHtml;
}

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

export interface HeaderBrand {
  appName: string;
  logo?: DsChild;
  href?: string;
  environment?: string;
}

export interface HeaderNavItem {
  label: string;
  href: string;
  active?: boolean;
}

export interface SidebarSubject {
  id: string;
  label: string;
  active?: boolean;
}

export interface SidebarNavItem {
  label: string;
  href: string;
  active?: boolean;
}

export interface SidebarSection {
  id: string;
  label: string;
  items: SidebarNavItem[];
}

export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterStatus {
  label: string;
  value: string;
  tone?: "success" | "warning" | "info" | "muted";
}

export interface RightRailSection {
  id: string;
  label: string;
  href?: string;
  active?: boolean;
}

export interface HeaderApi {
  menuToggle: (labelText?: string, init?: { class?: string }) => DsHtml;
  brand: (info: HeaderBrand, init?: { class?: string }) => DsHtml;
  nav: (items: HeaderNavItem[], init?: { class?: string }) => DsHtml;
  actions: (children: DsChild | DsChild[], init?: { class?: string }) => DsHtml;
  breadcrumbs: (items: BreadcrumbItem[], init?: { class?: string }) => DsHtml;

  cls: (...parts: ClassSpec[]) => string;
  attrs: (...parts: Array<Attrs | null | undefined | false>) => Attrs;
}

export interface SidebarApi {
  subjectSelector: (
    subjects: SidebarSubject[],
    init?: { label?: string; class?: string },
  ) => DsHtml;
  sectionTitle: (t: string, init?: { class?: string }) => DsHtml;
  navList: (items: SidebarNavItem[], init?: { class?: string }) => DsHtml;
  navSection: (sectionDef: SidebarSection, init?: { class?: string }) => DsHtml;

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
  sectionNav: (
    items: RightRailSection[],
    init?: { title?: string; class?: string },
  ) => DsHtml;
  panel: (
    init: { title?: string; class?: string },
    children: DsChild | DsChild[],
  ) => DsHtml;

  cls: (...parts: ClassSpec[]) => string;
  attrs: (...parts: Array<Attrs | null | undefined | false>) => Attrs;
}

export interface FooterApi {
  links: (items: FooterLink[], init?: { class?: string }) => DsHtml;
  status: (items: FooterStatus[], init?: { class?: string }) => DsHtml;
  version: (t: string, init?: { class?: string }) => DsHtml;
  smallPrint: (t: string, init?: { class?: string }) => DsHtml;

  cls: (...parts: ClassSpec[]) => string;
  attrs: (...parts: Array<Attrs | null | undefined | false>) => Attrs;
}

/* --------------------------- Built-in variants --------------------------- */

export type EmptyObject = Record<PropertyKey, never>;

export type HeaderVariants = {
  enterprise: VariantFn<
    HeaderApi,
    {
      brand: HeaderBrand;
      nav?: HeaderNavItem[];
      actions?: DsChild | DsChild[];
      breadcrumbs?: BreadcrumbItem[];
      menuToggleLabel?: string;
    }
  >;
  minimal: VariantFn<HeaderApi, { title?: string }>;
};

export type SidebarVariants = {
  enterprise: VariantFn<
    SidebarApi,
    {
      title?: string;
      subjects?: SidebarSubject[];
      sections: SidebarSection[];
      footer?: DsChild | DsChild[];
      collapsed?: boolean;
    }
  >;
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
  sections: VariantFn<
    RightRailApi,
    { title?: string; items: RightRailSection[]; body?: DsChild | DsChild[] }
  >;
  panel: VariantFn<RightRailApi, { title?: string; body: DsChild | DsChild[] }>;
  empty: VariantFn<RightRailApi, EmptyObject>;
};

export type FooterVariants = {
  enterprise: VariantFn<
    FooterApi,
    {
      links?: FooterLink[];
      status?: FooterStatus[];
      version?: string;
      smallPrint?: string;
    }
  >;
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
      { class: c(`eds-${args.regionName}`, init.class) },
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

export function createEnterpriseDesignSystem<
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
    menuToggle: (labelText = "Toggle navigation", init) =>
      button(
        {
          class: c("eds-menu-toggle", init?.class),
          type: "button",
          "aria-label": labelText,
          "aria-expanded": "true",
          "data-eds-toggle": "sidebar",
        },
        span(
          { class: "eds-menu-toggle-icon" },
          span({ class: "eds-menu-toggle-bar" }),
          span({ class: "eds-menu-toggle-bar" }),
          span({ class: "eds-menu-toggle-bar" }),
        ),
        span({ class: "eds-sr-only" }, labelText),
      ),
    brand: (info, init) => {
      const nodes: DsChild[] = [];
      if (info.logo) nodes.push(span({ class: "eds-brand-mark" }, info.logo));
      nodes.push(span({ class: "eds-brand-name" }, info.appName));
      if (info.environment) {
        nodes.push(span({ class: "eds-env-badge" }, info.environment));
      }
      return info.href
        ? a({ href: info.href, class: c("eds-brand", init?.class) }, ...nodes)
        : span({ class: c("eds-brand", init?.class) }, ...nodes);
    },
    nav: (items, init) =>
      nav(
        { class: c("eds-header-nav", init?.class) },
        ul(
          { class: "eds-header-nav-list" },
          items.map((item) =>
            li(
              { class: c("eds-header-nav-item", item.active && "is-active") },
              a(
                {
                  href: item.href,
                  "aria-current": item.active ? "page" : undefined,
                },
                item.label,
              ),
            )
          ),
        ),
      ),
    actions: (kids, init) =>
      section(
        { class: c("eds-header-actions", init?.class) },
        ...asKids(kids),
      ),
    breadcrumbs: (items, init) =>
      nav(
        {
          class: c("eds-breadcrumbs", init?.class),
          "aria-label": "Breadcrumbs",
        },
        ol(
          { class: "eds-breadcrumbs-list" },
          items.map((it) =>
            li(
              { class: "eds-breadcrumbs-item" },
              it.href ? a({ href: it.href }, it.label) : span(it.label),
            )
          ),
        ),
      ),
    cls: c,
    attrs: at,
  };

  const sidebarApi: SidebarApi = {
    subjectSelector: (subjects, init) =>
      section(
        { class: c("eds-sidebar-subject", init?.class) },
        (() => {
          const activeSubject = subjects.find((subject) => subject.active) ??
            subjects[0];
          return details(
            { class: "eds-subject-menu" },
            summary(
              { class: "eds-subject-trigger" },
              span({ class: "eds-subject-icon" }),
              span(
                { class: "eds-subject-label" },
                activeSubject?.label ?? "",
              ),
              span({ class: "eds-subject-chevron" }),
            ),
            ul(
              { class: "eds-subject-list" },
              subjects.map((subject) =>
                li(
                  { class: "eds-subject-item" },
                  button(
                    {
                      class: c(
                        "eds-subject-option",
                        subject.active && "is-active",
                      ),
                      type: "button",
                      "data-subject": subject.id,
                      "data-label": subject.label,
                    },
                    span({ class: "eds-subject-option-icon" }),
                    span({ class: "eds-subject-option-label" }, subject.label),
                    span({ class: "eds-subject-check" }),
                  ),
                )
              ),
            ),
          );
        })(),
      ),
    sectionTitle: (t, init) =>
      span({ class: c("eds-sidebar-title", init?.class) }, t),
    navList: (items, init) =>
      ul(
        { class: c("eds-nav-list", init?.class) },
        items.map((it) =>
          li(
            { class: c("eds-nav-item", it.active && "is-active") },
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
    navSection: (sectionDef, init) =>
      section(
        { class: c("eds-sidebar-section", init?.class) },
        sectionDef.label
          ? header(
            { class: "eds-sidebar-section-header" },
            span(sectionDef.label),
          )
          : "",
        section(
          { class: "eds-sidebar-section-body" },
          sidebarApi.navList(sectionDef.items),
        ),
      ),
    cls: c,
    attrs: at,
  };

  const contentApi: ContentApi = {
    pageHeader: (t, init) =>
      header(
        { class: c("eds-page-header", init?.class) },
        section(
          { class: "eds-page-header-text" },
          span({ class: "eds-page-title" }, t),
          init?.description
            ? section(
              { class: "eds-page-description" },
              ...asKids(init.description),
            )
            : "",
        ),
        init?.actions
          ? section({ class: "eds-page-actions" }, ...asKids(init.actions))
          : "",
      ),
    contentSection: (init, kids) =>
      section(
        { class: c("eds-section", init.class) },
        init.title
          ? header({ class: "eds-section-header" }, span(init.title))
          : "",
        section({ class: "eds-section-body" }, ...asKids(kids)),
      ),
    cls: c,
    attrs: at,
  };

  const rightRailApi: RightRailApi = {
    sectionNav: (items, init) =>
      section(
        { class: c("eds-rail-nav", init?.class) },
        init?.title
          ? header({ class: "eds-rail-nav-header" }, span(init.title))
          : "",
        nav(
          { class: "eds-rail-nav-body", "aria-label": "On this page" },
          ul(
            { class: "eds-rail-nav-list" },
            items.map((item) =>
              li(
                { class: c("eds-rail-nav-item", item.active && "is-active") },
                item.href
                  ? a(
                    {
                      href: item.href,
                      "aria-current": item.active ? "location" : undefined,
                    },
                    item.label,
                  )
                  : span(item.label),
              )
            ),
          ),
        ),
      ),
    panel: (init, kids) =>
      section(
        { class: c("eds-rail-panel", init.class) },
        init.title
          ? header({ class: "eds-rail-panel-header" }, span(init.title))
          : "",
        section({ class: "eds-rail-panel-body" }, ...asKids(kids)),
      ),
    cls: c,
    attrs: at,
  };

  const footerApi: FooterApi = {
    links: (items, init) =>
      nav(
        {
          class: c("eds-footer-links", init?.class),
          "aria-label": "Footer links",
        },
        ul(
          { class: "eds-footer-links-list" },
          items.map((it) =>
            li(
              { class: "eds-footer-links-item" },
              a({ href: it.href }, it.label),
            )
          ),
        ),
      ),
    status: (items, init) =>
      section(
        { class: c("eds-footer-status", init?.class) },
        items.map((item) =>
          span(
            { class: c("eds-status-pill", item.tone && `is-${item.tone}`) },
            `${item.label}: ${item.value}`,
          )
        ),
      ),
    version: (t, init) =>
      span({ class: c("eds-footer-version", init?.class) }, t),
    smallPrint: (t, init) =>
      span({ class: c("eds-footer-smallprint", init?.class) }, t),
    cls: c,
    attrs: at,
  };

  const builtInHeader: HeaderVariants = {
    enterprise: (api, o) =>
      header(
        { class: "eds-header-inner" },
        section(
          { class: "eds-header-top" },
          section(
            { class: "eds-header-left" },
            api.menuToggle(o.menuToggleLabel),
            api.brand(o.brand),
          ),
          o.nav?.length ? api.nav(o.nav) : "",
          o.actions ? api.actions(o.actions) : "",
        ),
        o.breadcrumbs?.length
          ? section(
            { class: "eds-header-breadcrumbs" },
            api.breadcrumbs(o.breadcrumbs),
          )
          : "",
      ),
    minimal: (_api, o) =>
      header(
        { class: "eds-header-inner" },
        o.title ? span({ class: "eds-header-title" }, o.title) : "",
      ),
  };

  const builtInSidebar: SidebarVariants = {
    enterprise: (api, o) =>
      section(
        { class: c("eds-sidebar-inner", o.collapsed && "is-collapsed") },
        o.subjects?.length ? api.subjectSelector(o.subjects) : "",
        o.title ? api.sectionTitle(o.title) : "",
        o.sections.map((sectionDef) => api.navSection(sectionDef)),
        o.footer
          ? section(
            { class: "eds-sidebar-footer" },
            ...asKids(o.footer),
          )
          : "",
      ),
    empty: () => section({ class: "eds-sidebar-inner" }),
  };

  const builtInContent: ContentVariants = {
    standard: (api, o) =>
      section(
        { class: "eds-content-inner" },
        o.pageTitle
          ? api.pageHeader(o.pageTitle, {
            description: o.description,
            actions: o.actions,
          })
          : "",
        section({ class: "eds-content-body" }, ...asKids(o.body)),
      ),
  };

  const builtInRightRail: RightRailVariants = {
    sections: (api, o) =>
      section(
        { class: "eds-rail-inner" },
        api.sectionNav(o.items, { title: o.title }),
        o.body ? section({ class: "eds-rail-body" }, ...asKids(o.body)) : "",
      ),
    panel: (api, o) => api.panel({ title: o.title }, o.body),
    empty: () => section({ class: "eds-rail-empty" }),
  };

  const builtInFooter: FooterVariants = {
    enterprise: (api, o) =>
      section(
        { class: "eds-footer-inner" },
        o.links?.length ? api.links(o.links) : "",
        o.status?.length ? api.status(o.status) : "",
        o.version ? api.version(o.version) : "",
        o.smallPrint ? api.smallPrint(o.smallPrint) : "",
      ),
    empty: () => section({ class: "eds-footer-empty" }),
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

export const defaultEnterpriseDesignSystem = createEnterpriseDesignSystem();
export type DefaultEnterpriseDesignSystem =
  typeof defaultEnterpriseDesignSystem;

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

export interface LayoutInit<
  DS extends AnyDesignSystem = DefaultEnterpriseDesignSystem,
> {
  variant?: LayoutVariant;
  lang?: string;
  title?: string;
  stylesheetHref?: string;

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

export interface LayoutDependency {
  source: string;
  mount: string;
  contentType?: string;
  headers?: HeadersInit;
}

export interface LayoutResult {
  html: DsHtml;
  dependencies: Iterable<LayoutDependency>;
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

export function enterpriseLayout<
  DS extends AnyDesignSystem = DefaultEnterpriseDesignSystem,
>(
  init: LayoutInit<DS>,
  ds: DS = defaultEnterpriseDesignSystem as unknown as DS,
): LayoutResult {
  const variant = init.variant ?? "app-shell";

  const themeParts = (init.theme?.(themeApi) ?? {}) as ThemeParts;
  const extraHead = init.head?.(headApi) ?? "";

  const metaCharset = init.meta?.charset ?? "utf-8";
  const metaViewport = init.meta?.viewport ??
    "width=device-width, initial-scale=1";
  const metaColorScheme = init.meta?.colorScheme ?? "light dark";
  const stylesheetHref = init.stylesheetHref ?? "/fluent-ds/enterprise.css";
  const stylesheetSource = stylesheetHref.startsWith("http://") ||
      stylesheetHref.startsWith("https://")
    ? stylesheetHref
    : import.meta.resolve("./enterprise.css");

  const parts = init.shell({
    header: ds.header,
    sidebar: ds.sidebar,
    content: ds.content,
    rightRail: ds.rightRail,
    footer: ds.footer,
  });

  const bodyNode = buildBody(variant, parts);

  return {
    html: concatRaw(
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
          link({ rel: "stylesheet", href: stylesheetHref }),
          init.title ? title(init.title) : "",
          themeParts.head ?? "",
          extraHead,
        ),
        body(
          attrs(
            { class: classNames("eds-body", themeParts.bodyClass) },
            themeParts.bodyAttrs,
          ),
          bodyNode,
        ),
      ),
    ),
    dependencies: [
      {
        source: stylesheetSource,
        mount: stylesheetHref,
        contentType: "text/css; charset=utf-8",
      },
    ],
  };
}

function buildBody(variant: LayoutVariant, parts: ShellParts): DsHtml {
  switch (variant) {
    case "centered":
      return section(
        attrs({ class: "eds-centered" }, parts.shellAttrs),
        parts.header ?? "",
        section({ class: "eds-centered-container" }, parts.content),
        parts.footer ?? "",
      );

    case "marketing":
      return section(
        attrs({ class: "eds-marketing" }, parts.shellAttrs),
        parts.header ?? "",
        section({ class: "eds-marketing-content" }, parts.content),
        parts.footer ?? "",
      );

    case "app-shell":
    default:
      return div(
        attrs({ class: "eds-shell" }, parts.shellAttrs),
        parts.header ?? "",
        section(
          { class: "eds-workspace" },
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
