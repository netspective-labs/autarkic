/**
 * @module lib/natural-html/design-system.ts
 *
 * Natural Design System (Natural DS) is a fluent, type-safe design system runtime
 * that builds HAST (Hypertext AST) nodes using Natural HTML primitives from
 * elements.ts.
 *
 * It is not a component library in the traditional React/Vue sense. Instead, it is a
 * structural composition system that models UI as:
 *
 * - Layouts: high-level structural shells that define page-level composition
 * - Regions: named structural containers within layouts
 * - Components: reusable leaf-level renderers used inside regions
 *
 * The system is intentionally SSR-first and deterministic. It produces HAST
 * (not strings) with no hidden global state, no implicit registries, and no
 * runtime mutation. Rendering is delegated downstream to Natural HTML utilities.
 *
 * Most design systems fail developers in two ways:
 *
 * 1. They are visually opinionated but structurally weak.
 *    Developers can put anything anywhere, leading to entropy.
 *
 * 2. They are flexible at runtime but unsafe at compile time.
 *    Missing regions, misspelled slots, and invalid compositions are only
 *    discovered visually or in production.
 *
 * Natural DS is designed to make *illegal UI states unrepresentable*.
 * If a layout or region requires a slot, TypeScript enforces it.
 * If a slot name is invalid, TypeScript rejects it.
 * If something slips through at runtime, the dev-mode runtime checks catch it.
 *
 * Core concepts
 * -------------
 *
 * 1. Layouts
 * ----------
 * A layout represents a complete structural frame for a page or sub-page.
 *
 * Examples:
 * - AppShell
 * - MarketingLanding
 * - DocumentationPage
 *
 * Layouts:
 * - Declare required and optional slots
 * - May invoke regions and other layouts
 * - Are responsible for structural ordering
 *
 * Layouts are hierarchical. Sub-layouts are just layouts invoked inside layouts.
 *
 * 2. Regions
 * ----------
 * Regions are named structural wrappers inside layouts.
 *
 * Examples:
 * - Header
 * - Main
 * - Footer
 * - Sidebar
 * - RightRail
 *
 * Regions:
 * - Have their own slot contracts
 * - Are wrapped consistently with data attributes
 * - Carry render metadata
 *
 * Regions are intentionally simple. They do not own routing, data, or business logic.
 * They exist to enforce structure and enable styling, tracing, and inspection.
 *
 * 3. Slots
 * --------
 * Slots are named render functions `(ctx) => HAST`.
 *
 * Slots are:
 * - Explicitly declared as required or optional
 * - Enforced at compile time using exact object typing
 * - Validated again at runtime in development mode
 *
 * There is no silent slot dropping.
 *
 * 4. Components
 * -------------
 * Components are pure render functions.
 *
 * They:
 * - Receive a RenderCtx and props
 * - Return HAST
 * - Can be traced for diagnostics
 *
 * Components never register themselves globally.
 * They are just functions.
 *
 * Design System User Agent Dependencies (UA deps)
 * -----------------------------------------------
 * A fluent design system may require browser-side assets such as:
 *
 * - CSS
 * - JavaScript modules
 * - Fonts
 *
 * These are modeled explicitly as UA dependencies.
 *
 * A UA dependency includes:
 * - mountPoint: the URL referenced in HTML
 * - canonicalSource: external URL or inlined content (see UaDependency.nature)
 * - mimeType
 * - cache, headers, CORS, and routing metadata
 *
 * The design system owns these dependencies so that:
 * - The server can automatically expose routes for them
 * - HTML head tags can be generated deterministically
 * - No layout or page needs to know where assets come from
 *
 * Subject area organization
 * -------------------------
 * This module is intentionally organized into three layers:
 *
 * 1. Universal Design System Subjects
 *    - Layout and region primitives
 *    - Slot typing and validation
 *    - UA dependency modeling
 *    - Rendering context
 *
 * 2. Typical Design System Subjects
 *    - Reusable patterns common across many systems
 *    - Cards, breadcrumbs, navigation, etc.
 *
 * 3. Enterprise Design System Subjects
 *    - Opinionated application shells
 *    - Admin dashboards
 *    - Complex multi-region layouts
 *
 * This allows downstream teams to:
 * - Reuse only the universal layer
 * - Extend typical patterns
 * - Replace enterprise shells entirely
 *
 * Developer ergonomics and safety
 * -------------------------------
 * The system is deliberately defensive against common footguns:
 *
 * - Exact slot typing prevents accidental extra keys
 * - Required slots cannot be omitted
 * - Unknown slots throw in dev mode
 * - Layout and region names are type-safe keys
 * - Generics have sensible defaults so most users never write them
 *
 * Junior engineers get guidance from the type system.
 * Senior engineers get extensibility without runtime hacks.
 *
 * How to use
 * ----------
 *
 * 1. Create a design system:
 *
 *   const ds = createDesignSystem("my-ds", naming)
 *     .region(MyRegion)
 *     .layout(MyLayout)
 *     .uaDependencies([...])
 *     .build();
 *
 * 2. Render a layout:
 *
 *   const hast = ds.render("AppShell", renderCtx, {
 *     slots: {
 *       headerLeft: ctx => ...
 *       content: ctx => ...
 *     }
 *   });
 *
 *   const html = h.render(hast);
 *
 * 3. Let the server expose ds.uaRoutes() and inject ds.uaHeadTags()
 *
 * Philosophy
 * ----------
 * This module favors:
 * - Explicit structure over convenience
 * - Compile-time safety over runtime guessing
 * - Deterministic output over hidden state
 *
 * It is designed to scale from simple pages to large enterprise systems
 * without changing mental models or APIs.
 */
import * as h from "./elements.ts";
import type { RawHtml, StyleAttributeEmitStrategy } from "./elements.ts";
import {
  browserUserAgentHeadTags,
  collectStyleAttributeCss,
  emitStyleAttributeCss,
  normalizeUaRoute,
  UaDependency,
  UaRoute,
} from "./elements.ts";

// deno-lint-ignore no-explicit-any
type Any = any;

type NamingKind = "layout" | "region" | "component" | "css-emit";

export type NamingStrategy = {
  readonly elemIdValue: (suggested: string, kind: NamingKind) => string;
  readonly elemDataAttr: (
    suggestedKeyName: string,
    suggestedValue: string,
    kind: NamingKind,
  ) => string;
  readonly className: (suggested: string, kind: NamingKind) => string;
};

export type TraceEvent =
  | {
    readonly kind: "layout";
    readonly name: string;
    readonly elementId: string;
    readonly className: string;
    readonly phase: "enter" | "exit";
  }
  | {
    readonly kind: "region";
    readonly name: string;
    readonly elementId: string;
    readonly className: string;
    readonly phase: "enter" | "exit";
  }
  | {
    readonly kind: "component";
    readonly name: string;
    readonly elementId: string;
    readonly className: string;
  };

export type TraceSink = (ev: TraceEvent) => void;

export type TokenBag = Readonly<Record<string, string | number>>;

type RenderCtxBase<N extends NamingStrategy = NamingStrategy> = {
  readonly ds: string;
  readonly layout: string;
  readonly region?: string;
  readonly component?: string;
  readonly naming: N;
  readonly tokens: TokenBag;
  readonly html: typeof h;
  readonly attrs: typeof h.attrs;
  readonly cls: (...parts: h.ClassSpec[]) => string;
  readonly css: typeof h.styleText;
  readonly componentStyles: ComponentStyleRegistry;
  readonly scripts: ScriptRegistry;
  readonly trace: TraceSink;
  readonly policy: DsPolicies;
};

type EmptyObject = Record<PropertyKey, never>;

export type RenderCtx<
  Ctx extends object = EmptyObject,
  NS extends NamingStrategy = NamingStrategy,
> = RenderCtxBase<NS> & Ctx;

export type SlotBuilder<
  Ctx extends object = EmptyObject,
  NS extends NamingStrategy = NamingStrategy,
> = (
  ctx: RenderCtx<Ctx, NS>,
) => RawHtml;

export type DsPolicies = {
  readonly onTrace?: TraceSink;
  readonly rawPolicy?: h.RawPolicy;

  readonly wrappers?: {
    readonly enabled?: boolean;
    readonly wrapperTag?: "section" | "div"; // default "section"
  };

  readonly dev?: {
    readonly unknownSlotMode?: "ignore" | "throw"; // default "throw"
  };
};

function mapClassSpec(
  spec: h.ClassSpec,
  naming: NamingStrategy,
  kind: NamingKind,
): h.ClassSpec {
  if (!spec) return spec;
  if (Array.isArray(spec)) {
    return spec.map((item) => mapClassSpec(item, naming, kind));
  }
  if (typeof spec === "object") {
    const out: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(spec)) {
      out[naming.className(key, kind)] = value;
    }
    return out;
  }
  return naming.className(String(spec), kind);
}

function makeClassNames(
  naming: NamingStrategy,
  kind: NamingKind,
): (...parts: h.ClassSpec[]) => string {
  return (...parts) =>
    h.classNames(...parts.map((part) => mapClassSpec(part, naming, kind)));
}

/* -----------------------------------------------------------------------------
 * Slot Specs and Exactness (removes “stringly” footguns)
 * -------------------------------------------------------------------------- */

export type SlotSpec<Req extends string, Opt extends string> = {
  readonly required: readonly Req[];
  readonly optional: readonly Opt[];
};

export function slots<
  const Req extends readonly string[] = readonly [],
  const Opt extends readonly string[] = readonly [],
>(
  spec: { readonly required?: Req; readonly optional?: Opt },
): SlotSpec<Req[number], Opt[number]> {
  return {
    required: (spec.required ?? []) as readonly Req[number][],
    optional: (spec.optional ?? []) as readonly Opt[number][],
  };
}

type ReqOf<Spec> = Spec extends SlotSpec<infer R, string> ? R : never;
type OptOf<Spec> = Spec extends SlotSpec<string, infer O> ? O : never;

export type SlotBuilders<
  Spec,
  Ctx extends object = EmptyObject,
  NS extends NamingStrategy = NamingStrategy,
> =
  & Record<ReqOf<Spec>, SlotBuilder<Ctx, NS>>
  & Partial<Record<OptOf<Spec>, SlotBuilder<Ctx, NS>>>;

type KeysOfBuilders<Spec> = keyof SlotBuilders<Spec> & string;

type Exact<Actual, Shape> = Actual extends Shape
  ? Exclude<keyof Actual, keyof Shape> extends never ? Actual
  : never
  : never;

type ExactSlots<
  Spec,
  Actual,
  Ctx extends object = EmptyObject,
  NS extends NamingStrategy = NamingStrategy,
> = Exact<Actual, SlotBuilders<Spec, Ctx, NS>>;

/* -----------------------------------------------------------------------------
 * Region + Layout definitions (typed slots, required/optional)
 * -------------------------------------------------------------------------- */

export type RegionDef<
  Name extends string,
  Spec extends SlotSpec<string, string> = SlotSpec<never, never>,
  Ctx extends object = EmptyObject,
  NS extends NamingStrategy = NamingStrategy,
> = {
  readonly kind: "region";
  readonly name: Name;
  readonly slots: Spec;
  readonly scripts?: ScriptContributionsDef<Ctx, NS>;
  readonly render: (
    ctx: RenderCtx<Ctx, NS>,
    slots: SlotBuilders<Spec, Ctx, NS>,
  ) => RawHtml;
};

export type LayoutDef<
  Name extends string,
  Spec extends SlotSpec<string, string> = SlotSpec<never, never>,
  Ctx extends object = EmptyObject,
  NS extends NamingStrategy = NamingStrategy,
> = {
  readonly kind: "layout";
  readonly name: Name;
  readonly slots: Spec;
  readonly headSlots?: SlotSpec<string, string>;
  readonly scripts?: ScriptContributionsDef<Ctx, NS>;
  readonly render: (
    ctx: RenderCtx<Ctx, NS>,
    api: DsApi<Any, Any, Ctx, NS>,
    slots: SlotBuilders<Spec, Ctx, NS>,
  ) => RawHtml;
};

export function defineRegion<
  Name extends string,
  Spec extends SlotSpec<string, string>,
  Ctx extends object = EmptyObject,
  NS extends NamingStrategy = NamingStrategy,
>(
  def: Omit<RegionDef<Name, Spec, Ctx, NS>, "kind">,
): RegionDef<Name, Spec, Ctx, NS> {
  return { kind: "region", ...def };
}

export function defineLayout<
  Name extends string,
  Spec extends SlotSpec<string, string>,
  HeadSpec extends SlotSpec<string, string>,
  Ctx extends object = EmptyObject,
  NS extends NamingStrategy = NamingStrategy,
>(
  def: Omit<LayoutDef<Name, Spec, Ctx, NS>, "kind"> & {
    readonly headSlots: HeadSpec;
  },
): LayoutDef<Name, Spec, Ctx, NS> & { readonly headSlots: HeadSpec };
export function defineLayout<
  Name extends string,
  Spec extends SlotSpec<string, string>,
  Ctx extends object = EmptyObject,
  NS extends NamingStrategy = NamingStrategy,
>(
  def: Omit<LayoutDef<Name, Spec, Ctx, NS>, "kind">,
): LayoutDef<Name, Spec, Ctx, NS>;
export function defineLayout<
  Name extends string,
  Spec extends SlotSpec<string, string>,
  Ctx extends object = EmptyObject,
  NS extends NamingStrategy = NamingStrategy,
>(
  def: Omit<LayoutDef<Name, Spec, Ctx, NS>, "kind">,
): LayoutDef<Name, Spec, Ctx, NS> {
  return { kind: "layout", ...def };
}

export type Component<
  Props = unknown,
  Ctx extends object = EmptyObject,
  NS extends NamingStrategy = NamingStrategy,
> =
  & ((
    ctx: RenderCtx<Ctx, NS>,
    props: Props,
  ) => RawHtml)
  & {
    readonly stylesheets?: ComponentStylesheets;
    readonly scripts?: ScriptContributions;
  };

export type CssStyleObject = Readonly<
  Record<string, string | number | null | undefined | false>
>;

export type ComponentStylesheet<Classes extends string = string> = Readonly<
  Record<Classes, CssStyleObject>
>;

export type ComponentStylesheets<Classes extends string = string> =
  readonly ComponentStylesheet<Classes>[];

export type ScriptPlacementHint = "head" | "body-end";
export type ScriptEmitHint = "inline" | "ua-dep";

export type ScriptIdentityHint =
  | { readonly kind: "name"; readonly value: string }
  | { readonly kind: "hash" }
  | { readonly kind: "none" };

export type ScriptHints = {
  readonly placement?: ScriptPlacementHint;
  readonly emit?: ScriptEmitHint;
  readonly identity?: ScriptIdentityHint;
  readonly as?: "script" | "module";
  readonly attrs?: h.Attrs;
};

export type ScriptContribution = {
  readonly code: RawHtml | string;
  readonly hints?: ScriptHints;
};

export type ScriptContributions = readonly ScriptContribution[];

export type ScriptEmitDecision = {
  readonly placement?: ScriptPlacementHint;
  readonly emit?: ScriptEmitHint | "skip";
  readonly identity?: ScriptIdentityHint;
};

export type ScriptEmitStrategy = {
  readonly mode?: "skip" | "hints" | "inline" | "ua-dep";
  readonly placement?: ScriptPlacementHint;
  readonly resolve?: (entry: RegisteredScript) => ScriptEmitDecision;
};

type ComponentStyleRegistry = {
  readonly register: (
    componentName: string,
    stylesheets: ComponentStylesheets,
  ) => void;
  readonly cssText: () => string;
};

type ScriptContributionsDef<Ctx extends object, NS extends NamingStrategy> =
  | ScriptContributions
  | ((ctx: RenderCtx<Ctx, NS>) => ScriptContributions);

type ScriptOwnerKind = "component" | "region" | "layout";

type RegisteredScript = {
  readonly ownerKind: ScriptOwnerKind;
  readonly ownerName: string;
  readonly contribution: ScriptContribution;
};

type ScriptRegistry = {
  readonly register: (
    ownerKind: ScriptOwnerKind,
    ownerName: string,
    scripts: ScriptContributions | ScriptContribution | RawHtml | string,
  ) => void;
  readonly entries: () => readonly RegisteredScript[];
};

export function defineComponent<
  Props,
  Ctx extends object = EmptyObject,
  NS extends NamingStrategy = NamingStrategy,
>(
  name: string,
  stylesheets: ComponentStylesheets,
  fn: Component<Props, Ctx, NS>,
): Component<Props, Ctx, NS>;
export function defineComponent<
  Props,
  Ctx extends object = EmptyObject,
  NS extends NamingStrategy = NamingStrategy,
>(
  name: string,
  options: {
    readonly stylesheets?: ComponentStylesheets;
    readonly scripts?: ScriptContributionsDef<Ctx, NS>;
  },
  fn: Component<Props, Ctx, NS>,
): Component<Props, Ctx, NS>;
export function defineComponent<
  Props,
  Ctx extends object = EmptyObject,
  NS extends NamingStrategy = NamingStrategy,
>(
  name: string,
  fn: Component<Props, Ctx, NS>,
): Component<Props, Ctx, NS>;
export function defineComponent<
  Props,
  Ctx extends object = EmptyObject,
  NS extends NamingStrategy = NamingStrategy,
>(
  name: string,
  stylesheetsOrFn:
    | ComponentStylesheets
    | {
      readonly stylesheets?: ComponentStylesheets;
      readonly scripts?: ScriptContributionsDef<Ctx, NS>;
    }
    | Component<Props, Ctx, NS>,
  maybeFn?: Component<Props, Ctx, NS>,
): Component<Props, Ctx, NS> {
  const makeComponent = (
    stylesheets: ComponentStylesheets,
    scripts: ScriptContributionsDef<Ctx, NS> | undefined,
    fn: Component<Props, Ctx, NS>,
  ): Component<Props, Ctx, NS> => {
    const definedStylesheets = stylesheets.length > 0 ? stylesheets : undefined;
    const component = Object.assign(
      (ctx: RenderCtx<Ctx, NS>, props: Props) => {
        const componentCtx: RenderCtx<Ctx, NS> = {
          ...ctx,
          component: name,
          cls: makeClassNames(ctx.naming, "component"),
        };
        if (definedStylesheets) {
          componentCtx.componentStyles.register(name, definedStylesheets);
        }
        registerScriptContributions(
          componentCtx,
          "component",
          name,
          scripts,
        );
        ctx.trace({
          kind: "component",
          elementId: ctx.naming.elemIdValue(name, "component"),
          className: ctx.naming.className(name, "component"),
          name,
        });
        return fn(componentCtx, props);
      },
      definedStylesheets || scripts
        ? {
          ...(definedStylesheets ? { stylesheets: definedStylesheets } : {}),
          ...(!scripts || typeof scripts === "function"
            ? {}
            : { scripts: normalizeScriptContributions(scripts) }),
        }
        : {},
    ) as Component<Props, Ctx, NS>;
    return component;
  };

  if (typeof stylesheetsOrFn === "function") {
    return makeComponent([], undefined, stylesheetsOrFn);
  }

  if (Array.isArray(stylesheetsOrFn)) {
    const fn = maybeFn;
    if (!fn) throw new Error("fluent-ds: defineComponent missing renderer");
    return makeComponent(stylesheetsOrFn, undefined, fn);
  }

  if (stylesheetsOrFn && typeof stylesheetsOrFn === "object") {
    const fn = maybeFn;
    if (!fn) throw new Error("fluent-ds: defineComponent missing renderer");
    const opts = stylesheetsOrFn as {
      readonly stylesheets?: ComponentStylesheets;
      readonly scripts?: ScriptContributionsDef<Ctx, NS>;
    };
    return makeComponent(
      opts.stylesheets ?? [],
      opts.scripts,
      fn,
    );
  }

  throw new Error("fluent-ds: defineComponent missing renderer");
}

/* -----------------------------------------------------------------------------
 * Typed DS registry (builder accumulates types)
 * -------------------------------------------------------------------------- */

export type RegionsRegistry<
  Ctx extends object = EmptyObject,
  NS extends NamingStrategy = NamingStrategy,
> = Record<string, RegionDef<string, Any, Ctx, NS>>;
export type LayoutsRegistry<
  Ctx extends object = EmptyObject,
  NS extends NamingStrategy = NamingStrategy,
> = Record<string, LayoutDef<string, Any, Ctx, NS>>;

type ExtendRegions<
  R extends RegionsRegistry<Ctx, NS>,
  Def extends RegionDef<string, Any, Ctx, NS>,
  Ctx extends object,
  NS extends NamingStrategy,
> = R & { [K in Def["name"]]: Def } & RegionsRegistry<Ctx, NS>;

type ExtendLayouts<
  L extends LayoutsRegistry<Ctx, NS>,
  Def extends LayoutDef<string, Any, Ctx, NS>,
  Ctx extends object,
  NS extends NamingStrategy,
> = L & { [K in Def["name"]]: Def } & LayoutsRegistry<Ctx, NS>;

export type DsApi<
  R extends RegionsRegistry<Ctx, NS>,
  L extends LayoutsRegistry<Ctx, NS>,
  Ctx extends object = EmptyObject,
  NS extends NamingStrategy = NamingStrategy,
> = {
  readonly region: <
    N extends keyof R & string,
    Actual extends SlotBuilders<R[N]["slots"], Ctx, NS>,
  >(
    name: N,
    slots: ExactSlots<R[N]["slots"], Actual, Ctx, NS>,
  ) => RawHtml;

  readonly layout: <
    N extends keyof L & string,
    Actual extends SlotBuilders<L[N]["slots"], Ctx, NS>,
  >(
    name: N,
    slots: ExactSlots<L[N]["slots"], Actual, Ctx, NS>,
    ctxOverrides?: Partial<Ctx>,
  ) => RawHtml;
};

export type RenderOptionsFor<
  L extends LayoutDef<string, Any, Ctx, NS>,
  Ctx extends object = EmptyObject,
  NS extends NamingStrategy = NamingStrategy,
> = {
  readonly slots: SlotBuilders<L["slots"], Ctx, NS>;
  readonly styleAttributeEmitStrategy?: StyleAttributeEmitStrategy;
  readonly scriptEmitStrategy?: ScriptEmitStrategy;
};

type HeadSlotsFor<
  L extends LayoutDef<string, Any, Ctx, NS>,
  Ctx extends object = EmptyObject,
  NS extends NamingStrategy = NamingStrategy,
> = L extends { readonly headSlots: SlotSpec<string, string> }
  ? (ReqOf<L["headSlots"]> extends never
    ? { readonly headSlots?: SlotBuilders<L["headSlots"], Ctx, NS> }
    : { readonly headSlots: SlotBuilders<L["headSlots"], Ctx, NS> })
  : { readonly headSlots?: never };

export type PageOptionsFor<
  L extends LayoutDef<string, Any, Ctx, NS>,
  Ctx extends object = EmptyObject,
  NS extends NamingStrategy = NamingStrategy,
> =
  & RenderOptionsFor<L, Ctx, NS>
  & HeadSlotsFor<L, Ctx, NS>
  & { readonly styleAttributeEmitStrategy?: StyleAttributeEmitStrategy }
  & { readonly scriptEmitStrategy?: ScriptEmitStrategy };

export type DesignSystem<
  R extends RegionsRegistry<Ctx, NS>,
  L extends LayoutsRegistry<Ctx, NS>,
  Ctx extends object = EmptyObject,
  NS extends NamingStrategy = NamingStrategy,
> = {
  readonly name: string;
  readonly regions: R;
  readonly layouts: L;

  readonly tokens: (renderCtx: Ctx) => TokenBag;
  readonly policies: DsPolicies;

  readonly uaDependencies: () => readonly h.UaDependency[];
  readonly uaRoutes: () => readonly UaRoute[];
  readonly uaHeadTags: () => RawHtml;

  readonly render: <N extends keyof L>(
    layoutName: N,
    renderCtx: Ctx,
    options: RenderOptionsFor<L[N], Ctx, NS>,
  ) => RawHtml;

  readonly renderPretty: <N extends keyof L>(
    layoutName: N,
    renderCtx: Ctx,
    options: RenderOptionsFor<L[N], Ctx, NS>,
  ) => RawHtml;

  readonly page: <N extends keyof L>(
    layoutName: N,
    renderCtx: Ctx,
    options: PageOptionsFor<L[N], Ctx, NS>,
  ) => RawHtml;
};

export type DsBuilder<
  R extends RegionsRegistry<Ctx, NS>,
  L extends LayoutsRegistry<Ctx, NS>,
  Ctx extends object = EmptyObject,
  NS extends NamingStrategy = NamingStrategy,
> = {
  readonly region: <Def extends RegionDef<string, Any, Ctx, NS>>(
    def: Def,
  ) => DsBuilder<ExtendRegions<R, Def, Ctx, NS>, L, Ctx, NS>;

  readonly layout: <Def extends LayoutDef<string, Any, Ctx, NS>>(
    def: Def,
  ) => DsBuilder<R, ExtendLayouts<L, Def, Ctx, NS>, Ctx, NS>;

  readonly tokens: (
    fn: (renderCtx: Ctx) => TokenBag,
  ) => DsBuilder<R, L, Ctx, NS>;
  readonly policies: (p: DsPolicies) => DsBuilder<R, L, Ctx, NS>;
  readonly uaDependencies: (
    deps: readonly UaDependency[] | (() => readonly UaDependency[]),
  ) => DsBuilder<R, L, Ctx, NS>;

  readonly build: () => DesignSystem<R, L, Ctx, NS>;
};

export function createDesignSystem<
  Ctx extends object = EmptyObject,
  NS extends NamingStrategy = NamingStrategy,
>(
  dsName: string,
  naming: NS,
  // deno-lint-ignore ban-types
): DsBuilder<{}, {}, Ctx, NS> {
  const regions: Record<string, RegionDef<string, Any, Ctx, NS>> = {};
  const layouts: Record<string, LayoutDef<string, Any, Ctx, NS>> = {};

  let tokenFn: (renderCtx: Ctx) => TokenBag = () => ({});
  let pol: DsPolicies = {
    wrappers: { enabled: true, wrapperTag: "section" },
    dev: { unknownSlotMode: "throw" },
  };
  let uaDepsFn: () => readonly UaDependency[] = () => [];

  const builder: DsBuilder<Any, Any, Ctx, NS> = {
    region(def) {
      regions[def.name] = def;
      return builder;
    },
    layout(def) {
      layouts[def.name] = def;
      return builder;
    },
    tokens(fn) {
      tokenFn = fn;
      return builder;
    },
    policies(p) {
      pol = {
        ...pol,
        ...p,
        wrappers: { ...pol.wrappers, ...p.wrappers },
        dev: { ...pol.dev, ...p.dev },
      };
      return builder;
    },
    uaDependencies(deps) {
      uaDepsFn = typeof deps === "function" ? deps : () => deps;
      return builder;
    },
    build() {
      const ds: DesignSystem<Any, Any, Ctx, NS> = {
        name: dsName,
        regions: regions as Any,
        layouts: layouts as Any,
        tokens: tokenFn,
        policies: pol,

        uaDependencies: uaDepsFn,
        uaRoutes: () => uaDepsFn().map(normalizeUaRoute),
        uaHeadTags: () => browserUserAgentHeadTags(uaDepsFn()),

        render: (layoutName, renderCtx, options) =>
          renderInternal(
            dsName,
            regions,
            layouts,
            tokenFn,
            pol,
            naming,
            layoutName as string,
            renderCtx,
            options.slots,
            options.styleAttributeEmitStrategy,
            options.scriptEmitStrategy,
          ),
        renderPretty: (layoutName, renderCtx, options) =>
          renderInternal(
            dsName,
            regions,
            layouts,
            tokenFn,
            pol,
            naming,
            layoutName as string,
            renderCtx,
            options.slots,
            options.styleAttributeEmitStrategy,
            options.scriptEmitStrategy,
          ),
        page: (layoutName, renderCtx, options) =>
          renderPageInternal(
            dsName,
            regions,
            layouts,
            tokenFn,
            pol,
            uaDepsFn,
            naming,
            layoutName as string,
            renderCtx,
            options.slots,
            options.headSlots as
              | Record<string, SlotBuilder<Ctx, NS>>
              | undefined,
            options.styleAttributeEmitStrategy,
            options.scriptEmitStrategy,
          ),
      };

      return ds;
    },
  };

  return builder;
}

/* -----------------------------------------------------------------------------
 * HAST assembly
 * -------------------------------------------------------------------------- */

function combineHast(...parts: RawHtml[]): RawHtml {
  const nodes = parts.flatMap((p) => p.__nodes ?? []);
  const raw = parts.map((p) => p.__rawHtml).join("");
  return { __rawHtml: raw, __nodes: nodes };
}

function renderInternal<Ctx extends object, NS extends NamingStrategy>(
  dsName: string,
  regions: Record<string, RegionDef<string, Any, Ctx, NS>>,
  layouts: Record<string, LayoutDef<string, Any, Ctx, NS>>,
  tokensFn: (renderCtx: Ctx) => TokenBag,
  policy: DsPolicies,
  naming: NS,
  layoutName: string,
  renderCtx: Ctx,
  layoutSlots: Record<string, SlotBuilder<Ctx, NS>>,
  styleAttributeEmitStrategy?: StyleAttributeEmitStrategy,
  scriptEmitStrategy?: ScriptEmitStrategy,
): RawHtml {
  if (policy.rawPolicy) h.setRawPolicy(policy.rawPolicy);

  const trace: TraceSink = (ev) => policy.onTrace?.(ev);

  const ctxBaseFields: RenderCtxBase<NS> = {
    ds: dsName,
    layout: layoutName,
    region: undefined,
    component: undefined,
    naming,
    tokens: tokensFn(renderCtx),
    html: h,
    attrs: h.attrs,
    cls: makeClassNames(naming, "layout"),
    css: h.styleText,
    componentStyles: createComponentStyleRegistry(naming),
    scripts: createScriptRegistry(),
    trace,
    policy,
  };

  const ctxBase: RenderCtx<Ctx, NS> = { ...renderCtx, ...ctxBaseFields };

  const api: DsApi<Any, Any, Ctx, NS> = {
    region: (name: string, slots: Any) =>
      invokeRegion(regions, ctxBase, name, slots),
    layout: (name: string, slots: Any, ctxOverrides?: Partial<Ctx>) => {
      const subRenderCtx = { ...renderCtx, ...(ctxOverrides ?? {}) };
      const subCtx: RenderCtx<Ctx, NS> = {
        ...subRenderCtx,
        ...ctxBaseFields,
        tokens: tokensFn(subRenderCtx),
        layout: name,
        region: undefined,
        component: undefined,
        cls: makeClassNames(naming, "layout"),
      };
      return invokeLayout(layouts, subCtx, api, name, slots);
    },
  };

  const raw = invokeLayout(
    layouts,
    ctxBase,
    api,
    layoutName,
    layoutSlots,
  );

  const styled = emitStyleAttributeCss(
    raw,
    styleAttributeEmitStrategy,
    ctxBase.componentStyles.cssText(),
  );
  const { inlineScripts } = planScriptEmissions(
    dsName,
    ctxBase.scripts.entries(),
    scriptEmitStrategy,
  );
  return inlineScripts.length > 0
    ? combineHast(styled, ...inlineScripts)
    : styled;
}

function renderPageInternal<Ctx extends object, NS extends NamingStrategy>(
  dsName: string,
  regions: Record<string, RegionDef<string, Any, Ctx, NS>>,
  layouts: Record<string, LayoutDef<string, Any, Ctx, NS>>,
  tokensFn: (renderCtx: Ctx) => TokenBag,
  policy: DsPolicies,
  uaDepsFn: () => readonly UaDependency[],
  naming: NS,
  layoutName: string,
  renderCtx: Ctx,
  layoutSlots: Record<string, SlotBuilder<Ctx, NS>>,
  headSlotsIn: Record<string, SlotBuilder<Ctx, NS>> | undefined,
  styleAttributeEmitStrategy?: StyleAttributeEmitStrategy,
  scriptEmitStrategy?: ScriptEmitStrategy,
): RawHtml {
  if (policy.rawPolicy) h.setRawPolicy(policy.rawPolicy);

  const trace: TraceSink = (ev) => policy.onTrace?.(ev);

  const ctxBaseFields: RenderCtxBase<NS> = {
    ds: dsName,
    layout: layoutName,
    region: undefined,
    component: undefined,
    naming,
    tokens: tokensFn(renderCtx),
    html: h,
    attrs: h.attrs,
    cls: makeClassNames(naming, "layout"),
    css: h.styleText,
    componentStyles: createComponentStyleRegistry(naming),
    scripts: createScriptRegistry(),
    trace,
    policy,
  };

  const ctxBase: RenderCtx<Ctx, NS> = { ...renderCtx, ...ctxBaseFields };

  const api: DsApi<Any, Any, Ctx, NS> = {
    region: (name: string, slots: Any) =>
      invokeRegion(regions, ctxBase, name, slots),
    layout: (name: string, slots: Any, ctxOverrides?: Partial<Ctx>) => {
      const subRenderCtx = { ...renderCtx, ...(ctxOverrides ?? {}) };
      const subCtx: RenderCtx<Ctx, NS> = {
        ...subRenderCtx,
        ...ctxBaseFields,
        tokens: tokensFn(subRenderCtx),
        layout: name,
        region: undefined,
        component: undefined,
        cls: makeClassNames(naming, "layout"),
      };
      return invokeLayout(layouts, subCtx, api, name, slots);
    },
  };

  const def = layouts[layoutName];
  if (!def) throw new Error(`fluent-ds: unknown layout "${layoutName}"`);

  const baseDeps = uaDepsFn();
  const headChildren: RawHtml[] = [];

  if (def.headSlots) {
    const normalized = normalizeAndValidateSlots(
      ctxBase,
      "layout",
      `${layoutName}.head`,
      def.headSlots,
      headSlotsIn ?? ({} as Record<string, SlotBuilder<Ctx, NS>>),
    );

    const orderedKeys = [...def.headSlots.required, ...def.headSlots.optional];
    for (const key of orderedKeys) {
      const slot = normalized[key];
      if (!slot) continue;
      const rendered = slot(ctxBase);
      headChildren.push(key === "title" ? h.title(rendered) : rendered);
    }
  } else if (headSlotsIn && Object.keys(headSlotsIn).length > 0) {
    throw new Error(
      `fluent-ds: head slots provided for layout "${layoutName}" but none are declared`,
    );
  }

  const bodyRaw = invokeLayout(layouts, ctxBase, api, layoutName, layoutSlots);
  const { html: body, cssText } = collectStyleAttributeCss(
    bodyRaw,
    styleAttributeEmitStrategy,
    ["body"],
    ctxBase.componentStyles.cssText(),
  );
  const scriptPlan = planScriptEmissions(
    dsName,
    ctxBase.scripts.entries(),
    scriptEmitStrategy,
  );
  if (cssText && styleAttributeEmitStrategy === "head") {
    headChildren.unshift(h.style(cssText));
  }
  if (scriptPlan.headScripts.length > 0) {
    headChildren.push(...scriptPlan.headScripts);
  }

  const cssDeps = cssText && styleAttributeEmitStrategy === "ua-dep"
    ? [
      h.uaDepCssContent(styleAttributeCssMountPoint(dsName), cssText, {
        emit: "link",
      }),
    ]
    : [];
  const uaDeps = [...baseDeps, ...cssDeps, ...scriptPlan.uaDeps];
  if (uaDeps.length > 0) {
    headChildren.unshift(browserUserAgentHeadTags(uaDeps));
  }

  const bodyWithScripts = scriptPlan.bodyScripts.length > 0
    ? combineHast(body, ...scriptPlan.bodyScripts)
    : body;
  const page = h.html(
    h.head(...headChildren),
    h.body(bodyWithScripts),
  );
  const doc = h.doctype();

  return combineHast(doc, page);
}

function styleAttributeCssMountPoint(dsName: string): string {
  const safe = dsName.replace(/[^a-zA-Z0-9_-]+/g, "-").replaceAll("--", "-");
  return `/_ua/${safe}/inline.css`;
}

function createComponentStyleRegistry(
  naming: NamingStrategy,
): ComponentStyleRegistry {
  const stylesByComponent = new Map<string, ComponentStylesheets>();
  return {
    register: (componentName, stylesheets) => {
      if (stylesheets.length === 0) return;
      if (!stylesByComponent.has(componentName)) {
        stylesByComponent.set(componentName, stylesheets);
      }
    },
    cssText: () => {
      if (stylesByComponent.size === 0) return "";
      const rules: string[] = [];
      const seenRules = new Set<string>();
      for (const stylesheets of stylesByComponent.values()) {
        for (const stylesheet of stylesheets) {
          for (const [classToken, style] of Object.entries(stylesheet)) {
            const ruleBody = h.styleText(style);
            if (!ruleBody) continue;
            const selector = `.${naming.className(classToken, "component")}`;
            const rule = `${selector} { ${ruleBody} }`;
            if (!seenRules.has(rule)) {
              seenRules.add(rule);
              rules.push(rule);
            }
          }
        }
      }
      return rules.join("\n");
    },
  };
}

function normalizeScriptContributions(
  scripts:
    | ScriptContributions
    | ScriptContribution
    | RawHtml
    | string
    | undefined,
): ScriptContributions {
  if (!scripts) return [];
  if (Array.isArray(scripts)) return scripts;
  if (typeof scripts === "string") return [{ code: scripts }];
  if (typeof scripts === "object" && "__rawHtml" in scripts) {
    return [{ code: scripts as RawHtml }];
  }
  return [scripts as ScriptContribution];
}

function resolveScriptContributions<
  Ctx extends object,
  NS extends NamingStrategy,
>(
  scripts:
    | ScriptContributionsDef<Ctx, NS>
    | ScriptContribution
    | RawHtml
    | string
    | undefined,
  ctx: RenderCtx<Ctx, NS>,
): ScriptContributions {
  if (!scripts) return [];
  if (typeof scripts === "function") {
    return normalizeScriptContributions(scripts(ctx));
  }
  return normalizeScriptContributions(scripts);
}

function registerScriptContributions<
  Ctx extends object,
  NS extends NamingStrategy,
>(
  ctx: RenderCtx<Ctx, NS>,
  ownerKind: ScriptOwnerKind,
  ownerName: string,
  scripts:
    | ScriptContributionsDef<Ctx, NS>
    | ScriptContribution
    | RawHtml
    | string
    | undefined,
): void {
  const resolved = resolveScriptContributions(scripts, ctx);
  if (resolved.length === 0) return;
  ctx.scripts.register(ownerKind, ownerName, resolved);
}

function createScriptRegistry(): ScriptRegistry {
  const entries: RegisteredScript[] = [];
  return {
    register: (ownerKind, ownerName, scripts) => {
      const normalized = normalizeScriptContributions(
        scripts as
          | ScriptContributions
          | ScriptContribution
          | RawHtml
          | string,
      );
      if (normalized.length === 0) return;
      for (const contribution of normalized) {
        entries.push({ ownerKind, ownerName, contribution });
      }
    },
    entries: () => entries,
  };
}

function scriptAttributeMountPoint(
  dsName: string,
  kind: "script" | "module",
): string {
  const safe = dsName.replace(/[^a-zA-Z0-9_-]+/g, "-").replaceAll("--", "-");
  return `/_ua/${safe}/inline.${kind}.js`;
}

function hashText(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

function scriptText(code: RawHtml | string): string {
  return typeof code === "string" ? code : code.__rawHtml;
}

function scriptTag(contribution: ScriptContribution): RawHtml {
  const hints = contribution.hints ?? {};
  const attrs: h.Attrs = { ...(hints.attrs ?? {}) };
  if (hints.as === "module") attrs.type = "module";
  if (typeof contribution.code === "string") {
    return h.scriptJs(contribution.code, attrs);
  }
  return h.script(attrs, contribution.code);
}

function scriptIdentityKey(
  contribution: ScriptContribution,
  decision: ScriptEmitDecision,
): string | undefined {
  const identity = decision.identity ?? contribution.hints?.identity;
  if (!identity || identity.kind === "none") return undefined;
  if (identity.kind === "name") return `name:${identity.value}`;
  if (identity.kind === "hash") {
    return `hash:${hashText(scriptText(contribution.code))}`;
  }
  return undefined;
}

function planScriptEmissions(
  dsName: string,
  entries: readonly RegisteredScript[],
  strategy?: ScriptEmitStrategy,
): {
  readonly headScripts: RawHtml[];
  readonly bodyScripts: RawHtml[];
  readonly inlineScripts: RawHtml[];
  readonly uaDeps: UaDependency[];
} {
  if (!strategy || strategy.mode === "skip") {
    return { headScripts: [], bodyScripts: [], inlineScripts: [], uaDeps: [] };
  }

  const mode = strategy.mode ?? "hints";
  const headScripts: RawHtml[] = [];
  const bodyScripts: RawHtml[] = [];
  const inlineScripts: RawHtml[] = [];
  const uaDeps: UaDependency[] = [];
  const seen = new Set<string>();

  const uaDepTextByKind = new Map<"script" | "module", string[]>();

  for (const entry of entries) {
    const hints = entry.contribution.hints ?? {};
    const baseDecision: ScriptEmitDecision = {
      placement: hints.placement ?? strategy.placement ?? "body-end",
      emit: hints.emit ?? "inline",
      identity: hints.identity,
    };
    let modeDecision: ScriptEmitDecision;
    if (mode === "inline") {
      modeDecision = { ...baseDecision, emit: "inline" };
    } else if (mode === "ua-dep") {
      modeDecision = { ...baseDecision, emit: "ua-dep" };
    } else {
      modeDecision = baseDecision;
    }
    const decision = strategy.resolve
      ? { ...modeDecision, ...strategy.resolve(entry) }
      : modeDecision;
    if (!decision.emit || decision.emit === "skip") continue;

    const identityKey = scriptIdentityKey(entry.contribution, decision);
    if (identityKey) {
      if (seen.has(identityKey)) continue;
      seen.add(identityKey);
    }

    if (decision.emit === "ua-dep") {
      const as = hints.as ?? "script";
      const list = uaDepTextByKind.get(as) ?? [];
      list.push(scriptText(entry.contribution.code));
      uaDepTextByKind.set(as, list);
      continue;
    }

    const scriptNode = scriptTag(entry.contribution);
    if (decision.placement === "head") headScripts.push(scriptNode);
    else bodyScripts.push(scriptNode);
    inlineScripts.push(scriptNode);
  }

  for (const [as, parts] of uaDepTextByKind.entries()) {
    const content = parts.join("\n");
    if (!content) continue;
    uaDeps.push(
      h.uaDepJsContent(scriptAttributeMountPoint(dsName, as), content, {
        emit: "link",
        as,
      }),
    );
  }

  return { headScripts, bodyScripts, inlineScripts, uaDeps };
}

function invokeLayout<Ctx extends object, NS extends NamingStrategy>(
  layouts: Record<string, LayoutDef<string, Any, Ctx, NS>>,
  ctx: RenderCtx<Ctx, NS>,
  api: DsApi<Any, Any, Ctx, NS>,
  layoutName: string,
  slotsIn: Record<string, SlotBuilder<Ctx, NS>>,
): RawHtml {
  const def = layouts[layoutName];
  if (!def) throw new Error(`fluent-ds: unknown layout "${layoutName}"`);

  const layoutCtx: RenderCtx<Ctx, NS> = {
    ...ctx,
    layout: layoutName,
    region: undefined,
    component: undefined,
    cls: makeClassNames(ctx.naming, "layout"),
  };
  layoutCtx.trace({
    kind: "layout",
    name: layoutName,
    elementId: ctx.naming.elemIdValue(layoutName, "layout"),
    className: ctx.naming.className(layoutName, "layout"),
    phase: "enter",
  });

  registerScriptContributions(layoutCtx, "layout", layoutName, def.scripts);

  const slots = normalizeAndValidateSlots(
    layoutCtx,
    "layout",
    layoutName,
    def.slots,
    slotsIn,
  ) as Any;
  const out = def.render(layoutCtx, api, slots);

  layoutCtx.trace({
    kind: "layout",
    name: layoutName,
    elementId: ctx.naming.elemIdValue(layoutName, "layout"),
    className: ctx.naming.className(layoutName, "layout"),
    phase: "exit",
  });
  return out;
}

function invokeRegion<Ctx extends object, NS extends NamingStrategy>(
  regions: Record<string, RegionDef<string, Any, Ctx, NS>>,
  ctx: RenderCtx<Ctx, NS>,
  regionName: string,
  slotsIn: Record<string, SlotBuilder<Ctx, NS>>,
): RawHtml {
  const def = regions[regionName];
  if (!def) throw new Error(`fluent-ds: unknown region "${regionName}"`);

  const regionCtx: RenderCtx<Ctx, NS> = {
    ...ctx,
    region: regionName,
    component: undefined,
    cls: makeClassNames(ctx.naming, "region"),
  };
  regionCtx.trace({
    kind: "region",
    name: regionName,
    elementId: ctx.naming.elemIdValue(regionName, "region"),
    className: ctx.naming.className(regionName, "region"),
    phase: "enter",
  });

  registerScriptContributions(regionCtx, "region", regionName, def.scripts);

  const slots = normalizeAndValidateSlots(
    regionCtx,
    "region",
    regionName,
    def.slots,
    slotsIn,
  ) as Any;
  const inner = def.render(regionCtx, slots);
  const wrapped = wrapRegion(regionCtx, inner);

  regionCtx.trace({
    kind: "region",
    name: regionName,
    elementId: ctx.naming.elemIdValue(regionName, "region"),
    className: ctx.naming.className(regionName, "region"),
    phase: "exit",
  });
  return wrapped;
}

function normalizeAndValidateSlots<
  Ctx extends object,
  NS extends NamingStrategy,
>(
  ctx: RenderCtx<Ctx, NS>,
  kind: "layout" | "region",
  name: string,
  spec: SlotSpec<string, string>,
  slotsIn: Record<string, SlotBuilder<Ctx, NS>>,
): Record<string, SlotBuilder<Ctx, NS>> {
  const required = new Set(spec.required);
  const optional = new Set(spec.optional);
  const allowed = new Set<string>([...required, ...optional]);

  const out: Record<string, SlotBuilder<Ctx, NS>> = {};

  for (const r of required) {
    const b = slotsIn[r];
    if (!b) {
      throw new Error(
        `fluent-ds: missing required ${kind} slot "${name}.${r}"`,
      );
    }
    out[r] = b;
  }

  for (const o of optional) {
    const b = slotsIn[o];
    if (b) out[o] = b;
  }

  const unknown = Object.keys(slotsIn).filter((k) => !allowed.has(k));
  if (
    unknown.length > 0 &&
    (ctx.policy.dev?.unknownSlotMode ?? "throw") === "throw"
  ) {
    throw new Error(
      `fluent-ds: unknown ${kind} slot(s) for "${name}": ${unknown.join(", ")}`,
    );
  }

  return out;
}

function wrapRegion<Ctx extends object, NS extends NamingStrategy>(
  ctx: RenderCtx<Ctx, NS>,
  inner: RawHtml,
): RawHtml {
  const w = ctx.policy.wrappers ?? { enabled: true, wrapperTag: "section" };
  if (w.enabled === false) return inner;

  const tag = w.wrapperTag ?? "section";

  const kind: NamingKind = ctx.region ? "region" : "layout";
  const elementId = ctx.naming.elemIdValue(
    ctx.region ?? ctx.layout,
    kind,
  );

  const a: h.Attrs = {
    [ctx.naming.elemDataAttr("ds", ctx.ds, kind)]: ctx.ds,
    [ctx.naming.elemDataAttr("layout", ctx.layout, kind)]: ctx.naming.className(
      ctx.layout,
      "layout",
    ),
    [ctx.naming.elemDataAttr("region", ctx.region ?? "", kind)]: ctx.region
      ? ctx.naming.className(ctx.region, "region")
      : "",
    [ctx.naming.elemDataAttr("element-id", elementId, kind)]: elementId,
  };

  const renderCtx = ctx as Record<string, unknown>;
  for (const key of ["bp", "theme", "density", "mode"]) {
    const value = renderCtx[key];
    if (
      typeof value === "string" || typeof value === "number" ||
      typeof value === "boolean"
    ) {
      a[ctx.naming.elemDataAttr(key, String(value), kind)] = value;
    }
  }

  const wrap = tag === "div" ? h.div : h.section;
  return wrap(a, inner);
}
