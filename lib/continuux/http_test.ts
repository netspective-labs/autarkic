// lib/continuux/http_test.ts
//
// Deno tests for lib/http/server.ts
//
// Run with:
//   deno test -A lib/continuux/http_test.ts
//
// Notes:
// - Bundling uses Deno.bundle which can require --unstable-bundle. Tests adapt.
// - SSE is a streaming response: this test cancels the body when done.

import {
  Application,
  htmlResponse,
  InMemoryBundler,
  jsonResponse,
  jsResponse,
  methodNotAllowed,
  notFoundPureTsUi,
  observe,
  sseEvery,
  sseSession,
  textResponse,
} from "./http.ts";

const hostname = "127.0.0.1";

type StartedServer = {
  baseUrl: string;
  close: () => Promise<void>;
};

const startServer = (
  handler: (req: Request) => Response | Promise<Response>,
): StartedServer => {
  const server = Deno.serve({ hostname, port: 0, onListen: () => {} }, handler);

  const addr = (server as unknown as { addr: { port: number } }).addr;
  const port = addr.port;

  const baseUrl = `http://${hostname}:${port}`;

  const close = async () => {
    const s = server as unknown as {
      shutdown?: () => void;
      finished?: Promise<unknown>;
    };
    try {
      s.shutdown?.();
    } finally {
      await (s.finished ?? Promise.resolve());
    }
  };

  return { baseUrl, close };
};

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const withTimeout = async <T>(p: Promise<T>, ms: number, label = "timeout") => {
  let id: number | undefined;
  const t = new Promise<never>((_, rej) => {
    id = setTimeout(() => rej(new Error(label)), ms) as unknown as number;
  });
  try {
    return await Promise.race([p, t]);
  } finally {
    if (id !== undefined) clearTimeout(id);
  }
};

// Drain a Response body to satisfy leak sanitizer.
// Works whether or not the body is empty; does not call cancel().
const drain = async (r: Response): Promise<void> => {
  try {
    await r.arrayBuffer();
  } catch {
    // If already consumed/locked, ignore.
  }
};

// For streaming responses like SSE: cancel if not fully drained.
const cancelQuietly = async (r: Response): Promise<void> => {
  try {
    await r.body?.cancel();
  } catch {
    // ignore
  }
};

type SseMessage = {
  event: string;
  data: string;
  raw: string;
};

const parseSseFrames = (text: string): SseMessage[] => {
  const frames = text.split(/\n\n/).map((s) => s.trimEnd()).filter((s) =>
    s.length > 0
  );
  const out: SseMessage[] = [];

  for (const raw of frames) {
    const lines = raw.split(/\r?\n/);
    let event = "message";
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith(":")) continue;
      if (line.startsWith("event:")) event = line.slice("event:".length).trim();
      if (line.startsWith("data:")) {
        dataLines.push(line.slice("data:".length).trimStart());
      }
    }
    out.push({ event, data: dataLines.join("\n"), raw });
  }

  return out;
};

const readSseUntil = async (
  r: Response,
  pred: (acc: { text: string; messages: SseMessage[] }) => boolean,
  ms = 1500,
) => {
  const body = r.body;
  if (!body) throw new Error("SSE response has no body");

  const reader = body.getReader();
  const dec = new TextDecoder();

  let text = "";
  let messages: SseMessage[] = [];

  const run = (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += dec.decode(value, { stream: true });
        messages = parseSseFrames(text);
        if (pred({ text, messages })) break;
      }
      return { text, messages };
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // ignore
      }
    }
  })();

  return await withTimeout(run, ms, "SSE read timeout");
};

const hasDenoBundle = (): boolean => {
  const d = Deno as unknown as { bundle?: unknown };
  return typeof d.bundle === "function";
};

Deno.test("response helpers set correct content-type and body", async (t) => {
  await t.step("textResponse", async () => {
    const r = textResponse("hi");
    if (r.status !== 200) throw new Error("status mismatch");
    if (r.headers.get("content-type") !== "text/plain; charset=utf-8") {
      throw new Error("content-type mismatch");
    }
    const body = await r.text();
    if (body !== "hi") throw new Error("body mismatch");
  });

  await t.step("htmlResponse", async () => {
    const r = htmlResponse("<h1>x</h1>", 201, { "x-test": "1" });
    if (r.status !== 201) throw new Error("status mismatch");
    if (r.headers.get("content-type") !== "text/html; charset=utf-8") {
      throw new Error("content-type mismatch");
    }
    if (r.headers.get("x-test") !== "1") throw new Error("header mismatch");
    const body = await r.text();
    if (body !== "<h1>x</h1>") throw new Error("body mismatch");
  });

  await t.step("jsonResponse", async () => {
    const r = jsonResponse({ a: 1 }, 202);
    if (r.status !== 202) throw new Error("status mismatch");
    if (r.headers.get("content-type") !== "application/json; charset=utf-8") {
      throw new Error("content-type mismatch");
    }
    const body = await r.text();
    if (body !== JSON.stringify({ a: 1 })) throw new Error("body mismatch");
  });

  await t.step("jsResponse", async () => {
    const r = jsResponse("console.log(1)", "max-age=60", 203);
    if (r.status !== 203) throw new Error("status mismatch");
    if (r.headers.get("content-type") !== "text/javascript; charset=utf-8") {
      throw new Error("content-type mismatch");
    }
    if (r.headers.get("cache-control") !== "max-age=60") {
      throw new Error("cache-control mismatch");
    }
    const body = await r.text();
    if (body !== "console.log(1)") throw new Error("body mismatch");
  });

  await t.step("methodNotAllowed", async () => {
    const r = methodNotAllowed("/x", "GET, POST");
    if (r.status !== 405) throw new Error("status mismatch");
    if (r.headers.get("allow") !== "GET, POST") {
      throw new Error("allow mismatch");
    }
    const body = await r.text();
    if (!body.includes("Method not allowed.")) throw new Error("body missing");
    if (!body.includes("Endpoint: /x")) {
      throw new Error("body missing endpoint");
    }
  });
});

Deno.test(
  "InMemoryBundler bundles (or fails predictably), caches, primes, and clears",
  async (t) => {
    const dir = await Deno.makeTempDir({ prefix: "jx-bundler-test-" });
    try {
      const entry = `${dir}/entry.ts`;
      const dep = `${dir}/dep.ts`;

      await Deno.writeTextFile(dep, `export const msg = "bundled-ok";\n`);
      await Deno.writeTextFile(
        entry,
        [
          `import { msg } from "./dep.ts";`,
          `console.log(msg);`,
          `export const value = msg;`,
          ``,
        ].join("\n"),
      );

      const bundler = new InMemoryBundler({ defaultMinify: false });
      const bundleEnabled = hasDenoBundle();

      await t.step(
        bundleEnabled
          ? "bundle produces JS"
          : "bundle produces JS (expected to fail)",
        async () => {
          const r = await bundler.bundle(entry, {
            cacheKey: "k1",
            minify: false,
          });
          if (bundleEnabled) {
            if (!r.ok) throw new Error(r.message);
            if (!r.js.includes("bundled-ok")) {
              throw new Error("expected bundled string");
            }
            if (bundler.cacheSize !== 1) throw new Error("cacheSize mismatch");
          } else {
            if (r.ok) {
              throw new Error(
                "expected bundling to fail without --unstable-bundle",
              );
            }
            if (r.status !== 500) throw new Error("expected status 500");
            if (!r.message.includes("Bundle error: Deno.bundle failed")) {
              throw new Error("unexpected message");
            }
          }
        },
      );

      await t.step(
        bundleEnabled
          ? "bundle hits cache via cacheKey"
          : "bundle hits cache via cacheKey (expected to fail)",
        async () => {
          const r = await bundler.bundle(entry, { cacheKey: "k1" });
          if (bundleEnabled) {
            if (!r.ok) throw new Error(r.message);
            if (bundler.cacheSize !== 1) {
              throw new Error("cache should not grow");
            }
          } else {
            if (r.ok) throw new Error("expected failure");
          }
        },
      );

      await t.step("prime and peek", () => {
        bundler.prime("k2", "console.log('primed')");
        const p = bundler.peek("k2");
        if (p !== "console.log('primed')") throw new Error("peek mismatch");
      });

      await t.step("clearCache", () => {
        bundler.clearCache();
        if (bundler.cacheSize !== 0) throw new Error("clearCache failed");
      });

      await t.step(
        bundleEnabled
          ? "jsModuleResponse returns jsResponse on success"
          : "jsModuleResponse returns error response when bundling unavailable",
        async () => {
          const r = await bundler.jsModuleResponse(entry, {
            cacheControl: "no-store",
            minify: false,
          });

          if (bundleEnabled) {
            if (r.status !== 200) throw new Error("status mismatch");
            if (
              r.headers.get("content-type") !== "text/javascript; charset=utf-8"
            ) {
              throw new Error("content-type mismatch");
            }
            const body = await r.text();
            if (!body.includes("bundled-ok")) {
              throw new Error("body missing bundled output");
            }
          } else {
            if (r.status !== 500) {
              throw new Error("expected 500 without bundling enabled");
            }
            const body = await r.text();
            if (!body.includes("Deno.bundle")) {
              throw new Error("expected Deno.bundle mention");
            }
          }
        },
      );
    } finally {
      await Deno.remove(dir, { recursive: true });
    }
  },
);

Deno.test("sseSession basic behavior: send, keepalive, close behavior", async (t) => {
  await t.step(
    "sseSession emits event and data; close is idempotent",
    async () => {
      type Events = { hello: { x: number } };

      const s = sseSession<Events>({ keepAliveMs: 50 });
      await s.ready;

      const ok = s.send("hello", { x: 1 });
      if (!ok) throw new Error("send returned false");

      s.error("oops");
      s.close();
      s.close();
    },
  );

  await t.step("sseEvery sends periodic events and stop closes", async () => {
    type Events = { tick: number };

    const s = sseSession<Events>({ keepAliveMs: 25 });
    await s.ready;

    let n = 0;
    const stop = sseEvery(s, 10, "tick", () => ++n);

    await delay(35);
    stop();
    if (!s.isClosed()) throw new Error("session should be closed after stop()");
  });
});

Deno.test(
  "Router, params, middleware, typed vars, method not allowed, SSE (end-to-end server)",
  async (t) => {
    type State = { prefix: string };

    const app = Application.sharedState<State>({ prefix: "p:" }).withVars<
      { userId: string }
    >();

    const seen: string[] = [];

    app.use(observe({
      onRequest: (c) => seen.push(`obs:req:${c.requestId}`),
      onResponse: (c, _r, _ms) => seen.push(`obs:res:${c.requestId}`),
    }));

    app.use("/api", async (c, next) => {
      c.setVar("userId", "u-1");
      return await next();
    });

    app.get("/hello", (c) => c.text(`${c.state.prefix}hello`));

    app.get("/api/users/:id", (c) => {
      const userId = c.getVar("userId");
      return c.json({ id: c.params.id, q: c.query("q"), userId });
    });

    app.post("/api/users/:id", async (c) => {
      const body = await c.readJsonParsed((u) => {
        const v = u as { name?: unknown };
        if (typeof v?.name !== "string") throw new Error("name must be string");
        return { name: v.name };
      });
      return c.json({ id: c.params.id, name: body.name }, { status: 201 });
    });

    app.get("/only-get", (c) => c.text("ok"));

    app.route("/v1", (r) => {
      r.get("/ping", (c) => c.text("pong"));
    });

    app.get("/events", (c) =>
      c.sse<{ msg: string; done: true }>(
        async (s) => {
          await s.sendWhenReady("msg", "a");
          s.send("msg", "b");
          s.send("done", true);
        },
        { keepAliveMs: 25 },
      ));

    // Compile-time inference checks (type-check only)
    {
      void app.get("/typed/:x/:y", (c) => {
        const x: string = c.params.x;
        const y: string = c.params.y;
        return c.text(`${x}-${y}`);
      });

      // @ts-expect-error param name does not exist
      void app.get("/typed/:x", (c) => c.text(c.params.nope));

      void app.get("/vars", (c) => c.text(c.getVar("userId")));
    }

    const server = startServer((req) => app.fetch(req));
    try {
      await t.step("GET /hello returns text", async () => {
        const r = await fetch(`${server.baseUrl}/hello`);
        const body = await r.text();
        if (body !== "p:hello") throw new Error("body mismatch");
      });

      await t.step("GET /api/users/:id returns params/query/vars", async () => {
        const r = await fetch(`${server.baseUrl}/api/users/42?q=ok`);
        const j = await r.json();
        if (j.id !== "42") throw new Error("param mismatch");
        if (j.q !== "ok") throw new Error("query mismatch");
        if (j.userId !== "u-1") throw new Error("vars mismatch");
      });

      await t.step(
        "POST /api/users/:id reads json and returns 201",
        async () => {
          const r = await fetch(`${server.baseUrl}/api/users/7`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name: "N" }),
          });
          try {
            if (r.status !== 201) throw new Error("status mismatch");
            const j = await r.json();
            if (j.id !== "7") throw new Error("param mismatch");
            if (j.name !== "N") throw new Error("body mismatch");
          } finally {
            // json() consumes, so only drain defensively (no cancel)
            await drain(r);
          }
        },
      );

      await t.step(
        "method not allowed returns 405 with Allow header",
        async () => {
          const r = await fetch(`${server.baseUrl}/only-get`, {
            method: "POST",
          });
          if (r.status !== 405) throw new Error("expected 405");
          const allow = r.headers.get("allow") ?? "";
          if (!allow.includes("GET")) {
            throw new Error("allow should include GET");
          }
          await drain(r); // do not cancel
        },
      );

      await t.step("route() base path works: GET /v1/ping", async () => {
        const r = await fetch(`${server.baseUrl}/v1/ping`);
        const body = await r.text(); // consumes
        if (body !== "pong") throw new Error("body mismatch");
      });

      await t.step(
        "SSE endpoint streams events and shuts down cleanly",
        async () => {
          const ac = new AbortController();

          const r = await fetch(`${server.baseUrl}/events`, {
            headers: { accept: "text/event-stream" },
            signal: ac.signal,
          });

          if (r.status !== 200) throw new Error("status mismatch");
          const ct = r.headers.get("content-type") ?? "";
          if (!ct.startsWith("text/event-stream")) {
            throw new Error("content-type mismatch");
          }

          const out = await readSseUntil(
            r,
            ({ messages }) => messages.some((m) => m.event === "done"),
            1500,
          );

          const events = out.messages.map((m) => m.event);
          if (!events.includes("msg")) throw new Error("missing msg events");
          if (!events.includes("done")) throw new Error("missing done event");

          // We stop early; explicitly cancel streaming body.
          await cancelQuietly(r);
          ac.abort();

          await delay(30);
        },
      );

      await t.step("notFoundPureTsUi hints for static-like paths", async () => {
        const req = new Request(`${server.baseUrl}/assets/app.js`, {
          method: "GET",
        });
        const hintRoutes = ["/mod/app.ts", "/mod/runtime.ts"];
        const r = notFoundPureTsUi(req, hintRoutes);
        if (r.status !== 404) throw new Error("status mismatch");
        const body = await r.text();
        if (!body.includes("does not serve static files")) {
          throw new Error("missing explanation");
        }
        if (!body.includes("/mod/app.ts")) {
          throw new Error("missing hint route");
        }
      });

      await t.step("observability hooks fired", () => {
        const hasReq = seen.some((s) => s.startsWith("obs:req:"));
        const hasRes = seen.some((s) => s.startsWith("obs:res:"));
        if (!hasReq || !hasRes) throw new Error("expected observability hooks");
      });
    } finally {
      await server.close();
    }
  },
);
