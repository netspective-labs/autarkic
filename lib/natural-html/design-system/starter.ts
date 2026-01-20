/**
 * @module lib/natural-html/design-system/starter.ts
 *
 * Minimal starter design system using PicoCSS via CDN.
 */
import {
  createDesignSystem,
  defineLayout,
  defineRegion,
  NamingStrategy,
  RenderCtx,
  slots,
} from "../design-system.ts";
import * as h from "../elements.ts";
import { HeadSlotInput, headSlots, headSlotSpec } from "../patterns.ts";

type RenderInput = Record<PropertyKey, never>;

const picoCssUrl =
  "https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css";

const naming: NamingStrategy = {
  elemIdValue: (suggested, kind) => `${kind}-${suggested}`,
  elemDataAttr: (suggestedKeyName, _suggestedValue, _kind) =>
    `data-${suggestedKeyName}`,
  className: (suggested, kind) => `${kind}-${suggested}`,
};

export const starterMainRegion = defineRegion({
  name: "Main",
  slots: slots({
    required: ["title", "content"] as const,
    optional: ["lead"] as const,
  }),
  render: (ctx: RenderCtx<RenderInput, NamingStrategy>, s) =>
    h.main(
      { class: "container" },
      h.header(
        h.hgroup(
          h.h1(s.title(ctx)),
          s.lead ? s.lead(ctx) : null,
        ),
      ),
      h.section(s.content(ctx)),
    ),
});

export const starterLayout = defineLayout({
  name: "Starter",
  slots: slots({
    required: ["title", "content"] as const,
    optional: ["lead"] as const,
  }),
  headSlots: headSlotSpec,
  render: (_ctx, api, s) =>
    api.region("Main", {
      title: s.title,
      content: s.content,
      ...(s.lead ? { lead: s.lead } : {}),
    }),
});

export function starterDesignSystem(dsName = "starter-ds") {
  const ds = createDesignSystem<RenderInput>(dsName, naming)
    .policies({ wrappers: { enabled: false } })
    .uaDependencies([
      {
        mountPoint: picoCssUrl,
        canonicalSource: picoCssUrl,
        nature: "reference",
        mimeType: "text/css",
      },
    ])
    .region(starterMainRegion)
    .layout(starterLayout)
    .build();

  const defaultHead = headSlots({
    styles: [
      h.style(`
        :root {
          font-size: 85%;
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
