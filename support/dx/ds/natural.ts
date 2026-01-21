#!/usr/bin/env -S deno run -A --watch --unstable-bundle --node-modules-dir=auto
// support/dx/ds/natural.ts
/**
 * Natural DS reference app (mirrors platformds/public/natural-ds.html).
 *
 * Run:
 *   deno run -A --unstable-bundle support/dx/ds/natural.ts
 *
 * Then open:
 *   http://127.0.0.1:8000
 */
import { Application } from "../../../lib/continuux/http.ts";
import * as H from "../../../lib/natural-html/elements.ts";
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
} from "../../../lib/natural-html/design-system/natural.ts";
import { headSlots } from "../../../lib/natural-html/patterns.ts";

type State = Record<string, never>;
type Vars = Record<string, never>;

const app = Application.sharedState<State, Vars>({});
const ds = naturalDesignSystem();

const svg = (markup: string) => H.trustedRaw(markup);

const combineHast = (...parts: H.RawHtml[]): H.RawHtml => {
  const nodes = parts.flatMap((p) => p.__nodes ?? []);
  const raw = parts.map((p) => p.__rawHtml).join("");
  return { __rawHtml: raw, __nodes: nodes };
};

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
  check: svg(
    '<svg class="option-checkmark" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>',
  ),
  copy: svg(
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
  ),
};

const pageHtml = (): string => {
  const page = ds.page("NaturalDoc", {}, {
    slots: {
      contextHeader: (ctx) =>
        contextHeaderContent(ctx, {
          brand: contextBrand(ctx, {
            label: "Acme Inc",
            iconText: "DS",
          }),
          nav: [
            contextNavLink(ctx, {
              label: "Docs",
              icon: icons.docs,
              active: true,
            }),
            contextNavLink(ctx, { label: "GitHub", icon: icons.github }),
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
        }),
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
              "A comprehensive guide to all available components, layout regions, and styling patterns in this design system.",
          }),
          H.section(
            { id: "layout" },
            sectionHeading(ctx, { title: "Layout Structure", href: "#layout" }),
            bodyText(ctx, {
              content:
                "The layout uses a three-column grid that keeps navigation visible while preserving readable content width.",
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
            definitionList(ctx, {
              items: [
                definitionItem(ctx, {
                  term: ".sidebar-header",
                  description:
                    "Contains the logo/brand and theme toggle button. Uses flexbox with justify-content: space-between.",
                }),
                definitionItem(ctx, {
                  term: ".search-bar",
                  description:
                    "Clickable search trigger with keyboard shortcut indicator.",
                }),
                definitionItem(ctx, {
                  term: ".subject-area-selector",
                  description:
                    "Dropdown for switching between major subject areas.",
                }),
                definitionItem(ctx, {
                  term: ".nav-section",
                  description:
                    "Grouped navigation with category headers and active link styling.",
                }),
              ],
            }),
          ),
          H.section(
            { id: "colors" },
            sectionHeading(ctx, { title: "Color Palette", href: "#colors" }),
            bodyText(ctx, {
              content:
                "Accent orange drives attention while neutrals provide a clean reading surface.",
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
                "System fonts provide a native feel; code uses a monospace stack for clarity.",
            }),
            exampleWrapper(ctx, {
              label: "Type Scale",
              content: H.div(
                H.h1({
                  style: "font-size:32px; font-weight:700; margin-bottom:8px;",
                }, "Page Title (32px/700)"),
                H.h2({
                  style: "font-size:22px; font-weight:600; margin-bottom:8px;",
                }, "Section Heading (22px/600)"),
                H.h3({
                  style: "font-size:18px; font-weight:600; margin-bottom:8px;",
                }, "Subsection (18px/600)"),
                H.p(
                  { style: "font-size:15px; margin-bottom:8px;" },
                  "Body text paragraph (15px)",
                ),
                H.p(
                  { style: "font-size:13px; color:#737373;" },
                  "Small text for captions (13px)",
                ),
              ),
            }),
          ),
          H.section(
            { id: "spacing" },
            sectionHeading(ctx, { title: "Spacing", href: "#spacing" }),
            bodyText(ctx, {
              content:
                "Spacing uses a 4px base scale, aligned to predictable increments.",
            }),
            apiTable(ctx, {
              head: ["Token", "Value", "Usage"],
              rows: [
                ["spacing-xs", "4px", "Keyboard key gaps"],
                ["spacing-sm", "8px", "Icon-text gaps"],
                ["spacing-md", "16px", "Default padding"],
                ["spacing-lg", "24px", "Card padding"],
                ["spacing-xl", "40px", "Section spacing"],
              ],
            }),
          ),
          H.section(
            { id: "code-blocks" },
            sectionHeading(ctx, { title: "Code Blocks", href: "#code-blocks" }),
            bodyText(ctx, {
              content:
                "Use basic blocks for short snippets and enhanced blocks for full examples.",
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
              filename: "natural.ts",
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
          ),
          H.section(
            { id: "tabs" },
            sectionHeading(ctx, { title: "Tabs", href: "#tabs" }),
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
            H.div(
              { id: "callout-default" },
              subsectionHeading(ctx, { title: "Default" }),
            ),
            callout(ctx, {
              title: "Warning",
              icon: icons.info,
              content:
                "Use callouts sparingly to highlight important information.",
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
                "Use .callout.info for additional context or explanations.",
            }),
            H.div(
              { id: "callout-tip" },
              subsectionHeading(ctx, { title: "Tip Variant" }),
            ),
            callout(ctx, {
              title: "Tip",
              icon: icons.info,
              variant: "tip",
              content:
                "Use .callout.tip for best practices and recommendations.",
            }),
          ),
          H.section(
            { id: "cards" },
            sectionHeading(ctx, { title: "Feature Cards", href: "#cards" }),
            featureGrid(ctx, {
              cards: [
                featureCard(ctx, {
                  icon: "A",
                  title: "Composable",
                  description: "Components share structure and tokens.",
                }),
                featureCard(ctx, {
                  icon: "B",
                  title: "Predictable",
                  description: "Explicit layouts keep markup consistent.",
                }),
                featureCard(ctx, {
                  icon: "C",
                  title: "Accessible",
                  description: "ARIA-friendly patterns by default.",
                }),
                featureCard(ctx, {
                  icon: "D",
                  title: "Fast",
                  description: "Minimal DOM and optimized styles.",
                }),
              ],
            }),
          ),
          H.section(
            { id: "accordion" },
            sectionHeading(ctx, { title: "Accordion", href: "#accordion" }),
            accordion(ctx, {
              items: [
                {
                  title: "What is Natural DS?",
                  content: "A structured DS for docs.",
                  icon: icons.chevronDown,
                  open: true,
                },
                {
                  title: "How is CSS handled?",
                  content: "Styles are component-scoped.",
                  icon: icons.chevronDown,
                },
              ],
            }),
          ),
          H.section(
            { id: "file-tree" },
            sectionHeading(ctx, { title: "File Tree", href: "#file-tree" }),
            fileTree(ctx, {
              items: [
                H.div({ class: "file-tree-item folder" }, "design-system"),
                H.div(
                  { class: "file-tree-children" },
                  H.div({ class: "file-tree-item file file-ts" }, "natural.ts"),
                  H.div(
                    { class: "file-tree-item file file-css" },
                    "natural.css",
                  ),
                ),
              ],
            }),
          ),
          H.section(
            { id: "steps" },
            sectionHeading(ctx, { title: "Steps", href: "#steps" }),
            steps(ctx, {
              steps: [
                {
                  title: "Install",
                  description: "Add Natural DS dependencies.",
                },
                {
                  title: "Compose",
                  description: "Create layouts and regions.",
                },
                { title: "Render", description: "Serve the HTML output." },
              ],
            }),
          ),
          H.section(
            { id: "tables" },
            sectionHeading(ctx, { title: "API Tables", href: "#tables" }),
            H.div(
              { id: "table-props" },
              subsectionHeading(ctx, { title: "Props Table" }),
            ),
            apiTable(ctx, {
              head: ["Prop", "Type", "Default"],
              rows: [
                ["title", "string", "n/a"],
                ["description", "string", "n/a"],
                ["actions", "Content[]", "[]"],
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
            H.div(
              badge(ctx, { label: "Default", variant: "default" }),
              " ",
              badge(ctx, { label: "Primary", variant: "primary" }),
              " ",
              badge(ctx, { label: "Success", variant: "success" }),
              " ",
              badge(ctx, { label: "Warning", variant: "warning" }),
              " ",
              badge(ctx, { label: "Error", variant: "error" }),
              " ",
              badge(ctx, { label: "Info", variant: "info" }),
            ),
          ),
          H.section(
            { id: "keyboard" },
            sectionHeading(ctx, {
              title: "Keyboard Shortcuts",
              href: "#keyboard",
            }),
            keyboardShortcut(ctx, { keys: ["Cmd", "K"] }),
          ),
          imageWithCaption(ctx, {
            src: "http://via.placeholder.com/960x320?text=Natural+DS",
            caption: "Reference preview image",
          }),
          footerNav(ctx, {
            previous: { label: "Previous", title: "Spacing", href: "#spacing" },
            next: { label: "Next", title: "Callouts", href: "#callouts" },
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
            tocLink(ctx, { label: "Default", href: "#callout-default", nested: true }),
            tocLink(ctx, { label: "Info Variant", href: "#callout-info", nested: true }),
            tocLink(ctx, { label: "Tip Variant", href: "#callout-tip", nested: true }),
            tocLink(ctx, { label: "Feature Cards", href: "#cards" }),
            tocLink(ctx, { label: "Accordion", href: "#accordion" }),
            tocLink(ctx, { label: "File Tree", href: "#file-tree" }),
            tocLink(ctx, { label: "Steps", href: "#steps" }),
            tocLink(ctx, { label: "API Tables", href: "#tables" }),
            tocLink(ctx, { label: "Props Table", href: "#table-props", nested: true }),
            tocLink(ctx, { label: "Events Table", href: "#table-events", nested: true }),
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
    cssStyleEmitStrategy: "class-style-head",
  });

  return H.render(page);
};

app.use(async (c, next) => {
  const u = new URL(c.req.url);
  console.log("[req]", c.req.method, u.pathname);
  return await next();
});

app.get("/", () =>
  new Response(pageHtml(), {
    headers: { "content-type": "text/html; charset=utf-8" },
  }));

app.serve();
