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
import type { RawHtml } from "./elements.ts";
import {
  browserUserAgentHeadTags,
  normalizeUaRoute,
  UaDependency,
  UaRoute,
} from "./elements.ts";
import type { Element, RootContent } from "hast";

// deno-lint-ignore no-explicit-any
type Any = any;

type NamingKind = "layout" | "region" | "component" | "css-emit";

export type CssStyleEmitStrategy = "inline" | "class-dep" | "class-style-head";

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
> = (
  ctx: RenderCtx<Ctx, NS>,
  props: Props,
) => RawHtml;

export function defineComponent<
  Props,
  Ctx extends object = EmptyObject,
  NS extends NamingStrategy = NamingStrategy,
>(
  name: string,
  fn: Component<Props, Ctx, NS>,
): Component<Props, Ctx, NS> {
  return (ctx, props) => {
    const componentCtx: RenderCtx<Ctx, NS> = {
      ...ctx,
      component: name,
      cls: makeClassNames(ctx.naming, "component"),
    };
    ctx.trace({
      kind: "component",
      elementId: ctx.naming.elemIdValue(name, "component"),
      className: ctx.naming.className(name, "component"),
      name,
    });
    return fn(componentCtx, props);
  };
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
  readonly cssStyleEmitStrategy?: CssStyleEmitStrategy;
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
  & { readonly cssStyleEmitStrategy?: CssStyleEmitStrategy };

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
            options.cssStyleEmitStrategy,
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
            options.cssStyleEmitStrategy,
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
            options.cssStyleEmitStrategy,
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
  cssStyleEmitStrategy?: CssStyleEmitStrategy,
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

  return applyCssStyleEmitStrategy(raw, cssStyleEmitStrategy);
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
  cssStyleEmitStrategy?: CssStyleEmitStrategy,
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
  const { html: body, cssText } = extractInlineStylesForClassStrategy(
    bodyRaw,
    cssStyleEmitStrategy,
    ["body"],
  );
  if (cssText && cssStyleEmitStrategy === "class-style-head") {
    headChildren.unshift(h.style(cssText));
    headChildren.unshift(browserUserAgentHeadTags(baseDeps));
  } else {
    const uaDeps = cssText && cssStyleEmitStrategy === "class-dep"
      ? [
        ...baseDeps,
        h.uaDepCssContent(cssStyleMountPoint(dsName), cssText, {
          emit: "link",
        }),
      ]
      : baseDeps;
    headChildren.unshift(browserUserAgentHeadTags(uaDeps));
  }

  const page = h.html(
    h.head(...headChildren),
    h.body(body),
  );
  const doc = h.doctype();

  return combineHast(doc, page);
}

type InlineStyleExtraction = {
  readonly html: RawHtml;
  readonly cssText: string;
};

function cssStyleMountPoint(dsName: string): string {
  const safe = dsName.replace(/[^a-zA-Z0-9_-]+/g, "-").replaceAll("--", "-");
  return `/_ua/${safe}/inline.css`;
}

function getElementId(props: Record<string, unknown>): string | undefined {
  const id = props.id ?? props.ID;
  if (typeof id === "string") return id;
  if (typeof id === "number") return String(id);
  return undefined;
}

function getClassTokens(props: Record<string, unknown>): string[] {
  const value = ("class" in props ? props.class : props.className) as unknown;
  if (typeof value === "string") {
    return value.split(/\s+/).filter((t) => t.trim() !== "");
  }
  if (Array.isArray(value)) {
    return value.map((v) => String(v)).filter((t) => t.trim() !== "");
  }
  if (value == null) return [];
  return [String(value)];
}

function extractInlineStylesForClassStrategy(
  raw: RawHtml,
  cssStyleEmitStrategy?: CssStyleEmitStrategy,
  basePath: string[] = [],
): InlineStyleExtraction {
  if (
    (cssStyleEmitStrategy !== "class-dep" &&
      cssStyleEmitStrategy !== "class-style-head") || !raw.__nodes
  ) {
    return { html: raw, cssText: "" };
  }

  const rules: string[] = [];

  const visit = (node: RootContent, path: string[]): void => {
    if (node.type === "element") {
      const element = node as Element;
      const props = (element.properties ??= {}) as Record<string, unknown>;
      const styleText = props.style;
      if (typeof styleText === "string" && styleText.trim() !== "") {
        delete props.style;
        const id = getElementId(props);
        const classTokens = getClassTokens(props);
        const nodeSelector = classTokens.length > 0
          ? `${element.tagName}.${classTokens.join(".")}`
          : element.tagName;
        const cascadeSelector = [...path, nodeSelector].join(" ");

        const selectors: string[] = [];
        if (cascadeSelector) selectors.push(cascadeSelector);
        if (id) selectors.push(`#${id}`);

        const selectorKey = selectors.join(", ");
        const ruleBody = styleText.trim().endsWith(";")
          ? styleText.trim()
          : `${styleText.trim()};`;
        rules.push(`${selectorKey} { ${ruleBody} }`);
      }
      const classTokens = getClassTokens(props);
      const nodeSelector = classTokens.length > 0
        ? `${element.tagName}.${classTokens.join(".")}`
        : element.tagName;
      const nextPath = [...path, nodeSelector];
      if ("children" in node && Array.isArray(node.children)) {
        for (const child of node.children) {
          visit(child as RootContent, nextPath);
        }
      }
      return;
    }
    if ("children" in node && Array.isArray(node.children)) {
      for (const child of node.children) visit(child as RootContent, path);
    }
  };

  for (const node of raw.__nodes) visit(node as RootContent, basePath);

  if (rules.length === 0) return { html: raw, cssText: "" };

  const normalized = h.render(raw);
  return {
    html: { __rawHtml: normalized, __nodes: raw.__nodes },
    cssText: rules.join("\n"),
  };
}

function applyCssStyleEmitStrategy(
  raw: RawHtml,
  cssStyleEmitStrategy?: CssStyleEmitStrategy,
): RawHtml {
  const effective = cssStyleEmitStrategy === "class-dep"
    ? "class-style-head"
    : cssStyleEmitStrategy;
  const { html, cssText } = extractInlineStylesForClassStrategy(
    raw,
    effective,
  );
  if (!cssText) return html;
  return combineHast(h.style(cssText), html);
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
