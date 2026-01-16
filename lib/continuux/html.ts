// lib/continuux/html.ts

export type AttrValue =
  | string
  | number
  | boolean
  | null
  | undefined;

export type Attrs = Record<string, AttrValue>;

export type RawHtml = { readonly __rawHtml: string };

// Structural “DOM Node” shape, safe to reference without lib=dom.
export type DomNodeLike = { readonly nodeType: number };

// Builder support (usable anywhere a child can appear)
export type ChildAdder = (...children: Child[]) => void;
export type ChildBuilder = (e: ChildAdder) => void;

// A "Child" is recursive and can include builder functions.
export type Child =
  | string
  | number
  | boolean
  | null
  | undefined
  | RawHtml
  | DomNodeLike
  | Child[]
  | ChildBuilder;

// Optional dev-time raw policy (defaults to permissive)
export type RawPolicy = {
  mode?: "permissive" | "dev-strict";
};

let rawPolicy: RawPolicy = { mode: "permissive" };

export function setRawPolicy(policy: RawPolicy): void {
  rawPolicy = { ...rawPolicy, ...policy };
}

const isDev = (): boolean => {
  const deno = (globalThis as unknown as {
    Deno?: { env?: { get?: (k: string) => string | undefined } };
  }).Deno;
  const env = deno?.env?.get?.("DENO_ENV");
  return env !== "production";
};

export function raw(html: string): RawHtml {
  if (rawPolicy.mode === "dev-strict" && isDev()) {
    throw new Error(
      `raw() is disabled in dev-strict mode. Use trustedRaw(...) or setRawPolicy({ mode: "permissive" }).`,
    );
  }
  return { __rawHtml: html };
}

export function trustedRaw(html: string, _hint?: string): RawHtml {
  return { __rawHtml: html };
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function escapeAttr(value: string): string {
  return escapeHtml(value);
}

/**
 * Flattens children into a linear list of (string | RawHtml | DomNodeLike),
 * executing any builder callbacks as it walks the structure.
 *
 * Rules:
 * - null/undefined/false are skipped
 * - true is skipped (use boolean attrs for boolean semantics)
 * - arrays are recursively expanded
 * - builder functions are executed, and whatever they emit is recursively expanded
 * - RawHtml is passed through as-is
 * - DomNodeLike is passed through as-is (endpoint decides what to do)
 * - other primitives become strings
 */
export function flattenChildren(
  children: readonly Child[],
): (string | RawHtml | DomNodeLike)[] {
  const out: (string | RawHtml | DomNodeLike)[] = [];

  const visit = (c: Child): void => {
    if (c == null || c === false) return;

    // Builder callback
    if (typeof c === "function") {
      const emit: ChildAdder = (...xs) => {
        for (const x of xs) visit(x);
      };
      (c as ChildBuilder)(emit);
      return;
    }

    // Nested arrays
    if (Array.isArray(c)) {
      for (const x of c) visit(x);
      return;
    }

    // RawHtml passthrough
    if (typeof c === "object" && c && "__rawHtml" in c) {
      out.push(c as RawHtml);
      return;
    }

    // Skip boolean true as a child
    if (c === true) return;

    out.push(String(c));
  };

  for (const c of children) visit(c);
  return out;
}

export function serializeAttrs(attrs?: Attrs): string {
  if (!attrs) return "";

  const keys = Object.keys(attrs).sort();
  let s = "";
  for (const k of keys) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (v === true) {
      s += ` ${k}`;
      continue;
    }
    s += ` ${k}="${escapeAttr(String(v))}"`;
  }
  return s;
}

// DX helpers shared by server + client

export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  if (value == null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function attrs(
  ...parts: Array<Attrs | null | undefined | false>
): Attrs {
  const out: Attrs = {};
  for (const p of parts) {
    if (!p) continue;
    for (const [k, v] of Object.entries(p)) out[k] = v;
  }
  return out;
}

export type ClassSpec =
  | string
  | null
  | undefined
  | false
  | ClassSpec[]
  | Record<string, boolean>;

export function classNames(...parts: ClassSpec[]): string {
  const out: string[] = [];
  const visit = (p: ClassSpec): void => {
    if (!p) return;
    if (Array.isArray(p)) {
      for (const x of p) visit(x);
      return;
    }
    if (typeof p === "object") {
      for (const [k, v] of Object.entries(p)) if (v) out.push(k);
      return;
    }
    const s = String(p).trim();
    if (s) out.push(s);
  };
  for (const p of parts) visit(p);
  return out.join(" ");
}

export const cls = classNames;

export function styleText(
  style: Record<string, string | number | null | undefined | false>,
): string {
  const toKebab = (s: string) =>
    s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

  const keys = Object.keys(style).sort();
  let s = "";
  for (const k of keys) {
    const v = style[k];
    if (v == null || v === false) continue;
    s += `${toKebab(k)}:${String(v)};`;
  }
  return s;
}

export const css = styleText;

// Explicit wrapper for readability in call sites.
export function children(builder: ChildBuilder): ChildBuilder {
  return builder;
}

export function each<T>(
  items: Iterable<T>,
  fn: (item: T, index: number) => Child,
): ChildBuilder {
  return (e) => {
    let i = 0;
    for (const it of items) e(fn(it, i++));
  };
}

// Minimal explicit type to satisfy "public API must have explicit type"
export type TagFn = (
  attrsOrChild?: Attrs | Child,
  ...children: Child[]
) => RawHtml;

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
  const flat = flattenChildren(children);

  let inner = "";
  for (const c of flat) {
    if (typeof c === "string") {
      inner += escapeHtml(c);
      continue;
    }

    if (typeof c === "object" && c && "__rawHtml" in c) {
      inner += (c as RawHtml).__rawHtml;
      continue;
    }

    throw new Error("Fluent server error: unsupported child type.");
  }

  if (isVoidElement(tag)) return trustedRaw(`<${tag}${attrText}>`);
  return trustedRaw(`<${tag}${attrText}>${inner}</${tag}>`);
};

const tag = (name: string): TagFn => (...args: unknown[]) =>
  el(name, ...(args as never[]));

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

// Type-safe custom element tag helper (server)
export const customElement = (name: `${string}-${string}`): TagFn => tag(name);

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
