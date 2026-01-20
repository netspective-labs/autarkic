/**
 * @module lib/natural-html/elements-dom.js
 *
 * Fluent DOM is the browser twin of elements.ts.
 * Same tag API surface (div(...), a(...), table(...), etc.) and same helpers
 * (attrs, cls/classNames, css/styleText, each, children, raw/trustedRaw, javaScript).
 *
 * Instead of producing HTML strings, this module produces real DOM Nodes.
 * Tag functions return Elements. render(...) returns a DocumentFragment.
 *
 * Notes
 * - Plain string/number children become Text nodes.
 * - null/undefined/false/true children are skipped (use boolean attrs for semantics).
 * - Arrays are flattened.
 * - Builder callbacks are executed as the tree is walked.
 * - raw()/trustedRaw() return a "RawDom" wrapper containing Nodes parsed from HTML.
 */

/**
 * @typedef {string|number|boolean|null|undefined} AttrValue
 */

/**
 * @typedef {Record<string, AttrValue>} Attrs
 */

/**
 * Optional dev-time raw policy (defaults to permissive).
 * @typedef {{ mode?: "permissive" | "dev-strict" }} RawPolicy
 */

let rawPolicy = { mode: "permissive" };

/**
 * @param {RawPolicy} policy
 * @returns {void}
 */
export function setRawPolicy(policy) {
  rawPolicy = { ...rawPolicy, ...policy };
}

/**
 * A wrapper for trusted, pre-parsed DOM nodes.
 * @typedef {{ readonly __nodes: readonly Node[] }} RawDom
 */

/**
 * Builder support (usable anywhere a child can appear).
 * @typedef {(...children: Child[]) => void} ChildAdder
 * @typedef {(e: ChildAdder) => void} ChildBuilder
 */

/**
 * A "Child" is recursive and can include builder functions.
 * @typedef {string|number|boolean|null|undefined|Node|RawDom|Child[]|ChildBuilder} Child
 */

const isPlainObject = (value) => {
  if (value == null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/**
 * @param {unknown} v
 * @returns {v is Attrs}
 */
const isAttrs = (v) => {
  if (!isPlainObject(v)) return false;
  if ("__nodes" in /** @type {Record<string, unknown>} */ (v)) return false;
  if ("nodeType" in /** @type {Record<string, unknown>} */ (v)) return false;
  return true;
};

/**
 * Deterministic attrs merge helper (later wins).
 * @param {...(Attrs|null|undefined|false)} parts
 * @returns {Attrs}
 */
export function attrs(...parts) {
  /** @type {Attrs} */
  const out = {};
  for (const p of parts) {
    if (!p) continue;
    for (const [k, v] of Object.entries(p)) out[k] = v;
  }
  return out;
}

/**
 * @typedef {string|null|undefined|false|ClassSpec[]|Record<string, boolean>} ClassSpec
 */

/**
 * @param {...ClassSpec} parts
 * @returns {string}
 */
export function classNames(...parts) {
  /** @type {string[]} */
  const out = [];
  /** @param {ClassSpec} p */
  const visit = (p) => {
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

/**
 * @param {Record<string, string|number|null|undefined|false>} style
 * @returns {string}
 */
export function styleText(style) {
  const toKebab = (s) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
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

/**
 * Explicit wrapper for readability in call sites.
 * @param {ChildBuilder} builder
 * @returns {ChildBuilder}
 */
export function children(builder) {
  return builder;
}

/**
 * @template T
 * @param {Iterable<T>} items
 * @param {(item: T, index: number) => Child} fn
 * @returns {ChildBuilder}
 */
export function each(items, fn) {
  return (e) => {
    let i = 0;
    for (const it of items) e(fn(it, i++));
  };
}

/**
 * Parse HTML into DOM nodes (template-based).
 * @param {string} html
 * @returns {RawDom}
 */
export function trustedRaw(html) {
  const t = document.createElement("template");
  t.innerHTML = html;
  return { __nodes: Array.from(t.content.childNodes) };
}

/**
 * Escape hatch that can be blocked in dev/test by policy.
 * Use for trusted HTML snippets.
 * @param {string} html
 * @param {string=} hint
 * @returns {RawDom}
 */
export function raw(html, hint) {
  if (rawPolicy.mode === "dev-strict") {
    const msg = hint
      ? `raw() is blocked by dev-strict policy: ${hint}`
      : "raw() is blocked by dev-strict policy";
    throw new Error(msg);
  }
  return trustedRaw(html);
}

/**
 * Template tag for embedding text blocks as trusted raw DOM (parsed as HTML).
 * The template literal must start with a blank first line.
 * @param {TemplateStringsArray} strings
 * @param {...unknown} exprs
 * @returns {RawDom}
 */
export function trustedRawFriendly(strings, ...exprs) {
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
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();

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

  return trustedRaw(dedented);
}

export const javaScript = trustedRawFriendly;

/**
 * @param {readonly Child[]} children
 * @returns {Node[]}
 */
export function flattenChildren(children) {
  /** @type {Node[]} */
  const out = [];

  /** @param {Child} c */
  const visit = (c) => {
    if (c == null || c === false) return;

    // Builder callback
    if (typeof c === "function") {
      /** @type {ChildAdder} */
      const emit = (...xs) => {
        for (const x of xs) visit(x);
      };
      /** @type {ChildBuilder} */ (c)(emit);
      return;
    }

    // Nested arrays
    if (Array.isArray(c)) {
      for (const x of c) visit(x);
      return;
    }

    // RawDom passthrough
    if (typeof c === "object" && c && "__nodes" in c) {
      for (const n of /** @type {RawDom} */ (c).__nodes) out.push(n);
      return;
    }

    // Node passthrough
    if (typeof c === "object" && c && "nodeType" in c) {
      out.push(/** @type {Node} */ (c));
      return;
    }

    // Skip boolean true as a child
    if (c === true) return;

    // string/number -> Text
    out.push(document.createTextNode(String(c)));
  };

  for (const c of children) visit(c);
  return out;
}

/**
 * @param {Element} el
 * @param {Attrs|undefined} a
 * @returns {void}
 */
function applyAttrs(el, a) {
  if (!a) return;
  const keys = Object.keys(a).sort();
  for (const k of keys) {
    const v = a[k];
    if (v == null || v === false) continue;
    if (v === true) {
      el.setAttribute(k, "");
      continue;
    }
    el.setAttribute(k, String(v));
  }
}

/**
 * @typedef {(attrsOrChild?: Attrs|Child, ...children: Child[]) => Element} TagFn
 */

/**
 * Internal primitive.
 * @param {string} tagName
 * @param {...unknown} args
 * @returns {Element}
 */
function el(tagName, ...args) {
  /** @type {Attrs|undefined} */
  let at;
  /** @type {Child[]} */
  let kids;

  if (args.length > 0 && isAttrs(args[0])) {
    at = /** @type {Attrs} */ (args[0]);
    kids = /** @type {Child[]} */ (args.slice(1));
  } else {
    kids = /** @type {Child[]} */ (args);
  }

  const node = document.createElement(tagName);
  applyAttrs(node, at);

  const flat = flattenChildren(kids);
  for (const c of flat) node.appendChild(c);

  return node;
}

/**
 * @param {string} name
 * @returns {TagFn}
 */
function tag(name) {
  return (...args) => el(name, .../** @type {unknown[]} */ (args));
}

/**
 * Create a DocumentFragment of all parts.
 * @param {...(Node|Element|RawDom|string)} parts
 * @returns {DocumentFragment}
 */
export function render(...parts) {
  const frag = document.createDocumentFragment();
  for (const p of parts) {
    if (p == null) continue;
    if (typeof p === "string") {
      // Interpret string as HTML snippet, like server-side render() joining strings.
      const rd = trustedRaw(p);
      for (const n of rd.__nodes) frag.appendChild(n.cloneNode(true));
      continue;
    }
    if (typeof p === "object" && "__nodes" in p) {
      for (const n of /** @type {RawDom} */ (p).__nodes) frag.appendChild(n);
      continue;
    }
    frag.appendChild(/** @type {Node} */ (p));
  }
  return frag;
}

// No-op alias for API parity with elements.ts
export const renderPretty = render;

/**
 * @returns {DocumentType}
 */
export function doctype() {
  // Default to HTML doctype for parity.
  return document.implementation.createDocumentType("html", "", "");
}

/**
 * @param {string} s
 * @returns {Comment}
 */
export function comment(s) {
  return document.createComment(s);
}

/**
 * Safer script helper: puts code into textContent.
 * @param {string} code
 * @param {Attrs=} a
 * @returns {HTMLScriptElement}
 */
export function scriptJs(code, a) {
  const s = /** @type {HTMLScriptElement} */ (script(a ?? {}));
  s.textContent = code;
  return s;
}

/**
 * Safer style helper: puts css text into textContent.
 * @param {string} cssText
 * @param {Attrs=} a
 * @returns {HTMLStyleElement}
 */
export function styleCss(cssText, a) {
  const s = /** @type {HTMLStyleElement} */ (style(a ?? {}));
  s.textContent = cssText;
  return s;
}

/**
 * Type-safe custom element tag helper.
 * @param {`${string}-${string}`} name
 * @returns {TagFn}
 */
export function customElement(name) {
  return tag(name);
}

// Full HTML tag set as named exports
export const a = tag("a");
export const abbr = tag("abbr");
export const address = tag("address");
export const area = tag("area");
export const article = tag("article");
export const aside = tag("aside");
export const audio = tag("audio");
export const b = tag("b");
export const base = tag("base");
export const bdi = tag("bdi");
export const bdo = tag("bdo");
export const blockquote = tag("blockquote");
export const body = tag("body");
export const br = tag("br");
export const button = tag("button");
export const canvas = tag("canvas");
export const caption = tag("caption");
export const cite = tag("cite");
export const codeTag = tag("code");
export const col = tag("col");
export const colgroup = tag("colgroup");
export const data = tag("data");
export const datalist = tag("datalist");
export const dd = tag("dd");
export const del = tag("del");
export const details = tag("details");
export const dfn = tag("dfn");
export const dialog = tag("dialog");
export const div = tag("div");
export const dl = tag("dl");
export const dt = tag("dt");
export const em = tag("em");
export const embed = tag("embed");
export const fieldset = tag("fieldset");
export const figcaption = tag("figcaption");
export const figure = tag("figure");
export const footer = tag("footer");
export const form = tag("form");
export const h1 = tag("h1");
export const h2 = tag("h2");
export const h3 = tag("h3");
export const h4 = tag("h4");
export const h5 = tag("h5");
export const h6 = tag("h6");
export const head = tag("head");
export const header = tag("header");
export const hgroup = tag("hgroup");
export const hr = tag("hr");
export const html = tag("html");
export const i = tag("i");
export const iframe = tag("iframe");
export const img = tag("img");
export const input = tag("input");
export const ins = tag("ins");
export const kbd = tag("kbd");
export const label = tag("label");
export const legend = tag("legend");
export const li = tag("li");
export const link = tag("link");
export const main = tag("main");
export const map = tag("map");
export const mark = tag("mark");
export const menu = tag("menu");
export const meta = tag("meta");
export const meter = tag("meter");
export const nav = tag("nav");
export const noscript = tag("noscript");
export const object = tag("object");
export const ol = tag("ol");
export const optgroup = tag("optgroup");
export const option = tag("option");
export const output = tag("output");
export const p = tag("p");
export const param = tag("param");
export const picture = tag("picture");
export const pre = tag("pre");
export const progress = tag("progress");
export const qTag = tag("q");
export const rp = tag("rp");
export const rt = tag("rt");
export const ruby = tag("ruby");
export const s = tag("s");
export const samp = tag("samp");
export const script = tag("script");
export const search = tag("search");
export const section = tag("section");
export const select = tag("select");
export const slot = tag("slot");
export const small = tag("small");
export const source = tag("source");
export const span = tag("span");
export const strong = tag("strong");
export const style = tag("style");
export const sub = tag("sub");
export const summary = tag("summary");
export const sup = tag("sup");
export const table = tag("table");
export const tbody = tag("tbody");
export const td = tag("td");
export const template = tag("template");
export const textarea = tag("textarea");
export const tfoot = tag("tfoot");
export const th = tag("th");
export const thead = tag("thead");
export const time = tag("time");
export const title = tag("title");
export const tr = tag("tr");
export const track = tag("track");
export const u = tag("u");
export const ul = tag("ul");
export const varTag = tag("var");
export const video = tag("video");
export const wbr = tag("wbr");
