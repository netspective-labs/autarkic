// lib/html/shared.ts
function raw(html2) {
  return {
    __rawHtml: html2
  };
}
function flattenChildren(children) {
  const out = [];
  const visit = (c) => {
    if (c == null || c === false) return;
    if (Array.isArray(c)) {
      for (const x of c) visit(x);
      return;
    }
    if (typeof c === "object" && "__rawHtml" in c) {
      out.push(c);
      return;
    }
    if (c === true) return;
    out.push(String(c));
  };
  for (const c of children) visit(c);
  return out;
}

// src/html/browser-ua/fluent.ts
var el = (tagName, ...args) => {
  let attrs;
  let children;
  if (args.length > 0 && isAttrs(args[0])) {
    attrs = args[0];
    children = args.slice(1);
  } else {
    children = args;
  }
  const node = document.createElement(tagName);
  if (attrs) {
    const keys = Object.keys(attrs).sort();
    for (const k of keys) {
      const v = attrs[k];
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
var tag = (name) => (...args) => el(name, ...args);
var legacyTag = (name) => (...args) => el(name, ...args);
var isAttrs = (v) => {
  if (v == null) return false;
  if (Array.isArray(v)) return false;
  if (typeof v !== "object") return false;
  if ("__rawHtml" in v) return false;
  return true;
};
var mount = (target, node) => target.appendChild(node);
var replace = (target, node) => target.replaceWith(node);
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
  cite,
  codeTag,
  col,
  colgroup,
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
  em,
  embed,
  fieldset,
  figcaption,
  figure,
  footer,
  form,
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
  u,
  ul,
  varTag,
  video,
  wbr
};
