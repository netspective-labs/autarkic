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
  definitionItem,
  definitionList,
  exampleWrapper,
  featureCard,
  featureGrid,
  fileTree,
  footerNav,
  imageWithCaption,
  keyboardShortcut,
  NaturalContextBarBuilder,
  naturalDesignSystem,
  NaturalSidebarBuilder,
  pageHeader,
  sectionHeading,
  type SidebarNavEntry,
  type SidebarSubject,
  steps,
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
import { icons } from "../../../lib/natural-html/assets.ts";

type State = Record<string, never>;
type Vars = Record<string, never>;

const app = Application.sharedState<State, Vars>({});
const ds = naturalDesignSystem();

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

const docsNavEntries: SidebarNavEntry[] = [
  { kind: "category", label: "Foundations" },
  {
    kind: "link",
    label: "Layout Structure",
    href: "#layout",
    icon: icons.navIcon,
    active: true,
  },
  {
    kind: "link",
    label: "Color Palette",
    href: "#colors",
    icon: icons.navIcon,
  },
  {
    kind: "link",
    label: "Typography",
    href: "#typography",
    icon: icons.navIcon,
  },
  { kind: "link", label: "Spacing", href: "#spacing", icon: icons.navIcon },
  { kind: "category", label: "Components" },
  {
    kind: "expandable",
    label: "Manual Setup",
    icon: icons.navIcon,
    chevron: icons.chevronDown,
    expanded: true,
    children: [
      { label: "React" },
      { label: "Vue", active: true },
      { label: "Svelte" },
      { label: "Vanilla JS" },
    ],
  },
  {
    kind: "link",
    label: "Code Blocks",
    href: "#code-blocks",
    icon: icons.navIcon,
  },
  { kind: "link", label: "Tabs", href: "#tabs", icon: icons.navIcon },
  { kind: "link", label: "Callouts", href: "#callouts", icon: icons.navIcon },
  { kind: "link", label: "Feature Cards", href: "#cards", icon: icons.navIcon },
  { kind: "link", label: "Accordion", href: "#accordion", icon: icons.navIcon },
  { kind: "link", label: "File Tree", href: "#file-tree", icon: icons.navIcon },
  { kind: "link", label: "Steps", href: "#steps", icon: icons.navIcon },
  { kind: "link", label: "API Tables", href: "#tables", icon: icons.navIcon },
  { kind: "link", label: "Badges", href: "#badges", icon: icons.navIcon },
  {
    kind: "link",
    label: "Keyboard Shortcuts",
    href: "#keyboard",
    icon: icons.navIcon,
  },
];

const contextNavDefinitions = [
  { id: "docs", label: "Docs", href: "/", icon: icons.docs },
  { id: "github", label: "GitHub", href: "/github", icon: icons.github },
  { id: "blog", label: "Blog", icon: icons.globe },
  { id: "discord", label: "Discord", icon: icons.chat },
];

const buildContextHeader = (ctx: DsRenderCtx, active: ContextNavTarget) =>
  new NaturalContextBarBuilder(ctx)
    .withBrand({ label: "Acme Inc", iconText: "DS" })
    .withNavEntries(
      contextNavDefinitions.map((entry) => ({
        kind: "link" as const,
        label: entry.label,
        href: entry.href,
        icon: entry.icon,
        active: entry.id === active,
      })),
    )
    .withActions([
      { label: "Search", icon: icons.search },
      { label: "Notifications", icon: icons.bell, badge: true },
      { label: "Settings", icon: icons.settings },
    ])
    .withUser({
      initials: "JD",
      name: "John Doe",
      chevron: icons.chevronDown,
    })
    .build();

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

type GitHubSubject = SidebarSubject & {
  readonly org: string;
  readonly repos: readonly GitHubRepo[];
};

const gitHubSubjects: Record<GitHubSubjectId, GitHubSubject> = {
  netspective: {
    id: "netspective",
    title: "Netspective",
    href: "/github/netspective",
    description: "Core ContinuUX tooling and docs living under Netspective.",
    icon: icons.docs,
    org: "netspective",
    repos: [
      {
        slug: "graphql-codegen-csharp",
        name: "GraphQL Code Generator",
        description:
          "Experimental GraphQL code generator template for C# projects",
        url: "https://github.com/netspective/graphql-codegen-csharp",
      },
      {
        slug: "continuux",
        name: "ContinuUX",
        description: "Typed UI primitives and runtime for guided interfaces.",
        url: "https://github.com/netspective/continuux",
      },
      {
        slug: "natural-ds",
        name: "Natural DS",
        description: "The shared design system used throughout these docs.",
        url: "https://github.com/netspective/natural-ds",
      },
    ],
  },
  "netspective-labs": {
    id: "netspective-labs",
    title: "Netspective Labs",
    href: "/github/netspective-labs",
    description:
      "Experimental labs and prototypes that push CI/CD and runtime tooling.",
    icon: icons.grid,
    org: "netspective-labs",
    repos: [
      {
        slug: "autarkic",
        name: "Autarkic",
        description:
          "Deno UI shell combining Natural DS with ContinuUX patterns.",
        url: "https://github.com/netspective-labs/autarkic",
      },
      {
        slug: "home-polyglot",
        name: "Home Polyglot",
        description: "Prototype data portal for multilingual smart homes.",
        url: "https://github.com/netspective-labs/home-polyglot",
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
    href: "/github/programmablemd",
    description:
      "Healthcare data and workflow automations from ProgrammableMD.",
    icon: icons.globe,
    org: "programmablemd",
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
      {
        slug: "sprybi",
        name: "SpryBI",
        description: "BI dashboards for ProgrammableMD care networks.",
        url: "https://github.com/programmablemd/sprybi",
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
        new NaturalSidebarBuilder(ctx)
          .withHeader({
            label: "Design System",
            iconText: "DS",
            toggleIcon: icons.toggle,
          })
          .withSearchBar({
            placeholder: "Search components...",
            icon: icons.searchSmall,
            shortcut: ["Cmd", "K"],
          })
          .withNavEntries(docsNavEntries)
          .build(),
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
) => {
  const subjects = gitHubSubjectOrder.map((subjectId) =>
    gitHubSubjects[subjectId]
  );
  const navEntries: SidebarNavEntry[] = [
    { kind: "category" as const, label: "Repositories" },
    ...subject.repos.map((repo) => ({
      kind: "link" as const,
      label: repo.name,
      href: `/github/${subject.id}/${repo.slug}`,
      icon: icons.navIcon,
      active: repo.slug === activeRepo.slug,
    })),
  ];

  return new NaturalSidebarBuilder(ctx)
    .withHeader({
      label: "GitHub Explorer",
      iconText: "GH",
      toggleIcon: icons.toggle,
    })
    .withSearchBar({
      placeholder: "Filter repos or subjects...",
      icon: icons.searchSmall,
      shortcut: ["Cmd", "K"],
    })
    .withSubjectSelector({
      subjects,
      activeId: subject.id,
      icon: icons.grid,
      chevron: icons.chevronsUpDown,
      triggerId: "subject-trigger",
      popupId: "subject-popup",
      checkmark: icons.check,
      onSelect: (sub) => `/github/${sub.id}`,
    })
    .withNavEntries(navEntries)
    .build();
};

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
