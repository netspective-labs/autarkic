#!/usr/bin/env -S deno run -A --watch --unstable-bundle --node-modules-dir=auto
/**
 * ContinuUX "Hello World" (Natural DS) app.
 *
 * What this demonstrates end-to-end:
 * - Natural DS layout on the server (no templating engine).
 * - Fully type-safe HTTP routing (Application).
 * - A minimal page without context header or toc slots.
 *
 * Run:
 *   deno run -A --unstable-bundle support/learn/03-natural-ds/hello.ts
 *
 * Then open:
 *   http://127.0.0.1:7331
 */

import { Application } from "../../../lib/continuux/http.ts";
import {
  bodyText,
  breadcrumbItem,
  naturalDesignSystem,
  navLink,
  navSection,
  pageHeader,
  sidebarHeader,
} from "../../../lib/natural-ds/mod.ts";
import { devExperienceAide } from "../../../lib/natural-dx/aide.ts";
import { icons } from "../../../lib/natural-html/assets.ts";
import * as H from "../../../lib/natural-html/elements.ts";
import { combineHast, headSlots } from "../../../lib/natural-html/patterns.ts";

type State = Record<string, never>;
type Vars = Record<string, never>;

const devHub = devExperienceAide<State, Vars>();

const app = Application.sharedState<State, Vars>({});
const ds = naturalDesignSystem();

const pageHtml = (): string => {
  const page = ds.page("NaturalDoc", {}, {
    slots: {
      sidebar: (ctx) =>
        H.div(
          sidebarHeader(ctx, {
            label: "Natural DS",
            iconText: "ND",
            toggleIcon: icons.toggle,
          }),
          navSection(ctx, {
            children: [
              navLink(ctx, {
                label: "Hello",
                href: "#hello",
                active: true,
              }),
              navLink(ctx, { label: "About", href: "#about" }),
            ],
          }),
        ),
      breadcrumbs: (ctx) =>
        combineHast(
          breadcrumbItem(ctx, { label: "Home", href: "#", home: true }),
          H.span(
            { class: "breadcrumb-separator", "aria-hidden": "true" },
            ">",
          ),
          breadcrumbItem(ctx, { label: "Hello DS", current: true }),
        ),
      content: (ctx) =>
        H.div(
          pageHeader(ctx, {
            title: "Hello Natural DS",
            description: "A minimal Natural DS layout without extra chrome.",
          }),
          H.section(
            { id: "hello" },
            bodyText(ctx, {
              content:
                "This page keeps the layout lightweight by omitting the context header and table of contents.",
            }),
          ),
          H.section(
            { id: "about", style: "margin-top: 24px;" },
            bodyText(ctx, {
              content:
                "Use this as a starting point for simple documentation pages that still leverage Natural DS components.",
            }),
          ),
        ),
    },
    headSlots: headSlots({
      title: "ContinuUX Hello using Natural Design System",
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

// Put middleware BEFORE routes.
// 1) Add a top-level request logger middleware FIRST.
app.use(async (c, next) => {
  const u = new URL(c.req.url);
  console.log("[req]", c.req.method, u.pathname);
  return await next();
});
app.use(devHub.middleware);

app.get("/", () =>
  new Response(pageHtml(), {
    headers: { "content-type": "text/html; charset=utf-8" },
  }));

app.serve({ port: 7331 });
