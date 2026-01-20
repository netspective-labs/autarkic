// lib/universal/fluent-html_test.ts
import { assertEquals } from "@std/assert";
import * as F from "./fluent-html.ts";

Deno.test(
  "renderPretty: full HTML page skeleton (pico css + header/main/footer + inline js)",
  () => {
    const page = F.renderPretty(
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
            href:
              "https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css",
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
            F.javaScript`
              (() => {
                const btn = document.getElementById('btn');
                const status = document.getElementById('status');
                if (!btn || !status) return;
                btn.addEventListener('click', () => { status.textContent = 'clicked'; });
              })();
            `,
          ),
        ),
      ),
    );

    assertEquals(
      page.trim(),
      `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta content="width=device-width, initial-scale=1" name="viewport">
    <title>Fluent HTML Test Page</title>
    <link href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css" rel="stylesheet">
  </head>
  <body>
    <header class="container">
      <nav>
        <ul>
          <li><strong>Fluent HTML</strong></li>
        </ul>
        <ul>
          <li><a href="#main">Main</a></li>
          <li><a href="#footer">Footer</a></li>
        </ul>
      </nav>
    </header>
    <main class="container" id="main">
      <h1>Hello</h1>
      <p>This page is rendered on the server using fluent HTML.</p>
      <section>
        <h2>Actions</h2><button id="btn" type="button">Click me</button>
        <p><small>JS will update the status below.</small></p>
        <p id="status">idle</p>
      </section>
    </main>
    <footer class="container" id="footer"><small>© 2026</small></footer>
    <script>(() => {
  const btn = document.getElementById('btn');
  const status = document.getElementById('status');
  if (!btn || !status) return;
  btn.addEventListener('click', () => { status.textContent = 'clicked'; });
})();</script>
  </body>
</html>`,
    );
  },
);

Deno.test(
  "renderPretty: full HTML page skeleton (pico css + header/main/footer + inline js) using builders + helpers",
  () => {
    const nav = [
      { href: "#main", label: "Main" },
      { href: "#footer", label: "Footer" },
    ];

    const page = F.renderPretty(
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
                      F.each(
                        nav,
                        (it) => F.li(F.a({ href: it.href }, it.label)),
                      ),
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

            e(F.footer(
              { id: "footer", class: "container" },
              F.small("© 2026"),
            ));

            e(
              F.script(
                F.javaScript`
                  (() => {
                    const btn = document.getElementById('btn');
                    const status = document.getElementById('status');
                    if (!btn || !status) return;
                    btn.addEventListener('click', () => { status.textContent = 'clicked'; });
                  })();
                `,
              ),
            );
          }),
        );
      }),
    );

    assertEquals(
      page.trim(),
      `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta content="width=device-width, initial-scale=1" name="viewport">
    <title>Fluent HTML Test Page</title>
    <link href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css" rel="stylesheet">
  </head>
  <body>
    <header class="container">
      <nav>
        <ul>
          <li><strong>Fluent HTML</strong></li>
        </ul>
        <ul>
          <li><a href="#main">Main</a></li>
          <li><a href="#footer">Footer</a></li>
        </ul>
      </nav>
    </header>
    <main class="container" id="main">
      <h1>Hello</h1>
      <p>This page is rendered on the server using fluent HTML.</p>
      <section>
        <h2>Actions</h2><button id="btn" type="button">Click me</button>
        <p><small>JS will update the status below.</small></p>
        <p id="status">idle</p>
      </section>
    </main>
    <footer class="container" id="footer"><small>© 2026</small></footer>
    <script>(() => {
  const btn = document.getElementById('btn');
  const status = document.getElementById('status');
  if (!btn || !status) return;
  btn.addEventListener('click', () => { status.textContent = 'clicked'; });
})();</script>
  </body>
</html>`,
    );
  },
);

Deno.test("fluent-html: helpers + security + voids", async (t) => {
  await t.step(
    "children builder: preserves ordering with trailing children",
    () => {
      const html = F.renderPretty(
        F.div({ id: "x" }, (e) => {
          for (const n of [1, 2, 3]) e(F.span(String(n)));
          e(" mid ");
        }, "tail"),
      );

      assertEquals(
        html.trim(),
        `<div id="x"><span>1</span><span>2</span><span>3</span> mid tail</div>`,
      );
    },
  );

  await t.step("attrs helper: merges deterministically (later wins)", () => {
    const html = F.renderPretty(
      F.div(F.attrs({ a: "1", z: "9" }, { z: "3", m: "2" }), "x"),
    );
    assertEquals(html.trim(), `<div a="1" m="2" z="3">x</div>`);
  });

  await t.step("cls helper: builds class string from maps/arrays", () => {
    const html = F.render(
      F.div(
        { class: F.cls("a", ["b", { c: true, d: false }]) },
        "x",
      ),
    );
    assertEquals(html.trim(), `<div class="a b c">x</div>`);
  });

  await t.step("css helper: style object to stable style text", () => {
    const html = F.render(
      F.div({ style: F.css({ backgroundColor: "red", zIndex: 2 }) }, "x"),
    );
    assertEquals(
      html.trim(),
      `<div style="background-color:red;z-index:2;">x</div>`,
    );
  });

  await t.step("security: text is escaped by default", () => {
    const html = F.render(F.div("<script>alert(1)</script>"));
    assertEquals(
      html.trim(),
      `<div>&#x3C;script>alert(1)&#x3C;/script></div>`,
    );
  });

  await t.step("raw: opt-in html injection is preserved", () => {
    const html = F.render(F.div(F.trustedRaw("<b>ok</b>")));
    assertEquals(html.trim(), `<div><b>ok</b></div>`);
  });

  await t.step("attrs: deterministic ordering", () => {
    const html = F.render(F.div({ z: "3", a: "1", m: "2" }, "x"));
    assertEquals(html.trim(), `<div a="1" m="2" z="3">x</div>`);
  });

  await t.step("boolean attrs: true emits bare attr, false omitted", () => {
    const html = F.render(
      F.input({ disabled: true, hidden: false, value: "x" }),
    );
    assertEquals(html.trim(), `<input disabled value="x">`);
  });

  await t.step("void elements: no closing tag (sample)", () => {
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
});

Deno.test("browser user agent (UA) dependencies: normalize + head tags", async (t) => {
  await t.step("normalizeUaRoute: infers and preserves `as`", () => {
    const css = F.normalizeUaRoute({
      mountPoint: "/base.css",
      canonicalSource: "https://cdn/base.css",
      nature: "reference",
      mimeType: "text/css",
    });
    assertEquals(css.normalizedAs, "style");

    const js = F.normalizeUaRoute({
      mountPoint: "/app.js",
      canonicalSource: "https://cdn/app.js",
      nature: "reference",
      mimeType: "application/javascript",
    });
    assertEquals(js.normalizedAs, "module");

    const other = F.normalizeUaRoute({
      mountPoint: "/misc.bin",
      canonicalSource: "https://cdn/misc.bin",
      nature: "reference",
      mimeType: "application/octet-stream",
    });
    assertEquals(other.normalizedAs, "other");

    const explicit = F.normalizeUaRoute({
      mountPoint: "/legacy.js",
      canonicalSource: "https://cdn/legacy.js",
      nature: "reference",
      mimeType: "text/javascript",
      as: "script",
    });
    assertEquals(explicit.normalizedAs, "script");
  });

  await t.step("uaHeadTags: emits head markup for known types", () => {
    const deps: F.UaDependency[] = [
      {
        mountPoint: "/base.css",
        canonicalSource: "https://cdn/base.css",
        nature: "reference",
        mimeType: "text/css",
        integrity: "sha-css",
        crossOrigin: "anonymous",
      },
      {
        mountPoint: "/legacy.js",
        canonicalSource: "https://cdn/legacy.js",
        nature: "reference",
        mimeType: "text/javascript",
        as: "script",
        integrity: "sha-legacy",
      },
      {
        mountPoint: "/app.js",
        canonicalSource: "https://cdn/app.js",
        nature: "reference",
        mimeType: "application/javascript",
      },
      {
        mountPoint: "/preload.js",
        canonicalSource: "https://cdn/preload.js",
        nature: "reference",
        mimeType: "application/javascript",
        as: "preload",
        crossOrigin: "use-credentials",
      },
      {
        mountPoint: "/misc.bin",
        canonicalSource: "https://cdn/misc.bin",
        nature: "reference",
        mimeType: "application/octet-stream",
      },
    ];

    const html = F.renderPretty(F.head(F.browserUserAgentHeadTags(deps)));
    assertEquals(
      html.trim(),
      `<head>
  <link crossorigin="anonymous" href="/base.css" integrity="sha-css" rel="stylesheet">
  <script integrity="sha-legacy" src="/legacy.js"></script>
  <script src="/app.js" type="module"></script>
  <link as="script" crossorigin="use-credentials" href="/preload.js" rel="preload"><!--ua dep: /misc.bin-->
</head>`,
    );
  });

  await t.step("uaHeadTags: inline content dependencies", () => {
    const deps: F.UaDependency[] = [
      {
        mountPoint: "/inline.css",
        canonicalSource: "body{color:red;}",
        nature: "content",
        mimeType: "text/css",
      },
      {
        mountPoint: "/inline.js",
        canonicalSource: "console.log(1);",
        nature: "content",
        mimeType: "application/javascript",
      },
    ];

    const html = F.renderPretty(F.head(F.browserUserAgentHeadTags(deps)));
    assertEquals(
      html.trim(),
      `<head>
  <style>body{color:red;}</style>
  <script type="module">console.log(1);</script>
</head>`,
    );
  });
});
