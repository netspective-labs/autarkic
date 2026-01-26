/**
 * @module lib/natural-html/design-system.ts
 *
 * Natural DS derived from natural-ds.html reference.
 */
import {
  createDesignSystem,
  NamingStrategy,
} from "../natural-html/design-system.ts";
import * as h from "../natural-html/elements.ts";
import {
  HeadSlotInput,
  headSlots,
  RenderInput,
} from "../natural-html/patterns.ts";
import { naturalLayout } from "./layouts.ts";
import {
  breadcrumbRowRegion,
  contextHeaderRegion,
  leftSidebarRegion,
  mainContentRegion,
  rightSidebarRegion,
} from "./region/mod.ts";

export const naturalNaming: NamingStrategy = {
  elemIdValue: (suggested) => suggested,
  elemDataAttr: (suggestedKeyName) => `data-${suggestedKeyName}`,
  className: (suggested) => suggested,
};

/* -----------------------------------------------------------------------------
 * Design System Factory
 * -------------------------------------------------------------------------- */

export function naturalDesignSystem(dsName = "natural-ds") {
  const ds = createDesignSystem<RenderInput>(dsName, naturalNaming)
    .policies({ wrappers: { enabled: false } })
    .region(contextHeaderRegion)
    .region(leftSidebarRegion)
    .region(breadcrumbRowRegion)
    .region(mainContentRegion)
    .region(rightSidebarRegion)
    .layout(naturalLayout)
    .build();

  const defaultHead = headSlots({
    styles: [
      h.style(`
        html { scroll-behavior: smooth; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `),
      h.styleCss(`
        code {
          font-family: "SF Mono", Monaco, "Courier New", monospace;
          font-size: 13px;
          background: #f5f5f5;
          padding: 2px 6px;
          border-radius: 4px;
          color: #e11d48;
        }
        .context-nav-link:hover,
        .context-nav-link.active {
          color: #ffffff;
          background: #262626;
        }
        .context-nav-link svg { width: 16px; height: 16px; }
        .context-icon-btn:hover { color: #ffffff; background: #262626; }
        .context-user:hover { background: #262626; }
        .theme-toggle:hover { background: #f5f5f5; color: #0a0a0a; }
        .search-bar:hover { border-color: #d4d4d4; background: #fafafa; }
        .subject-selector:hover { border-color: #d4d4d4; background: #fafafa; }
        .subject-popup.open {
          opacity: 1;
          visibility: visible;
          transform: translateY(0);
        }
        .subject-option:hover { background: #f5f5f5; }
        .option-icon.active {
          background: linear-gradient(135deg, #f59e0b, #d97706);
        }
        .subject-option.selected .option-checkmark { opacity: 1; }
        .nav-category:first-child { margin-top: 0; }
        .nav-link:hover,
        .nav-toggle:hover { background: #f5f5f5; color: #0a0a0a; }
        .nav-link.active {
          background: #fff7ed;
          color: #ea580c;
          font-weight: 500;
        }
        .nav-link.active::before {
          content: "";
          position: absolute;
          left: 0;
          width: 3px;
          height: 24px;
          background: #f97316;
          border-radius: 0 2px 2px 0;
        }
        .nav-toggle[aria-expanded="true"] .nav-chevron {
          transform: rotate(180deg);
        }
        .nav-child-link:hover { background: #f5f5f5; color: #0a0a0a; }
        .nav-child-link.active {
          color: #ea580c;
          background: #fff7ed;
        }
        .breadcrumb-item:hover:not(.breadcrumb-item-current) {
          color: #f97316;
        }
        .breadcrumb-item-home:hover { color: #f97316; }
        .breadcrumb-separator svg { width: 14px; height: 14px; }
        .section-heading:first-of-type { margin-top: 0; }
        .section-heading:hover .anchor-link { opacity: 1; }
        .anchor-link:hover { color: #f97316; }
        .action-btn:hover { border-color: #d4d4d4; color: #0a0a0a; }
        .action-btn.primary,
        .action-btn-primary {
          background: #0a0a0a;
          border-color: #0a0a0a;
          color: #ffffff;
        }
        .action-btn.primary:hover,
        .action-btn-primary:hover { background: #262626; }
        .feature-card:hover {
          border-color: #d4d4d4;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
          transform: translateY(-2px);
        }
        .feature-card:nth-child(1) .feature-icon {
          background: #fff7ed; color: #f97316;
        }
        .feature-card:nth-child(2) .feature-icon {
          background: #eff6ff; color: #3b82f6;
        }
        .feature-card:nth-child(3) .feature-icon {
          background: #f0fdf4; color: #22c55e;
        }
        .feature-card:nth-child(4) .feature-icon {
          background: #faf5ff; color: #a855f7;
        }
        .callout.info {
          background: #eff6ff;
          border-color: #bfdbfe;
          border-left-color: #3b82f6;
        }
        .callout.tip {
          background: #f0fdf4;
          border-color: #bbf7d0;
          border-left-color: #22c55e;
        }
        .code-block code { background: transparent; color: #d4d4d4; padding: 0; }
        .code-block .comment { color: #6a9955; }
        .code-block .keyword { color: #569cd6; }
        .code-block .string { color: #ce9178; }
        .code-block .function { color: #dcdcaa; }
        .code-lang-badge.ts { background: #3178c6; color: #ffffff; }
        .code-lang-badge.js { background: #f7df1e; color: #000000; }
        .code-lang-badge.bash { background: #4eaa25; color: #ffffff; }
        .code-lang-badge.json { background: #292929; color: #f5a623; }
        .code-lang-badge.jsx { background: #61dafb; color: #000000; }
        .code-lang-badge.css { background: #264de4; color: #ffffff; }
        .code-lang-badge.html { background: #e34c26; color: #ffffff; }
        .code-copy-btn:hover { background: #404040; color: #ffffff; }
        .code-content pre {
          margin: 0;
          font-family: "SF Mono", Monaco, "Courier New", monospace;
          font-size: 13px;
          line-height: 1.6;
        }
        .code-content code { background: transparent; color: #d4d4d4; padding: 0; }
        .code-line.highlighted {
          background: rgba(249, 115, 22, 0.15);
          margin: 0 -20px;
          padding: 0 20px;
        }
        .tabs-header { background: #f5f5f5; }
        .tab-button:hover { color: #0a0a0a; background: #fafafa; }
        .tab-button.active { color: #0a0a0a; background: #ffffff; }
        .tab-button.active::after {
          content: "";
          position: absolute;
          bottom: -1px;
          left: 0;
          right: 0;
          height: 2px;
          background: #f97316;
        }
        .tab-content.active { display: block; }
        .tab-content .code-block-enhanced {
          margin: 0;
          border: none;
          border-radius: 0;
        }
        .step:last-child .step-line { display: none; }
        .accordion-header:hover { background: #fafafa; }
        .accordion-item.open .accordion-icon { transform: rotate(180deg); }
        .accordion-item.open .accordion-content { display: block; }
        .api-table th {
          text-align: left;
          padding: 12px 16px;
          background: #f5f5f5;
          font-size: 12px;
          font-weight: 600;
          color: #525252;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid #e5e5e5;
        }
        .api-table td {
          padding: 12px 16px;
          font-size: 14px;
          color: #404040;
          border-bottom: 1px solid #e5e5e5;
          vertical-align: top;
        }
        .api-table tr:last-child td { border-bottom: none; }
        .badge.default { background: #f5f5f5; color: #525252; }
        .badge.primary { background: #fff7ed; color: #ea580c; }
        .badge.success { background: #f0fdf4; color: #16a34a; }
        .badge.warning { background: #fffbeb; color: #d97706; }
        .badge.error { background: #fef2f2; color: #dc2626; }
        .badge.info { background: #eff6ff; color: #2563eb; }
        .file-tree-item.folder { color: #0a0a0a; font-weight: 500; }
        .file-tree-item .icon { width: 16px; height: 16px; flex-shrink: 0; }
        .file-tree-item.folder .icon { color: #f59e0b; }
        .file-tree-item.file .icon { color: #737373; }
        .file-tree-item.file-ts .icon { color: #3178c6; }
        .file-tree-item.file-json .icon { color: #f5a623; }
        .file-tree-item.file-md .icon { color: #083fa1; }
        .file-tree-item.file-css .icon { color: #264de4; }
        .file-tree-item.file-html .icon { color: #e34c26; }
        .toc-link:hover { color: #0a0a0a; }
        .toc-link.active {
          color: #d97706;
          font-weight: 500;
          border-left: 2px solid #f97316;
          padding-left: 15px;
        }
        .toc-link.nested {
          padding-left: 28px;
          font-size: 12px;
          color: #737373;
        }
        .toc-link.nested:hover { color: #525252; }
        .toc-link.nested.active {
          color: #d97706;
          padding-left: 27px;
        }
        .footer-link:hover { border-color: #d4d4d4; background: #fafafa; }
        .footer-link.next { text-align: right; margin-left: auto; }
      `),
    ],
    scripts: [
      h.scriptJs(`
        window.addEventListener("DOMContentLoaded", () => {
          document.querySelectorAll(".tab-button").forEach((button) => {
            button.addEventListener("click", () => {
              const tabId = button.dataset.tab;
              const container = button.closest(".tabs-container");
              if (!container || !tabId) return;

              container.querySelectorAll(".tab-button").forEach((btn) => {
                btn.classList.remove("active");
              });
              button.classList.add("active");

              container.querySelectorAll(".tab-content").forEach((content) => {
                content.classList.remove("active");
              });
              const next = container.querySelector("#tab-" + tabId);
              if (next) next.classList.add("active");
            });
          });

          document.querySelectorAll(".accordion-header").forEach((header) => {
            header.addEventListener("click", () => {
              const item = header.closest(".accordion-item");
              if (item) item.classList.toggle("open");
            });
          });

          document.querySelectorAll(".code-copy-btn").forEach((button) => {
            button.addEventListener("click", async () => {
              const codeBlock = button.closest(".code-block-enhanced");
              if (!codeBlock) return;
              const code = codeBlock.querySelector("code")?.textContent ?? "";

              try {
                await navigator.clipboard.writeText(code);
                const originalText = button.innerHTML;
                button.innerHTML = "Copied!";
                setTimeout(() => {
                  button.innerHTML = originalText;
                }, 2000);
              } catch (err) {
                console.error("Failed to copy:", err);
              }
            });
          });

          const tocLinks = document.querySelectorAll(".toc-link");
          const tocTargets = Array.from(tocLinks)
            .map((link) => {
              const href = link.getAttribute("href");
              if (!href || !href.startsWith("#")) return null;
              return document.querySelector(href);
            })
            .filter((el) => el);

          const observerOptions = { rootMargin: "-20% 0% -80% 0%" };
          const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              const id = entry.target.getAttribute("id");
              tocLinks.forEach((link) => {
                link.classList.remove("active");
                if (link.getAttribute("href") === "#" + id) {
                  link.classList.add("active");
                }
              });
            });
          }, observerOptions);

          tocTargets.forEach((target) => {
            if (target) observer.observe(target);
          });

          document.querySelectorAll(".nav-toggle").forEach((toggle) => {
            toggle.addEventListener("click", () => {
              const expanded = toggle.getAttribute("aria-expanded") === "true";
              toggle.setAttribute("aria-expanded", (!expanded).toString());
              const children = toggle.nextElementSibling;
              if (children && children.classList.contains("nav-children")) {
                children.style.display = expanded ? "none" : "flex";
              }
            });
          });

          const subjectTrigger = document.getElementById("subject-trigger");
          const subjectPopup = document.getElementById("subject-popup");

          if (subjectTrigger && subjectPopup) {
            subjectTrigger.addEventListener("click", (event) => {
              event.stopPropagation();
              const isOpen = subjectPopup.classList.contains("open");
              subjectPopup.classList.toggle("open");
              subjectTrigger.setAttribute("aria-expanded", (!isOpen).toString());
            });

            document.addEventListener("click", (event) => {
              const target = event.target;
              if (
                target instanceof Node &&
                !subjectPopup.contains(target) &&
                !subjectTrigger.contains(target)
              ) {
                subjectPopup.classList.remove("open");
                subjectTrigger.setAttribute("aria-expanded", "false");
              }
            });

            document.querySelectorAll(".subject-option").forEach((option) => {
              option.addEventListener("click", () => {
                document.querySelectorAll(".subject-option").forEach((opt) => {
                  opt.classList.remove("selected");
                  opt.querySelector(".option-icon")?.classList.remove("active");
                });
                option.classList.add("selected");
                option.querySelector(".option-icon")?.classList.add("active");
                const title =
                  option.querySelector(".option-title")?.textContent ?? "";
                const name = document.querySelector(".subject-selector-name");
                if (name) name.textContent = title;
                subjectPopup.classList.remove("open");
                subjectTrigger.setAttribute("aria-expanded", "false");
              });
            });
          }
        });
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
