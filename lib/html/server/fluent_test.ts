import { assert, assertEquals, assertMatch } from "@std/assert";
import * as F from "./fluent.ts";

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

Deno.test("JunxionUX: clickGet emits exact data-on:click and @get(...)", () => {
  const attrs = F.JunxionUX.clickGet("/x");
  assertEquals(attrs["data-on:click"], `@get("/x")`);
  const html = F.render(F.button({ ...attrs }, "Go"));
  assertMatch(html, /data-on:click="@get\(&quot;\/x&quot;\)"/);
});

Deno.test("JunxionUX: signals emits data-signals JSON", () => {
  const attrs = F.JunxionUX.signals({ a: 1, b: "x" });
  assertEquals(attrs["data-signals"], `{"a":1,"b":"x"}`);
  const html = F.render(F.div({ ...attrs }, "ok"));
  assertMatch(
    html,
    /data-signals="\{&quot;a&quot;:1,&quot;b&quot;:&quot;x&quot;\}"/,
  );
});
