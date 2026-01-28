import * as h from "../../natural-html/elements.ts";
import type {
  NamingStrategy,
  RenderCtx,
} from "../../natural-html/design-system.ts";
import type { RenderInput } from "../../natural-html/patterns.ts";

export type PitchHeroButtonProps = {
  readonly label: string;
  readonly href: string;
  readonly primary?: boolean;
  readonly target?: string;
  readonly rel?: string;
};

export const pitchHeroButton = (
  ctx: RenderCtx<RenderInput, NamingStrategy>,
  props: PitchHeroButtonProps,
) =>
  h.a(
    {
      href: props.href,
      target: props.target,
      rel: props.rel,
      style: ctx.css({
        borderRadius: "999px",
        padding: "14px 34px",
        fontSize: "0.95rem",
        fontWeight: 600,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        letterSpacing: "0.01em",
        textDecoration: "none",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
        backgroundColor: props.primary ? "#1c1b1a" : "transparent",
        color: props.primary ? "#fefcf7" : "#1b1a17",
        border: props.primary ? "none" : "1px solid rgba(27, 26, 22, 0.35)",
        boxShadow: props.primary
          ? "0 12px 30px rgba(27, 26, 22, 0.35)"
          : "0 0 0 rgba(0, 0, 0, 0)",
      }),
    },
    h.text(props.label),
  );

export type PitchHeroVisualProps = {
  readonly badge?: string;
  readonly title: string;
  readonly command: string;
  readonly footerLeft?: string;
  readonly footerRight?: string;
};

export const pitchHeroVisual = (
  ctx: RenderCtx<RenderInput, NamingStrategy>,
  props: PitchHeroVisualProps,
) =>
  h.div(
    {
      style: ctx.css({
        borderRadius: "28px",
        minHeight: "220px",
        background:
          "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.65), rgba(187, 147, 96, 0.4)), linear-gradient(180deg, #0a0a0a, #191616)",
        padding: "24px 32px",
        color: "#f4f1ea",
        boxShadow: "0 30px 60px rgba(0,0,0,0.35)",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        fontFamily: "SF Mono, Monaco, 'Courier New', monospace",
      }),
    },
    props.badge
      ? h.span(
        {
          style: ctx.css({
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            fontSize: "0.65rem",
            color: "#f97316",
          }),
        },
        props.badge,
      )
      : null,
    h.div({ style: ctx.css({ fontSize: "1.8rem", lineHeight: 1.2 }) }, props.title),
    h.codeTag(props.command),
    (props.footerLeft || props.footerRight)
      ? h.div(
        {
          style: ctx.css({
            display: "flex",
            justifyContent: "space-between",
            marginTop: "auto",
            fontSize: "0.85rem",
          }),
        },
        props.footerLeft ? h.span(props.footerLeft) : null,
        props.footerRight ? h.span(props.footerRight) : null,
      )
      : null,
  );

export type PitchCtaAction = {
  readonly label: string;
  readonly href: string;
  readonly primary?: boolean;
  readonly target?: string;
  readonly rel?: string;
};

export const pitchCtaActions = (
  ctx: RenderCtx<RenderInput, NamingStrategy>,
  actions: readonly PitchCtaAction[],
) =>
  h.div(
    {
      style: ctx.css({
        display: "flex",
        gap: "16px",
        flexWrap: "wrap",
        justifyContent: "center",
      }),
    },
    ...actions.map((action) =>
      pitchHeroButton(ctx, {
        label: action.label,
        href: action.href,
        primary: action.primary,
        target: action.target,
        rel: action.rel,
      })
    ),
  );
