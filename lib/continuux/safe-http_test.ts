// lib/continuux/safe-http_test.ts
import { assert, assertEquals, assertThrows } from "@std/assert";
import { Application, EmptyRecord } from "./http.ts";
import { type SafeHref, safeHttp } from "./safe-http.ts";

Deno.test("safe-http: documentation-style tests", async (t) => {
  await t.step(
    "href: paramless route supports 1-arg call and returns branded string",
    () => {
      const app = Application.sharedState({});
      const safe = safeHttp(app, { sitePrefix: "/base" });

      const safe2 = safe.get("/dashboard", () => new Response("ok"));

      const href = safe2.href("/dashboard");
      assertEquals(typeof href, "string");

      const s: string = href;
      assertEquals(s, "/base/dashboard");

      const sh: SafeHref = href;
      assertEquals(sh, "/base/dashboard");
    },
  );

  await t.step("href: param route requires params and encodes values", () => {
    const app = Application.sharedState({});
    const safe = safeHttp(app, { sitePrefix: "/base" });

    const safe2 = safe.get(
      "/hello/:name",
      { purpose: "demo" as const },
      (c) => new Response(`hi ${c.params.name}`),
    );

    const href = safe2.href("/hello/:name", { name: "Alice Bob" });
    assertEquals(href, "/base/hello/Alice%20Bob");

    const href2 = safe2.href("/hello/:name", { name: "A/B" });
    assertEquals(href2, "/base/hello/A%2FB");
  });

  await t.step("href: query + hash", () => {
    const app = Application.sharedState({});
    const safe = safeHttp(app, { sitePrefix: "/base" });

    const safe2 = safe.get("/dashboard", () => new Response("ok"));

    const href = safe2.href("/dashboard", {
      query: { a: 1, b: "two", c: null },
      hash: "top",
    });
    assertEquals(href, "/base/dashboard?a=1&b=two#top");

    const href2 = safe2.href("/dashboard", { query: { a: true }, hash: "#x" });
    assertEquals(href2, "/base/dashboard?a=true#x");
  });

  await t.step("parse: maps incoming path to route id + decoded params", () => {
    const app = Application.sharedState({});
    const safe = safeHttp(app, { sitePrefix: "/base" });

    const safe2 = safe
      .get("/dashboard", () => new Response("ok"))
      .get(
        "/hello/:name",
        { kind: "page" as const },
        (c) => new Response(c.params.name),
      );

    const m1 = safe2.parse("/base/dashboard");
    assert(m1);
    assertEquals(m1.id, "/dashboard");
    assertEquals(m1.params, {});

    const m2 = safe2.parse("/base/hello/Alice%20Bob");
    assert(m2);
    assertEquals(m2.id, "/hello/:name");
    assertEquals(m2.params, { name: "Alice Bob" });

    const m3 = safe2.parse("https://example.com/base/hello/Zed");
    assert(m3);
    assertEquals(m3.id, "/hello/:name");
    assertEquals(m3.params, { name: "Zed" });
  });

  await t.step("wildcard route: href + parse", () => {
    const app = Application.sharedState({});
    const safe = safeHttp(app, { sitePrefix: "/base" });

    const safe2 = safe.get("/files/*path", () => new Response("ok"));

    const href = safe2.href("/files/*path", { path: "a/b/c.txt" });
    assertEquals(href, "/base/files/a/b/c.txt");

    const m = safe2.parse("/base/files/a/b/c.txt");
    assert(m);
    assertEquals(m.id, "/files/*path");
    assertEquals(m.params, { path: "a/b/c.txt" });
  });

  await t.step(
    "elaboration: stored and retrievable, never used for decisions",
    () => {
      const app = Application.sharedState({});
      const safe = safeHttp(app);

      type Elab = {
        readonly role: "public" | "admin";
        readonly navLabel?: string;
      };

      const safe2 = safe
        .get(
          "/public",
          { role: "public", navLabel: "Home" } satisfies Elab,
          () => new Response("ok"),
        )
        .get(
          "/admin",
          { role: "admin" } satisfies Elab,
          () => new Response("ok"),
        );

      const e1 = safe2.elaboration("/public");
      assert(e1);
      assertEquals((e1 as Elab).role, "public");
      assertEquals((e1 as Elab).navLabel, "Home");

      const e2 = safe2.elaboration("/admin");
      assert(e2);
      assertEquals((e2 as Elab).role, "admin");
    },
  );

  await t.step(
    "assertNoDrift: detects when routes are added to app without safe-http",
    () => {
      const app = Application.sharedState({});
      const safe = safeHttp(app);

      const safe2 = safe.get("/dashboard", () => new Response("ok"));

      app.get("/raw", () => new Response("raw"));

      assertThrows(
        () => safe2.assertNoDrift(),
        Error,
        "safe-http drift detected.",
      );
    },
  );

  await t.step("href: throws for unknown route ids at runtime", () => {
    const app = Application.sharedState({});
    const safe = safeHttp(app);

    const safe2 = safe.get("/dashboard", () => new Response("ok"));

    assertThrows(
      () =>
        (safe2 as unknown as { href: (id: string) => string }).href("/nope"),
      Error,
      "Unknown route id",
    );
  });
});

Deno.test("safeHttp (typed href + parse + elaboration)", async (t) => {
  type State = EmptyRecord;

  type Elab = {
    readonly summary: string;
    readonly tags?: readonly string[];
  };

  await t.step(
    "Elaboration typing is provided at factory call site (no satisfies needed)",
    () => {
      const app = Application.sharedState<State>({});

      // Key point: pass Elaboration as the 3rd generic to safeHttp().
      // Now each route can accept strongly-typed elaboration inline.
      const r = safeHttp<State, EmptyRecord, Elab>(app)
        .get(
          "/hello/:name",
          { summary: "Say hello", tags: ["demo"] },
          (c) => c.text(`hi ${c.params.name}`),
        )
        .get("/health", { summary: "Healthcheck" }, (c) => c.text("ok"));

      // elaboration() is typed per-route
      const e1 = r.elaboration("/hello/:name");
      assertEquals(e1?.summary, "Say hello");
      assertEquals(e1?.tags?.[0], "demo");

      const e2 = r.elaboration("/health");
      assertEquals(e2?.summary, "Healthcheck");
    },
  );

  await t.step(
    "href() builds a SafeHref string (usable as string) + query/hash",
    () => {
      const app = Application.sharedState<State>({});

      const r = safeHttp<State, EmptyRecord, Elab>(app, { sitePrefix: "/ui" })
        .get(
          "/hello/:name",
          { summary: "Say hello" },
          (c) => c.text(`hi ${c.params.name}`),
        )
        .get(
          "/files/*path",
          { summary: "Files" },
          (c) => c.text(c.params.path),
        );

      const h1 = r.href("/hello/:name", { name: "Shahid" });
      // SafeHref is a string subtype so this is fine:
      const s1: string = h1;
      assertEquals(s1, "/ui/hello/Shahid");

      const h2 = r.href("/hello/:name", { name: "A B" }, {
        query: { a: 1, b: true },
        hash: "x",
      });
      assertEquals(String(h2), "/ui/hello/A%20B?a=1&b=true#x");

      const h3 = r.href("/files/*path", { path: "a/b/c.txt" });
      assertEquals(String(h3), "/ui/files/a/b/c.txt");
    },
  );

  await t.step("parse() returns route id + decoded params", () => {
    const app = Application.sharedState<State>({});

    const r = safeHttp<State, EmptyRecord, Elab>(app, { sitePrefix: "/ui" })
      .get(
        "/hello/:name",
        { summary: "Say hello" },
        (c) => c.text(`hi ${c.params.name}`),
      )
      .get(
        "/orders/:id{[0-9]+}",
        { summary: "Order" },
        (c) => c.text(c.params.id),
      )
      .get("/files/*path", { summary: "Files" }, (c) => c.text(c.params.path));

    const m1 = r.parse("/ui/hello/A%20B");
    assert(m1);
    assertEquals(m1.id, "/hello/:name");
    assertEquals(m1.params.name, "A B");

    const m2 = r.parse("https://example.com/ui/orders/123?x=1");
    assert(m2);
    assertEquals(m2.id, "/orders/:id{[0-9]+}");
    assertEquals(m2.params.id, "123");

    const m3 = r.parse("/ui/files/a/b/c.txt");
    assert(m3);
    assertEquals(m3.id, "/files/*path");
    assertEquals(m3.params.path, "a/b/c.txt");

    const m4 = r.parse("/ui/orders/abc");
    assertEquals(m4, null);
  });

  await t.step(
    "assertNoDrift() detects routes in app not registered via safeHttp",
    () => {
      const app = Application.sharedState<State>({});
      app.get("/untyped", (c) => c.text("x"));

      const r = safeHttp<State, EmptyRecord, Elab>(app)
        .get("/typed", { summary: "Typed route" }, (c) => c.text("y"));

      assertThrows(() => r.assertNoDrift(), Error, "drift detected");
    },
  );

  await t.step(
    "fetch works end-to-end (proof that safeHttp registered into Application)",
    async () => {
      const app = Application.sharedState<State>({});

      const r = safeHttp<State, EmptyRecord, Elab>(app)
        .get(
          "/hello/:name",
          { summary: "Say hello" },
          (c) => c.text(`hi ${c.params.name}`),
        );

      // Ensure no drift for this small app
      r.assertNoDrift();

      const res = await app.fetch(
        new Request("http://local/hello/world", { method: "GET" }),
      );
      const txt = await res.text();
      assertEquals(res.status, 200);
      assertEquals(txt, "hi world");
    },
  );
});
