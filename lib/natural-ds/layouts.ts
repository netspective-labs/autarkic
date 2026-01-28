import { defineLayout, slots } from "../natural-html/design-system.ts";
import * as h from "../natural-html/elements.ts";
import { headSlotSpec } from "../natural-html/patterns.ts";

export const naturalLayout = defineLayout({
  name: "NaturalDoc",
  slots: slots({
    required: ["content"] as const,
    optional: ["contextHeader", "breadcrumbs", "sidebar", "toc"] as const,
  }),
  headSlots: headSlotSpec,
  render: (ctx, api, s) => {
    const contextHeader = s.contextHeader;
    const sidebar = s.sidebar;
    const breadcrumbs = s.breadcrumbs;
    const toc = s.toc;
    const hasContextHeader = Boolean(contextHeader);
    const hasSidebar = Boolean(sidebar);
    const hasToc = Boolean(toc);

    return h.div(
      {
        class: "page-layout",
        style: ctx.css({
          display: "grid",
          gridTemplateColumns: `${hasSidebar ? "280px" : "0px"} 1fr ${
            hasToc ? "200px" : "0px"
          }`,
          gridTemplateRows: "auto auto 1fr",
          minHeight: "100vh",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif",
          fontSize: "14px",
          lineHeight: 1.6,
          color: "#0a0a0a",
          backgroundColor: "#fafafa",
          "--context-header-height": hasContextHeader ? "48px" : "0px",
          "--breadcrumb-row-height": "45px",
        }),
      },
      contextHeader
        ? api.region("ContextHeader", { content: contextHeader })
        : null,
      sidebar ? api.region("LeftSidebar", { content: sidebar }) : null,
      breadcrumbs ? api.region("BreadcrumbRow", { crumbs: breadcrumbs }) : null,
      api.region("MainContent", { content: s.content }),
      toc ? api.region("RightSidebar", { content: toc }) : null,
    );
  },
});

export const naturalPitchLayout = defineLayout({
  name: "NaturalPitch",
  slots: slots({
    required: [
      "heroTitle",
      "heroSubtitle",
      "heroPrimaryAction",
    ] as const,
    optional: [
      "heroSecondaryAction",
      "featureIntro",
      "featureCards",
      "docsHighlights",
      "ctaTitle",
      "ctaActions",
      "heroBadge",
      "heroVisual",
      "tryItSnippet",
      "testimonialCards",
      "footerNote",
    ] as const,
  }),
  headSlots: headSlotSpec,
  render: (ctx, _api, s) => {
    const heroBadge = s.heroBadge ? s.heroBadge(ctx) : null;
    const heroVisual = s.heroVisual ? s.heroVisual(ctx) : null;
    const tryItSnippet = s.tryItSnippet ? s.tryItSnippet(ctx) : null;
    const testimonialCards = s.testimonialCards
      ? s.testimonialCards(ctx)
      : null;
    const footerNote = s.footerNote ? s.footerNote(ctx) : null;
    const heroSecondaryAction = s.heroSecondaryAction
      ? s.heroSecondaryAction(ctx)
      : null;
    const featureIntroContent = s.featureIntro ? s.featureIntro(ctx) : null;
    const featureCards = s.featureCards ? s.featureCards(ctx) : null;
    const docsHighlights = s.docsHighlights ? s.docsHighlights(ctx) : null;
    const ctaTitle = s.ctaTitle ? s.ctaTitle(ctx) : null;
    const ctaActions = s.ctaActions ? s.ctaActions(ctx) : null;

    const heroActions = h.div(
      {
        class: "pitch-hero-actions",
        style: ctx.css({
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          marginTop: "24px",
        }),
      },
      s.heroPrimaryAction(ctx),
      heroSecondaryAction,
    );

    return h.div(
      {
        class: "natural-pitch-shell",
        style: ctx.css({
          minHeight: "100vh",
          backgroundColor: "#f6f3ed",
          color: "#1c1b1a",
          fontFamily:
            "var(--natural-font, 'Inter', 'Segoe UI', system-ui, sans-serif)",
          padding: "36px 16px 60px",
        }),
      },
      h.div(
        {
          class: "natural-pitch-body",
          style: ctx.css({
            maxWidth: "1200px",
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: "32px",
          }),
        },
        h.section(
          {
            class: "pitch-hero",
            style: ctx.css({
              borderRadius: "36px",
              padding: "40px",
              backgroundImage:
                "linear-gradient(135deg, #fef9ef 0%, #f5e7c8 45%, #f3e1ca 100%)",
              boxShadow: "0 24px 45px rgba(20, 16, 12, 0.12)",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "32px",
              alignItems: "center",
              position: "relative",
            }),
          },
          h.div(
            {
              class: "pitch-hero-copy",
              style: ctx.css({ position: "relative", zIndex: 2 }),
            },
            heroBadge
              ? h.div(
                {
                  class: "hero-badge",
                  style: ctx.css({
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "4px 12px",
                    borderRadius: "999px",
                    backgroundColor: "rgba(255,255,255,0.85)",
                    fontSize: "13px",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }),
                },
                heroBadge,
              )
              : null,
            h.h1(
              {
                class: "hero-title",
                style: ctx.css({
                  fontSize: "2.75rem",
                  lineHeight: 1.1,
                  margin: "16px 0 12px",
                }),
              },
              s.heroTitle(ctx),
            ),
            h.p(
              {
                class: "hero-subtitle",
                style: ctx.css({
                  fontSize: "1.05rem",
                  maxWidth: "560px",
                  color: "#3b362f",
                  margin: 0,
                }),
              },
              s.heroSubtitle(ctx),
            ),
            heroActions,
          ),
          heroVisual
            ? h.div(
              {
                class: "hero-visual",
                style: ctx.css({
                  borderRadius: "28px",
                  overflow: "hidden",
                  boxShadow: "0 20px 40px rgba(9, 9, 9, 0.25)",
                }),
              },
              heroVisual,
            )
            : null,
        ),
        featureIntroContent || tryItSnippet
          ? h.section(
            {
              class: "pitch-intro",
              style: ctx.css({
                borderRadius: "32px",
                padding: "36px",
                backgroundColor: "#ffffff",
                boxShadow: "0 18px 36px rgba(15, 13, 11, 0.08)",
                display: "flex",
                flexDirection: "column",
                gap: "24px",
              }),
            },
            featureIntroContent
              ? h.div(
                {
                  class: "pitch-intro-copy",
                  style: ctx.css({
                    fontSize: "1rem",
                    color: "#2a241f",
                    lineHeight: 1.7,
                  }),
                },
                featureIntroContent,
              )
              : null,
            tryItSnippet
              ? h.div(
                {
                  class: "pitch-try-it",
                  style: ctx.css({
                    borderRadius: "26px",
                    padding: "28px",
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0.9) 0%, #f0eddf 100%)",
                    border: "1px solid rgba(255, 255, 255, 0.7)",
                    boxShadow: "0 10px 30px rgba(10, 10, 10, 0.12)",
                  }),
                },
                tryItSnippet,
              )
              : null,
          )
          : null,
        (featureCards || testimonialCards)
          ? h.section(
            {
              class: "pitch-feature-grid",
              style: ctx.css({
                display: "flex",
                flexDirection: "column",
                gap: "20px",
              }),
            },
            featureCards
              ? h.div(
                {
                  class: "feature-grid-inner",
                  style: ctx.css({
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                    gap: "20px",
                  }),
                },
                featureCards,
              )
              : null,
            testimonialCards
              ? h.div(
                {
                  class: "testimonial-strip",
                  style: ctx.css({
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "18px",
                  }),
                },
                testimonialCards,
              )
              : null,
          )
          : null,
        docsHighlights
          ? h.section(
            {
              class: "docs-highlight-section",
              style: ctx.css({
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "24px",
              }),
            },
            docsHighlights,
          )
          : null,
        ctaTitle || ctaActions || footerNote
          ? h.section(
            {
              class: "pitch-cta",
              style: ctx.css({
                borderRadius: "34px",
                padding: "36px",
                backgroundColor: "#1b1a17",
                color: "#f9f6ef",
                textAlign: "center",
                boxShadow: "0 22px 45px rgba(4, 3, 2, 0.24)",
              }),
            },
            ctaTitle
              ? h.h2(
                {
                  class: "cta-title",
                  style: ctx.css({
                    fontSize: "2rem",
                    margin: "0 0 20px",
                  }),
                },
                ctaTitle,
              )
              : null,
            ctaActions
              ? h.div(
                {
                  class: "cta-actions",
                  style: ctx.css({
                    display: "flex",
                    justifyContent: "center",
                    gap: "16px",
                    flexWrap: "wrap",
                  }),
                },
                ctaActions,
              )
              : null,
            footerNote
              ? h.p(
                {
                  class: "cta-footer-note",
                  style: ctx.css({
                    margin: "26px auto 0",
                    maxWidth: "640px",
                    color: "rgba(249, 246, 239, 0.75)",
                    fontSize: "0.95rem",
                    lineHeight: 1.5,
                  }),
                },
                footerNote,
              )
              : null,
          )
          : null,
      ),
    );
  },
});
