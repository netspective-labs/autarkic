import { assert, assertEquals, assertMatch } from "@std/assert";
import * as F from "./fluent.ts";

Deno.test("render: full HTML page skeleton (pico css + header/main/footer + inline js)", () => {
  const page = F.render(
    F.doctype(),
    F.html(
      { lang: "en" },
      F.head(
        F.meta({ charset: "utf-8" }),
        F.meta({
          name: "viewport",
          content: "width=device-width, initial-scale=1",
        }),
        F.title("Fluent HTML Test Page"),
        F.link({
          rel: "stylesheet",
          href: "https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css",
        }),
      ),
      F.body(
        F.header(
          { class: "container" },
          F.nav(
            F.ul(F.li(F.strong("Fluent HTML"))),
            F.ul(
              F.li(F.a({ href: "#main" }, "Main")),
              F.li(F.a({ href: "#footer" }, "Footer")),
            ),
          ),
        ),
        F.main(
          { id: "main", class: "container" },
          F.h1("Hello"),
          F.p("This page is rendered on the server using fluent HTML."),
          F.section(
            F.h2("Actions"),
            F.button({ type: "button", id: "btn" }, "Click me"),
            F.p(F.small("JS will update the status below.")),
            F.p({ id: "status" }, "idle"),
          ),
        ),
        F.footer(
          { id: "footer", class: "container" },
          F.small("© 2026"),
        ),
        F.script(
          F.raw(
            [
              "(() => {",
              "  const btn = document.getElementById('btn');",
              "  const status = document.getElementById('status');",
              "  if (!btn || !status) return;",
              "  btn.addEventListener('click', () => { status.textContent = 'clicked'; });",
              "})();",
            ].join("\n"),
          ),
        ),
      ),
    ),
  );

  assertMatch(page, /<!doctype html>/i);
  assertMatch(page, /<html[^>]*\slang="en"/);
  assertMatch(page, /<meta charset="utf-8">/);
  assertMatch(page, /<title>Fluent HTML Test Page<\/title>/);
  assertMatch(page, /@picocss\/pico@2\/css\/pico\.min\.css/);
  assertMatch(page, /<header/);
  assertMatch(page, /<main[^>]*\sid="main"/);
  assertMatch(page, /<footer[^>]*\sid="footer"/);
  assertMatch(page, /addEventListener\('click'/);
});

Deno.test("render: full HTML page skeleton (pico css + header/main/footer + inline js) using builders + helpers", () => {
  const nav = [
    { href: "#main", label: "Main" },
    { href: "#footer", label: "Footer" },
  ];

  const page = F.render(
    F.doctype(),
    F.html({ lang: "en" }, (e) => {
      e(
        F.head((e) => {
          e(
            F.meta({ charset: "utf-8" }),
            F.meta({
              name: "viewport",
              content: "width=device-width, initial-scale=1",
            }),
            F.title("Fluent HTML Test Page"),
            F.link({
              rel: "stylesheet",
              href:
                "https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css",
            }),
          );
        }),
      );

      e(
        F.body((e) => {
          e(
            F.header(
              { class: F.cls("container") },
              F.nav((e) => {
                e(F.ul(F.li(F.strong("Fluent HTML"))));
                e(
                  F.ul(
                    F.each(nav, (it) => F.li(F.a({ href: it.href }, it.label))),
                  ),
                );
              }),
            ),
          );

          e(
            F.main({ id: "main", class: "container" }, (e) => {
              e(
                F.h1("Hello"),
                F.p("This page is rendered on the server using fluent HTML."),
                F.section((e) => {
                  e(
                    F.h2("Actions"),
                    F.button({ type: "button", id: "btn" }, "Click me"),
                    F.p(F.small("JS will update the status below.")),
                    F.p({ id: "status" }, "idle"),
                  );
                }),
              );
            }),
          );

          e(F.footer({ id: "footer", class: "container" }, F.small("© 2026")));

          e(
            F.scriptJs([
              "(() => {",
              "  const btn = document.getElementById('btn');",
              "  const status = document.getElementById('status');",
              "  if (!btn || !status) return;",
              "  btn.addEventListener('click', () => { status.textContent = 'clicked'; });",
              "})();",
            ].join("\n")),
          );
        }),
      );
    }),
  );

  assertMatch(page, /<!doctype html>/i);
  assertMatch(page, /<html[^>]*\slang="en"/);
  assertMatch(page, /<meta charset="utf-8">/);
  assertMatch(page, /@picocss\/pico@2\/css\/pico\.min\.css/);
  assertMatch(page, /<header/);
  assertMatch(page, /<main[^>]*\sid="main"/);
  assertMatch(page, /<footer[^>]*\sid="footer"/);
  assertMatch(page, /addEventListener\('click'/);
});

Deno.test("children builder: preserves ordering with trailing children", () => {
  const html = F.render(
    F.div({ id: "x" }, (e) => {
      for (const n of [1, 2, 3]) e(F.span(String(n)));
      e(" mid ");
    }, "tail"),
  );

  assertEquals(
    html,
    `<div id="x"><span>1</span><span>2</span><span>3</span> mid tail</div>`,
  );
});

Deno.test("attrs helper: merges deterministically (later wins)", () => {
  const html = F.render(
    F.div(
      F.attrs({ a: "1", z: "9" }, { z: "3", m: "2" }),
      "x",
    ),
  );
  assertEquals(html, `<div a="1" m="2" z="3">x</div>`);
});

Deno.test("cls helper: builds class string from maps/arrays", () => {
  const html = F.render(
    F.div(
      { class: F.cls("a", ["b", { c: true, d: false }]) },
      "x",
    ),
  );
  assertMatch(html, /class="a b c"/);
});

Deno.test("css helper: style object to stable style text", () => {
  const html = F.render(
    F.div({ style: F.css({ backgroundColor: "red", zIndex: 2 }) }, "x"),
  );
  assertMatch(html, /style="background-color:red;z-index:2;"/);
});

Deno.test("security: text is escaped by default", () => {
  const html = F.render(F.div("<script>alert(1)</script>"));
  assertMatch(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

Deno.test("raw: opt-in html injection is preserved", () => {
  const html = F.render(F.div(F.raw("<b>ok</b>")));
  assertMatch(html, /<div><b>ok<\/b><\/div>/);
});

Deno.test("attrs: deterministic ordering", () => {
  const html = F.render(F.div({ z: "3", a: "1", m: "2" }, "x"));
  assertEquals(html, `<div a="1" m="2" z="3">x</div>`);
});

Deno.test("boolean attrs: true emits bare attr, false omitted", () => {
  const html = F.render(F.input({ disabled: true, hidden: false, value: "x" }));
  assertMatch(html, /<input /);
  assertMatch(html, /\sdisabled(\s|>)/);
  assertMatch(html, /\svalue="x"/);
  assert(!html.includes(" hidden"));
});

Deno.test("void elements: no closing tag (sample)", () => {
  assertEquals(F.render(F.br()), "<br>");
  assertEquals(
    F.render(F.meta({ charset: "utf-8" })),
    `<meta charset="utf-8">`,
  );
  assertEquals(
    F.render(F.img({ alt: "x", src: "/a.png" })),
    `<img alt="x" src="/a.png">`,
  );
});
