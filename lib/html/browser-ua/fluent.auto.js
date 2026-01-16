// lib/html/shared.ts
var rawPolicy = {
  mode: "permissive"
};
var isDev = () => {
  const deno = globalThis.Deno;
  const env = deno?.env?.get?.("DENO_ENV");
  return env !== "production";
};
function raw(html2) {
  if (rawPolicy.mode === "dev-strict" && isDev()) {
    throw new Error(`raw() is disabled in dev-strict mode. Use trustedRaw(...) or setRawPolicy({ mode: "permissive" }).`);
  }
  return {
    __rawHtml: html2
  };
}
function trustedRaw(html2, _hint) {
  return {
    __rawHtml: html2
  };
}
function flattenChildren(children3) {
  const out = [];
  const visit = (c) => {
    if (c == null || c === false) return;
    if (typeof c === "function") {
      const emit = (...xs) => {
        for (const x of xs) visit(x);
      };
      c(emit);
      return;
    }
    if (Array.isArray(c)) {
      for (const x of c) visit(x);
      return;
    }
    if (typeof c === "object" && c && "__rawHtml" in c) {
      out.push(c);
      return;
    }
    if (c === true) return;
    out.push(String(c));
  };
  for (const c of children3) visit(c);
  return out;
}
function isPlainObject(value) {
  if (value == null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
function attrs(...parts) {
  const out = {};
  for (const p2 of parts) {
    if (!p2) continue;
    for (const [k, v] of Object.entries(p2)) out[k] = v;
  }
  return out;
}
function classNames(...parts) {
  const out = [];
  const visit = (p2) => {
    if (!p2) return;
    if (Array.isArray(p2)) {
      for (const x of p2) visit(x);
      return;
    }
    if (typeof p2 === "object") {
      for (const [k, v] of Object.entries(p2)) if (v) out.push(k);
      return;
    }
    const s2 = String(p2).trim();
    if (s2) out.push(s2);
  };
  for (const p2 of parts) visit(p2);
  return out.join(" ");
}
function styleText(style2) {
  const toKebab = (s3) => s3.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
  const keys = Object.keys(style2).sort();
  let s2 = "";
  for (const k of keys) {
    const v = style2[k];
    if (v == null || v === false) continue;
    s2 += `${toKebab(k)}:${String(v)};`;
  }
  return s2;
}
function children(builder) {
  return builder;
}
function each(items, fn) {
  return (e) => {
    let i2 = 0;
    for (const it of items) e(fn(it, i2++));
  };
}

// src/html/browser-ua/fluent.ts
var attrs2 = attrs;
var cls = classNames;
var css = styleText;
var children2 = children;
var each2 = each;
var isAttrs = (v) => {
  if (!isPlainObject(v)) return false;
  if ("__rawHtml" in v) return false;
  return true;
};
var VOID_ELEMENTS = /* @__PURE__ */ new Set([
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
  "wbr"
]);
var isVoidElement = (t) => VOID_ELEMENTS.has(t.toLowerCase());
var el = (tagName, ...args) => {
  let attrs3;
  let children3;
  if (args.length > 0 && isAttrs(args[0])) {
    attrs3 = args[0];
    children3 = args.slice(1);
  } else {
    children3 = args;
  }
  const node = document.createElement(tagName);
  if (attrs3) {
    const keys = Object.keys(attrs3).sort();
    for (const k of keys) {
      const v = attrs3[k];
      if (v == null || v === false) continue;
      node.setAttribute(k, v === true ? "" : String(v));
    }
  }
  if (isVoidElement(tagName) && children3.length > 0) {
    console.warn(`Void element <${tagName}> should not have children.`);
  }
  for (const c of flattenChildren(children3)) {
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
var tag = (name) => (...args) => el(name, ...args);
var legacyTag = (name) => (...args) => el(name, ...args);
var mount = (target, node) => target.appendChild(node);
var replace = (target, node) => target.replaceWith(node);
var fragment = (...children3) => {
  const frag = document.createDocumentFragment();
  for (const c of flattenChildren(children3)) {
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
var scriptJs = (code, attrs3) => {
  const s2 = document.createElement("script");
  if (attrs3) {
    const keys = Object.keys(attrs3).sort();
    for (const k of keys) {
      const v = attrs3[k];
      if (v == null || v === false) continue;
      s2.setAttribute(k, v === true ? "" : String(v));
    }
  }
  s2.textContent = code;
  return s2;
};
var styleCss = (cssText, attrs3) => {
  const s2 = document.createElement("style");
  if (attrs3) {
    const keys = Object.keys(attrs3).sort();
    for (const k of keys) {
      const v = attrs3[k];
      if (v == null || v === false) continue;
      s2.setAttribute(k, v === true ? "" : String(v));
    }
  }
  s2.textContent = cssText;
  return s2;
};
var junxionUxRuntimeModuleUrl = "https://cdn.jsdelivr.net/gh/starfederation/datastar@v1.0.0-RC.7/bundles/datastar.js";
var setJunxionUxRuntimeModuleUrl = (url) => {
  junxionUxRuntimeModuleUrl = url;
};
var looksLikeHypermediaDom = (root) => {
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
    "[data-ignore-morph]"
  ];
  return selectors.some((sel) => root.querySelector?.(sel));
};
var runtimeLoaded = null;
var ensureRuntime = () => {
  if (runtimeLoaded) return runtimeLoaded;
  runtimeLoaded = (async () => {
    await import(junxionUxRuntimeModuleUrl);
  })();
  return runtimeLoaded;
};
var autoIntegrateRuntime = () => {
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
    mo.observe(document.documentElement, {
      subtree: true,
      childList: true
    });
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void boot(), {
      once: true
    });
  } else {
    void boot();
  }
};
autoIntegrateRuntime();
var a = tag("a");
var abbr = tag("abbr");
var address = tag("address");
var area = tag("area");
var article = tag("article");
var aside = tag("aside");
var audio = tag("audio");
var b = tag("b");
var base = tag("base");
var bdi = tag("bdi");
var bdo = tag("bdo");
var blockquote = tag("blockquote");
var body = tag("body");
var br = tag("br");
var button = tag("button");
var canvas = tag("canvas");
var caption = tag("caption");
var cite = tag("cite");
var codeTag = tag("code");
var col = tag("col");
var colgroup = tag("colgroup");
var data = tag("data");
var datalist = tag("datalist");
var dd = tag("dd");
var del = tag("del");
var details = tag("details");
var dfn = tag("dfn");
var dialog = tag("dialog");
var div = tag("div");
var dl = tag("dl");
var dt = tag("dt");
var em = tag("em");
var embed = tag("embed");
var fieldset = tag("fieldset");
var figcaption = tag("figcaption");
var figure = tag("figure");
var footer = tag("footer");
var form = tag("form");
var h1 = tag("h1");
var h2 = tag("h2");
var h3 = tag("h3");
var h4 = tag("h4");
var h5 = tag("h5");
var h6 = tag("h6");
var head = tag("head");
var header = tag("header");
var hgroup = tag("hgroup");
var hr = tag("hr");
var html = tag("html");
var i = tag("i");
var iframe = tag("iframe");
var img = tag("img");
var input = tag("input");
var ins = tag("ins");
var kbd = tag("kbd");
var label = tag("label");
var legend = tag("legend");
var li = tag("li");
var link = tag("link");
var main = tag("main");
var map = tag("map");
var mark = tag("mark");
var menu = tag("menu");
var meta = tag("meta");
var meter = tag("meter");
var nav = tag("nav");
var noscript = tag("noscript");
var object = tag("object");
var ol = tag("ol");
var optgroup = tag("optgroup");
var option = tag("option");
var output = tag("output");
var p = tag("p");
var param = legacyTag("param");
var picture = tag("picture");
var pre = tag("pre");
var progress = tag("progress");
var qTag = tag("q");
var rp = tag("rp");
var rt = tag("rt");
var ruby = tag("ruby");
var s = tag("s");
var samp = tag("samp");
var script = tag("script");
var search = tag("search");
var section = tag("section");
var select = tag("select");
var slot = tag("slot");
var small = tag("small");
var source = tag("source");
var span = tag("span");
var strong = tag("strong");
var style = tag("style");
var sub = tag("sub");
var summary = tag("summary");
var sup = tag("sup");
var table = tag("table");
var tbody = tag("tbody");
var td = tag("td");
var template = tag("template");
var textarea = tag("textarea");
var tfoot = tag("tfoot");
var th = tag("th");
var thead = tag("thead");
var time = tag("time");
var title = tag("title");
var tr = tag("tr");
var track = tag("track");
var u = tag("u");
var ul = tag("ul");
var varTag = tag("var");
var video = tag("video");
var wbr = tag("wbr");
export {
  a,
  abbr,
  address,
  area,
  article,
  aside,
  attrs2 as attrs,
  audio,
  b,
  base,
  bdi,
  bdo,
  blockquote,
  body,
  br,
  button,
  canvas,
  caption,
  children2 as children,
  cite,
  cls,
  codeTag,
  col,
  colgroup,
  css,
  data,
  datalist,
  dd,
  del,
  details,
  dfn,
  dialog,
  div,
  dl,
  dt,
  each2 as each,
  em,
  embed,
  fieldset,
  figcaption,
  figure,
  footer,
  form,
  fragment,
  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  head,
  header,
  hgroup,
  hr,
  html,
  i,
  iframe,
  img,
  input,
  ins,
  kbd,
  label,
  legend,
  li,
  link,
  main,
  map,
  mark,
  menu,
  meta,
  meter,
  mount,
  nav,
  noscript,
  object,
  ol,
  optgroup,
  option,
  output,
  p,
  param,
  picture,
  pre,
  progress,
  qTag,
  raw,
  replace,
  rp,
  rt,
  ruby,
  s,
  samp,
  script,
  scriptJs,
  search,
  section,
  select,
  setJunxionUxRuntimeModuleUrl,
  slot,
  small,
  source,
  span,
  strong,
  style,
  styleCss,
  sub,
  summary,
  sup,
  table,
  tbody,
  td,
  template,
  textarea,
  tfoot,
  th,
  thead,
  time,
  title,
  tr,
  track,
  trustedRaw,
  u,
  ul,
  varTag,
  video,
  wbr
};
