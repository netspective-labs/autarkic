// lib/html/server/fluent-integration_test.ts
//
// Server-side integration tests (separate from browser harness).
// No third-party frameworks.
//
// Run:
//   deno test -A lib/html/server/fluent-integration_test.ts

import { assert, assertEquals, assertMatch } from "@std/assert";
import * as F from "./fluent.ts";

const getFreePort = () => {
  const l = Deno.listen({ hostname: "127.0.0.1", port: 0 });
  const port = (l.addr as Deno.NetAddr).port;
  l.close();
  return port;
};

Deno.test("integration: HTML route includes data-on:* attributes", async () => {
  const port = getFreePort();
  const ac = new AbortController();

  const handler = (req: Request): Response => {
    const url = new URL(req.url);
    if (url.pathname === "/") {
      const html = F.render(
        F.doctype(),
        F.html(
          F.head(F.title("x")),
          F.body(F.button({ ...F.JunxionUX.clickGet("/ping") }, "Ping")),
        ),
      );

      return new Response(html, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
    if (url.pathname === "/ping") {
      return new Response("ok", { headers: { "content-type": "text/plain" } });
    }
    return new Response("not found", { status: 404 });
  };

  const server = Deno.serve(
    { hostname: "127.0.0.1", port, signal: ac.signal },
    handler,
  );

  try {
    const res = await fetch(`http://127.0.0.1:${port}/`);
    const text = await res.text();
    assertMatch(text, /data-on:click="@get\(&quot;\/ping&quot;\)"/);
  } finally {
    ac.abort();
    await server.finished.catch(() => {});
  }
});

Deno.test("integration: SSE endpoint returns event-stream and yields events", async () => {
  const port = getFreePort();
  const ac = new AbortController();

  const handler = (req: Request): Response => {
    const url = new URL(req.url);

    if (url.pathname === "/sse") {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const enc = new TextEncoder();
          controller.enqueue(enc.encode("event: message\n"));
          controller.enqueue(enc.encode("data: hello\n\n"));
          controller.enqueue(enc.encode("event: message\n"));
          controller.enqueue(enc.encode("data: world\n\n"));
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          "connection": "keep-alive",
        },
      });
    }

    return new Response("not found", { status: 404 });
  };

  const server = Deno.serve(
    { hostname: "127.0.0.1", port, signal: ac.signal },
    handler,
  );

  try {
    const res = await fetch(`http://127.0.0.1:${port}/sse`);
    assertEquals(res.headers.get("content-type"), "text/event-stream");

    const reader = res.body?.getReader();
    assert(reader);

    const chunks: string[] = [];
    const dec = new TextDecoder();

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(dec.decode(value));
    }

    const all = chunks.join("");
    assertMatch(all, /data: hello/);
    assertMatch(all, /data: world/);
  } finally {
    ac.abort();
    await server.finished.catch(() => {});
  }
});
