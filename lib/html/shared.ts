// lib/html/shared.ts
// Shared runtime + types safe for server and client.

export type AttrValue =
  | string
  | number
  | boolean
  | null
  | undefined;

export type Attrs = Record<string, AttrValue>;

export type Child =
  | string
  | number
  | boolean
  | null
  | undefined
  | RawHtml
  | Child[];

export type RawHtml = { readonly __rawHtml: string };

export function raw(html: string): RawHtml {
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

export function flattenChildren(
  children: readonly Child[],
): (string | RawHtml)[] {
  const out: (string | RawHtml)[] = [];
  const visit = (c: Child): void => {
    if (c == null || c === false) return;
    if (Array.isArray(c)) {
      for (const x of c) visit(x);
      return;
    }
    if (typeof c === "object" && "__rawHtml" in c) {
      out.push(c as RawHtml);
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

  const keys = Object.keys(attrs).sort(); // deterministic output for tests
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
