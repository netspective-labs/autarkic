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
  type BreadcrumbSegment,
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
  NaturalBreadcrumbsBuilder,
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
import * as h from "../../../lib/natural-html/elements.ts";
import {
  combineHast,
  Content,
  headSlots,
  renderContent,
  type RenderInput,
} from "../../../lib/natural-html/patterns.ts";
import {
  pitchCtaActions,
  pitchHeroButton,
  pitchHeroVisual,
} from "../../../lib/natural-ds/component/pitch.ts";

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
  { id: "pitch", label: "Pitch", href: "/pitch", icon: icons.globe },
  { id: "discord", label: "Discord", icon: icons.chat },
];

const contextNavMap = contextNavDefinitions.reduce<
  Record<string, { readonly label: string; readonly href?: string }>
>((map, entry) => {
  map[entry.id] = { label: entry.label, href: entry.href };
  return map;
}, {} as Record<string, { readonly label: string; readonly href?: string }>);

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

const pitchFeatureCards = (ctx: DsRenderCtx) =>
  featureGrid(ctx, {
    cards: [
      featureCard(ctx, {
        icon: "🎯",
        title: "Purpose-built hero",
        description: "Highlight value props and actions above the fold.",
      }),
      featureCard(ctx, {
        icon: "💡",
        title: "Try-it snippet",
        description: "Embed a runnable callout that invites experimentation.",
      }),
      featureCard(ctx, {
        icon: "🧱",
        title: "Composable highlights",
        description:
          "Stack cards, testimonials, and docs highlights without layout plumbing.",
      }),
      featureCard(ctx, {
        icon: "⚙️",
        title: "Docs for engineers",
        description:
          "Support copy, code, and CLI hooks with consistent spacing.",
      }),
    ],
  });

const pitchDocsHighlights = (ctx: DsRenderCtx) =>
  h.div(
    {
      style: ctx.css({
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: "18px",
      }),
    },
    callout(ctx, {
      title: "Framework Agnostic",
      icon: icons.info,
      variant: "info",
      content:
        "Use NaturalPitch as a marketing shell anywhere your docs need a crossover between sales and developer onboarding.",
    }),
    callout(ctx, {
      title: "Minimal aesthetics",
      icon: icons.tip,
      variant: "tip",
      content:
        "Soft gradients, rounded cards, and consistent spacing keep the focus on your message.",
    }),
    callout(ctx, {
      title: "Search-first CTA",
      icon: icons.info,
      variant: "info",
      content:
        "Layer calls to action at the top and bottom so visitors always know how to engage.",
    }),
  );

const pitchTestimonials = (ctx: DsRenderCtx) =>
  h.div(
    {
      style: ctx.css({
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "18px",
      }),
    },
    callout(ctx, {
      title: "Anthony, DevOps",
      content:
        "“The NaturalPitch layout kept our new product launch concise without sacrificing technical depth.”",
    }),
    callout(ctx, {
      title: "Adia, Head of Docs",
      variant: "info",
      content:
        "“Soft gradients and segmented sections make it easy for stakeholders to walk through the proposal.”",
    }),
  );

const pitchTryItSnippet = (ctx: DsRenderCtx) =>
  codeBlock(ctx, {
    content: h.codeTag("npx natural docs-pitch --template fumadocs"),
  });

export type ApiPropDefinition = {
  readonly name: string;
  readonly type: string;
  readonly defaultValue?: string;
  readonly description?: Content<RenderInput, NamingStrategy>;
  readonly required?: boolean;
};

export const apiPropRow = (
  ctx: RenderCtx<RenderInput, NamingStrategy>,
  def: ApiPropDefinition,
): readonly (h.RawHtml | string)[] => [
  combineHast(
    ...[
      h.span({ class: "prop-name" }, def.name),
      ...(def.required ? [h.span({ class: "prop-required" }, "required")] : []),
    ],
  ),
  h.span({ class: "prop-type" }, def.type),
  h.span({ class: "prop-default" }, def.defaultValue ?? "—"),
  renderContent(ctx, def.description) ?? "",
];

export type BadgeVariant = {
  readonly label: string;
  readonly variant?: string;
};

export const badgeRow = (
  ctx: RenderCtx<RenderInput, NamingStrategy>,
  variants: readonly BadgeVariant[],
) =>
  h.div(
    { class: "badge-row" },
    ...variants.map((variant) =>
      badge(ctx, {
        label: variant.label,
        variant: variant.variant,
      })
    ),
  );

export type KeyboardShortcutExample = {
  readonly label: string;
  readonly keys: readonly string[];
};

export const keyboardShortcutList = (
  ctx: RenderCtx<RenderInput, NamingStrategy>,
  items: readonly KeyboardShortcutExample[],
) =>
  h.div(
    { class: "keyboard-row" },
    ...items.map((item) =>
      h.div(
        h.span({ class: "keyboard-label" }, item.label),
        keyboardShortcut(ctx, { keys: item.keys }),
      )
    ),
  );

export type GitHubRepoPreviewProps = {
  readonly icon?: Content<RenderInput, NamingStrategy>;
  readonly subjectLabel: string;
  readonly subjectOrg: string;
  readonly subjectDescription: string;
  readonly repoName: string;
  readonly repoDescription: string;
  readonly repoUrl: string;
  readonly iframeSrc: string;
  readonly helpText?: string;
};

export const githubRepoPreview = (
  ctx: RenderCtx<RenderInput, NamingStrategy>,
  props: GitHubRepoPreviewProps,
) =>
  h.div(
    callout(ctx, {
      title: `${props.subjectLabel} • ${props.subjectOrg}`,
      icon: props.icon ?? icons.github,
      variant: "info",
      content: combineHast(
        h.p(props.subjectDescription),
        h.p(
          h.span("Viewing: "),
          h.strong(props.repoName),
          " — ",
          props.repoDescription,
        ),
        h.p(
          h.a(
            {
              href: props.repoUrl,
              target: "_blank",
              rel: "noreferrer",
            },
            "Open on GitHub",
          ),
        ),
      ),
    }),
    bodyText(ctx, {
      content: props.helpText ??
        "Switch subjects or repositories from the sidebar to update the embedded preview. If you see a `404` or similar error, it might be a private repo.",
    }),
    h.section(
      {
        class: "github-iframe",
        style:
          "margin-top: 24px; background:#ffffff; border-radius:12px; box-shadow:0 12px 40px rgba(15,23,42,0.15);",
      },
      h.iframe({
        src: props.iframeSrc,
        title: `${props.repoName} repository`,
        style:
          "width: 100%; min-height: 640px; border: 1px solid #e5e5e5; border-radius: 12px;",
        loading: "lazy",
        referrerpolicy: "no-referrer",
      }),
    ),
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
      h.meta({ charset: "utf-8" }),
      h.meta({
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      }),
    ],
  });

const pageHtml = (request: Request): string => {
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
        new NaturalBreadcrumbsBuilder(ctx)
          .withHome({ label: "Home", href: "/", icon: icons.home })
          .withRequestTrail(request, {
            trail: ({ segments }) => {
              const contextId = segments[0] ?? "docs";
              const entry = contextNavMap[contextId] ?? contextNavMap.docs;
              return entry ? [{ label: entry.label, href: entry.href }] : [];
            },
          })
          .appendMany([
            { label: "Documentation", href: "#" },
            { label: "Design System Reference" },
          ])
          .build(),
      content: (ctx) =>
        h.div(
          pageHeader(ctx, {
            title: "Design System Reference",
            description:
              "A comprehensive guide to all available components, layout regions, and styling patterns in this design system. Use this page as your reference when building documentation sites.",
          }),
          h.section(
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
              content: h.div(
                h.strong("Left Sidebar:"),
                " 280px fixed width",
                h.br(),
                h.strong("Main Content:"),
                " Flexible (1fr)",
                h.br(),
                h.strong("Right TOC:"),
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
                  description: h.span(
                    "Contains the logo/brand and theme toggle button. Uses flexbox with ",
                    h.codeTag("justify-content: space-between"),
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
                  description: h.span(
                    "Grouped navigation with category headers (",
                    h.codeTag(".nav-category"),
                    ") and links (",
                    h.codeTag(".nav-link"),
                    "). Active link uses ",
                    h.codeTag(".nav-link.active"),
                    ".",
                  ),
                }),
              ],
            }),
          ),
          h.section(
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
          h.section(
            { id: "typography" },
            sectionHeading(ctx, { title: "Typography", href: "#typography" }),
            bodyText(ctx, {
              content:
                "The design system uses a system font stack for optimal performance and native feel across platforms. Code uses a monospace font stack.",
            }),
            exampleWrapper(ctx, {
              label: "Type Scale",
              content: h.div(
                h.h1(
                  { class: "type-scale-title" },
                  "Page Title (32px/700)",
                ),
                h.h2(
                  { class: "type-scale-section" },
                  "Section Heading (22px/600)",
                ),
                h.h3(
                  { class: "type-scale-subsection" },
                  "Subsection (18px/600)",
                ),
                h.p(
                  { class: "type-scale-body" },
                  "Body text paragraph (15px/normal)",
                ),
                h.p(
                  { class: "type-scale-small" },
                  "Small text for captions (13px)",
                ),
              ),
            }),
            subsectionHeading(ctx, { title: "Inline Code" }),
            bodyText(ctx, {
              content: h.span(
                "Inline code uses the ",
                h.codeTag("code"),
                " element with a rose/red color for visual distinction: ",
                h.codeTag("font-family: monospace"),
                ".",
              ),
            }),
          ),
          h.section(
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
                  h.span({ class: "prop-name" }, "spacing-xs"),
                  h.span({ class: "prop-default" }, "4px"),
                  "Gap between keyboard keys, minimal spacing",
                ],
                [
                  h.span({ class: "prop-name" }, "spacing-sm"),
                  h.span({ class: "prop-default" }, "8px"),
                  "Icon-text gaps, tight element spacing",
                ],
                [
                  h.span({ class: "prop-name" }, "spacing-md"),
                  h.span({ class: "prop-default" }, "16px"),
                  "Default padding, sidebar gaps",
                ],
                [
                  h.span({ class: "prop-name" }, "spacing-lg"),
                  h.span({ class: "prop-default" }, "24px"),
                  "Component margins, card padding",
                ],
                [
                  h.span({ class: "prop-name" }, "spacing-xl"),
                  h.span({ class: "prop-default" }, "40px"),
                  "Page padding, section spacing",
                ],
              ],
            }),
          ),
          h.section(
            { id: "code-blocks" },
            sectionHeading(ctx, { title: "Code Blocks", href: "#code-blocks" }),
            bodyText(ctx, {
              content:
                "Code blocks come in two variants: basic blocks for simple snippets and enhanced blocks with header, filename, language badge, and copy functionality.",
            }),
            h.div(
              { id: "code-basic" },
              subsectionHeading(ctx, { title: "Basic Usage" }),
            ),
            codeBlock(ctx, {
              content: h.codeTag(
                h.span({ class: "keyword" }, "const"),
                " greeting = ",
                h.span({ class: "string" }, '"Hello, World!"'),
                ";",
              ),
            }),
            h.div(
              { id: "code-enhanced" },
              subsectionHeading(ctx, { title: "Enhanced Block" }),
            ),
            codeBlockEnhanced(ctx, {
              filename: "design-system.ts",
              language: "TypeScript",
              languageClass: "ts",
              content: h.pre(
                h.codeTag(
                  h.div(
                    { class: "code-line" },
                    h.span({ class: "line-number" }, "1"),
                    h.span(
                      { class: "line-content" },
                      h.span({ class: "keyword" }, "export interface"),
                      " Config {",
                    ),
                  ),
                  h.div(
                    { class: "code-line highlighted" },
                    h.span({ class: "line-number" }, "2"),
                    h.span(
                      { class: "line-content" },
                      "  theme: ",
                      h.span({ class: "string" }, "'light'"),
                      " | ",
                      h.span({ class: "string" }, "'dark'"),
                      ";",
                    ),
                  ),
                  h.div(
                    { class: "code-line highlighted" },
                    h.span({ class: "line-number" }, "3"),
                    h.span(
                      { class: "line-content" },
                      "  accentColor: string;",
                    ),
                  ),
                  h.div(
                    { class: "code-line" },
                    h.span({ class: "line-number" }, "4"),
                    h.span({ class: "line-content" }, "}"),
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
              content: h.span(
                "Add the ",
                h.codeTag(".highlighted"),
                " class to ",
                h.codeTag(".code-line"),
                " elements to emphasize specific lines with an orange background.",
              ),
            }),
          ),
          h.section(
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
                    content: h.pre(
                      h.codeTag("npm install package-name"),
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
                    content: h.pre(
                      h.codeTag("pnpm add package-name"),
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
                    content: h.pre(
                      h.codeTag("yarn add package-name"),
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
                    content: h.pre(
                      h.codeTag("bun add package-name"),
                    ),
                  }),
                },
              ],
            }),
          ),
          h.section(
            { id: "callouts" },
            sectionHeading(ctx, { title: "Callouts", href: "#callouts" }),
            bodyText(ctx, {
              content:
                "Callouts draw attention to important information. Use them sparingly to maintain impact. Three semantic variants are available.",
            }),
            h.div(
              { id: "callout-default" },
              subsectionHeading(ctx, { title: "Default" }),
            ),
            callout(ctx, {
              title: "Warning",
              icon: icons.warning,
              content:
                "This is a default callout for important warnings or prerequisites that users should be aware of before proceeding.",
            }),
            h.div(
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
            h.div(
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
          h.section(
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
          h.section(
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
                  content: h.span(
                    "Find all instances of ",
                    h.codeTag("#f97316"),
                    " in the CSS and replace with your preferred color. Also update the hover state color ",
                    h.codeTag("#ea580c"),
                    " to a darker shade of your accent.",
                  ),
                  icon: icons.chevronDown,
                  open: true,
                },
                {
                  title: "Can I use this with React?",
                  content: h.span(
                    "Yes! The HTML structure and CSS classes can be directly used in JSX. Just convert ",
                    h.codeTag("class"),
                    " to ",
                    h.codeTag("className"),
                    " and add state management for interactive components.",
                  ),
                  icon: icons.chevronDown,
                },
                {
                  title: "Is dark mode supported?",
                  content: h.span(
                    "The theme toggle button is included in the sidebar. To implement dark mode, add a ",
                    h.codeTag(".dark"),
                    " class to ",
                    h.codeTag("<body>"),
                    " and define CSS custom properties with dark values.",
                  ),
                  icon: icons.chevronDown,
                },
              ],
            }),
          ),
          h.section(
            { id: "file-tree" },
            sectionHeading(ctx, { title: "File Tree", href: "#file-tree" }),
            bodyText(ctx, {
              content:
                "File trees display directory structures with appropriate icons for folders and different file types. Nested items are connected with dashed lines.",
            }),
            fileTree(ctx, {
              items: [
                h.div(
                  { class: "file-tree-item folder" },
                  icons.folderIcon,
                  "project-root",
                ),
                h.div(
                  { class: "file-tree-children" },
                  h.div(
                    { class: "file-tree-item folder" },
                    icons.folderIcon,
                    "src",
                  ),
                  h.div(
                    { class: "file-tree-children" },
                    h.div(
                      { class: "file-tree-item file file-ts" },
                      icons.fileIcon,
                      "index.ts",
                    ),
                    h.div(
                      { class: "file-tree-item file file-css" },
                      icons.fileIcon,
                      "styles.css",
                    ),
                  ),
                  h.div(
                    { class: "file-tree-item file file-json" },
                    icons.fileIcon,
                    "package.json",
                  ),
                  h.div(
                    { class: "file-tree-item file file-md" },
                    icons.fileIcon,
                    "README.md",
                  ),
                ),
              ],
            }),
          ),
          h.section(
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
          h.section(
            { id: "tables" },
            sectionHeading(ctx, { title: "API Tables", href: "#tables" }),
            bodyText(ctx, {
              content:
                "API tables display structured data like component props, configuration options, or function parameters with consistent styling.",
            }),
            h.div(
              { id: "table-props" },
              subsectionHeading(ctx, { title: "Props Table" }),
            ),
            apiTable(ctx, {
              head: ["Property", "Type", "Default", "Description"],
              rows: [
                apiPropRow(ctx, {
                  name: "variant",
                  type: '"default" | "info" | "tip"',
                  defaultValue: "—",
                  required: true,
                  description: "Visual style variant for the callout",
                }),
                apiPropRow(ctx, {
                  name: "title",
                  type: "string",
                  defaultValue: "undefined",
                  description: "Header text displayed with icon",
                }),
                apiPropRow(ctx, {
                  name: "children",
                  type: "ReactNode",
                  defaultValue: "—",
                  required: true,
                  description: "Content to display inside the callout",
                }),
              ],
            }),
            h.div(
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
          h.section(
            { id: "badges" },
            sectionHeading(ctx, { title: "Badges", href: "#badges" }),
            bodyText(ctx, {
              content:
                "Badges are small labels for status indicators, versions, categories, or tags. Six semantic variants are available.",
            }),
            exampleWrapper(ctx, {
              label: "All Variants",
              content: badgeRow(ctx, [
                { label: "Default", variant: "default" },
                { label: "Primary", variant: "primary" },
                { label: "Success", variant: "success" },
                { label: "Warning", variant: "warning" },
                { label: "Error", variant: "error" },
                { label: "Info", variant: "info" },
              ]),
            }),
            bodyText(ctx, {
              content: combineHast(
                h.span(
                  "Use badges inline with text to highlight status: The API is ",
                ),
                badge(ctx, { label: "Stable", variant: "success" }),
                h.span(" and ready for production use."),
              ),
            }),
          ),
          h.section(
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
              content: keyboardShortcutList(ctx, [
                { label: "Search:", keys: ["Cmd", "K"] },
                { label: "Save:", keys: ["Ctrl", "S"] },
                { label: "Copy:", keys: ["Cmd", "C"] },
              ]),
            }),
          ),
          imageWithCaption(ctx, {
            src: "http://via.placeholder.com/960x320?text=Natural+DS",
            caption: "Reference preview image",
          }),
          callout(ctx, {
            title: "See the NaturalPitch layout",
            icon: icons.info,
            variant: "info",
            content: h.span(
              "Launch the ",
              h.a({
                href: "/pitch",
                style: "color:#f97316; text-decoration:underline;",
              }, "/pitch"),
              " sales layout demo to see this concept in action.",
            ),
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
        h.meta({ charset: "utf-8" }),
        h.meta({
          name: "viewport",
          content: "width=device-width, initial-scale=1",
        }),
      ],
    }),
    styleAttributeEmitStrategy: "head",
  });

  return h.render(page);
};

const pitchPageHtml = (_request: Request): string => {
  const page = ds.page("NaturalPitch", {}, {
    slots: {
      heroBadge: () => h.span("Sales pitch"),
      heroTitle: () => h.text("Build excellent documentation, your style."),
      heroSubtitle: () =>
        h.text(
          "NaturalPitch combines marketing flair with developer-friendly structure so your docs look intentional from the first glance.",
        ),
      heroPrimaryAction: (ctx) =>
        pitchHeroButton(ctx, {
          label: "Get Started",
          href: "/#layout",
          primary: true,
        }),
      heroSecondaryAction: (ctx) =>
        pitchHeroButton(
          ctx,
          {
            label: "Open CodeSandbox",
            href: "https://codesandbox.io",
            primary: false,
            target: "_blank",
            rel: "noreferrer",
          },
        ),
      heroVisual: (ctx) =>
        pitchHeroVisual(ctx, {
          badge: "Try it out",
          title: "docs + pitch",
          command: "npx natural launch demo",
          footerLeft: "Hero preview",
          footerRight: "Live ✓",
        }),
      featureIntro: (ctx) =>
        bodyText(ctx, {
          content:
            "Nest this layout when you need a hero that sells, cards that explain value, and CTA bars that convert.",
        }),
      tryItSnippet: pitchTryItSnippet,
      featureCards: pitchFeatureCards,
      testimonialCards: pitchTestimonials,
      docsHighlights: pitchDocsHighlights,
      ctaTitle: () => h.text("Start building docs people actually read."),
      ctaActions: (ctx) =>
        pitchCtaActions(ctx, [
          { label: "Book a demo", href: "#pitch-demo", primary: false },
          { label: "View the docs", href: "/#layout", primary: true },
        ]),
      footerNote: () =>
        h.text(
          "Trusted by documentation teams, design systems squads, and open source communities worldwide.",
        ),
    },
    headSlots: headSlots({
      title: "NaturalPitch Layout Sample",
      meta: [
        h.meta({ charset: "utf-8" }),
        h.meta({
          name: "viewport",
          content: "width=device-width, initial-scale=1",
        }),
      ],
    }),
    styleAttributeEmitStrategy: "head",
  });

  return h.render(page);
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
  request: Request,
) =>
  new NaturalBreadcrumbsBuilder(ctx)
    .withHome({ label: "Home", href: "/", icon: icons.home })
    .withRequestTrail(
      request,
      {
        metadata: { subject, repo },
        trail: ({ segments, subject: metaSubject, repo: metaRepo }) => {
          const contextId = segments[0] ?? "github";
          const contextEntry = contextNavMap[contextId] ?? contextNavMap.github;
          const crumbs: BreadcrumbSegment[] = [];
          if (contextEntry) {
            crumbs.push({
              label: contextEntry.label,
              href: contextEntry.href,
            });
          }
          const subjectId = segments[1] as GitHubSubjectId | undefined;
          const resolvedSubject = metaSubject ??
            (subjectId ? gitHubSubjects[subjectId] : undefined);
          if (resolvedSubject) {
            crumbs.push({
              label: resolvedSubject.title ?? resolvedSubject.id,
              href: `/github/${resolvedSubject.id}`,
            });
            const targetRepoSlug = segments[2] ?? metaRepo?.slug;
            const matchedRepo = resolvedSubject.repos.find((item) =>
              item.slug === targetRepoSlug
            );
            if (matchedRepo) {
              crumbs.push({
                label: matchedRepo.name,
                href: `/github/${resolvedSubject.id}/${matchedRepo.slug}`,
              });
            }
          }
          return crumbs;
        },
      },
    )
    .build();

const renderGitHubContent = (
  ctx: DsRenderCtx,
  subject: GitHubSubject,
  repo: GitHubRepo,
) => {
  const iframeSrc = `${GITHUB_PROXY_BASE_URL}${
    repo.path ?? repo.url.slice("https://github.com".length)
  }`;
  return h.div(
    pageHeader(ctx, {
      title: "GitHub Explorer",
      description:
        "Browse the latest repositories from each organization without leaving the Natural DS shell.",
    }),
    githubRepoPreview(ctx, {
      subjectLabel: subject.title,
      subjectOrg: subject.org,
      subjectDescription: subject.description,
      repoName: repo.name,
      repoDescription: repo.description,
      repoUrl: repo.url,
      iframeSrc,
    }),
  );
};

const gitHubPageHtml = (
  subject: GitHubSubject,
  repo: GitHubRepo,
  request: Request,
): string => {
  const page = ds.page("NaturalDoc", {}, {
    slots: {
      contextHeader: (ctx) => buildContextHeader(ctx, "github"),
      sidebar: (ctx) => renderGitHubSidebar(ctx, subject, repo),
      breadcrumbs: (ctx) =>
        renderGitHubBreadcrumbs(ctx, subject, repo, request),
      content: (ctx) => renderGitHubContent(ctx, subject, repo),
    },
    headSlots: buildGitHubHeadSlots(subject),
    styleAttributeEmitStrategy: "head",
  });

  return h.render(page);
};

const respondGitHubPage = (
  request: Request,
  subjectId?: string,
  repoSlug?: string,
) => {
  const subject = getGitHubSubject(subjectId);
  const repo = getGitHubRepo(subject, repoSlug);
  return htmlResponse(gitHubPageHtml(subject, repo, request));
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

app.get("/", (c) => htmlResponse(pageHtml(c.req)));
app.get("/pitch", (c) => htmlResponse(pitchPageHtml(c.req)));

app.get("/github", (c) => respondGitHubPage(c.req));
app.get(
  "/github/:subject/:repo",
  (c) => respondGitHubPage(c.req, c.params.subject, c.params.repo),
);
app.get("/github/:subject", (c) => respondGitHubPage(c.req, c.params.subject));

app.serve({ port: 7599 });
