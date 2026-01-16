// lib/html/server/fluent.ts
//
// Server-side fluent HTML builder.
// - Juniors use named tag functions only (we do NOT export el)
// - Deterministic attribute ordering
// - Safe-by-default text escaping; explicit raw()/trustedRaw() for opt-in HTML injection
// - Supports imperative child builders anywhere in children lists
// - Hypermedia helpers emit an attribute vocabulary and headers that our own
//   dependency-free browser runtime understands.

import {
  type Attrs,
  attrs as mergeAttrs,
  type AttrValue,
  type Child,
  children as childrenFn,
  classNames,
  each as eachFn,
  escapeHtml,
  flattenChildren,
  isPlainObject,
  raw,
  type RawHtml,
  serializeAttrs,
  styleText,
  trustedRaw,
} from "../shared.ts";

export { raw, trustedRaw };
export type { Attrs, AttrValue, Child, RawHtml };

export const attrs = mergeAttrs;
export const cls = classNames;
export const css = styleText;
export const children = childrenFn;
export const each = eachFn;

// Minimal explicit type to satisfy "public API must have explicit type"
export type TagFn = (
  attrsOrChild?: Attrs | Child,
  ...children: Child[]
) => RawHtml;

// Internal primitive, intentionally not exported.
const el = (tag: string, ...args: unknown[]) => {
  let attrs: Attrs | undefined;
  let children: Child[];

  if (args.length > 0 && isAttrs(args[0])) {
    attrs = args[0] as Attrs;
    children = args.slice(1) as Child[];
  } else {
    children = args as Child[];
  }

  const attrText = serializeAttrs(attrs);

  // flattenChildren() executes ChildBuilder callbacks anywhere in the tree
  const flat = flattenChildren(children);

  let inner = "";
  for (const c of flat) {
    if (typeof c === "string") inner += escapeHtml(c);
    else inner += c.__rawHtml;
  }

  if (isVoidElement(tag)) return trustedRaw(`<${tag}${attrText}>`);
  return trustedRaw(`<${tag}${attrText}>${inner}</${tag}>`);
};

const tag = (name: string): TagFn => (...args: unknown[]) =>
  el(name, ...(args as never[]));

const isAttrs = (v: unknown): v is Attrs => {
  if (!isPlainObject(v)) return false;
  if ("__rawHtml" in (v as Record<string, unknown>)) return false;
  return true;
};

const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

const isVoidElement = (t: string) => VOID_ELEMENTS.has(t.toLowerCase());

// Convenience primitives
export const doctype: () => RawHtml = () => trustedRaw("<!doctype html>");
export const comment: (s: string) => RawHtml = (s) =>
  trustedRaw(`<!--${escapeHtml(s)}-->`);

// Render helper for HTTP responses and tests
export const render: (...parts: Array<string | RawHtml>) => string = (
  ...parts
) => parts.map((p) => (typeof p === "string" ? p : p.__rawHtml)).join("");

// Safer script/style helpers
export const scriptJs: (code: string, attrs?: Attrs) => RawHtml = (
  code,
  attrs,
) => script(attrs ?? {}, trustedRaw(code));

export const styleCss: (cssText: string, attrs?: Attrs) => RawHtml = (
  cssText,
  attrs,
) => style(attrs ?? {}, trustedRaw(cssText));

// Hypermedia helpers (attribute vocabulary + headers)
// This is implemented by our dependency-free browser runtime.
const q = (s: string) => JSON.stringify(s);
const actionExpr = (name: string, uri: string) => `@${name}(${q(uri)})`;
const on = (eventName: string, expr: string) => ({
  [`data-on:${eventName}`]: expr,
});

export const JunxionUX = {
  on,

  get: (uri: string) => actionExpr("get", uri),
  post: (uri: string) => actionExpr("post", uri),
  put: (uri: string) => actionExpr("put", uri),
  patch: (uri: string) => actionExpr("patch", uri),
  delete: (uri: string) => actionExpr("delete", uri),

  clickGet: (uri: string) => on("click", actionExpr("get", uri)),
  clickPost: (uri: string) => on("click", actionExpr("post", uri)),
  loadGet: (uri: string) => on("load", actionExpr("get", uri)),

  signals: (obj: Record<string, unknown>) => ({
    "data-signals": JSON.stringify(obj),
  }),

  bind: (path: string) => ({
    [`data-bind:${path}`]: "",
  }),

  headers: {
    selector: "datastar-selector",
    mode: "datastar-mode",
    useViewTransition: "datastar-use-view-transition",
    onlyIfMissing: "datastar-only-if-missing",
    request: "Datastar-Request",
  },
} as const;

// Full HTML tag set as named exports (no el export)
export const a: TagFn = tag("a");
export const abbr: TagFn = tag("abbr");
export const address: TagFn = tag("address");
export const area: TagFn = tag("area");
export const article: TagFn = tag("article");
export const aside: TagFn = tag("aside");
export const audio: TagFn = tag("audio");
export const b: TagFn = tag("b");
export const base: TagFn = tag("base");
export const bdi: TagFn = tag("bdi");
export const bdo: TagFn = tag("bdo");
export const blockquote: TagFn = tag("blockquote");
export const body: TagFn = tag("body");
export const br: TagFn = tag("br");
export const button: TagFn = tag("button");
export const canvas: TagFn = tag("canvas");
export const caption: TagFn = tag("caption");
export const cite: TagFn = tag("cite");
export const codeTag: TagFn = tag("code");
export const col: TagFn = tag("col");
export const colgroup: TagFn = tag("colgroup");
export const data: TagFn = tag("data");
export const datalist: TagFn = tag("datalist");
export const dd: TagFn = tag("dd");
export const del: TagFn = tag("del");
export const details: TagFn = tag("details");
export const dfn: TagFn = tag("dfn");
export const dialog: TagFn = tag("dialog");
export const div: TagFn = tag("div");
export const dl: TagFn = tag("dl");
export const dt: TagFn = tag("dt");
export const em: TagFn = tag("em");
export const embed: TagFn = tag("embed");
export const fieldset: TagFn = tag("fieldset");
export const figcaption: TagFn = tag("figcaption");
export const figure: TagFn = tag("figure");
export const footer: TagFn = tag("footer");
export const form: TagFn = tag("form");
export const h1: TagFn = tag("h1");
export const h2: TagFn = tag("h2");
export const h3: TagFn = tag("h3");
export const h4: TagFn = tag("h4");
export const h5: TagFn = tag("h5");
export const h6: TagFn = tag("h6");
export const head: TagFn = tag("head");
export const header: TagFn = tag("header");
export const hgroup: TagFn = tag("hgroup");
export const hr: TagFn = tag("hr");
export const html: TagFn = tag("html");
export const i: TagFn = tag("i");
export const iframe: TagFn = tag("iframe");
export const img: TagFn = tag("img");
export const input: TagFn = tag("input");
export const ins: TagFn = tag("ins");
export const kbd: TagFn = tag("kbd");
export const label: TagFn = tag("label");
export const legend: TagFn = tag("legend");
export const li: TagFn = tag("li");
export const link: TagFn = tag("link");
export const main: TagFn = tag("main");
export const map: TagFn = tag("map");
export const mark: TagFn = tag("mark");
export const menu: TagFn = tag("menu");
export const meta: TagFn = tag("meta");
export const meter: TagFn = tag("meter");
export const nav: TagFn = tag("nav");
export const noscript: TagFn = tag("noscript");
export const object: TagFn = tag("object");
export const ol: TagFn = tag("ol");
export const optgroup: TagFn = tag("optgroup");
export const option: TagFn = tag("option");
export const output: TagFn = tag("output");
export const p: TagFn = tag("p");
export const param: TagFn = tag("param");
export const picture: TagFn = tag("picture");
export const pre: TagFn = tag("pre");
export const progress: TagFn = tag("progress");
export const qTag: TagFn = tag("q");
export const rp: TagFn = tag("rp");
export const rt: TagFn = tag("rt");
export const ruby: TagFn = tag("ruby");
export const s: TagFn = tag("s");
export const samp: TagFn = tag("samp");
export const script: TagFn = tag("script");
export const search: TagFn = tag("search");
export const section: TagFn = tag("section");
export const select: TagFn = tag("select");
export const slot: TagFn = tag("slot");
export const small: TagFn = tag("small");
export const source: TagFn = tag("source");
export const span: TagFn = tag("span");
export const strong: TagFn = tag("strong");
export const style: TagFn = tag("style");
export const sub: TagFn = tag("sub");
export const summary: TagFn = tag("summary");
export const sup: TagFn = tag("sup");
export const table: TagFn = tag("table");
export const tbody: TagFn = tag("tbody");
export const td: TagFn = tag("td");
export const template: TagFn = tag("template");
export const textarea: TagFn = tag("textarea");
export const tfoot: TagFn = tag("tfoot");
export const th: TagFn = tag("th");
export const thead: TagFn = tag("thead");
export const time: TagFn = tag("time");
export const title: TagFn = tag("title");
export const tr: TagFn = tag("tr");
export const track: TagFn = tag("track");
export const u: TagFn = tag("u");
export const ul: TagFn = tag("ul");
export const varTag: TagFn = tag("var");
export const video: TagFn = tag("video");
export const wbr: TagFn = tag("wbr");
