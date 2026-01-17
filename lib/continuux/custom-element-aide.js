/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
// lib/continuux/custom-element-aide.js
//
// Minimal helper to make Custom Elements “Continuux-aware”.
// - Injects a safe, per-instance `cxAide` getter.
// - CxAide owns: sessionId, URL resolution, SSE wiring, JSON posting, action().
// - Includes small reusable attribute helpers (bool/string/json/number/url).
// - Small by design; add features only when they remain end-to-end testable.

const kCx = Symbol("continuux:cxAide");

const kebabFromClassName = (name) => {
  const s = String(name || "").trim();
  const base = s || "x-element";
  const k = base
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
  return k.includes("-") ? k : `x-${k}`;
};

const safeExec = (jsText) => {
  try {
    (0, Function)(String(jsText))();
  } catch {
    // ignore
  }
};

const safeJsonParse = (t) => {
  if (typeof t !== "string" || !t.trim()) return undefined;
  try {
    return JSON.parse(t);
  } catch {
    return undefined;
  }
};

// Attribute helpers that are safe and boring.
export const ceAttr = {
  has(el, name) {
    try {
      return el?.hasAttribute?.(name) || false;
    } catch {
      return false;
    }
  },

  bool(el, name, dflt) {
    try {
      if (el?.hasAttribute?.(name)) {
        const raw = el.getAttribute(name);
        const v = raw == null ? "" : String(raw).trim().toLowerCase();
        if (!v) return true;
        if (v === "true" || v === "1" || v === "yes" || v === "on") return true;
        if (v === "false" || v === "0" || v === "no" || v === "off") {
          return false;
        }
        return dflt;
      }
    } catch {
      // ignore
    }
    return dflt;
  },

  string(el, name, dflt) {
    try {
      const v = el?.getAttribute?.(name);
      return v == null || v === "" ? dflt : String(v);
    } catch {
      return dflt;
    }
  },

  number(el, name, dflt) {
    const t = ceAttr.string(el, name, "");
    if (!t) return dflt;
    const n = Number(t);
    return Number.isFinite(n) ? n : dflt;
  },

  json(el, name, dflt) {
    const t = ceAttr.string(el, name, "");
    if (!t) return dflt;
    const v = safeJsonParse(t);
    return v === undefined ? dflt : v;
  },

  url(el, name, dflt) {
    const t = ceAttr.string(el, name, dflt);
    return t == null ? dflt : String(t);
  },
};

const kDefault = {
  sseUrlAttr: "data-sse-url",
  postUrlAttr: "data-action-url",
  withCredsAttr: "data-with-credentials",
  sseUrl: "/ce/sse",
  postUrl: "/ce/action",
  withCredentials: true,
  jsEventName: "js",
};

const uuid = () => {
  try {
    return globalThis.crypto?.randomUUID?.() ??
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
};

const getOrCreateSessionId = () => {
  try {
    const k = "cx:sessionId";
    let v = localStorage.getItem(k);
    if (!v) {
      v = uuid();
      localStorage.setItem(k, v);
    }
    return v;
  } catch {
    return uuid();
  }
};

const withSessionId = (url, sessionId) => {
  const u = String(url || "").trim();
  if (!u) return "";
  const sep = u.includes("?") ? "&" : "?";
  return `${u}${sep}sessionId=${encodeURIComponent(sessionId)}`;
};

export class CxAide {
  /** @param {HTMLElement} host */
  constructor(host) {
    this.host = host;
    this.#sessionId = getOrCreateSessionId();
    this.#es = null;
    this.#jsEventName = kDefault.jsEventName;
    this.#handlers = Object.create(null);
    this.#sseHandlersBound = false;
  }

  /** @type {EventSource|null} */
  #es;

  /** @type {string} */
  #sessionId;

  /** @type {string} */
  #jsEventName;

  /** @type {Record<string, Function>} */
  #handlers;

  /** @type {boolean} */
  #sseHandlersBound;

  get sessionId() {
    return this.#sessionId;
  }

  get sseUrl() {
    return ceAttr.string(this.host, kDefault.sseUrlAttr, kDefault.sseUrl);
  }
  set sseUrl(v) {
    this.host.setAttribute(kDefault.sseUrlAttr, String(v));
  }

  get postUrl() {
    return ceAttr.string(this.host, kDefault.postUrlAttr, kDefault.postUrl);
  }
  set postUrl(v) {
    this.host.setAttribute(kDefault.postUrlAttr, String(v));
  }

  get withCredentials() {
    return ceAttr.bool(
      this.host,
      kDefault.withCredsAttr,
      kDefault.withCredentials,
    );
  }
  set withCredentials(v) {
    this.host.setAttribute(kDefault.withCredsAttr, v ? "true" : "false");
  }

  get isConnected() {
    return !!this.#es;
  }

  on(eventName, fn) {
    if (typeof eventName !== "string" || !eventName.trim()) return;
    if (typeof fn !== "function") return;
    this.#handlers[eventName] = fn;
    this.#sseHandlersBound = false; // allow rebind on next connect
  }

  off(eventName) {
    if (typeof eventName !== "string" || !eventName.trim()) return;
    delete this.#handlers[eventName];
    this.#sseHandlersBound = false;
  }

  sseConnect(opts = {}) {
    if (this.#es) return;

    const baseUrl = String(opts.url || this.sseUrl || "").trim();
    if (!baseUrl) throw new Error("cxAide.sseConnect requires sseUrl");

    const url = withSessionId(baseUrl, this.#sessionId);

    const withCredentials = (typeof opts.withCredentials === "boolean")
      ? opts.withCredentials
      : this.withCredentials;

    this.#jsEventName = String(opts.jsEventName || this.#jsEventName || "js");

    if (opts.handlers && typeof opts.handlers === "object") {
      for (const [k, v] of Object.entries(opts.handlers)) {
        if (typeof v === "function") this.#handlers[k] = v;
      }
      this.#sseHandlersBound = false;
    }

    this.#es = new EventSource(url, { withCredentials });

    // Bind handlers once per connection.
    if (!this.#sseHandlersBound) {
      this.#es.addEventListener(this.#jsEventName, (ev) => safeExec(ev?.data));

      for (const [eventName, fn] of Object.entries(this.#handlers)) {
        if (eventName === this.#jsEventName) continue;
        if (typeof fn !== "function") continue;

        this.#es.addEventListener(eventName, (ev) => {
          let data = ev?.data;
          try {
            data = typeof data === "string" ? JSON.parse(data) : data;
          } catch {
            // keep as string
          }
          try {
            fn(data, ev);
          } catch {
            // ignore
          }
        });
      }

      this.#sseHandlersBound = true;
    }
  }

  sseDisconnect() {
    if (!this.#es) return;
    try {
      this.#es.close();
    } catch {
      // ignore
    }
    this.#es = null;
    this.#sseHandlersBound = false;
  }

  async postJson(url, body, opts = {}) {
    const u = String(url || "").trim();
    if (!u) throw new Error("cxAide.postJson requires url");

    const res = await fetch(u, {
      method: "POST",
      headers: { "content-type": "application/json", ...(opts.headers || {}) },
      body: JSON.stringify(body ?? null),
      credentials: opts.credentials || "include",
      keepalive: opts.keepalive !== false,
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`${res.status} ${res.statusText}${t ? `\n${t}` : ""}`);
    }
    return res;
  }

  action(action, body = {}) {
    const url = String(this.postUrl || "").trim();
    if (!url) {
      throw new Error("cxAide.action requires postUrl (set cxAide.postUrl)");
    }
    return this.postJson(url, { action, ...body });
  }
}

/**
 * @template {typeof HTMLElement} T
 * @param {T} ElementClass HTMLElement subclass (class definition, not instance)
 * @param {string=} name Optional custom element name ("x-y"). If omitted, derived from class name.
 */
export function customElementAide(ElementClass, name) {
  const resolvedName = name || kebabFromClassName(ElementClass?.name);

  const enhanceInstance = (el) => {
    if (!el || el[kCx]) return el;

    el[kCx] = new CxAide(el);

    Object.defineProperty(el, "cxAide", {
      enumerable: true,
      configurable: false,
      get() {
        return el[kCx];
      },
    });

    return el;
  };

  const instance = () => enhanceInstance(new ElementClass());

  const register = () => {
    if (!customElements.get(resolvedName)) {
      const Original = ElementClass;

      class Wrapped extends Original {
        constructor() {
          super();
          enhanceInstance(this);
        }

        connectedCallback() {
          if (typeof super.connectedCallback === "function") {
            super.connectedCallback();
          }
        }

        disconnectedCallback() {
          try {
            this.cxAide?.sseDisconnect?.();
          } catch {
            // ignore
          }
          if (typeof super.disconnectedCallback === "function") {
            super.disconnectedCallback();
          }
        }
      }

      customElements.define(resolvedName, Wrapped);
    }
    return resolvedName;
  };

  return { name: resolvedName, instance, register };
}
