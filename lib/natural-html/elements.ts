/**
 * @module lib/natural-html/elements.ts
 *
 * Natural HTML is a tiny, functional HTML authoring library for TypeScript.
 * It is “natural” in the sense that developers who are fluent with functions can
 * write HTML, page chrome, and design-system primitives as composable functions
 * without JSX, template strings, or a runtime DOM.
 *
 * The core design goal is deterministic, inspectable HTML generation that stays
 * compatible with the broader syntax-tree ecosystem. Natural HTML builds a
 * HAST (Hypertext AST) tree and serializes it to HTML, rather than concatenating
 * strings. The AST emitted by this module is strictly HAST-compliant
 * (root/element/text/comment/doctype only), so downstream unified / syntax-tree
 * tooling can process the output cleanly.
 *
 * This module is intended as the foundation for Natural Design System (Natural DS),
 * where layouts and regions call into Natural HTML to generate HTML consistently.
 *
 * Major features
 *
 * 1) Typed tag API
 * - Named exports for the full HTML tag set: `div(...)`, `head(...)`, `a(...)`, etc.
 * - `customElement("my-tag")` for type-safe custom elements.
 * - Void-element handling: void tags never accept children.
 *
 * 2) Safe-by-default children model
 * - Plain strings and numbers become HAST `text` nodes and are escaped by the serializer.
 * - `null` / `undefined` / `false` children are skipped.
 * - `true` is skipped (use boolean attributes instead).
 * - Arrays are flattened.
 * - Builder callbacks (`ChildBuilder`) may emit children during flattening.
 *
 * 3) Deterministic output
 * - Attribute keys are sorted before emission for stable HTML.
 * - `render()` emits minimized HTML directly from HAST.
 * - `renderPretty()` formats the HAST tree (via `hast-util-format`) before serializing.
 * - No “stringify then parse” loop for ordinary element construction.
 *
 * 4) Raw and trusted content (two distinct use cases)
 *
 * Markup insertion (parsed as HTML):
 * - `trustedRaw(html)`: parses trusted markup into real HAST nodes (fragment mode),
 *   and splices those nodes into the tree. This keeps the AST strictly HAST-compliant
 *   (no semistandard `raw` nodes).
 * - `raw(html)`: same behavior but can be blocked in dev/test by `setRawPolicy({ mode: "dev-strict" })`
 *   to catch accidental raw insertion.
 *
 * Literal text blocks (NOT parsed as HTML):
 * - `trustedRawFriendly\`...\`` (alias: `javaScript`): for multiline code/text blocks that must
 *   remain literal. This is intended for inline `<script>` and `<style>` bodies, where parsing
 *   as HTML would corrupt valid JS/CSS. Output is HAST `text` nodes.
 * - `scriptJs(code)` and `styleCss(cssText)` always embed content as text nodes (never parsed).
 *
 * 5) Composition helpers
 * - `attrs(...)` to merge attribute objects.
 * - `classNames(...)` / `cls(...)` to build class strings.
 * - `styleText(...)` / `css(...)` to build deterministic inline style strings.
 * - `each(iterable, fn)` to build children from iterables with index support.
 * - `children(builder)` to author complex child trees with an emitter callback.
 *
 * 6) Minimal DOM interop contract
 * - `DomNodeLike` exists as a structural type (`{ nodeType: number }`) to avoid `lib=dom` coupling.
 *   Server rendering does not accept DOM nodes as children; if a DOM node slips through, an error is thrown.
 *
 * UA Dependencies (design system “user agent dependencies”)
 *
 * Natural HTML includes a small convention for describing “user agent dependencies” (UA deps):
 * external or inline resources that a design system needs in the browser/user agent
 * (CSS, JavaScript modules, SVGs, fonts, etc.).
 *
 * UA deps are declared as data so the server can:
 * - create routes to serve them (mountPoint routing)
 * - apply correct MIME types and headers
 * - control caching, ETag policy, and CORS if needed
 * - emit the corresponding `<link>` / `<script>` tags into `<head>`
 *
 * Key types and helpers:
 * - `UaDependency`: either a `reference` (served from a canonical source URL/path) or `content` (inlined payload).
 * - `uaDepCssRef(...)`, `uaDepJsRef(...)`: create reference deps.
 * - `uaDepCssContent(...)`, `uaDepJsContent(...)`: create inline deps.
 * - `normalizeUaRoute(dep)`: computes a normalized `as` classification used for HTML emission.
 * - `browserUserAgentHeadTags(deps)`: emits appropriate `<link rel="stylesheet">`, `<script>`,
 *   `<script type="module">`, `<link rel="preload">`, or safe inline `<style>/<script>` tags.
 *
 * Usage sketch
 *
 * ```ts
 * import * as h from "./natural-html.ts";
 *
 * const deps = [
 *   h.uaDepCssRef("/_natural/app.css", "file:///abs/path/app.css"),
 *   h.uaDepJsRef("/_natural/app.js", "https://cdn.example/app.js", { as: "module" }),
 * ];
 *
 * const page = h.renderPretty(
 *   h.doctype(),
 *   h.html(
 *     h.head(
 *       h.title("Hello"),
 *       h.browserUserAgentHeadTags(deps),
 *     ),
 *     h.body(
 *       h.div({ class: "container" }, "Hello, Natural HTML"),
 *     ),
 *   ),
 * );
 * ```
 *
 * Dependencies
 * - HAST types from `hast`
 * - HTML serialization via `hast-util-to-html`
 * - Pretty formatting via `hast-util-format`
 * - HTML fragment parsing via `hast-util-from-html-isomorphic`
 */
import type {
  Comment,
  Doctype,
  Element,
  ElementContent,
  Properties,
  Root,
  RootContent,
  Text,
} from "hast";
import { toHtml } from "hast-util-to-html";
import { format } from "hast-util-format";
import { fromHtmlIsomorphic } from "hast-util-from-html-isomorphic";

export type AttrValue =
  | string
  | number
  | boolean
  | null
  | undefined;

export type Attrs = Record<string, AttrValue>;

export type RawPolicy = {
  mode?: "permissive" | "dev-strict";
};

let rawPolicy: RawPolicy = { mode: "permissive" };

export function setRawPolicy(policy: RawPolicy): void {
  rawPolicy = { ...rawPolicy, ...policy };
}

/**
 * A safe-to-concatenate HTML wrapper.
 * `__nodes` are HAST nodes (spec-compliant) used by renderers and downstream tooling.
 */
export type RawHtml = {
  readonly __rawHtml: string;
  readonly __nodes?: readonly RootContent[];
};

// Structural “DOM Node” shape, safe to reference without lib=dom.
export type DomNodeLike = { readonly nodeType: number };

// Builder support (usable anywhere a child can appear)
export type ChildAdder = (...children: Child[]) => void;
export type ChildBuilder = (e: ChildAdder) => void;

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

// Kept for compatibility and for serializeAttrs() only.
// Primary escaping is handled by hast-util-to-html.
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

function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  if (value == null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

const isAttrs = (v: unknown): v is Attrs => {
  if (!isPlainObject(v)) return false;
  if ("__rawHtml" in (v as Record<string, unknown>)) return false;
  if ("nodeType" in (v as Record<string, unknown>)) return false;
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

function parseTrustedHtmlToNodes(html: string): readonly RootContent[] {
  const root = fromHtmlIsomorphic(html, { fragment: true }) as Root;
  return root.children;
}

function textNodes(text: string): readonly RootContent[] {
  const n: Text = { type: "text", value: text };
  return [n as unknown as RootContent];
}

/**
 * Minimal text node wrapper (no parsing).
 */
export function text(value: string): RawHtml {
  const nodes = textNodes(value);
  return { __rawHtml: value, __nodes: nodes };
}

/**
 * Trusted HTML insertion: parses markup into HAST nodes (fragment) and stores nodes.
 * This keeps the AST strictly HAST-compliant (no semistandard `raw` nodes).
 */
export function trustedRaw(html: string, _hint?: string): RawHtml {
  const nodes = parseTrustedHtmlToNodes(html);
  const normalized = toHtml({ type: "root", children: [...nodes] } as Root);
  return { __rawHtml: normalized, __nodes: nodes };
}

/**
 * Escape hatch that can be blocked in dev/test by policy.
 * Use for trusted HTML snippets that should be inserted as markup.
 */
export function raw(html: string, hint?: string): RawHtml {
  if (rawPolicy.mode === "dev-strict") {
    const msg = hint
      ? `raw() is blocked by dev-strict policy: ${hint}`
      : "raw() is blocked by dev-strict policy";
    throw new Error(msg);
  }
  return trustedRaw(html, hint);
}

/**
 * Template tag for embedding “as-is” text blocks (JS/CSS/code).
 *
 * The template literal must start with a blank first line. That line is discarded.
 * The remaining lines are dedented by the minimum common leading indentation.
 *
 * Output is HAST `text` nodes (not parsed HTML).
 */
export function trustedRawFriendly(
  strings: TemplateStringsArray,
  ...exprs: unknown[]
): RawHtml {
  let full = strings[0] ?? "";
  for (let i = 0; i < exprs.length; i++) {
    full += String(exprs[i]) + (strings[i + 1] ?? "");
  }

  full = full.replaceAll("\r\n", "\n");
  const lines = full.split("\n");

  if (lines.length === 0 || lines[0].trim() !== "") {
    throw new Error("javaScript() template must start with a blank first line");
  }

  lines.shift();

  while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }

  let minIndent = Infinity;
  for (const line of lines) {
    if (!line.trim()) continue;
    const m = line.match(/^(\s*)/);
    if (m) minIndent = Math.min(minIndent, m[1].length);
  }
  if (!Number.isFinite(minIndent)) minIndent = 0;

  const dedented = lines
    .map((l) => (minIndent > 0 ? l.slice(minIndent) : l))
    .join("\n");

  const nodes = textNodes(dedented);
  const normalized = toHtml({ type: "root", children: [...nodes] } as Root);
  return { __rawHtml: normalized, __nodes: nodes };
}

export const javaScript = trustedRawFriendly;

/**
 * Flattens children into a linear list of (string | RawHtml | DomNodeLike),
 * executing any builder callbacks as it walks the structure.
 */
export function flattenChildren(
  children: readonly Child[],
): (string | RawHtml | DomNodeLike)[] {
  const out: (string | RawHtml | DomNodeLike)[] = [];

  const visit = (c: Child): void => {
    if (c == null || c === false) return;

    if (typeof c === "function") {
      const emit: ChildAdder = (...xs) => {
        for (const x of xs) visit(x);
      };
      (c as ChildBuilder)(emit);
      return;
    }

    if (Array.isArray(c)) {
      for (const x of c) visit(x);
      return;
    }

    if (typeof c === "object" && c && "__rawHtml" in c) {
      out.push(c as RawHtml);
      return;
    }

    if (typeof c === "object" && c && "nodeType" in c) {
      out.push(c as DomNodeLike);
      return;
    }

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

function attrsToHastProperties(a: Attrs): Properties {
  const keys = Object.keys(a).sort();
  const out: Properties = {};
  for (const k of keys) {
    const v = a[k];
    if (v == null || v === false) continue;
    (out as Record<string, unknown>)[k] = v === true ? true : v;
  }
  return out;
}

function childrenToHast(children: readonly Child[]): ElementContent[] {
  const flat = flattenChildren(children);
  const out: ElementContent[] = [];

  for (const c of flat) {
    if (typeof c === "string") {
      const t: Text = { type: "text", value: c };
      out.push(t);
      continue;
    }

    if (typeof c === "object" && c && "__rawHtml" in c) {
      const rh = c as RawHtml;
      const nodes = rh.__nodes ?? parseTrustedHtmlToNodes(rh.__rawHtml);
      for (const n of nodes) out.push(n as unknown as ElementContent);
      continue;
    }

    if (typeof c === "object" && c && "nodeType" in c) {
      throw new Error("Fluent server error: DomNodeLike not supported here.");
    }

    throw new Error("Fluent server error: unsupported child type.");
  }

  return out;
}

function toHtmlMinimizedFromNodes(nodes: readonly RootContent[]): string {
  const root: Root = { type: "root", children: [...nodes] };
  return toHtml(root);
}

function toHtmlPrettyFromNodes(nodes: readonly RootContent[]): string {
  const root: Root = { type: "root", children: structuredClone([...nodes]) };
  format(root);
  const html = toHtml(root);
  return html.endsWith("\n") ? html : html + "\n";
}

// Internal primitive, intentionally not exported.
const el = (tagName: string, ...args: unknown[]): RawHtml => {
  let at: Attrs | undefined;
  let kids: Child[];

  if (args.length > 0 && isAttrs(args[0])) {
    at = args[0] as Attrs;
    kids = args.slice(1) as Child[];
  } else {
    kids = args as Child[];
  }

  const elem: Element = {
    type: "element",
    tagName,
    properties: at ? attrsToHastProperties(at) : {},
    children: isVoidElement(tagName) ? [] : childrenToHast(kids),
  };

  const nodes = [elem as unknown as RootContent];
  const minimized = toHtmlMinimizedFromNodes(nodes);

  return { __rawHtml: minimized, __nodes: nodes };
};

const tag = (name: string): TagFn => (...args: unknown[]) =>
  el(name, ...(args as never[]));

// Convenience primitives
export const doctype: () => RawHtml = () => {
  const n: Doctype = { type: "doctype" };
  const nodes = [n as unknown as RootContent];
  return { __rawHtml: toHtmlMinimizedFromNodes(nodes), __nodes: nodes };
};

export const comment: (s: string) => RawHtml = (s) => {
  const n: Comment = { type: "comment", value: s };
  const nodes = [n as unknown as RootContent];
  return { __rawHtml: toHtmlMinimizedFromNodes(nodes), __nodes: nodes };
};

// Render helpers
export type RenderMinimized = (...parts: Array<string | RawHtml>) => string;
export type RenderPretty = (...parts: Array<string | RawHtml>) => string;

/**
 * render():
 * - Uses HAST serialization for determinism.
 * - For plain string parts, we treat them as trusted HTML fragments and parse them
 *   (this preserves past behavior where callers could concatenate prebuilt HTML strings).
 *   If you want “strings mean literal text”, wrap them as children to elements (text nodes),
 *   or change this function to emit Text nodes for string parts.
 */
export const render: RenderMinimized = (...parts) => {
  const nodes: RootContent[] = [];
  for (const p of parts) {
    if (typeof p === "string") {
      nodes.push(...parseTrustedHtmlToNodes(p));
      continue;
    }
    if (p.__nodes) {
      nodes.push(...p.__nodes);
      continue;
    }
    nodes.push(...parseTrustedHtmlToNodes(p.__rawHtml));
  }
  return toHtmlMinimizedFromNodes(nodes);
};

export const renderPretty: RenderPretty = (...parts) => {
  const nodes: RootContent[] = [];
  for (const p of parts) {
    if (typeof p === "string") nodes.push(...parseTrustedHtmlToNodes(p));
    else if (p.__nodes) nodes.push(...p.__nodes);
    else nodes.push(...parseTrustedHtmlToNodes(p.__rawHtml));
  }
  return toHtmlPrettyFromNodes(nodes);
};

// Safe script/style helpers: always embed as text, never parse as HTML
export const scriptJs: (code: string, attrs?: Attrs) => RawHtml = (
  code,
  attrs,
) => script(attrs ?? {}, code);

export const styleCss: (cssText: string, attrs?: Attrs) => RawHtml = (
  cssText,
  attrs,
) => style(attrs ?? {}, cssText);

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

/* -----------------------------------------------------------------------------
 * UA Dependencies (design system user agent dependencies)
 * -------------------------------------------------------------------------- */

export type UaDepMimeType =
  | "text/css"
  | "text/javascript"
  | "application/javascript"
  | "application/json"
  | "image/svg+xml"
  | "font/woff2"
  | "text/plain"
  | string;

export type UaDependencyBase = {
  readonly mountPoint: string; // what HTML references, e.g. "/_fds/fluent.css"
  readonly mimeType: UaDepMimeType;

  // optional route controls for the server
  readonly method?: "GET" | "HEAD"; // default GET
  readonly headers?: Readonly<Record<string, string>>; // added to response
  readonly cache?: {
    readonly maxAgeSeconds?: number;
    readonly immutable?: boolean;
    readonly etag?: "weak" | "strong" | false; // server can generate if enabled
  };
  readonly cors?: {
    readonly allowOrigin?: string; // e.g. "*" or "https://yourapp"
    readonly allowHeaders?: string;
    readonly allowMethods?: string;
  };
};

export type UaDependencyReference = UaDependencyBase & {
  readonly nature: "reference";
  readonly canonicalSource: string; // "https://..." or "http://..." or "/abs/path/..." (or file:// if you want)

  // optional HTML emission hints
  readonly as?: "style" | "script" | "module" | "preload" | "other";
  readonly integrity?: string;
  readonly crossOrigin?: "anonymous" | "use-credentials";
};

export type UaDependencyContent = UaDependencyBase & {
  readonly nature: "content";
  readonly canonicalSource: string; // full inlined content (css/js/etc)
  readonly emit?: "inline" | "link";

  // optional HTML emission hints
  readonly as?: "style" | "script" | "module" | "other";
};

export type UaDependency = UaDependencyReference | UaDependencyContent;

type UaDepCommonOverrides = Partial<
  Pick<UaDependencyBase, "method" | "headers" | "cache" | "cors">
>;

type UaDepRefOverrides =
  & UaDepCommonOverrides
  & Partial<
    Pick<UaDependencyReference, "as" | "integrity" | "crossOrigin">
  >;

type UaDepContentOverrides =
  & UaDepCommonOverrides
  & Partial<
    Pick<UaDependencyContent, "as" | "emit">
  >;

type UaDepJsMimeOverride = {
  readonly mimeType?: "text/javascript" | "application/javascript";
};

export function uaDepCssRef(
  mountPoint: string,
  canonicalSource: string,
  overrides: UaDepRefOverrides = {},
): UaDependencyReference {
  return {
    mountPoint,
    canonicalSource,
    nature: "reference",
    mimeType: "text/css",
    ...overrides,
  };
}

export function uaDepJsRef(
  mountPoint: string,
  canonicalSource: string,
  overrides: UaDepRefOverrides & UaDepJsMimeOverride = {},
): UaDependencyReference {
  const { mimeType, ...rest } = overrides;
  return {
    mountPoint,
    canonicalSource,
    nature: "reference",
    mimeType: mimeType ?? "application/javascript",
    ...rest,
  };
}

export function uaDepCssContent(
  mountPoint: string,
  content: string,
  overrides: UaDepContentOverrides = {},
): UaDependencyContent {
  return {
    mountPoint,
    canonicalSource: content,
    nature: "content",
    mimeType: "text/css",
    ...overrides,
  };
}

export function uaDepJsContent(
  mountPoint: string,
  content: string,
  overrides: UaDepContentOverrides & UaDepJsMimeOverride = {},
): UaDependencyContent {
  const { mimeType, ...rest } = overrides;
  return {
    mountPoint,
    canonicalSource: content,
    nature: "content",
    mimeType: mimeType ?? "application/javascript",
    ...rest,
  };
}

export type UaRoute = UaDependency & {
  readonly normalizedAs: "style" | "script" | "module" | "preload" | "other";
};

export function normalizeUaRoute(dep: UaDependency): UaRoute {
  const as = dep.as ??
    (dep.mimeType.includes("css")
      ? "style"
      : dep.mimeType.includes("javascript")
      ? "module"
      : "other");

  return { ...dep, normalizedAs: as };
}

export function browserUserAgentHeadTags(
  deps: Iterable<UaDependency>,
): RawHtml {
  const routes = Array.from(deps).map(normalizeUaRoute);

  return children((e) => {
    for (const r of routes) {
      if (r.nature === "content") {
        if (r.emit === "link") {
          if (r.normalizedAs === "style") {
            e(link(attrs({ rel: "stylesheet", href: r.mountPoint })));
            continue;
          }
          if (r.normalizedAs === "script") {
            e(script(attrs({ src: r.mountPoint })));
            continue;
          }
          if (r.normalizedAs === "module") {
            e(script(attrs({ src: r.mountPoint, type: "module" })));
            continue;
          }
        }

        if (r.normalizedAs === "style") {
          e(styleCss(r.canonicalSource));
          continue;
        }

        if (r.normalizedAs === "script") {
          e(script({}, r.canonicalSource));
          continue;
        }

        if (r.normalizedAs === "module") {
          e(script({ type: "module" }, r.canonicalSource));
          continue;
        }

        e(comment(`ua dep: ${r.mountPoint}`));
        continue;
      }

      if (r.normalizedAs === "style") {
        e(
          link(
            attrs(
              { rel: "stylesheet", href: r.mountPoint },
              r.integrity ? { integrity: r.integrity } : null,
              r.crossOrigin ? { crossOrigin: r.crossOrigin } : null,
            ),
          ),
        );
        continue;
      }

      if (r.normalizedAs === "script") {
        e(
          script(
            attrs(
              { src: r.mountPoint },
              r.integrity ? { integrity: r.integrity } : null,
              r.crossOrigin ? { crossOrigin: r.crossOrigin } : null,
            ),
          ),
        );
        continue;
      }

      if (r.normalizedAs === "module") {
        e(
          script(
            attrs(
              { src: r.mountPoint, type: "module" },
              r.integrity ? { integrity: r.integrity } : null,
              r.crossOrigin ? { crossOrigin: r.crossOrigin } : null,
            ),
          ),
        );
        continue;
      }

      if (r.normalizedAs === "preload") {
        e(
          link(
            attrs(
              { rel: "preload", href: r.mountPoint, as: "script" },
              r.crossOrigin ? { crossOrigin: r.crossOrigin } : null,
            ),
          ),
        );
        continue;
      }

      e(comment(`ua dep: ${r.mountPoint}`));
    }
  }) as unknown as RawHtml;
}
