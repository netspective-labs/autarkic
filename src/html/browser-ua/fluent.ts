/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

// src/html/browser-ua/fluent.ts
//
// Browser-side fluent HTML builder + dependency-free runtime integration.
// This file has no external dependencies. It wires our local runtime via enhance().

import {
  type Attrs,
  attrs as mergeAttrs,
  type AttrValue,
  type Child,
  children as childrenFn,
  classNames,
  each as eachFn,
  flattenChildren,
  isPlainObject,
  raw,
  styleText,
  trustedRaw,
} from "../../../lib/html/shared.ts";

import { enhance } from "./runtime.ts";

export { raw, trustedRaw };
export type { Child };

export const attrs = mergeAttrs;
export const cls = classNames;
export const css = styleText;
export const children = childrenFn;
export const each = eachFn;

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

// Internal primitive (not exported).
const el = (tagName: string, ...args: unknown[]) => {
  let attrs: Attrs | undefined;
  let children: Child[];

  if (args.length > 0 && isAttrs(args[0])) {
    attrs = args[0] as Attrs;
    children = args.slice(1) as Child[];
  } else {
    children = args as Child[];
  }

  const node = document.createElement(tagName);

  if (attrs) {
    const keys = Object.keys(attrs).sort();
    for (const k of keys) {
      const v = (attrs as Record<string, AttrValue>)[k];
      if (v == null || v === false) continue;
      node.setAttribute(k, v === true ? "" : String(v));
    }
  }

  if (isVoidElement(tagName) && children.length > 0) {
    console.warn(`Void element <${tagName}> should not have children.`);
  }

  // flattenChildren executes builders anywhere in the tree
  for (const c of flattenChildren(children)) {
    if (typeof c === "string") {
      node.appendChild(document.createTextNode(c));
    } else {
      const t = document.createElement("template");
      t.innerHTML = c.__rawHtml;
      node.appendChild(t.content);
    }
  }

  return node;
};

const tag =
  <K extends keyof HTMLElementTagNameMap>(name: K) => (...args: unknown[]) =>
    el(name, ...(args as never[])) as HTMLElementTagNameMap[K];

const legacyTag = (name: string) => (...args: unknown[]) =>
  el(name, ...(args as never[])) as HTMLElement;

export const mount = (target: Element, node: Node) => target.appendChild(node);
export const replace = (target: Element, node: Node) =>
  target.replaceWith(node);

export const fragment = (...children: Child[]) => {
  const frag = document.createDocumentFragment();
  for (const c of flattenChildren(children)) {
    if (typeof c === "string") {
      frag.appendChild(document.createTextNode(c));
    } else {
      const t = document.createElement("template");
      t.innerHTML = c.__rawHtml;
      frag.appendChild(t.content);
    }
  }
  return frag;
};

export const scriptJs = (code: string, attrs?: Attrs) => {
  const s = document.createElement("script");
  if (attrs) {
    const keys = Object.keys(attrs).sort();
    for (const k of keys) {
      const v = (attrs as Record<string, AttrValue>)[k];
      if (v == null || v === false) continue;
      s.setAttribute(k, v === true ? "" : String(v));
    }
  }
  s.textContent = code;
  return s;
};

export const styleCss = (cssText: string, attrs?: Attrs) => {
  const s = document.createElement("style");
  if (attrs) {
    const keys = Object.keys(attrs).sort();
    for (const k of keys) {
      const v = (attrs as Record<string, AttrValue>)[k];
      if (v == null || v === false) continue;
      s.setAttribute(k, v === true ? "" : String(v));
    }
  }
  s.textContent = cssText;
  return s;
};

// Dependency-free runtime auto-integration.
// We only call enhance() after DOM is available.
const autoEnhance = () => {
  const boot = () => enhance({ root: document });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
};

autoEnhance();

// Named HTML tag exports (no el export)
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
export const param = legacyTag("param");
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
