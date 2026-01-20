// lib/natural-html/design-system/starter_test.ts
import { assertEquals } from "@std/assert";
import { starterDesignSystem } from "./starter.ts";
import * as h from "../elements.ts";
import { headSlots } from "../patterns.ts";

Deno.test("fluent-ds-starter: minimal body-only ds", () => {
  const ds = starterDesignSystem();

  const page = h.renderPretty(
    ds.page("Starter", {}, {
      slots: {
        title: () => h.text("Starter DS"),
        lead: () => h.p("PicoCSS-powered starter."),
        content: () => h.p("Hello from the starter design system."),
      },
      headSlots: headSlots({
        title: "Starter DS",
      }),
    }),
  );

  assertEquals(
    page.trim(),
    `<!doctype html>
<html>
  <head>
    <link href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css" rel="stylesheet">
    <title>Starter DS</title>
    <style>
        :root {
          font-size: 85%;
        }
      </style>
  </head>
  <body>
    <main class="container">
      <header>
        <hgroup>
          <h1>Starter DS</h1>
          <p>PicoCSS-powered starter.</p>
        </hgroup>
      </header>
      <section>
        <p>Hello from the starter design system.</p>
      </section>
    </main>
  </body>
</html>`,
  );
});
