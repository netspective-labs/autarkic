// markdown.js
/**
 * @module markdown
 *
 * Client-side Markdown renderer custom element using unified/remark/rehype from CDN.
 * Shadow DOM by default; optional Light DOM via `no-shadow`.
 *
 * Features:
 * - src attribute fetch, or inline <script type="text/markdown">
 * - auto render unless `no-auto`
 * - template-based CSS injection (prepend/append/replace)
 * - stable heading ids with collision handling
 * - rewrite relative URLs based on src
 * - hash scroll after render
 * - lazy enhancements: highlight.js, Mermaid, KaTeX
 * - FOUC prevention: build content offscreen and swap atomically
 *
 * Global config:
 * - globalThis.MarkdownElementConfig = { tagName?, fetch?, allowDangerousHtml? }
 */
/**
 * @typedef {Object} MarkdownElementConfig
 * @property {string=} tagName
 * @property {(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>=} fetch
 * @property {boolean=} allowDangerousHtml (default: true)
 */
// deno-lint-ignore-file no-import-prefix
const GlobalConfig =
  /** @type {MarkdownElementConfig} */ (globalThis.MarkdownElementConfig ?? {});

/** @param {string | null | undefined} v */
function isFalseyAttr(v) {
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s === "false" || s === "0" || s === "no" || s === "off";
}

/** @param {string} url */
function isProbablyAbsoluteUrl(url) {
  return (
    url.startsWith("//") ||
    url.startsWith("http:") ||
    url.startsWith("https:") ||
    url.startsWith("data:") ||
    url.startsWith("mailto:") ||
    url.startsWith("tel:") ||
    url.startsWith("#") ||
    url.startsWith("/") ||
    url.startsWith("blob:")
  );
}

/** @param {string} href @param {URL} base */
function resolveRelativeUrl(href, base) {
  if (!href) return href;
  if (isProbablyAbsoluteUrl(href)) return href;
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

/**
 * Rewrite relative href/src attributes inside rendered HTML to be relative to `src`.
 * @param {HTMLElement} root
 * @param {URL | null} baseUrl
 */
function rewriteRelativeUrls(root, baseUrl) {
  if (!baseUrl) return;

  /** @type {Array<[string, string[]]>} */
  const targets = [
    ["a", ["href"]],
    ["img", ["src", "srcset"]],
    ["source", ["src", "srcset"]],
    ["video", ["poster", "src"]],
    ["audio", ["src"]],
    ["link", ["href"]],
  ];

  for (const [sel, attrs] of targets) {
    for (const el of root.querySelectorAll(sel)) {
      for (const a of attrs) {
        const val = el.getAttribute(a);
        if (!val) continue;

        if (a === "srcset") {
          const parts = val
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean)
            .map((p) => {
              const segs = p.split(/\s+/);
              const u = segs.shift() ?? "";
              const rest = segs.join(" ");
              const ru = resolveRelativeUrl(u, baseUrl);
              return rest ? `${ru} ${rest}` : ru;
            });
          el.setAttribute("srcset", parts.join(", "));
          continue;
        }

        el.setAttribute(a, resolveRelativeUrl(val, baseUrl));
      }
    }
  }
}

/**
 * Basic link hardening (not full sanitization).
 * - Remove javascript: href
 * - Add rel=noopener noreferrer for target=_blank
 * @param {HTMLElement} root
 */
function hardenLinks(root) {
  for (const a of root.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href") ?? "";
    if (/^\s*javascript:/i.test(href)) {
      a.removeAttribute("href");
      continue;
    }

    const target = (a.getAttribute("target") ?? "").toLowerCase();
    if (target === "_blank") {
      const rel = (a.getAttribute("rel") ?? "").split(/\s+/).filter(Boolean);
      if (!rel.includes("noopener")) rel.push("noopener");
      if (!rel.includes("noreferrer")) rel.push("noreferrer");
      a.setAttribute("rel", rel.join(" "));
    }
  }
}

/**
 * Minimal typography CSS.
 * @param {string} p class prefix (e.g. "md-")
 */
function defaultCss(p) {
  return `
:host{display:block}
.${p}root{color:var(--${p}c,#1f2937);font:400 16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
.${p}root{max-width:var(--${p}mw,72ch)}
.${p}root :where(h1,h2,h3,h4){line-height:1.2;margin:1.25em 0 .5em}
.${p}root h1{font-size:2rem}
.${p}root h2{font-size:1.6rem}
.${p}root h3{font-size:1.25rem}
.${p}root h4{font-size:1.1rem}
.${p}root :where(p,ul,ol,pre,blockquote,table,figure){margin:0 0 1em}
.${p}root :where(ul,ol){padding-left:1.25em}
.${p}root li{margin:.25em 0}
.${p}root a{color:var(--${p}a,#2563eb);text-decoration:underline;text-underline-offset:.15em}
.${p}root a:hover{opacity:.9}
.${p}root :where(code,kbd,samp){font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:.925em}
.${p}root code{background:var(--${p}cbg,#f3f4f6);padding:.15em .35em;border-radius:.35em}
.${p}root pre{background:var(--${p}pbg,#0b1020);color:var(--${p}pc,#e5e7eb);padding:1em;border-radius:.8em;overflow:auto}
.${p}root pre code{background:transparent;padding:0;color:inherit}
.${p}root blockquote{border-left:4px solid var(--${p}bq,#e5e7eb);padding:.2em 0 .2em 1em;color:var(--${p}bqc,#374151)}
.${p}root hr{border:0;border-top:1px solid var(--${p}bd,#e5e7eb);margin:1.5em 0}
.${p}root table{width:100%;border-collapse:collapse;overflow:hidden;border-radius:.6em;border:1px solid var(--${p}bd,#e5e7eb)}
.${p}root th, .${p}root td{padding:.6em .75em;border-top:1px solid var(--${p}bd,#e5e7eb);vertical-align:top}
.${p}root thead th{background:var(--${p}tbg,#f9fafb);border-top:0}
.${p}root img{max-width:100%;height:auto;border-radius:.5em}
.${p}root :where(h1,h2,h3,h4,h5,h6)[id]{scroll-margin-top:1.25rem}
.${p}root .${p}muted{color:var(--${p}m,#6b7280)}
.${p}root .${p}error{background:#fff1f2;border:1px solid #fecdd3;color:#9f1239;padding:.75em 1em;border-radius:.8em}
.${p}root .${p}spinner{display:inline-block;width:1em;height:1em;border:.15em solid currentColor;border-right-color:transparent;border-radius:999px;animation:${p}spin .9s linear infinite;vertical-align:-.15em}

/* minimal highlight.js token colors */
.${p}root pre code.hljs{display:block}
.${p}root .hljs-comment,.${p}root .hljs-quote{color:#94a3b8}
.${p}root .hljs-keyword,.${p}root .hljs-selector-tag,.${p}root .hljs-subst{color:#c084fc}
.${p}root .hljs-string,.${p}root .hljs-title,.${p}root .hljs-name,.${p}root .hljs-type,.${p}root .hljs-attribute{color:#86efac}
.${p}root .hljs-number,.${p}root .hljs-literal,.${p}root .hljs-symbol,.${p}root .hljs-bullet{color:#fca5a5}
.${p}root .hljs-function,.${p}root .hljs-built_in{color:#93c5fd}
.${p}root .hljs-variable,.${p}root .hljs-template-variable{color:#fcd34d}

/* make mermaid svg responsive */
.${p}root .mermaid svg{max-width:100%;height:auto}

@keyframes ${p}spin{to{transform:rotate(360deg)}}
`;
}

/**
 * @param {HTMLElement} el
 * @param {string} selector
 * @returns {HTMLTemplateElement[]}
 */
function collectTemplates(el, selector) {
  return /** @type {HTMLTemplateElement[]} */ (Array.from(
    el.querySelectorAll(selector),
  ));
}

/** @param {HTMLTemplateElement} t @param {Document} doc */
function cloneTemplateContent(t, doc) {
  return doc.importNode(t.content, true);
}

export default class MarkdownElement extends HTMLElement {
  static get observedAttributes() {
    return [
      "src",
      "no-shadow",
      "no-auto",
      "body-class",
      "styled",
      "style-prefix",
    ];
  }

  /** @type {ShadowRoot | null} */
  #shadow = null;

  /** @type {MutationObserver | null} */
  #mo = null;

  /** @type {AbortController | null} */
  #abort = null;

  /** @type {Promise<any> | null} */
  #pipelinePromise = null;

  /** @type {number} */
  #renderToken = 0;

  connectedCallback() {
    this.#setupRoot();

    if (!this.hasAttribute("no-auto")) {
      this.render();
      this.#observe();
    }
  }

  disconnectedCallback() {
    this.#mo?.disconnect();
    this.#mo = null;
    this.#abort?.abort();
    this.#abort = null;
    this.#renderToken++;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    if (name === "no-shadow") {
      this.#setupRoot(true);
    }

    if (!this.hasAttribute("no-auto")) {
      this.render();
    }
  }

  get styled() {
    return !isFalseyAttr(this.getAttribute("styled"));
  }

  get stylePrefix() {
    const p = (this.getAttribute("style-prefix") ?? "md-").trim();
    return p ? (p.endsWith("-") ? p : `${p}-`) : "md-";
  }

  get src() {
    return this.getAttribute("src") ?? "";
  }

  get noShadow() {
    return this.hasAttribute("no-shadow");
  }

  get noAuto() {
    return this.hasAttribute("no-auto");
  }

  get bodyClass() {
    return (this.getAttribute("body-class") ?? "").trim();
  }

  /** @returns {HTMLElement | ShadowRoot} */
  #getRenderHost() {
    if (this.noShadow) return this;
    if (!this.#shadow) this.#shadow = this.attachShadow({ mode: "open" });
    return this.#shadow;
  }

  /** @param {boolean=} force */
  #setupRoot(force = false) {
    if (force) {
      if (this.#shadow) this.#shadow.innerHTML = "";
      const existing = this.querySelector(":scope > [data-md-host]");
      existing?.remove();
    }

    const host = this.#getRenderHost();

    if (this.noShadow) {
      let container = this.querySelector(":scope > [data-md-host]");
      if (!container) {
        container = document.createElement("div");
        container.setAttribute("data-md-host", "");
        this.prepend(container);
      }
      return;
    }

    if (!(host instanceof ShadowRoot)) return;
    if (!host.querySelector("[data-md-host]")) {
      const container = document.createElement("div");
      container.setAttribute("data-md-host", "");
      host.append(container);
    }
  }

  #observe() {
    if (this.#mo) return;

    this.#mo = new MutationObserver((mutations) => {
      const shouldRerender = mutations.some((m) => {
        if (this.noShadow) {
          const n = /** @type {Node} */ (m.target);
          const host = this.querySelector(":scope > [data-md-host]");
          if (host && (n === host || host.contains(n))) return false;
        }
        return true;
      });

      if (shouldRerender && !this.noAuto) this.render();
    });

    this.#mo.observe(this, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        "data-dedent",
        "data-prepend",
        "data-append",
        "data-merge",
      ],
    });
  }

  /** @returns {HTMLScriptElement | null} */
  #inlineMarkdownScript() {
    return /** @type {HTMLScriptElement | null} */ (
      this.querySelector('script[type="text/markdown"]')
    );
  }

  /** @returns {string} */
  #readInlineMarkdown() {
    const s = this.#inlineMarkdownScript();
    if (!s) return "";
    const raw = s.textContent ?? "";
    if (s.hasAttribute("data-dedent")) {
      const lines = raw.replace(/\r\n?/g, "\n").split("\n");
      const nonEmpty = lines.filter((l) => l.trim().length);
      const indents = nonEmpty
        .map((l) => (l.match(/^[ \t]*/)?.[0].length ?? 0))
        .filter((n) => n > 0);
      const min = indents.length ? Math.min(...indents) : 0;
      return lines.map((l) => l.slice(min)).join("\n").trim();
    }
    return raw.trim();
  }

  /** @returns {Promise<string>} */
  async #loadMarkdown() {
    const src = this.src.trim();
    if (!src) return this.#readInlineMarkdown();

    this.#abort?.abort();
    this.#abort = new AbortController();

    const f = GlobalConfig.fetch ?? fetch.bind(globalThis);
    const res = await f(src, {
      signal: this.#abort.signal,
      credentials: "same-origin",
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch src (${res.status} ${res.statusText})`);
    }
    return await res.text();
  }

  /** @returns {Promise<{unified:any, remarkParse:any, remarkGfm:any, remarkRehype:any, rehypeRaw:any, rehypeStringify:any}>} */
  // deno-lint-ignore require-await
  async #pipeline() {
    if (this.#pipelinePromise) return this.#pipelinePromise;

    this.#pipelinePromise = (async () => {
      const [
        { unified },
        { default: remarkParse },
        { default: remarkGfm },
        { default: remarkRehype },
        { default: rehypeRaw },
        { default: rehypeStringify },
      ] = await Promise.all([
        import("https://esm.sh/unified@11.0.5?bundle"),
        import("https://esm.sh/remark-parse@11.0.0?bundle"),
        import("https://esm.sh/remark-gfm@4.0.1?bundle"),
        import("https://esm.sh/remark-rehype@11.1.2?bundle"),
        import("https://esm.sh/rehype-raw@7.0.0?bundle"),
        import("https://esm.sh/rehype-stringify@10.0.1?bundle"),
      ]);

      return {
        unified,
        remarkParse,
        remarkGfm,
        remarkRehype,
        rehypeRaw,
        rehypeStringify,
      };
    })();

    return this.#pipelinePromise;
  }

  /** @param {string} markdown */
  async #renderMarkdownToHtml(markdown) {
    const {
      unified,
      remarkParse,
      remarkGfm,
      remarkRehype,
      rehypeRaw,
      rehypeStringify,
    } = await this.#pipeline();

    // Restored default: true (so your <pre class="mermaid"> in markdown works)
    const allowDangerousHtml = GlobalConfig.allowDangerousHtml ?? true;

    const p = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype, { allowDangerousHtml })
      .use(allowDangerousHtml ? rehypeRaw : () => {})
      .use(rehypeStringify, { allowDangerousHtml });

    const file = await p.process(markdown);
    return String(file);
  }

  /** @returns {{host: HTMLElement | ShadowRoot, mount: HTMLElement}} */
  #mountPoint() {
    const host = this.#getRenderHost();

    if (this.noShadow) {
      let mount = /** @type {HTMLElement | null} */ (
        this.querySelector(":scope > [data-md-host]")
      );
      if (!mount) {
        mount = document.createElement("div");
        mount.setAttribute("data-md-host", "");
        this.prepend(mount);
      }
      return { host, mount };
    }

    const sr = /** @type {ShadowRoot} */ (host);
    let mount =
      /** @type {HTMLElement | null} */ (sr.querySelector("[data-md-host]"));
    if (!mount) {
      mount = document.createElement("div");
      mount.setAttribute("data-md-host", "");
      sr.append(mount);
    }
    return { host, mount };
  }

  /** @param {HTMLElement | ShadowRoot} host @param {HTMLElement} mount */
  #applyTemplateAndStyles(host, mount) {
    const p = this.stylePrefix;
    const doc = document;

    const replacementTemplate = /** @type {HTMLTemplateElement | null} */ (
      this.querySelector(
        ":scope > template:not([data-prepend]):not([data-append]):not([data-merge])",
      )
    );

    /** @type {DocumentFragment} */
    const frag = doc.createDocumentFragment();

    const prepend = collectTemplates(this, ":scope > template[data-prepend]");
    const append = collectTemplates(this, ":scope > template[data-append]");
    const merge = collectTemplates(this, ":scope > template[data-merge]");

    if (replacementTemplate) {
      frag.append(cloneTemplateContent(replacementTemplate, doc));
    } else {
      if (this.styled) {
        const style = doc.createElement("style");
        style.textContent = defaultCss(p);
        frag.append(style);
      }

      const mergePre = merge.filter((t) =>
        (t.getAttribute("data-merge") ?? "").toLowerCase() === "prepend"
      );
      const mergeApp = merge.filter((t) =>
        (t.getAttribute("data-merge") ?? "").toLowerCase() === "append"
      );

      const orderedPre = [...prepend, ...mergePre];
      const orderedApp = [...mergeApp, ...append];

      if (orderedPre.length) {
        const preFrag = doc.createDocumentFragment();
        for (const t of orderedPre) {
          preFrag.append(cloneTemplateContent(t, doc));
        }
        frag.prepend(preFrag);
      }

      for (const t of orderedApp) frag.append(cloneTemplateContent(t, doc));
    }

    mount.innerHTML = "";

    const styleTarget = this.noShadow ? mount : host;

    if (!this.noShadow && styleTarget instanceof ShadowRoot) {
      for (const n of Array.from(styleTarget.childNodes)) {
        if (
          n.nodeType === Node.ELEMENT_NODE &&
          /** @type {Element} */ (n).matches?.("style,link,meta")
        ) {
          styleTarget.removeChild(n);
        }
      }
      styleTarget.prepend(frag);
      return;
    }

    /** @type {HTMLElement} */ (styleTarget).prepend(frag);
  }

  /** @param {HTMLElement} root */
  #applyClasses(root) {
    const p = this.stylePrefix;
    root.classList.add(`${p}root`);
    const bc = this.bodyClass;
    if (bc) root.classList.add(...bc.split(/\s+/).filter(Boolean));
  }

  /** @param {HTMLElement} root */
  #ensureHeadingIds(root) {
    const used = new Set(
      Array.from(root.querySelectorAll("[id]"))
        .map((n) => /** @type {HTMLElement} */ (n).id)
        .filter(Boolean),
    );

    for (const h of root.querySelectorAll("h1,h2,h3,h4,h5,h6")) {
      const el = /** @type {HTMLElement} */ (h);
      if (el.id) continue;

      const txt = (el.textContent ?? "").trim().toLowerCase();
      if (!txt) continue;

      const base = txt
        .replace(/[^\p{L}\p{N}\s-]/gu, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

      if (!base) continue;

      let candidate = base;
      let i = 2;
      while (used.has(candidate)) candidate = `${base}-${i++}`;
      el.id = candidate;
      used.add(candidate);
    }
  }

  /** structural post-processing safe offscreen */
  #postProcessStructural(root, baseUrl) {
    rewriteRelativeUrls(root, baseUrl);
    hardenLinks(root);
    this.#ensureHeadingIds(root);
  }

  /** enhancements must run after root is connected */
  #enhance(root, token) {
    // Mermaid
    const mermaidCodeFences = Array.from(
      root.querySelectorAll("pre code.language-mermaid, pre code.mermaid"),
    );
    const mermaidRawBlocks = Array.from(
      root.querySelectorAll("pre.mermaid, div.mermaid"),
    );

    if (mermaidCodeFences.length || mermaidRawBlocks.length) {
      const runMermaid = async () => {
        if (token !== this.#renderToken || !root.isConnected) return;

        const mod = await import(
          "https://cdn.jsdelivr.net/npm/mermaid@11.12.2/+esm"
        );
        if (token !== this.#renderToken || !root.isConnected) return;

        const mermaid = globalThis.mermaid ?? mod.default ?? mod.mermaid ?? mod;
        if (!mermaid) return;

        try {
          mermaid.initialize?.({ startOnLoad: false });
        } catch {
          // ignore
        }

        // fenced blocks
        for (const codeEl of mermaidCodeFences) {
          if (token !== this.#renderToken || !root.isConnected) return;
          if (!(codeEl instanceof HTMLElement) || !codeEl.isConnected) continue;

          const pre = codeEl.closest("pre");
          if (!pre || !pre.isConnected) continue;

          const src = codeEl.textContent ?? "";
          const id = `md-mermaid-${Math.random().toString(36).slice(2)}`;

          try {
            const out = await mermaid.render(id, src);
            if (token !== this.#renderToken || !root.isConnected) return;

            const svg = out?.svg ?? String(out ?? "");
            const wrap = document.createElement("div");
            wrap.className = "mermaid";
            wrap.innerHTML = svg;
            pre.replaceWith(wrap);
            out?.bindFunctions?.(wrap);
          } catch (e) {
            console.warn("Mermaid render failed (fenced block)", e);
          }
        }

        // raw blocks
        for (const el of mermaidRawBlocks) {
          if (token !== this.#renderToken || !root.isConnected) return;
          if (!(el instanceof HTMLElement) || !el.isConnected) continue;

          const src = el.textContent ?? "";
          const id = `md-mermaid-${Math.random().toString(36).slice(2)}`;

          try {
            const out = await mermaid.render(id, src);
            if (token !== this.#renderToken || !root.isConnected) return;

            const svg = out?.svg ?? String(out ?? "");
            const wrap = document.createElement("div");
            wrap.className = "mermaid";
            wrap.innerHTML = svg;
            el.replaceWith(wrap);
            out?.bindFunctions?.(wrap);
          } catch (e) {
            console.warn("Mermaid render failed (raw block)", e);
          }
        }
      };

      queueMicrotask(() => void runMermaid());
    }

    // highlight.js (skip mermaid blocks)
    const codeBlocks = Array.from(root.querySelectorAll("pre code")).filter(
      (c) => {
        const el = /** @type {HTMLElement} */ (c);
        return !(el.classList.contains("language-mermaid") ||
          el.classList.contains("mermaid"));
      },
    );

    if (codeBlocks.length) {
      const runHighlight = async () => {
        if (token !== this.#renderToken || !root.isConnected) return;

        const mod = await import("https://esm.sh/highlight.js@11.10.0?bundle");
        if (token !== this.#renderToken || !root.isConnected) return;

        const hljs = globalThis.hljs ?? mod.default ?? mod.hljs ?? mod;
        if (!hljs || typeof hljs.highlightElement !== "function") return;

        for (const code of codeBlocks) {
          if (token !== this.#renderToken || !root.isConnected) return;
          if (!(code instanceof HTMLElement) || !code.isConnected) continue;
          try {
            hljs.highlightElement(code);
          } catch {
            // ignore
          }
        }
      };

      queueMicrotask(() => void runHighlight());
    }

    // KaTeX
    const hasMath = /\$\$[\s\S]+?\$\$|(^|[^\\])\$(?!\s)([\s\S]+?)(?<!\s)\$/m
      .test(root.textContent ?? "");

    if (hasMath) {
      const runKatex = async () => {
        if (token !== this.#renderToken || !root.isConnected) return;

        const host = this.#getRenderHost();
        const styleTarget = this.noShadow ? root : host;

        const cssHref =
          "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css";

        const q = /** @type {any} */ (styleTarget).querySelector?.bind(
          styleTarget,
        );
        const already = q ? q('link[data-md-katex=""]') : null;

        if (!already) {
          const link = document.createElement("link");
          link.setAttribute("data-md-katex", "");
          link.rel = "stylesheet";
          link.href = cssHref;

          if (styleTarget instanceof ShadowRoot) styleTarget.prepend(link);
          /** @type {HTMLElement} */ else (styleTarget).prepend(link);
        }

        const ar = await import(
          "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.mjs"
        );
        if (token !== this.#renderToken || !root.isConnected) return;

        const renderMathInElement = globalThis.renderMathInElement ??
          ar.default ?? ar.renderMathInElement;

        if (typeof renderMathInElement !== "function") return;

        try {
          renderMathInElement(root, {
            delimiters: [
              { left: "$$", right: "$$", display: true },
              { left: "$", right: "$", display: false },
            ],
            throwOnError: false,
          });
        } catch {
          // ignore
        }
      };

      queueMicrotask(() => void runKatex());
    }
  }

  async render() {
    const token = ++this.#renderToken;

    const { host, mount } = this.#mountPoint();
    const p = this.stylePrefix;

    this.setAttribute("aria-busy", "true");
    this.removeAttribute("data-rendered");

    const hadExisting = mount.querySelector(`.${p}root`) != null;

    if (!hadExisting) {
      this.#applyTemplateAndStyles(host, mount);
      const placeholder = document.createElement("div");
      placeholder.className = `${p}root`;
      placeholder.innerHTML =
        `<span class="${p}spinner" aria-hidden="true"></span> <span class="${p}muted">Rendering…</span>`;
      mount.append(placeholder);
    }

    /** @type {URL | null} */
    let baseUrl = null;
    const src = this.src.trim();

    try {
      const markdown = await this.#loadMarkdown();
      if (token !== this.#renderToken) return;

      if (src) {
        try {
          baseUrl = new URL(src, document.baseURI);
        } catch {
          baseUrl = null;
        }
      }

      const html = await this.#renderMarkdownToHtml(markdown);
      if (token !== this.#renderToken) return;

      // Build offscreen
      const nextContainer = document.createElement("article");
      this.#applyClasses(nextContainer);
      nextContainer.innerHTML = html || "";

      // Structural post-processing offscreen
      this.#postProcessStructural(nextContainer, baseUrl);

      // Swap atomically (FOUC prevention)
      this.#applyTemplateAndStyles(host, mount);
      mount.append(nextContainer);

      // Enhancements + hash scroll must run after connect
      queueMicrotask(() => {
        if (token !== this.#renderToken) return;

        const hash = globalThis.location?.hash ?? "";
        if (hash && hash.length > 1) {
          try {
            const id = decodeURIComponent(hash.slice(1));
            const target = nextContainer.querySelector(`#${CSS.escape(id)}`);
            if (target) {
              target.scrollIntoView({ block: "start", behavior: "auto" });
            }
          } catch {
            // ignore
          }
        }

        this.#enhance(nextContainer, token);
      });

      this.setAttribute("data-rendered", "");
      this.setAttribute("aria-busy", "false");

      const detail = { src: src || null, markdown };

      this.dispatchEvent(
        new CustomEvent("rendered", { detail, bubbles: true, composed: true }),
      );
      globalThis.dispatchEvent(
        new CustomEvent("markdown-rendered", { detail }),
      );
    } catch (err) {
      if (token !== this.#renderToken) return;

      this.setAttribute("aria-busy", "false");

      this.#applyTemplateAndStyles(host, mount);

      const msg = err instanceof Error ? err.message : String(err);
      const container = document.createElement("article");
      this.#applyClasses(container);
      container.innerHTML =
        `<div class="${p}error">Markdown render failed: ${msg}</div>`;
      mount.append(container);

      this.dispatchEvent(
        new CustomEvent("error", {
          detail: { error: err },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }
}

// Optional auto-register
const tagName = (GlobalConfig.tagName ?? "markdown-html").toLowerCase();
if (!customElements.get(tagName)) {
  customElements.define(tagName, MarkdownElement);
}
