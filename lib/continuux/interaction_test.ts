// lib/continuux/interaction_test.ts
//
// Playwright E2E test (real browser).
// Browser-side logic is executed only via strings (page.evaluate / waitForFunction).

import { assert, assertEquals, fail } from "@std/assert";

// deno-lint-ignore no-import-prefix
import { chromium } from "npm:playwright@1";

import { Application, textResponse } from "./http.ts";
import {
  CX_DIAG_PREFIX,
  type CxDiagEvent,
  type CxInbound,
  decodeCxEnvelope,
  formatCxDiagnosticsDump,
  parseCxDiagLine,
  sawDiag,
  userAgentAide,
} from "./interaction.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitUntil(
  pred: () => boolean,
  timeoutMs: number,
  stepMs = 25,
): Promise<boolean> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (pred()) return true;
    await sleep(stepMs);
  }
  return pred();
}

const fixtureHtml = () =>
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Continuux Interaction Test</title>
  </head>
  <body>
    <button id="btn1" data-cx="action:ping">Ping</button>

    <form id="form1" data-cx-on-submit="action:submitPing">
      <input id="in1" name="q" value="hello">
      <button type="submit">Submit</button>
    </form>

    <button
      id="btnSignals"
      data-cx="action:signals"
      data-cx-signals='{"x":1,"flag":true}'
      data-cx-headers='{"X-Test":"yes"}'
    >Signals</button>

    <div id="domTarget"></div>
  </body>
</html>`;

Deno.test("continuux: interaction e2e", async (t) => {
  const aide = userAgentAide();

  await t.step("UA module exists on disk", async () => {
    try {
      await aide.moduleSource();
    } catch (err) {
      fail(
        [
          "Missing required local file:",
          "lib/continuux/interaction-browser-ua.js",
          `Details: ${String(err)}`,
        ].join("\n"),
      );
    }
  });

  type SendJs = (js: string) => void;

  const sends: SendJs[] = [];
  const posts: CxInbound[] = [];

  const app = Application.sharedState({});
  app.get(
    "/interaction-browser-ua.js",
    async () => await aide.moduleResponse("no-store"),
  );

  app.get("/__fixture__", () =>
    new Response(fixtureHtml(), {
      headers: { "content-type": "text/html; charset=utf-8" },
    }));

  app.get(
    "/cx/sse",
    (c) =>
      c.sse<{ js: string; message: string }>(async (session) => {
        const sendJs = async (js: string) => {
          await session.sendWhenReady("js", js);
          await session.sendWhenReady("message", js);
        };
        const send: SendJs = (js) => void sendJs(js);
        sends.push(send);
        await sendJs(`window.__cx_sse_ready = "ok";`);
      }),
  );

  app.post("/cx", async (c) => {
    const u = await c.readJson();

    let cx: CxInbound;
    try {
      cx = decodeCxEnvelope(u);
    } catch (err) {
      return textResponse(`bad cx envelope: ${String(err)}`, 400);
    }

    posts.push(cx);

    if (sends.length === 0) {
      return textResponse(
        "POST arrived but no SSE sessions registered yet.",
        500,
      );
    }

    const js =
      `document.body.dataset.lastSpec = ${JSON.stringify(cx.spec)};\n` +
      `document.body.dataset.lastEvent = ${JSON.stringify(cx.domEvent)};\n` +
      `const t = document.getElementById("domTarget");\n` +
      `if (t) t.textContent = "ok:" + ${JSON.stringify(cx.spec)};\n`;

    for (const send of sends) send(js);
    return new Response(null, { status: 204 });
  });

  const ac = new AbortController();
  const server = Deno.serve(
    { hostname: "127.0.0.1", port: 0, signal: ac.signal, onListen: () => {} },
    (req: Request) => app.fetch(req),
  );
  const origin = `http://127.0.0.1:${(server.addr as Deno.NetAddr).port}`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const consoleLogs: string[] = [];
  const pageErrors: string[] = [];

  const diags: CxDiagEvent[] = [];
  const diagRawLines: string[] = [];

  const dumpDebug = (title: string) =>
    formatCxDiagnosticsDump({
      title,
      diags,
      diagRawLines,
      consoleLogs,
      pageErrors,
      posts: posts.map((p) => ({ domEvent: p.domEvent, spec: p.spec })),
    });

  page.on("console", (m) => {
    const text = m.text();
    consoleLogs.push(`[console.${m.type()}] ${text}`);

    if (text.startsWith(CX_DIAG_PREFIX)) {
      diagRawLines.push(text);
      const d = parseCxDiagLine(text);
      if (d) diags.push(d);
    }
  });

  page.on("pageerror", (e) => pageErrors.push(`[pageerror] ${String(e)}`));
  page.on("requestfailed", (r) => {
    const f = r.failure();
    consoleLogs.push(
      `[requestfailed] ${r.method()} ${r.url()} ${f ? f.errorText : ""}`,
    );
  });

  try {
    await t.step("Server serves UA module endpoint", async () => {
      const modResp = await fetch(`${origin}/interaction-browser-ua.js`);
      try {
        if (!modResp.ok) {
          const body = await modResp.text().catch(() => "");
          fail(
            `Server did not serve /interaction-browser-ua.js: ${modResp.status} ${modResp.statusText}\n${body}`,
          );
        }
        await modResp.arrayBuffer();
      } finally {
        try {
          await modResp.body?.cancel();
        } catch {
          // ignore
        }
      }
    });

    await t.step("Navigate to fixture page", async () => {
      await page.goto(`${origin}/__fixture__`, {
        waitUntil: "domcontentloaded",
      });
    });

    await t.step("Initialize UA (diagnostics on)", async () => {
      const initErr = await page.evaluate(`
        (async () => {
          try {
            const mod = await import(${
        JSON.stringify(`${origin}/interaction-browser-ua.js`)
      });
            const fn =
              (mod && (mod.createCxUserAgent || mod.default)) ||
              (window && window.createCxUserAgent);
            if (typeof fn !== "function") {
              throw new Error("createCxUserAgent not found (named export, default export, or global).");
            }
            window.__ua = fn({
              postUrl: "/cx",
              sseUrl: "/cx/sse",
              autoConnect: true,
              debug: false,
              diagnostics: true,
            });
            return null;
          } catch (e) {
            const msg = String(e && (e.stack || e.message || e));
            window.__ua_error = msg;
            return msg;
          }
        })()
      `) as string | null;

      if (initErr) {
        fail(
          dumpDebug(
            `UA init failed inside browser.\nwindow.__ua_error: ${initErr}`,
          ),
        );
      }
    });

    await t.step("UA wiring completed (diag wire:end)", async () => {
      const ok = await waitUntil(() => sawDiag(diags, "wire:end"), 5_000, 25);
      if (!ok) fail(dumpDebug("Did not observe UA diagnostics wire:end."));
    });

    await t.step("Server observed SSE session", async () => {
      const ok = await waitUntil(() => sends.length > 0, 10_000, 25);
      if (!ok) {
        fail(dumpDebug("Server never observed an SSE session (GET /cx/sse)."));
      }
    });

    await t.step("SSE handshake executed in browser", async () => {
      await page.waitForFunction('window.__cx_sse_ready === "ok"', undefined, {
        timeout: 10_000,
      });
    });

    await t.step(
      "Click Ping posts envelope and updates DOM via SSE(js)",
      async () => {
        await page.click("#btn1");

        const gotPing = await waitUntil(
          () => posts.some((p) => p.spec === "action:ping"),
          5_000,
          25,
        );
        if (!gotPing) {
          fail(dumpDebug("Server never received POST /cx for action:ping."));
        }

        await page.waitForFunction(
          'document.body.dataset.lastSpec === "action:ping"',
          undefined,
          { timeout: 10_000 },
        );

        assertEquals(
          await page.evaluate("document.body.dataset.lastSpec"),
          "action:ping",
        );
        assertEquals(await page.textContent("#domTarget"), "ok:action:ping");
      },
    );

    await t.step("Click Signals posts signals + headers", async () => {
      await page.click("#btnSignals");

      const gotSignals = await waitUntil(
        () => posts.some((p) => p.spec === "action:signals"),
        5_000,
        25,
      );
      if (!gotSignals) {
        fail(dumpDebug("Server never received POST /cx for action:signals."));
      }

      await page.waitForFunction(
        'document.body.dataset.lastSpec === "action:signals"',
        undefined,
        { timeout: 10_000 },
      );

      const sig = posts.find((p) => p.spec === "action:signals");
      assert(sig);
      assertEquals(sig.signals?.x, 1);
      assertEquals(sig.signals?.flag, true);
      assertEquals(sig.headers?.["X-Test"], "yes");
    });

    await t.step("Submit form posts form data", async () => {
      await page.click('#form1 button[type="submit"]');

      const gotSubmit = await waitUntil(
        () => posts.some((p) => p.spec === "action:submitPing"),
        5_000,
        25,
      );
      if (!gotSubmit) {
        fail(
          dumpDebug("Server never received POST /cx for action:submitPing."),
        );
      }

      await page.waitForFunction(
        'document.body.dataset.lastSpec === "action:submitPing"',
        undefined,
        { timeout: 10_000 },
      );

      const submit = posts.find((p) => p.spec === "action:submitPing");
      assert(submit);
      assertEquals(submit.form?.q, "hello");
    });
  } finally {
    await page.close();
    await browser.close();
    ac.abort();
    try {
      await server.finished;
    } catch {
      // ignore
    }
  }
});
