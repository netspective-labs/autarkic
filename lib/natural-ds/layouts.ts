import { defineLayout, slots } from "../natural-html/design-system.ts";
import * as h from "../natural-html/elements.ts";
import { headSlotSpec } from "../natural-html/patterns.ts";

export const naturalLayout = defineLayout({
  name: "NaturalDoc",
  slots: slots({
    required: ["breadcrumbs", "content"] as const,
    optional: ["contextHeader", "sidebar", "toc"] as const,
  }),
  headSlots: headSlotSpec,
  render: (ctx, api, s) => {
    const contextHeader = s.contextHeader;
    const sidebar = s.sidebar;
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
      api.region("BreadcrumbRow", { crumbs: s.breadcrumbs }),
      api.region("MainContent", { content: s.content }),
      toc ? api.region("RightSidebar", { content: toc }) : null,
    );
  },
});
