import type { RenderCtx } from "../../natural-html/design-system.ts";
import {
  type ComponentStylesheets,
  defineComponent,
  NamingStrategy,
} from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import {
  combineHast,
  type Content,
  renderContent,
  renderContents,
  type RenderInput,
} from "../../natural-html/patterns.ts";

const contextHeaderStyles: ComponentStylesheets = [
  {
    "context-header-left": {
      display: "flex",
      alignItems: "center",
      gap: "24px",
    },
    "context-brand": {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      textDecoration: "none",
      color: "#ffffff",
      fontWeight: 600,
      fontSize: "15px",
    },
    "context-brand-icon": {
      width: "28px",
      height: "28px",
      background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
      borderRadius: "6px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "white",
      fontSize: "12px",
      fontWeight: "bold",
    },
    "context-nav": {
      display: "flex",
      alignItems: "center",
      gap: "4px",
    },
    "context-nav-link": {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      padding: "6px 12px",
      borderRadius: "6px",
      textDecoration: "none",
      color: "#a3a3a3",
      fontSize: "13px",
      fontWeight: 500,
      transition: "all 0.15s ease",
    },
    "context-nav-link-active": {
      color: "#ffffff",
      background: "#262626",
    },
    "context-header-right": {
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },
    "context-icon-btn": {
      width: "36px",
      height: "36px",
      border: "none",
      background: "transparent",
      borderRadius: "6px",
      color: "#a3a3a3",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      transition: "all 0.15s ease",
    },
    "notification-badge": {
      position: "absolute",
      top: "6px",
      right: "6px",
      width: "8px",
      height: "8px",
      background: "#f97316",
      borderRadius: "50%",
      border: "2px solid #0a0a0a",
    },
    "context-divider": {
      width: "1px",
      height: "24px",
      background: "#333333",
      margin: "0 8px",
    },
    "context-user": {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      padding: "4px 8px 4px 4px",
      borderRadius: "6px",
      cursor: "pointer",
      transition: "all 0.15s ease",
    },
    "context-avatar": {
      width: "28px",
      height: "28px",
      borderRadius: "50%",
      background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "white",
      fontSize: "11px",
      fontWeight: 600,
    },
    "context-user-name": {
      fontSize: "13px",
      color: "#e5e5e5",
      fontWeight: 500,
    },
    "context-user-chevron": {
      color: "#737373",
    },
  },
];

export type ContextBrandProps<Ctx extends object = RenderInput> = {
  readonly label: string;
  readonly href?: string;
  readonly icon?: Content<Ctx, NamingStrategy>;
  readonly iconText?: string;
};

export const contextBrand = defineComponent<
  ContextBrandProps,
  RenderInput,
  NamingStrategy
>(
  "ContextBrand",
  contextHeaderStyles,
  (ctx, props) => {
    const icon = renderContent(ctx, props.icon) ??
      h.text(props.iconText ?? "DS");
    return h.a(
      { href: props.href ?? "#", class: ctx.cls("context-brand") },
      h.span({ class: ctx.cls("context-brand-icon") }, icon),
      h.span(props.label),
    );
  },
);

export type ContextNavLinkProps<Ctx extends object = RenderInput> = {
  readonly label: string;
  readonly href?: string;
  readonly icon?: Content<Ctx, NamingStrategy>;
  readonly active?: boolean;
};

export const contextNavLink = defineComponent<
  ContextNavLinkProps,
  RenderInput,
  NamingStrategy
>(
  "ContextNavLink",
  contextHeaderStyles,
  (ctx, props) => {
    const icon = renderContent(ctx, props.icon);
    return h.a(
      {
        href: props.href ?? "#",
        class: ctx.cls(
          "context-nav-link",
          props.active ? "context-nav-link-active" : null,
          props.active ? "active" : null,
        ),
      },
      icon,
      h.span(props.label),
    );
  },
);

export type ContextIconButtonProps<Ctx extends object = RenderInput> = {
  readonly label: string;
  readonly icon: Content<Ctx, NamingStrategy>;
  readonly badge?: boolean;
};

export const contextIconButton = defineComponent<
  ContextIconButtonProps,
  RenderInput,
  NamingStrategy
>(
  "ContextIconButton",
  contextHeaderStyles,
  (ctx, props) =>
    h.button(
      { class: ctx.cls("context-icon-btn"), "aria-label": props.label },
      renderContent(ctx, props.icon),
      props.badge ? h.span({ class: ctx.cls("notification-badge") }) : null,
    ),
);

export type ContextUserProps = {
  readonly initials: string;
  readonly name: string;
  readonly chevron?: h.RawHtml;
};

export const contextUser = defineComponent<ContextUserProps, RenderInput>(
  "ContextUser",
  contextHeaderStyles,
  (_ctx, props) =>
    h.div(
      { class: "context-user" },
      h.div({ class: "context-avatar" }, props.initials),
      h.span({ class: "context-user-name" }, props.name),
      props.chevron
        ? h.span({ class: "context-user-chevron" }, props.chevron)
        : null,
    ),
);

export type ContextHeaderContentProps<Ctx extends object = RenderInput> = {
  readonly brand: Content<Ctx, NamingStrategy>;
  readonly nav: readonly Content<Ctx, NamingStrategy>[];
  readonly actions: readonly Content<Ctx, NamingStrategy>[];
  readonly user: Content<Ctx, NamingStrategy>;
};

export const contextHeaderContent = defineComponent<
  ContextHeaderContentProps,
  RenderInput
>(
  "ContextHeaderContent",
  contextHeaderStyles,
  (ctx, props) =>
    combineHast(
      h.div(
        { class: ctx.cls("context-header-left") },
        renderContent(ctx, props.brand),
        h.nav(
          { class: ctx.cls("context-nav") },
          ...renderContents(ctx, props.nav),
        ),
      ),
      h.div(
        { class: ctx.cls("context-header-right") },
        ...renderContents(ctx, props.actions),
        h.div({ class: ctx.cls("context-divider") }),
        renderContent(ctx, props.user),
      ),
    ),
);

export type ContextNavEntry = {
  readonly label: string;
  readonly href?: string;
  readonly icon?: Content<RenderInput, NamingStrategy>;
  readonly active?: boolean;
};

export type ContextAction = {
  readonly label: string;
  readonly icon: Content<RenderInput, NamingStrategy>;
  readonly badge?: boolean;
};

export type ContextUserInfo = {
  readonly initials: string;
  readonly name: string;
  readonly chevron?: h.RawHtml;
};

export class NaturalContextBarBuilder {
  readonly #ctx: RenderCtx<RenderInput, NamingStrategy>;
  #brand?: ContextBrandProps;
  #navEntries: ContextNavEntry[] = [];
  #actions: ContextAction[] = [];
  #user?: ContextUserInfo;

  constructor(ctx: RenderCtx<RenderInput, NamingStrategy>) {
    this.#ctx = ctx;
  }

  withBrand(brand: ContextBrandProps): this {
    this.#brand = brand;
    return this;
  }

  withNavEntries(entries: ContextNavEntry[]): this {
    this.#navEntries = entries;
    return this;
  }

  withActions(actions: ContextAction[]): this {
    this.#actions = actions;
    return this;
  }

  withUser(user: ContextUserInfo): this {
    this.#user = user;
    return this;
  }

  build(): h.RawHtml {
    if (!this.#brand) throw new Error("Context bar requires a brand.");
    if (!this.#user) throw new Error("Context bar requires a user.");

    const nav = this.#navEntries.map((entry) =>
      contextNavLink(this.#ctx, {
        label: entry.label,
        href: entry.href,
        icon: entry.icon,
        active: entry.active,
      })
    );
    const actions = this.#actions.map((action) =>
      contextIconButton(this.#ctx, {
        label: action.label,
        icon: action.icon,
        badge: action.badge,
      })
    );

    return contextHeaderContent(this.#ctx, {
      brand: contextBrand(this.#ctx, this.#brand),
      nav,
      actions,
      user: contextUser(this.#ctx, this.#user),
    });
  }
}
