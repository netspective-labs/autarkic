/**
 * @module lib/natural-html/design-system/platform.ts
 *
 * Canonical platform regions, layouts, and slot helpers for Natural DS.
 */

/* =============================================================================
 * Typical Design System Subjects
 * ============================================================================= */

import {
  createDesignSystem,
  defineLayout,
  defineRegion,
  NamingStrategy,
  SlotBuilder,
  slots,
} from "../design-system.ts";
import * as h from "../elements.ts";

/* -----------------------------------------------------------------------------
 * Canonical Regions
 * -------------------------------------------------------------------------- */

export const headerRegion = defineRegion({
  name: "Header",
  slots: slots({
    optional: ["left", "center", "right", "row2"] as const,
  }),
  render: (ctx, s) => {
    const elementId = ctx.naming.elemIdValue("Header", "region");
    const left = s.left ? s.left(ctx) : h.comment("Header.left");
    const center = s.center ? s.center(ctx) : h.comment("Header.center");
    const right = s.right ? s.right(ctx) : h.comment("Header.right");
    const row2 = s.row2 ? s.row2(ctx) : null;

    return h.header(
      h.attrs({ role: "banner", id: elementId }, {
        class: ctx.cls("fds-header"),
      }),
      h.div(
        { class: ctx.cls("fds-header__row") },
        h.div({ class: ctx.cls("fds-header__left") }, left),
        h.div({ class: ctx.cls("fds-header__center") }, center),
        h.div({ class: ctx.cls("fds-header__right") }, right),
      ),
      row2 ? h.div({ class: ctx.cls("fds-header__row2") }, row2) : null,
    );
  },
});

export const breadcrumbsRegion = defineRegion({
  name: "Breadcrumbs",
  slots: slots({
    required: ["crumbs"] as const,
    optional: ["actions"] as const,
  }),
  render: (ctx, s) => {
    const elementId = ctx.naming.elemIdValue("Breadcrumbs", "region");
    return h.div(
      { class: ctx.cls("fds-bcbar"), id: elementId },
      h.div({ class: ctx.cls("fds-bcbar__crumbs") }, s.crumbs(ctx)),
      s.actions
        ? h.div({ class: ctx.cls("fds-bcbar__actions") }, s.actions(ctx))
        : null,
    );
  },
});

export const mainRegion = defineRegion({
  name: "Main",
  slots: slots({
    required: ["content"] as const,
    optional: ["sidebar", "rail"] as const,
  }),
  render: (ctx, s) => {
    const elementId = ctx.naming.elemIdValue("Main", "region");
    const sidebar = s.sidebar ? s.sidebar(ctx) : h.comment("Main.sidebar");
    const rail = s.rail ? s.rail(ctx) : h.comment("Main.rail");

    return h.main(
      h.attrs({ role: "main", id: elementId }, { class: ctx.cls("fds-main") }),
      h.div(
        { class: ctx.cls("fds-main__grid") },
        h.aside({ class: ctx.cls("fds-main__sidebar") }, sidebar),
        h.section({ class: ctx.cls("fds-main__content") }, s.content(ctx)),
        h.aside({ class: ctx.cls("fds-main__rail") }, rail),
      ),
    );
  },
});

export const footerRegion = defineRegion({
  name: "Footer",
  slots: slots({
    optional: ["left", "center", "right"] as const,
  }),
  render: (ctx, s) => {
    const elementId = ctx.naming.elemIdValue("Footer", "region");
    const left = s.left ? s.left(ctx) : h.comment("Footer.left");
    const center = s.center ? s.center(ctx) : h.comment("Footer.center");
    const right = s.right ? s.right(ctx) : h.comment("Footer.right");

    return h.footer(
      h.attrs({ role: "contentinfo", id: elementId }, {
        class: ctx.cls("fds-footer"),
      }),
      h.div(
        { class: ctx.cls("fds-footer__row") },
        h.div({ class: ctx.cls("fds-footer__left") }, left),
        h.div({ class: ctx.cls("fds-footer__center") }, center),
        h.div({ class: ctx.cls("fds-footer__right") }, right),
      ),
    );
  },
});

/* =============================================================================
 * Enterprise Design System Subjects
 * ============================================================================= */

/* -----------------------------------------------------------------------------
 * AppShell Layout
 * -------------------------------------------------------------------------- */

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

export const appShellLayout = defineLayout({
  name: "AppShell",
  slots: slots({
    required: ["breadcrumbs", "content"] as const,
    optional: [
      "headerLeft",
      "headerCenter",
      "headerRight",
      "headerRow2",
      "breadcrumbActions",
      "sidebar",
      "rail",
      "footerLeft",
      "footerCenter",
      "footerRight",
    ] as const,
  }),
  headSlots: slots({
    optional: ["title", "head"] as const,
  }),

  render: (ctx, api, s) => {
    const elementId = ctx.naming.elemIdValue("AppShell", "layout");
    return h.div(
      { class: ctx.cls("fds-appshell"), id: elementId },
      api.region(
        "Header",
        optionalSlots({
          left: s.headerLeft,
          center: s.headerCenter,
          right: s.headerRight,
          row2: s.headerRow2,
        }),
      ),
      api.region("Breadcrumbs", {
        crumbs: s.breadcrumbs,
        ...optionalSlots({ actions: s.breadcrumbActions }),
      }),
      api.region("Main", {
        content: s.content,
        ...optionalSlots({ sidebar: s.sidebar, rail: s.rail }),
      }),
      api.region(
        "Footer",
        optionalSlots({
          left: s.footerLeft,
          center: s.footerCenter,
          right: s.footerRight,
        }),
      ),
    );
  },
});

/* -----------------------------------------------------------------------------
 * Canonical DS factory (typed builder -> build())
 * -------------------------------------------------------------------------- */

export function canonicalDesignSystem(dsName = "canonical-ds") {
  const naming: NamingStrategy = {
    elemIdValue: (suggested) => suggested,
    elemDataAttr: (suggestedKeyName, _suggestedValue, _kind) =>
      `data-fds-${suggestedKeyName}`,
    className: (suggested) => suggested,
  };

  return createDesignSystem(dsName, naming)
    .policies({
      wrappers: {
        enabled: true,
        wrapperTag: "section",
      },
      dev: { unknownSlotMode: "throw" },
    })
    .uaDependencies(() =>
      [
        {
          mountPoint: "/canonical-ds/canonical.css",
          canonicalSource: import.meta.resolve("./canonical.css"),
          nature: "reference",
          mimeType: "text/css",
          cache: { maxAgeSeconds: 3600, immutable: true, etag: "strong" },
        },
        {
          mountPoint: "/canonical-ds/canonical.js",
          canonicalSource: import.meta.resolve("./canonical.js"),
          nature: "reference",
          mimeType: "application/javascript",
          as: "module",
          cache: { maxAgeSeconds: 3600, immutable: true, etag: "strong" },
        },
      ] as const
    )
    .region(headerRegion)
    .region(breadcrumbsRegion)
    .region(mainRegion)
    .region(footerRegion)
    .layout(appShellLayout)
    .build();
}
