/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

// src/html/browser-ua/fluent.ts
//
// Client-side fluent DOM builder + automatic hypermedia runtime loading.
// - Juniors use named tag functions only (we do NOT export el)
// - Uses DOM typing where possible; for tags missing from HTMLElementTagNameMap
//   (example: "param" in some lib.dom variants), we fall back to HTMLElement.
// - raw() opt-in for HTML injection
// - AUTO-DISCOVERY: if DataStar-style data-* attrs exist, we auto-load the upstream runtime
//
// Bundled to: lib/html/browser-ua/fluent-browser-ua.auto.js
//
// Note: we intentionally avoid using the upstream project name in identifiers/exports.

import {
  type Attrs,
  type AttrValue,
  type Child,
  flattenChildren,
  raw,
} from "../../../lib/html/shared.ts";

export { raw };

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
      if (v === true) {
        node.setAttribute(k, "");
        continue;
      }
      node.setAttribute(k, String(v));
    }
  }

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

// Typed tag factory for tags present in HTMLElementTagNameMap
const tag =
  <K extends keyof HTMLElementTagNameMap>(name: K) => (...args: unknown[]) =>
    el(name, ...(args as never[])) as HTMLElementTagNameMap[K];

// Fallback tag factory for tags not in HTMLElementTagNameMap in some DOM libs
const legacyTag = (name: string) => (...args: unknown[]) =>
  el(name, ...(args as never[])) as HTMLElement;

const isAttrs = (v: unknown): v is Attrs => {
  if (v == null) return false;
  if (Array.isArray(v)) return false;
  if (typeof v !== "object") return false;
  if ("__rawHtml" in (v as Record<string, unknown>)) return false;
  return true;
};

export const mount = (target: Element, node: Node) => target.appendChild(node);
export const replace = (target: Element, node: Node) =>
  target.replaceWith(node);

// Automatic runtime integration (DataStar-style attributes)
// Identifiers avoid upstream name; URL is configurable.
let junxionUxRuntimeModuleUrl =
  "https://cdn.jsdelivr.net/gh/starfederation/datastar@v1.0.0-RC.7/bundles/datastar.js";

export const setJunxionUxRuntimeModuleUrl = (url: string) => {
  junxionUxRuntimeModuleUrl = url;
};

const looksLikeHypermediaDom = (root: ParentNode) => {
  const selectors = [
    "[data-on\\:]",
    "[data-bind\\:]",
    "[data-signals]",
    "[data-signals\\:]",
    "[data-effect]",
    "[data-text]",
    "[data-show]",
    "[data-class\\:]",
    "[data-attr\\:]",
    "[data-computed\\:]",
    "[data-indicator\\:]",
    "[data-ignore]",
    "[data-ignore-morph]",
  ];
  return selectors.some((sel) =>
    (root as Document | Element).querySelector?.(sel)
  );
};

let runtimeLoaded: Promise<void> | null = null;

const ensureRuntime = () => {
  if (runtimeLoaded) return runtimeLoaded;
  runtimeLoaded = (async () => {
    await import(junxionUxRuntimeModuleUrl);
  })();
  return runtimeLoaded;
};

const autoIntegrateRuntime = () => {
  const boot = async () => {
    if (looksLikeHypermediaDom(document)) await ensureRuntime();

    const mo = new MutationObserver(async (mutations) => {
      for (const m of mutations) {
        for (const n of m.addedNodes) {
          if (!(n instanceof Element)) continue;
          if (looksLikeHypermediaDom(n)) {
            await ensureRuntime();
            return;
          }
        }
      }
    });

    mo.observe(document.documentElement, { subtree: true, childList: true });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void boot(), {
      once: true,
    });
  } else {
    void boot();
  }
};

autoIntegrateRuntime();

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
export const param = legacyTag("param"); // Some DOM lib variants don’t include "param" in HTMLElementTagNameMap
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
