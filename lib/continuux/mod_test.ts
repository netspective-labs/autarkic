// lib/continuux/mod_test.ts
//
// ContinuUX end-to-end test (Playwright) for a tiny "counter" app.
// All browser logic is executed via strings (page.evaluate / waitForFunction).
//
// Run:
//   deno test -A lib/continuux/mod_test.ts

import { assertEquals, fail } from "@std/assert";
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
} from "./interaction.ts";

import {
  createCx,
  cxPostHandler,
  cxSseRegister,
  defineSchemas,
} from "./interaction-html.ts";

import {
  type Attrs,
  attrs as mergeAttrs,
  body,
  button,
  div,
  doctype,
  head,
  html,
  meta,
  render,
  script,
  title,
  trustedRaw,
} from "./html.ts";

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

type BrowserSnapshot = {
  pageReady: unknown;
  sseReady: unknown;
  execHook: unknown;
  execCount: unknown;
  lastJsLen: unknown;
  lastJsPrefix: unknown;
  fromServer: unknown;
  lastFromServer: unknown;
  datasetLastSpec: unknown;
  datasetLastCount: unknown;
  countText: unknown;
  statusText: unknown;
};

Deno.test("continuux: counter e2e (html.ts + interaction-html.ts)", async (t) => {
  type State = { count: number };
  const appState: State = { count: 0 }; // canonical shared state for this test

  type Vars = Record<string, never>;

  const schemas = defineSchemas({
    increment: (u: unknown) => decodeCxEnvelope(u),
    reset: (u: unknown) => decodeCxEnvelope(u),
  });

  const cx = createCx<
    State,
    Vars,
    typeof schemas,
    { js: string; message: string }
  >(schemas);

  const hub = cx.server.sseHub();
  const posts: CxInbound[] = [];

  const sseRegs: Array<{ sessionId: string; ts: number }> = [];
  const sseSends: Array<
    {
      kind: "handshake" | "broadcast";
      event: "js" | "message";
      ts: number;
      note?: string;
    }
  > = [];

  type SendJs = (js: string) => void;
  type SendMsg = (msg: string) => void;
  const sendsJs: SendJs[] = [];
  const sendsMsg: SendMsg[] = [];

  const setTextJs = (id: string, text: string) => {
    // IMPORTANT: never assign through optional chaining; it's a SyntaxError.
    return `{
      const __el = document.getElementById(${JSON.stringify(id)});
      if (__el) __el.textContent = ${JSON.stringify(text)};
    }`;
  };

  const setDatasetJs = (k: string, v: string) => {
    return `{
      try { document.body.dataset[${JSON.stringify(k)}] = ${
      JSON.stringify(v)
    }; } catch {}
    }`;
  };

  const fixtureHtml = (): string => {
    const appAttrs: Attrs = mergeAttrs(
      cx.html.sse({ url: "/cx/sse", withCredentials: true }),
    );

    const boot = cx.html.bootModuleScriptTag({
      diagnostics: true,
      debug: false,
      autoConnect: true,
      attrs: { id: "cxBoot" },
    });

    const execHook = script(
      { type: "module", id: "cxExecHook" },
      trustedRaw(`
        (async () => {
          const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
          for (let i = 0; i < 400; i++) {
            if (window.CX && typeof window.CX.exec === "function") break;
            await sleep(10);
          }
          if (!window.CX || typeof window.CX.exec !== "function") {
            window.__cx_exec_hook = "missing";
            return;
          }
          window.__cx_exec_hook = "ok";
          const orig = window.CX.exec.bind(window.CX);
          window.__cx_exec_count = 0;
          window.__cx_last_js = "";
          window.CX.exec = (jsText) => {
            try {
              window.__cx_exec_count++;
              window.__cx_last_js = String(jsText ?? "");
            } catch {}
            return orig(jsText);
          };
        })();
      `),
    );

    return render(
      doctype(),
      html(
        appAttrs,
        head(
          meta({ charset: "utf-8" }),
          title("ContinuUX Counter Test"),
        ),
        body(
          div({ id: "app" }, [
            div({ id: "count" }, "0"),
            button({ id: "inc", ...cx.html.click("increment") }, "Increment"),
            button({ id: "reset", ...cx.html.click("reset") }, "Reset"),
            div({ id: "status" }, ""),
          ]),
          boot,
          execHook,
          script({ type: "module" }, trustedRaw(`window.__page_ready = "ok";`)),
        ),
      ),
    );
  };

  // Make the state semantics explicit: shared mutable state across requests.
  const app = Application.sharedState<State, Vars>(appState);

  app.get("/interaction-browser-ua.js", async () => {
    return await cx.server.uaModuleResponse("no-store");
  });

  app.get("/__fixture__", () =>
    new Response(fixtureHtml(), {
      headers: { "content-type": "text/html; charset=utf-8" },
    }));

  app.get(
    "/cx/sse",
    (c) =>
      c.sse<{ js: string; message: string }>(async (session) => {
        const sessionId = c.query("sessionId") ?? "unknown";

        cxSseRegister(hub, sessionId, session);
        sseRegs.push({ sessionId, ts: Date.now() });

        sendsJs.push((js) => void session.sendWhenReady("js", js));
        sendsMsg.push((msg) => void session.sendWhenReady("message", msg));

        sseSends.push(
          {
            kind: "handshake",
            event: "js",
            ts: Date.now(),
            note: "ready-flag",
          },
        );
        await session.sendWhenReady("js", `window.__cx_sse_ready = "ok";`);

        sseSends.push({
          kind: "handshake",
          event: "message",
          ts: Date.now(),
          note: `sse ready for ${sessionId}`,
        });
        await session.sendWhenReady("message", `sse ready for ${sessionId}`);

        sseSends.push({
          kind: "handshake",
          event: "js",
          ts: Date.now(),
          note: `initial count=${appState.count}`,
        });
        await session.sendWhenReady(
          "js",
          setTextJs("count", String(appState.count)),
        );
      }),
  );

  app.post("/cx", async (c) => {
    const bodyU = await c.readJson();

    if (sendsJs.length === 0) {
      return textResponse(
        "POST arrived but no SSE sessions registered yet (sendsJs empty).",
        500,
      );
    }

    const r = await cxPostHandler(cx, {
      req: c.req,
      body: bodyU,
      state: appState,
      vars: c.vars,
      sse: hub,
      handlers: {
        increment: ({ cx: env, sessionId }) => {
          posts.push(env);
          appState.count += 1;

          const js =
            `window.__cx_from_server = (window.__cx_from_server || 0) + 1;\n` +
            `window.__cx_last_from_server = ${JSON.stringify(env.spec)};\n` +
            `${setTextJs("count", String(appState.count))}\n` +
            `${setTextJs("status", "ok:increment")}\n` +
            `${setDatasetJs("lastSpec", env.spec)}\n` +
            `${setDatasetJs("lastCount", String(appState.count))}\n`;

          sseSends.push({
            kind: "broadcast",
            event: "message",
            ts: Date.now(),
            note: `count=${appState.count}`,
          });
          sseSends.push({
            kind: "broadcast",
            event: "js",
            ts: Date.now(),
            note: `spec=${env.spec} count=${appState.count}`,
          });

          for (const send of sendsMsg) send(`count=${appState.count}`);
          for (const send of sendsJs) send(js);

          // Also exercise hub.send directly (typed).
          hub.send(sessionId, "message", `count=${appState.count}`);

          return { ok: true };
        },

        reset: ({ cx: env, sessionId }) => {
          posts.push(env);
          appState.count = 0;

          const js =
            `window.__cx_from_server = (window.__cx_from_server || 0) + 1;\n` +
            `window.__cx_last_from_server = ${JSON.stringify(env.spec)};\n` +
            `${setTextJs("count", "0")}\n` +
            `${setTextJs("status", "ok:reset")}\n` +
            `${setDatasetJs("lastSpec", env.spec)}\n` +
            `${setDatasetJs("lastCount", "0")}\n`;

          sseSends.push({
            kind: "broadcast",
            event: "message",
            ts: Date.now(),
            note: "count=0",
          });
          sseSends.push({
            kind: "broadcast",
            event: "js",
            ts: Date.now(),
            note: `spec=${env.spec} count=0`,
          });

          for (const send of sendsMsg) send("count=0");
          for (const send of sendsJs) send(js);

          // Also exercise hub.send directly (typed).
          hub.send(sessionId, "message", "count=0");

          return { ok: true };
        },
      },
    });

    if (r.ok) return new Response(null, { status: 204 });
    return textResponse(r.message, r.status);
  });

  const ac = new AbortController();
  const server = Deno.serve(
    { hostname: "127.0.0.1", port: 0, signal: ac.signal, onListen: () => {} },
    (req) => app.fetch(req),
  );
  const origin = `http://127.0.0.1:${(server.addr as Deno.NetAddr).port}`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const consoleLogs: string[] = [];
  const pageErrors: string[] = [];

  const diags: CxDiagEvent[] = [];
  const diagRawLines: string[] = [];

  const snapshot = async (): Promise<BrowserSnapshot> => {
    const snap = await page.evaluate(`
      (() => {
        const lastJs = globalThis.__cx_last_js;
        const prefix = (typeof lastJs === "string") ? lastJs.slice(0, 220) : "";
        const qs = (id) => {
          try { return document.getElementById(id)?.textContent ?? null; } catch { return null; }
        };
        return {
          pageReady: globalThis.__page_ready ?? null,
          sseReady: globalThis.__cx_sse_ready ?? null,
          execHook: globalThis.__cx_exec_hook ?? null,
          execCount: globalThis.__cx_exec_count ?? null,
          lastJsLen: (typeof lastJs === "string") ? lastJs.length : 0,
          lastJsPrefix: prefix,
          fromServer: globalThis.__cx_from_server ?? null,
          lastFromServer: globalThis.__cx_last_from_server ?? null,
          datasetLastSpec: document?.body?.dataset?.lastSpec ?? null,
          datasetLastCount: document?.body?.dataset?.lastCount ?? null,
          countText: qs("count"),
          statusText: qs("status"),
        };
      })()
    `) as BrowserSnapshot;
    return snap;
  };

  const dumpDebug = async (title: string) => {
    const snap = await snapshot().catch(() => null);
    const hdr = `${title}\n` +
      `server: appState.count=${appState.count} hub.size=${hub.size()} regs=${sseRegs.length} sends=${sseSends.length} sendsJs=${sendsJs.length}\n` +
      `server: lastReg=${JSON.stringify(sseRegs.at(-1) ?? null)}\n` +
      `server: lastSend=${JSON.stringify(sseSends.at(-1) ?? null)}\n` +
      `browser: snapshot=${JSON.stringify(snap)}`;

    return formatCxDiagnosticsDump({
      title: hdr,
      diags,
      diagRawLines,
      consoleLogs,
      pageErrors,
      posts: posts.map((p) => ({ domEvent: p.domEvent, spec: p.spec })),
    });
  };

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

    await t.step("Page module script executed", async () => {
      await page.waitForFunction('window.__page_ready === "ok"', undefined, {
        timeout: 10_000,
      });
    });

    await t.step("UA wiring completed (diag wire:end)", async () => {
      const ok = await waitUntil(() => sawDiag(diags, "wire:end"), 5_000, 25);
      if (!ok) {
        fail(await dumpDebug("Did not observe UA diagnostics wire:end."));
      }
    });

    await t.step("SSE handshake executed in browser", async () => {
      await page.waitForFunction('window.__cx_sse_ready === "ok"', undefined, {
        timeout: 10_000,
      });
    });

    await t.step("UA exec hook installed", async () => {
      await page.waitForFunction('window.__cx_exec_hook === "ok"', undefined, {
        timeout: 10_000,
      });
    });

    await t.step("Initial count rendered", async () => {
      assertEquals(await page.textContent("#count"), "0");
      assertEquals(appState.count, 0);
    });

    await t.step("Click Increment updates DOM via SSE(js)", async () => {
      await page.click("#inc");

      const gotPost = await waitUntil(
        () => posts.some((p) => p.spec === "action:increment"),
        5_000,
        25,
      );
      if (!gotPost) {
        fail(await dumpDebug("Server never received POST for increment."));
      }

      await page.waitForFunction(
        'document.body.dataset.lastCount === "1"',
        undefined,
        {
          timeout: 10_000,
        },
      );

      assertEquals(await page.textContent("#count"), "1");
      assertEquals(
        await page.evaluate("document.body.dataset.lastSpec"),
        "action:increment",
      );
      assertEquals(await page.evaluate("document.body.dataset.lastCount"), "1");
      assertEquals(appState.count, 1);
    });

    await t.step("Click Increment multiple times", async () => {
      await page.click("#inc");
      await page.click("#inc");

      await page.waitForFunction(
        'document.body.dataset.lastCount === "3"',
        undefined,
        {
          timeout: 10_000,
        },
      );

      assertEquals(await page.textContent("#count"), "3");
      assertEquals(appState.count, 3);
    });

    await t.step("Reset sets count back to 0", async () => {
      await page.click("#reset");

      const gotReset = await waitUntil(
        () => posts.some((p) => p.spec === "action:reset"),
        5_000,
        25,
      );
      if (!gotReset) {
        fail(await dumpDebug("Server never received POST for reset."));
      }

      await page.waitForFunction(
        'document.body.dataset.lastCount === "0"',
        undefined,
        {
          timeout: 10_000,
        },
      );

      assertEquals(await page.textContent("#count"), "0");
      assertEquals(appState.count, 0); // this now checks canonical state
    });

    await t.step("Posts include typed specs", () => {
      const specs = new Set(posts.map((p) => p.spec));
      for (const s of specs) {
        if (s !== "action:increment" && s !== "action:reset") {
          fail(`Unexpected cx spec observed: ${s}`);
        }
      }
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
