#!/usr/bin/env -S deno run -A --watch --unstable-bundle --node-modules-dir=auto
/**
 * Natural DS reference app (mirrors lib/natural-ds/natural-ds.html).
 *
 * Run:
 *   deno run -A --unstable-bundle support/learn/03-natural-ds/guide.ts
 *
 * Then open:
 *   http://127.0.0.1:7599
 */
import { Application, htmlResponse } from "../../../lib/continuux/http.ts";
import {
  accordion,
  apiTable,
  badge,
  bodyText,
  breadcrumbItem,
  callout,
  codeBlock,
  codeBlockEnhanced,
  colorGrid,
  colorSwatch,
  contextBrand,
  contextHeaderContent,
  contextIconButton,
  contextNavLink,
  contextUser,
  definitionItem,
  definitionList,
  exampleWrapper,
  featureCard,
  featureGrid,
  fileTree,
  footerNav,
  imageWithCaption,
  keyboardShortcut,
  naturalDesignSystem,
  navCategory,
  navChildLink,
  navExpandable,
  navLink,
  navSection,
  pageHeader,
  searchBar,
  sectionHeading,
  sidebarHeader,
  steps,
  subjectOption,
  subjectSelector,
  subsectionHeading,
  tabs,
  tocLink,
  tocList,
} from "../../../lib/natural-ds/mod.ts";
import type {
  NamingStrategy,
  RenderCtx,
} from "../../../lib/natural-html/design-system.ts";
import * as H from "../../../lib/natural-html/elements.ts";
import {
  combineHast,
  headSlots,
  type RenderInput,
} from "../../../lib/natural-html/patterns.ts";

import {
  httpProxyFromManifest,
  type ProxyManifestRoute,
} from "../../../lib/continuux/http-proxy.ts";

type State = Record<string, never>;
type Vars = Record<string, never>;

const app = Application.sharedState<State, Vars>({});
const ds = naturalDesignSystem();

const svg = (markup: string) => H.trustedRaw(markup);

const icons = {
  home: svg(
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>',
  ),
  docs: svg(
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>',
  ),
  globe: svg(
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>',
  ),
  github: svg(
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>',
  ),
  chat: svg(
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>',
  ),
  search: svg(
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
  ),
  searchSmall: svg(
    '<svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
  ),
  bell: svg(
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>',
  ),
  settings: svg(
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
  ),
  chevronDown: svg(
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>',
  ),
  chevronsUpDown: svg(
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5"></path><path d="m7 9 5-5 5 5"></path></svg>',
  ),
  grid: svg(
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect></svg>',
  ),
  navIcon: svg(
    '<svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>',
  ),
  toggle: svg(
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>',
  ),
  breadcrumbChevron: svg(
    '<svg class="breadcrumb-separator-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>',
  ),
  info: svg(
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
  ),
  warning: svg(
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
  ),
  tip: svg(
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path></svg>',
  ),
  check: svg(
    '<svg class="option-checkmark" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>',
  ),
  copy: svg(
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
  ),
  folderIcon: svg(
    '<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"></path></svg>',
  ),
  fileIcon: svg(
    '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>',
  ),
};

const GITHUB_PROXY_HOST = "127.0.0.1";
const GITHUB_PROXY_PORT = 7600;
const GITHUB_PROXY_BASE_URL =
  `http://${GITHUB_PROXY_HOST}:${GITHUB_PROXY_PORT}`;
const GITHUB_PROXY_TOKEN = Deno.env.get("GITHUB_PROXY_TOKEN")?.trim();
const githubProxyRequestHeaders = GITHUB_PROXY_TOKEN
  ? { set: { Authorization: `token ${GITHUB_PROXY_TOKEN}` } }
  : undefined;

type ContextNavTarget = "docs" | "github";

type DsRenderCtx = RenderCtx<RenderInput, NamingStrategy>;

const buildContextHeader = (ctx: DsRenderCtx, active: ContextNavTarget) =>
  contextHeaderContent(ctx, {
    brand: contextBrand(ctx, {
      label: "Acme Inc",
      iconText: "DS",
    }),
    nav: [
      contextNavLink(ctx, {
        label: "Docs",
        icon: icons.docs,
        href: "/",
        active: active === "docs",
      }),
      contextNavLink(ctx, {
        label: "GitHub",
        icon: icons.github,
        href: "/github",
        active: active === "github",
      }),
      contextNavLink(ctx, { label: "Blog", icon: icons.globe }),
      contextNavLink(ctx, { label: "Discord", icon: icons.chat }),
    ],
    actions: [
      contextIconButton(ctx, { label: "Search", icon: icons.search }),
      contextIconButton(ctx, {
        label: "Notifications",
        icon: icons.bell,
        badge: true,
      }),
      contextIconButton(ctx, { label: "Settings", icon: icons.settings }),
    ],
    user: contextUser(ctx, {
      initials: "JD",
      name: "John Doe",
      chevron: icons.chevronDown,
    }),
  });

const renderBreadcrumbSeparator = () =>
  H.span(
    { class: "breadcrumb-separator", "aria-hidden": "true" },
    icons.breadcrumbChevron,
  );

type GitHubSubjectId =
  | "netspective"
  | "netspective-labs"
  | "programmablemd";

type GitHubRepo = {
  readonly name: string;
  readonly slug: string;
  readonly description: string;
  readonly url: string;
  readonly path?: string;
};

type GitHubSubject = {
  readonly id: GitHubSubjectId;
  readonly title: string;
  readonly org: string;
  readonly description: string;
  readonly icon: H.RawHtml;
  readonly repos: readonly GitHubRepo[];
};

const gitHubSubjects: Record<GitHubSubjectId, GitHubSubject> = {
  netspective: {
    id: "netspective",
    title: "Netspective",
    org: "netspective",
    description: "Core ContinuUX tooling and docs living under Netspective.",
    icon: icons.docs,
    repos: [
      {
        slug: "fluent",
        name: "Fluent",
        description: "Netspective Fluent M2M Platform",
        url: "https://github.com/netspective/fluent",
      },
    ],
  },
  "netspective-labs": {
    id: "netspective-labs",
    title: "Netspective Labs",
    org: "netspective-labs",
    description:
      "Experimental labs and prototypes that push CI/CD and runtime tooling.",
    icon: icons.grid,
    repos: [
      {
        slug: "autarkic",
        name: "Autarkic",
        description:
          "Deno UI shell combining Natural DS with ContinuUX patterns.",
        url: "https://github.com/netspective-labs/autarkic",
      },
      {
        slug: "sql-aide",
        name: "SQL Aide",
        description: "CLI and UI helpers for managing schema migrations.",
        url: "https://github.com/netspective-labs/sql-aide",
      },
      {
        slug: "aide",
        name: "Aide",
        description: "Collection of shared helper libraries for automation.",
        url: "https://github.com/netspective-labs/aide",
      },
    ],
  },
  programmablemd: {
    id: "programmablemd",
    title: "ProgrammableMD",
    org: "programmablemd",
    description:
      "Healthcare data and workflow automations from ProgrammableMD.",
    icon: icons.globe,
    repos: [
      {
        slug: "spry",
        name: "Spry",
        description: "Behavioral health tracking platform UX.",
        url: "https://github.com/programmablemd/spry",
      },
      {
        slug: "assurance-prime",
        name: "Assurance Prime",
        description: "Decision support engine for value-based care teams.",
        url: "https://github.com/programmablemd/assurance-prime",
      },
    ],
  },
};

const gitHubSubjectOrder: readonly GitHubSubjectId[] = [
  "netspective",
  "netspective-labs",
  "programmablemd",
];

const defaultGitHubSubjectId: GitHubSubjectId = "netspective";

const getGitHubSubject = (id?: string): GitHubSubject =>
  gitHubSubjects[
    (id && id in gitHubSubjects
      ? id
      : defaultGitHubSubjectId) as GitHubSubjectId
  ];

const getGitHubRepo = (
  subject: GitHubSubject,
  slug?: string,
): GitHubRepo =>
  subject.repos.find((repo) => repo.slug === slug) ?? subject.repos[0];

const githubProxyManifest: ProxyManifestRoute<State, Vars>[] = [
  {
    name: "github-root",
    mount: "/",
    upstream: "https://github.com",
    stripMount: true,
    forwardQuery: true,
    responseHeaders: {
      drop: [
        "x-frame-options",
        "content-security-policy",
        "content-security-policy-report-only",
      ],
      set: {
        "content-security-policy":
          "frame-ancestors http://127.0.0.1:7599 http://127.0.0.1:7600 http://localhost:7599 http://localhost:7600;",
      },
    },
    ...(githubProxyRequestHeaders
      ? { requestHeaders: githubProxyRequestHeaders }
      : {}),
  },
];

const buildGitHubHeadSlots = (subject: GitHubSubject) =>
  headSlots({
    title: `GitHub Explorer — ${subject.title}`,
    meta: [
      H.meta({ charset: "utf-8" }),
      H.meta({
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      }),
    ],
  });

const pageHtml = (): string => {
  const page = ds.page("NaturalDoc", {}, {
    slots: {
      contextHeader: (ctx) => buildContextHeader(ctx, "docs"),
      sidebar: (ctx) =>
        H.div(
          sidebarHeader(ctx, {
            label: "Design System",
            iconText: "DS",
            toggleIcon: icons.toggle,
          }),
          searchBar(ctx, {
            placeholder: "Search components...",
            icon: icons.searchSmall,
            shortcut: ["Cmd", "K"],
          }),
          subjectSelector(ctx, {
            name: "Subject 1",
            icon: icons.grid,
            chevron: icons.chevronsUpDown,
            triggerId: "subject-trigger",
            popupId: "subject-popup",
            options: [
              subjectOption(ctx, {
                title: "Subject 1",
                description: "Primary subject area",
                icon: icons.grid,
                checkmark: icons.check,
                value: "subject-1",
                selected: true,
              }),
              subjectOption(ctx, {
                title: "Subject 2",
                description: "Secondary subject area",
                icon: icons.navIcon,
                checkmark: icons.check,
                value: "subject-2",
              }),
              subjectOption(ctx, {
                title: "Subject 3",
                description: "Tertiary subject area",
                icon: icons.navIcon,
                checkmark: icons.check,
                value: "subject-3",
              }),
              subjectOption(ctx, {
                title: "Subject 4",
                description: "Additional subject area",
                icon: icons.navIcon,
                checkmark: icons.check,
                value: "subject-4",
              }),
            ],
          }),
          navSection(ctx, {
            children: [
              navCategory(ctx, { label: "Foundations" }),
              navLink(ctx, {
                label: "Layout Structure",
                href: "#layout",
                icon: icons.navIcon,
                active: true,
              }),
              navLink(ctx, {
                label: "Color Palette",
                href: "#colors",
                icon: icons.navIcon,
              }),
              navLink(ctx, {
                label: "Typography",
                href: "#typography",
                icon: icons.navIcon,
              }),
              navLink(ctx, {
                label: "Spacing",
                href: "#spacing",
                icon: icons.navIcon,
              }),
              navCategory(ctx, { label: "Components" }),
              navExpandable(ctx, {
                label: "Manual Setup",
                icon: icons.navIcon,
                chevron: icons.chevronDown,
                expanded: true,
                children: [
                  navChildLink(ctx, { label: "React" }),
                  navChildLink(ctx, { label: "Vue", active: true }),
                  navChildLink(ctx, { label: "Svelte" }),
                  navChildLink(ctx, { label: "Vanilla JS" }),
                ],
              }),
              navLink(ctx, { label: "Code Blocks", href: "#code-blocks" }),
              navLink(ctx, { label: "Tabs", href: "#tabs" }),
              navLink(ctx, { label: "Callouts", href: "#callouts" }),
              navLink(ctx, { label: "Feature Cards", href: "#cards" }),
              navLink(ctx, { label: "Accordion", href: "#accordion" }),
              navLink(ctx, { label: "File Tree", href: "#file-tree" }),
              navLink(ctx, { label: "Steps", href: "#steps" }),
              navLink(ctx, { label: "API Tables", href: "#tables" }),
              navLink(ctx, { label: "Badges", href: "#badges" }),
              navLink(ctx, { label: "Keyboard Shortcuts", href: "#keyboard" }),
            ],
          }),
        ),
      breadcrumbs: (ctx) =>
        combineHast(
          breadcrumbItem(ctx, {
            href: "#",
            icon: icons.home,
            home: true,
          }),
          H.span(
            { class: "breadcrumb-separator", "aria-hidden": "true" },
            icons.breadcrumbChevron,
          ),
          breadcrumbItem(ctx, { label: "Documentation", href: "#" }),
          H.span(
            { class: "breadcrumb-separator", "aria-hidden": "true" },
            icons.breadcrumbChevron,
          ),
          breadcrumbItem(ctx, {
            label: "Design System Reference",
            current: true,
          }),
        ),
      content: (ctx) =>
        H.div(
          pageHeader(ctx, {
            title: "Design System Reference",
            description:
              "A comprehensive guide to all available components, layout regions, and styling patterns in this design system. Use this page as your reference when building documentation sites.",
          }),
          H.section(
            { id: "layout" },
            sectionHeading(ctx, { title: "Layout Structure", href: "#layout" }),
            bodyText(ctx, {
              content:
                "The design system uses a three-column CSS Grid layout that provides optimal reading experience for documentation content while keeping navigation accessible.",
            }),
            callout(ctx, {
              title: "Layout Grid",
              icon: icons.info,
              variant: "info",
              content: H.div(
                H.strong("Left Sidebar:"),
                " 280px fixed width",
                H.br(),
                H.strong("Main Content:"),
                " Flexible (1fr)",
                H.br(),
                H.strong("Right TOC:"),
                " 200px fixed width",
              ),
            }),
            subsectionHeading(ctx, { title: "Left Sidebar Regions" }),
            bodyText(ctx, {
              content:
                "The left sidebar contains four distinct regions, each with specific functionality:",
            }),
            definitionList(ctx, {
              items: [
                definitionItem(ctx, {
                  term: ".sidebar-header",
                  description: H.span(
                    "Contains the logo/brand and theme toggle button. Uses flexbox with ",
                    H.codeTag("justify-content: space-between"),
                    ".",
                  ),
                }),
                definitionItem(ctx, {
                  term: ".search-bar",
                  description:
                    "Clickable search trigger with keyboard shortcut indicator. Opens a modal for full-text search.",
                }),
                definitionItem(ctx, {
                  term: ".subject-area-selector",
                  description:
                    "Dropdown for switching between major subject areas.",
                }),
                definitionItem(ctx, {
                  term: ".nav-section",
                  description: H.span(
                    "Grouped navigation with category headers (",
                    H.codeTag(".nav-category"),
                    ") and links (",
                    H.codeTag(".nav-link"),
                    "). Active link uses ",
                    H.codeTag(".nav-link.active"),
                    ".",
                  ),
                }),
              ],
            }),
          ),
          H.section(
            { id: "colors" },
            sectionHeading(ctx, { title: "Color Palette", href: "#colors" }),
            bodyText(ctx, {
              content:
                "The design system uses a carefully selected color palette with orange as the primary accent color, providing good contrast and visual hierarchy.",
            }),
            subsectionHeading(ctx, { title: "Accent Colors" }),
            colorGrid(ctx, {
              swatches: [
                colorSwatch(ctx, { name: "Accent Primary", value: "#f97316" }),
                colorSwatch(ctx, { name: "Accent Hover", value: "#ea580c" }),
                colorSwatch(ctx, { name: "Accent Light", value: "#fff7ed" }),
                colorSwatch(ctx, { name: "Accent Muted", value: "#fdba74" }),
              ],
            }),
            subsectionHeading(ctx, { title: "Semantic Colors" }),
            colorGrid(ctx, {
              swatches: [
                colorSwatch(ctx, { name: "Success", value: "#22c55e" }),
                colorSwatch(ctx, { name: "Info", value: "#3b82f6" }),
                colorSwatch(ctx, { name: "Warning", value: "#f59e0b" }),
                colorSwatch(ctx, { name: "Error", value: "#dc2626" }),
              ],
            }),
          ),
          H.section(
            { id: "typography" },
            sectionHeading(ctx, { title: "Typography", href: "#typography" }),
            bodyText(ctx, {
              content:
                "The design system uses a system font stack for optimal performance and native feel across platforms. Code uses a monospace font stack.",
            }),
            exampleWrapper(ctx, {
              label: "Type Scale",
              content: H.div(
                H.h1(
                  { class: "type-scale-title" },
                  "Page Title (32px/700)",
                ),
                H.h2(
                  { class: "type-scale-section" },
                  "Section Heading (22px/600)",
                ),
                H.h3(
                  { class: "type-scale-subsection" },
                  "Subsection (18px/600)",
                ),
                H.p(
                  { class: "type-scale-body" },
                  "Body text paragraph (15px/normal)",
                ),
                H.p(
                  { class: "type-scale-small" },
                  "Small text for captions (13px)",
                ),
              ),
            }),
            subsectionHeading(ctx, { title: "Inline Code" }),
            bodyText(ctx, {
              content: H.span(
                "Inline code uses the ",
                H.codeTag("code"),
                " element with a rose/red color for visual distinction: ",
                H.codeTag("font-family: monospace"),
                ".",
              ),
            }),
          ),
          H.section(
            { id: "spacing" },
            sectionHeading(ctx, { title: "Spacing", href: "#spacing" }),
            bodyText(ctx, {
              content:
                "The spacing system uses a 4px base unit with consistent multipliers throughout the design system.",
            }),
            apiTable(ctx, {
              head: ["Token", "Value", "Usage"],
              rows: [
                [
                  H.span({ class: "prop-name" }, "spacing-xs"),
                  H.span({ class: "prop-default" }, "4px"),
                  "Gap between keyboard keys, minimal spacing",
                ],
                [
                  H.span({ class: "prop-name" }, "spacing-sm"),
                  H.span({ class: "prop-default" }, "8px"),
                  "Icon-text gaps, tight element spacing",
                ],
                [
                  H.span({ class: "prop-name" }, "spacing-md"),
                  H.span({ class: "prop-default" }, "16px"),
                  "Default padding, sidebar gaps",
                ],
                [
                  H.span({ class: "prop-name" }, "spacing-lg"),
                  H.span({ class: "prop-default" }, "24px"),
                  "Component margins, card padding",
                ],
                [
                  H.span({ class: "prop-name" }, "spacing-xl"),
                  H.span({ class: "prop-default" }, "40px"),
                  "Page padding, section spacing",
                ],
              ],
            }),
          ),
          H.section(
            { id: "code-blocks" },
            sectionHeading(ctx, { title: "Code Blocks", href: "#code-blocks" }),
            bodyText(ctx, {
              content:
                "Code blocks come in two variants: basic blocks for simple snippets and enhanced blocks with header, filename, language badge, and copy functionality.",
            }),
            H.div(
              { id: "code-basic" },
              subsectionHeading(ctx, { title: "Basic Usage" }),
            ),
            codeBlock(ctx, {
              content: H.codeTag(
                H.span({ class: "keyword" }, "const"),
                " greeting = ",
                H.span({ class: "string" }, '"Hello, World!"'),
                ";",
              ),
            }),
            H.div(
              { id: "code-enhanced" },
              subsectionHeading(ctx, { title: "Enhanced Block" }),
            ),
            codeBlockEnhanced(ctx, {
              filename: "design-system.ts",
              language: "TypeScript",
              languageClass: "ts",
              content: H.pre(
                H.codeTag(
                  H.div(
                    { class: "code-line" },
                    H.span({ class: "line-number" }, "1"),
                    H.span(
                      { class: "line-content" },
                      H.span({ class: "keyword" }, "export interface"),
                      " Config {",
                    ),
                  ),
                  H.div(
                    { class: "code-line highlighted" },
                    H.span({ class: "line-number" }, "2"),
                    H.span(
                      { class: "line-content" },
                      "  theme: ",
                      H.span({ class: "string" }, "'light'"),
                      " | ",
                      H.span({ class: "string" }, "'dark'"),
                      ";",
                    ),
                  ),
                  H.div(
                    { class: "code-line highlighted" },
                    H.span({ class: "line-number" }, "3"),
                    H.span(
                      { class: "line-content" },
                      "  accentColor: string;",
                    ),
                  ),
                  H.div(
                    { class: "code-line" },
                    H.span({ class: "line-number" }, "4"),
                    H.span({ class: "line-content" }, "}"),
                  ),
                ),
              ),
              copyLabel: "Copy",
              copyIcon: icons.copy,
            }),
            callout(ctx, {
              title: "Line Highlighting",
              icon: icons.tip,
              variant: "tip",
              content: H.span(
                "Add the ",
                H.codeTag(".highlighted"),
                " class to ",
                H.codeTag(".code-line"),
                " elements to emphasize specific lines with an orange background.",
              ),
            }),
          ),
          H.section(
            { id: "tabs" },
            sectionHeading(ctx, { title: "Tabs", href: "#tabs" }),
            bodyText(ctx, {
              content:
                "Tabs allow users to switch between different content views without leaving the page. Common use cases include package managers, frameworks, and language variants.",
            }),
            tabs(ctx, {
              tabs: [
                {
                  label: "npm",
                  content: codeBlockEnhanced(ctx, {
                    filename: "Terminal",
                    language: "bash",
                    languageClass: "bash",
                    copyLabel: "Copy",
                    copyIcon: icons.copy,
                    content: H.pre(
                      H.codeTag("npm install package-name"),
                    ),
                  }),
                },
                {
                  label: "pnpm",
                  content: codeBlockEnhanced(ctx, {
                    filename: "Terminal",
                    language: "bash",
                    languageClass: "bash",
                    copyLabel: "Copy",
                    content: H.pre(
                      H.codeTag("pnpm add package-name"),
                    ),
                  }),
                },
                {
                  label: "yarn",
                  content: codeBlockEnhanced(ctx, {
                    filename: "Terminal",
                    language: "bash",
                    languageClass: "bash",
                    copyLabel: "Copy",
                    content: H.pre(
                      H.codeTag("yarn add package-name"),
                    ),
                  }),
                },
                {
                  label: "bun",
                  content: codeBlockEnhanced(ctx, {
                    filename: "Terminal",
                    language: "bash",
                    languageClass: "bash",
                    copyLabel: "Copy",
                    content: H.pre(
                      H.codeTag("bun add package-name"),
                    ),
                  }),
                },
              ],
            }),
          ),
          H.section(
            { id: "callouts" },
            sectionHeading(ctx, { title: "Callouts", href: "#callouts" }),
            bodyText(ctx, {
              content:
                "Callouts draw attention to important information. Use them sparingly to maintain impact. Three semantic variants are available.",
            }),
            H.div(
              { id: "callout-default" },
              subsectionHeading(ctx, { title: "Default" }),
            ),
            callout(ctx, {
              title: "Warning",
              icon: icons.warning,
              content:
                "This is a default callout for important warnings or prerequisites that users should be aware of before proceeding.",
            }),
            H.div(
              { id: "callout-info" },
              subsectionHeading(ctx, { title: "Info Variant" }),
            ),
            callout(ctx, {
              title: "Info",
              icon: icons.info,
              variant: "info",
              content:
                "Use .callout.info for additional context or explanations that help users understand concepts better.",
            }),
            H.div(
              { id: "callout-tip" },
              subsectionHeading(ctx, { title: "Tip Variant" }),
            ),
            callout(ctx, {
              title: "Tip",
              icon: icons.tip,
              variant: "tip",
              content:
                "Use .callout.tip for best practices, recommendations, and helpful suggestions that improve the user experience.",
            }),
          ),
          H.section(
            { id: "cards" },
            sectionHeading(ctx, { title: "Feature Cards", href: "#cards" }),
            bodyText(ctx, {
              content:
                "Feature cards display related items in a grid layout. Each card has an icon, title, and description with hover effects for interactivity.",
            }),
            featureGrid(ctx, {
              cards: [
                featureCard(ctx, {
                  icon: "📦",
                  title: "Modular Design",
                  description:
                    "Components are self-contained and can be used independently.",
                }),
                featureCard(ctx, {
                  icon: "🎨",
                  title: "Customizable",
                  description:
                    "Override CSS variables to match your brand colors.",
                }),
                featureCard(ctx, {
                  icon: "⚡",
                  title: "Performant",
                  description:
                    "Minimal CSS with no JavaScript dependencies for base components.",
                }),
                featureCard(ctx, {
                  icon: "📱",
                  title: "Responsive",
                  description:
                    "Adapts to any screen size with mobile-first breakpoints.",
                }),
              ],
            }),
          ),
          H.section(
            { id: "accordion" },
            sectionHeading(ctx, { title: "Accordion", href: "#accordion" }),
            bodyText(ctx, {
              content:
                "Accordions hide content until expanded, perfect for FAQs, troubleshooting guides, or advanced options that don't need to be visible initially.",
            }),
            accordion(ctx, {
              items: [
                {
                  title: "How do I customize the accent color?",
                  content: H.span(
                    "Find all instances of ",
                    H.codeTag("#f97316"),
                    " in the CSS and replace with your preferred color. Also update the hover state color ",
                    H.codeTag("#ea580c"),
                    " to a darker shade of your accent.",
                  ),
                  icon: icons.chevronDown,
                  open: true,
                },
                {
                  title: "Can I use this with React?",
                  content: H.span(
                    "Yes! The HTML structure and CSS classes can be directly used in JSX. Just convert ",
                    H.codeTag("class"),
                    " to ",
                    H.codeTag("className"),
                    " and add state management for interactive components.",
                  ),
                  icon: icons.chevronDown,
                },
                {
                  title: "Is dark mode supported?",
                  content: H.span(
                    "The theme toggle button is included in the sidebar. To implement dark mode, add a ",
                    H.codeTag(".dark"),
                    " class to ",
                    H.codeTag("<body>"),
                    " and define CSS custom properties with dark values.",
                  ),
                  icon: icons.chevronDown,
                },
              ],
            }),
          ),
          H.section(
            { id: "file-tree" },
            sectionHeading(ctx, { title: "File Tree", href: "#file-tree" }),
            bodyText(ctx, {
              content:
                "File trees display directory structures with appropriate icons for folders and different file types. Nested items are connected with dashed lines.",
            }),
            fileTree(ctx, {
              items: [
                H.div(
                  { class: "file-tree-item folder" },
                  icons.folderIcon,
                  "project-root",
                ),
                H.div(
                  { class: "file-tree-children" },
                  H.div(
                    { class: "file-tree-item folder" },
                    icons.folderIcon,
                    "src",
                  ),
                  H.div(
                    { class: "file-tree-children" },
                    H.div(
                      { class: "file-tree-item file file-ts" },
                      icons.fileIcon,
                      "index.ts",
                    ),
                    H.div(
                      { class: "file-tree-item file file-css" },
                      icons.fileIcon,
                      "styles.css",
                    ),
                  ),
                  H.div(
                    { class: "file-tree-item file file-json" },
                    icons.fileIcon,
                    "package.json",
                  ),
                  H.div(
                    { class: "file-tree-item file file-md" },
                    icons.fileIcon,
                    "README.md",
                  ),
                ),
              ],
            }),
          ),
          H.section(
            { id: "steps" },
            sectionHeading(ctx, { title: "Steps", href: "#steps" }),
            bodyText(ctx, {
              content:
                "Steps show a numbered progression through a multi-step process. Each step has an indicator, connecting line, and content area.",
            }),
            steps(ctx, {
              steps: [
                {
                  title: "Define the Structure",
                  description:
                    "Create the HTML markup using the documented class names.",
                },
                {
                  title: "Apply Styling",
                  description:
                    "Copy the relevant CSS or include the full stylesheet.",
                },
                {
                  title: "Add Interactivity",
                  description:
                    "Implement JavaScript for interactive components like tabs and accordions.",
                },
              ],
            }),
          ),
          H.section(
            { id: "tables" },
            sectionHeading(ctx, { title: "API Tables", href: "#tables" }),
            bodyText(ctx, {
              content:
                "API tables display structured data like component props, configuration options, or function parameters with consistent styling.",
            }),
            H.div(
              { id: "table-props" },
              subsectionHeading(ctx, { title: "Props Table" }),
            ),
            apiTable(ctx, {
              head: ["Property", "Type", "Default", "Description"],
              rows: [
                [
                  combineHast(
                    H.span({ class: "prop-name" }, "variant"),
                    H.span({ class: "prop-required" }, "required"),
                  ),
                  H.span({ class: "prop-type" }, '"default" | "info" | "tip"'),
                  H.span({ class: "prop-default" }, "—"),
                  "Visual style variant for the callout",
                ],
                [
                  H.span({ class: "prop-name" }, "title"),
                  H.span({ class: "prop-type" }, "string"),
                  H.span({ class: "prop-default" }, "undefined"),
                  "Header text displayed with icon",
                ],
                [
                  combineHast(
                    H.span({ class: "prop-name" }, "children"),
                    H.span({ class: "prop-required" }, "required"),
                  ),
                  H.span({ class: "prop-type" }, "ReactNode"),
                  H.span({ class: "prop-default" }, "—"),
                  "Content to display inside the callout",
                ],
              ],
            }),
            H.div(
              { id: "table-events" },
              subsectionHeading(ctx, { title: "Events Table" }),
            ),
            apiTable(ctx, {
              head: ["Event", "Type", "Description"],
              rows: [
                ["onOpen", "function", "Emitted on open"],
                ["onClose", "function", "Emitted on close"],
              ],
            }),
          ),
          H.section(
            { id: "badges" },
            sectionHeading(ctx, { title: "Badges", href: "#badges" }),
            bodyText(ctx, {
              content:
                "Badges are small labels for status indicators, versions, categories, or tags. Six semantic variants are available.",
            }),
            exampleWrapper(ctx, {
              label: "All Variants",
              content: H.div(
                { class: "badge-row" },
                badge(ctx, { label: "Default", variant: "default" }),
                badge(ctx, { label: "Primary", variant: "primary" }),
                badge(ctx, { label: "Success", variant: "success" }),
                badge(ctx, { label: "Warning", variant: "warning" }),
                badge(ctx, { label: "Error", variant: "error" }),
                badge(ctx, { label: "Info", variant: "info" }),
              ),
            }),
            bodyText(ctx, {
              content: combineHast(
                H.span(
                  "Use badges inline with text to highlight status: The API is ",
                ),
                badge(ctx, { label: "Stable", variant: "success" }),
                H.span(" and ready for production use."),
              ),
            }),
          ),
          H.section(
            { id: "keyboard" },
            sectionHeading(ctx, {
              title: "Keyboard Shortcuts",
              href: "#keyboard",
            }),
            bodyText(ctx, {
              content:
                "Display keyboard shortcuts with styled key indicators that mimic physical keys.",
            }),
            exampleWrapper(ctx, {
              label: "Examples",
              content: H.div(
                { class: "keyboard-row" },
                H.div(
                  H.span(
                    { class: "keyboard-label" },
                    "Search:",
                  ),
                  keyboardShortcut(ctx, { keys: ["Cmd", "K"] }),
                ),
                H.div(
                  H.span(
                    { class: "keyboard-label" },
                    "Save:",
                  ),
                  keyboardShortcut(ctx, { keys: ["Ctrl", "S"] }),
                ),
                H.div(
                  H.span(
                    { class: "keyboard-label" },
                    "Copy:",
                  ),
                  keyboardShortcut(ctx, { keys: ["Cmd", "C"] }),
                ),
              ),
            }),
          ),
          imageWithCaption(ctx, {
            src: "http://via.placeholder.com/960x320?text=Natural+DS",
            caption: "Reference preview image",
          }),
          footerNav(ctx, {
            previous: {
              label: "Previous",
              title: "Introduction",
              href: "#layout",
            },
            next: {
              label: "Next",
              title: "Customization",
              href: "#callouts",
            },
          }),
        ),
      toc: (ctx) =>
        tocList(ctx, {
          title: "On this page",
          items: [
            tocLink(ctx, {
              label: "Introduction",
              href: "#layout",
              active: true,
            }),
            tocLink(ctx, { label: "Color Palette", href: "#colors" }),
            tocLink(ctx, { label: "Typography", href: "#typography" }),
            tocLink(ctx, { label: "Spacing", href: "#spacing" }),
            tocLink(ctx, { label: "Code Blocks", href: "#code-blocks" }),
            tocLink(ctx, {
              label: "Basic Usage",
              href: "#code-basic",
              nested: true,
            }),
            tocLink(ctx, {
              label: "Enhanced Block",
              href: "#code-enhanced",
              nested: true,
            }),
            tocLink(ctx, { label: "Tabs", href: "#tabs" }),
            tocLink(ctx, { label: "Callouts", href: "#callouts" }),
            tocLink(ctx, {
              label: "Default",
              href: "#callout-default",
              nested: true,
            }),
            tocLink(ctx, {
              label: "Info Variant",
              href: "#callout-info",
              nested: true,
            }),
            tocLink(ctx, {
              label: "Tip Variant",
              href: "#callout-tip",
              nested: true,
            }),
            tocLink(ctx, { label: "Feature Cards", href: "#cards" }),
            tocLink(ctx, { label: "Accordion", href: "#accordion" }),
            tocLink(ctx, { label: "File Tree", href: "#file-tree" }),
            tocLink(ctx, { label: "Steps", href: "#steps" }),
            tocLink(ctx, { label: "API Tables", href: "#tables" }),
            tocLink(ctx, {
              label: "Props Table",
              href: "#table-props",
              nested: true,
            }),
            tocLink(ctx, {
              label: "Events Table",
              href: "#table-events",
              nested: true,
            }),
            tocLink(ctx, { label: "Badges", href: "#badges" }),
            tocLink(ctx, { label: "Keyboard Shortcuts", href: "#keyboard" }),
          ],
        }),
    },
    headSlots: headSlots({
      title: "Natural DS Reference",
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

const renderGitHubSidebar = (
  ctx: DsRenderCtx,
  subject: GitHubSubject,
  activeRepo: GitHubRepo,
) =>
  H.div(
    sidebarHeader(ctx, {
      label: "GitHub Explorer",
      iconText: "GH",
      toggleIcon: icons.toggle,
    }),
    subjectSelector(ctx, {
      name: subject.title,
      icon: subject.icon,
      chevron: icons.chevronsUpDown,
      triggerId: "subject-trigger",
      popupId: "subject-popup",
      options: gitHubSubjectOrder.map((subjectId) =>
        H.a(
          {
            href: `/github/${subjectId}`,
            style: "display:block;text-decoration:none;color:inherit;",
          },
          subjectOption(ctx, {
            title: gitHubSubjects[subjectId].title,
            description: gitHubSubjects[subjectId].description,
            icon: gitHubSubjects[subjectId].icon,
            checkmark: icons.check,
            value: subjectId,
            selected: subjectId === subject.id,
          }),
        )
      ),
    }),
    navSection(ctx, {
      children: [
        navCategory(ctx, { label: "Repositories" }),
        ...subject.repos.map((repo) =>
          navLink(ctx, {
            label: repo.name,
            href: `/github/${subject.id}/${repo.slug}`,
            icon: icons.navIcon,
            active: repo.slug === activeRepo.slug,
          })
        ),
      ],
    }),
  );

const renderGitHubBreadcrumbs = (
  ctx: DsRenderCtx,
  subject: GitHubSubject,
  repo: GitHubRepo,
) =>
  combineHast(
    breadcrumbItem(ctx, { href: "/", icon: icons.home, home: true }),
    renderBreadcrumbSeparator(),
    breadcrumbItem(ctx, { label: "GitHub Explorer", href: "/github" }),
    renderBreadcrumbSeparator(),
    breadcrumbItem(ctx, {
      label: subject.title,
      href: `/github/${subject.id}`,
    }),
    renderBreadcrumbSeparator(),
    breadcrumbItem(ctx, { label: repo.name, current: true }),
  );

const renderGitHubContent = (
  ctx: DsRenderCtx,
  subject: GitHubSubject,
  repo: GitHubRepo,
) => {
  const iframeSrc = `${GITHUB_PROXY_BASE_URL}${
    repo.path ?? repo.url.slice("https://github.com".length)
  }`;
  return H.div(
    pageHeader(ctx, {
      title: "GitHub Explorer",
      description:
        "Browse the latest repositories from each organization without leaving the Natural DS shell.",
    }),
    callout(ctx, {
      title: `${subject.title} • ${subject.org}`,
      icon: icons.github,
      variant: "info",
      content: H.div(
        H.p(subject.description),
        H.p(
          H.span("Viewing: "),
          H.strong(repo.name),
          " — ",
          repo.description,
        ),
        H.p(
          H.a(
            {
              href: repo.url,
              target: "_blank",
              rel: "noreferrer",
            },
            "Open on GitHub",
          ),
        ),
      ),
    }),
    bodyText(ctx, {
      content:
        "Switch subjects or repositories from the sidebar to update the embedded preview. If you see a `404` or similar error, it might be a private repo.",
    }),
    H.section(
      {
        class: "github-iframe",
        style:
          "margin-top: 24px; background:#ffffff; border-radius:12px; box-shadow:0 12px 40px rgba(15,23,42,0.15);",
      },
      H.iframe({
        src: iframeSrc,
        title: `${repo.name} repository`,
        style:
          "width: 100%; min-height: 640px; border: 1px solid #e5e5e5; border-radius: 12px;",
        loading: "lazy",
        referrerpolicy: "no-referrer",
      }),
    ),
  );
};

const gitHubPageHtml = (subject: GitHubSubject, repo: GitHubRepo): string => {
  const page = ds.page("NaturalDoc", {}, {
    slots: {
      contextHeader: (ctx) => buildContextHeader(ctx, "github"),
      sidebar: (ctx) => renderGitHubSidebar(ctx, subject, repo),
      breadcrumbs: (ctx) => renderGitHubBreadcrumbs(ctx, subject, repo),
      content: (ctx) => renderGitHubContent(ctx, subject, repo),
    },
    headSlots: buildGitHubHeadSlots(subject),
    styleAttributeEmitStrategy: "head",
  });

  return H.render(page);
};

const respondGitHubPage = (
  subjectId?: string,
  repoSlug?: string,
) => {
  const subject = getGitHubSubject(subjectId);
  const repo = getGitHubRepo(subject, repoSlug);
  return htmlResponse(gitHubPageHtml(subject, repo));
};

const githubProxyApp = Application.sharedState<State, Vars>({});

githubProxyApp.use(
  httpProxyFromManifest<State, Vars>(githubProxyManifest, {
    requireHttpsUpstream: true,
    allowedUpstreamHosts: (host) => host === "github.com",
    onProxyError: (_c, kind, info) => {
      console.error(
        `[github-proxy] ${kind} ${info.routeName ?? ""} ${
          info.upstreamUrl ?? ""
        }`,
        info.error,
      );
    },
  }),
);

githubProxyApp.serve({
  hostname: GITHUB_PROXY_HOST,
  port: GITHUB_PROXY_PORT,
  onListen: () =>
    console.log(
      `[github-proxy] serving GitHub through http://${GITHUB_PROXY_HOST}:${GITHUB_PROXY_PORT}/`,
    ),
});

app.use(async (c, next) => {
  const u = new URL(c.req.url);
  console.log("[req]", c.req.method, u.pathname);
  return await next();
});

app.get("/", () => htmlResponse(pageHtml()));

app.get("/github", () => respondGitHubPage());
app.get(
  "/github/:subject/:repo",
  (c) => respondGitHubPage(c.params.subject, c.params.repo),
);
app.get("/github/:subject", (c) => respondGitHubPage(c.params.subject));

app.serve({ port: 7599 });
