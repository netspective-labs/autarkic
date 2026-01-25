#!/usr/bin/env -S deno run -A --watch --unstable-bundle --node-modules-dir=auto
/**
 * Learning Resources Server
 *
 * Runs an index UI and proxies selected learning resources, spawning their
 * servers on demand via Deno.Command.
 */

import { serveDir, serveFile } from "@std/http/file-server";
import { dirname, fromFileUrl, normalize, resolve } from "@std/path";

type LearningResource = {
  id: string;
  name: string;
  description: string;
  path: string;
  entry: string;
  port: number; // if same as indexPort, does not start a new server, uses self
  teaches: string;
};

const indexPort = 7700;

// Serve the full project filesystem (rooted at ../..) at /projectfs/*
const projectFsMount = "/projectfs";
const projectFsRoot = fromFileUrl(new URL("../..", import.meta.url));
const projectFsRootCanon = projectFsRoot.replace(/[\/\\]+$/, "");

const resources = [
  {
    id: "counter",
    name: "Hello Counter",
    description: "interactive counter (SSR + SSE) increment app",
    path: "support/learn/01-hello/counter.ts",
    entry: "./01-hello/counter.ts",
    port: 7681,
    teaches:
      "ContinuUX counter example showing server-rendered Natural HTML, typed SSE pushes, shared state, and pico.css styling.",
  },
  {
    id: "counter-ce",
    name: "Hello Counter CE",
    description:
      "interactive counter (SSR + Web Component + SSE) increment app",
    path: "support/learn/01-hello/counter-ce.ts",
    entry: "./01-hello/counter-ce.ts",
    port: 8000,
    teaches:
      "Custom Element boundary powered by ContinuUX SSE/action endpoints and Natural HTML markup with a plain JS `<counter-ce>` module.",
  },
  {
    id: "dialog-live",
    name: "Hello Dialog",
    description: "interactive forms validation using SSE",
    path: "support/learn/04-dialog/hello.ts",
    entry: "./04-dialog/hello.ts",
    port: 7744,
    teaches:
      "Natural Dialog form with zod validation, ContinuUX CX helpers, live SSE validation messages, and inline submission summary.",
  },
  {
    id: "markdown",
    name: "Hello Markdown",
    description: "client-side markdown preview app with custom HTML",
    path: "support/learn/01-hello/markdown.ts",
    entry: "./01-hello/markdown.ts",
    port: 7690,
    teaches:
      "ContinuUX routing + autoTsJsBundler delivering TypeScript client code that renders markdown via remark in the browser.",
  },
  {
    id: "starter-ds",
    name: "Starter DS",
    description: "client-side markdown preview app with Starter DS",
    path: "support/learn/02-starter-ds/starter-ds.ts",
    entry: "./02-starter-ds/starter-ds.ts",
    port: 7665,
    teaches:
      "Starter Design System page that wraps the markdown demo in `starterDesignSystem`, head slots, and Starter DS layout helpers.",
  },
  {
    id: "hello",
    name: "Hello",
    description: "simple static text with Natural DS",
    path: "support/learn/03-natural-ds/hello.ts",
    entry: "./03-natural-ds/hello.ts",
    port: 7331,
    teaches:
      "Minimal Natural DS layout showing breadcrumbs, sidebar, and content sections without extra chrome.",
  },
  {
    id: "hello-fancy",
    name: "Hello Fancy",
    description: "client-side markdown preview app with Natural DS",
    path: "support/learn/03-natural-ds/hello-fancy.ts",
    entry: "./03-natural-ds/hello-fancy.ts",
    port: 7456,
    teaches:
      "Natural DS context header, navigation, search, TOC, and markdown rendering powered by ContinuUX client bundling.",
  },
  {
    id: "natural-ds-guide",
    name: "Natural Design System Guide",
    description: "demo of full Natural Design System",
    path: "support/learn/03-natural-ds/guide.ts",
    entry: "./03-natural-ds/guide.ts",
    port: 7599,
    teaches:
      "Comprehensive Natural DS reference mirroring `lib/natural-ds`, showcasing accordions, cards, grids, nav components, and more.",
  },
  {
    id: "natural-om-guide",
    name: "Natural Object Model Guide",
    description: "demo of Natural Object Model Builder (OMB)",
    path: "support/learn/05-natural-om/index.ts",
    // Served by this server via /projectfs
    entry: "support/learn/05-natural-om/guide.html",
    port: indexPort,
    teaches:
      "Comprehensive Natural OMB reference, showcasing how to easily transform XML to typed-ish JavaScript objects.",
  },
] satisfies LearningResource[];

const resourceById = new Map(resources.map((r) => [r.id, r]));
const running = new Map<
  string,
  { resource: LearningResource; child: Deno.ChildProcess | null }
>();

const defaultRunArgs = [
  "run",
  "-A",
  "--unstable-bundle",
  "--node-modules-dir=auto",
];

const clientResources = resources.map(
  ({ id, name, description, path, port, teaches, entry }) => ({
    id,
    name,
    description,
    path,
    port,
    teaches,
    href: port === indexPort
      ? `${projectFsMount}/${entry.replace(/^\.?\//, "")}`
      : "/",
  }),
);

const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Autarkic UX Learning Resources</title>
  </head>
  <frameset rows="56,*" frameborder="0" border="0" framespacing="0">
    <frame src="/frame-top" name="resourceTop" />
    <frame src="/frame-blank" name="resourceFrame" />
    <noframes>
      <body>
        <p>This page requires frames.</p>
      </body>
    </noframes>
  </frameset>
</html>`;

const topFrameHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Learning Resources</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #0f1115;
        --bg-soft: #161a22;
        --text: #f3f5f7;
        --muted: #aab1bd;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif;
        background: linear-gradient(120deg, #0f1115 0%, #191f2b 60%, #0f1115 100%);
        color: var(--text);
      }
      header {
        padding: 0.5rem 1.2rem;
        display: flex;
        align-items: center;
        gap: 1rem;
        border-bottom: 1px solid #1f2530;
      }
      label { font-weight: 600; letter-spacing: 0.01em; }
      select {
        appearance: none;
        padding: 0.5rem 2.5rem 0.5rem 0.7rem;
        border-radius: 999px;
        border: 1px solid #2a3242;
        background: var(--bg-soft);
        color: var(--text);
        font-size: 0.95rem;
        min-width: min(70vw, 520px);
      }
      .status { color: var(--muted); font-size: 0.9rem; white-space: nowrap; }
      @media (max-width: 720px) {
        header { flex-wrap: wrap; }
        select { min-width: 100%; }
        .status { width: 100%; }
      }
    </style>
  </head>
  <body>
    <header>
      <label for="resourceSelect">Learning Resource:</label>
      <select id="resourceSelect">
        <option value="">Select a resource…</option>
      </select>
      <span class="status" id="status">idle</span>
    </header>
    <script type="module">
      const resources = ${JSON.stringify(clientResources)};
      const byId = new Map(resources.map((r) => [r.id, r]));
      const select = document.getElementById("resourceSelect");
      const status = document.getElementById("status");
      for (const res of resources) {
        const option = document.createElement("option");
        option.value = res.id;
        option.textContent = \`\${res.name} — \${res.description}\`;
        select.append(option);
      }

      const setStatus = (text) => { status.textContent = text; };

      const startResource = async (id) => {
        const res = byId.get(id);
        if (!res) return;
        setStatus("starting…");
        try {
          const resp = await fetch("/start", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ id }),
          });
          if (!resp.ok) throw new Error(await resp.text());
          if (parent && parent.frames && parent.frames.resourceFrame) {
            parent.frames.resourceFrame.location = \`http://localhost:\${res.port}\${res.href}\`;
          }
          setStatus(\`\${res.path} (port \${res.port})\`);
        } catch (err) {
          setStatus("failed to start");
          alert(String(err));
        }
      };

      select.addEventListener("change", (event) => {
        const id = event.target.value;
        if (!id) return;
        startResource(id);
      });
    </script>
  </body>
</html>`;

const blankFrameHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Learning Resources</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css" />
    <style>
      :root { font-size: 85%; }
      body {
        min-height: 100vh;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 2rem 1rem;
        background: #f9fafb;
      }
      main { width: min(960px, 100%); }
      ol { margin-top: 0.75rem; }
      li { padding: 1rem; }
      .muted-text { color: #6b7280; }
      .teaches { font-size: 0.95rem; font-style: italic; margin: 0.35rem 0; }
      .meta { margin: 0; font-size: 0.85rem; }
      code { font-size: 0.92em; }
    </style>
  </head>
  <body>
    <main>
      <article class="intro">
        <header>
          <h1>Learning Resources Server</h1>
          <p>
            The Autarkic learning hub catalogs ContinuUX, Natural HTML, and Natural DS samples.
            Selecting a resource spins up its Deno process and renders it in this frame.
          </p>
        </header>
        <p id="serverStatus" class="muted-text">Waiting for selection…</p>
        <p class="muted-text">
          Project filesystem browser is mounted at <code>${projectFsMount}</code>
          (rooted at <code>${projectFsRoot}</code>).
        </p>
      </article>
      <section>
        <h2>Available Learning Resources</h2>
        <ol id="resourceList"></ol>
      </section>
    </main>
    <script type="module">
      const resources = ${JSON.stringify(clientResources)};
      const list = document.getElementById("resourceList");
      const status = document.getElementById("serverStatus");
      if (status) status.textContent = "Learning Resources Server running on http://localhost:${indexPort}/";
      for (const resource of resources) {
        const li = document.createElement("li");
        const title = document.createElement("strong");
        title.textContent = resource.name;
        const desc = document.createElement("p");
        desc.textContent = resource.description;
        const teaches = document.createElement("p");
        teaches.textContent = resource.teaches;
        teaches.className = "teaches";
        const meta = document.createElement("p");
        meta.textContent = \`\${resource.path} · port \${resource.port}\`;
        meta.className = "meta muted-text";
        li.append(title, desc, teaches, meta);
        list?.appendChild(li);
      }
    </script>
  </body>
</html>`;

const serveIndex = () =>
  new Response(indexHtml, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });

const serveTopFrame = () =>
  new Response(topFrameHtml, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });

const serveBlankFrame = () =>
  new Response(blankFrameHtml, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });

const serveResources = () =>
  new Response(JSON.stringify(resources, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

const isPortReady = async (port: number): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 250);
    const resp = await fetch(`http://localhost:${port}/`, {
      signal: controller.signal,
    }).catch(() => null);
    clearTimeout(timeout);
    return Boolean(resp && resp.ok);
  } catch {
    return false;
  }
};

const waitForPort = async (port: number): Promise<boolean> => {
  for (let i = 0; i < 25; i += 1) {
    if (await isPortReady(port)) return true;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
};

const ensureStarted = async (resource: LearningResource) => {
  if (running.has(resource.id)) return;

  if (resource.port === indexPort) {
    running.set(resource.id, { resource, child: null });
    return;
  }

  if (await isPortReady(resource.port)) {
    running.set(resource.id, { resource, child: null });
    return;
  }

  const entryUrl = new URL(resource.entry, import.meta.url);
  const command = new Deno.Command(Deno.execPath(), {
    args: [...defaultRunArgs, fromFileUrl(entryUrl)],
    stdin: "null",
    stdout: "inherit",
    stderr: "inherit",
  });

  const child = command.spawn();
  running.set(resource.id, { resource, child });

  void child.status.then(
    () => running.delete(resource.id),
    () => running.delete(resource.id),
  );

  await waitForPort(resource.port);
};

const htmlDiagnostics = (title: string, details: Record<string, unknown>) => {
  const rows = Object.entries(details).map(([k, v]) => {
    const text = typeof v === "string" ? v : JSON.stringify(v, null, 2);
    const escaped = text.replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
    return `<tr><th style="text-align:left;vertical-align:top;padding:6px 10px;border-bottom:1px solid #eee;">${k}</th><td style="white-space:pre-wrap;padding:6px 10px;border-bottom:1px solid #eee;">${escaped}</td></tr>`;
  }).join("");
  return new Response(
    `<!doctype html><meta charset="utf-8" />
     <title>${title}</title>
     <body style="font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono','Courier New', monospace; padding:16px;">
     <h2 style="margin:0 0 12px 0;">${title}</h2>
     <table style="border-collapse:collapse; width:100%; max-width:1100px;">${rows}</table>
     </body>`,
    { status: 404, headers: { "content-type": "text/html; charset=utf-8" } },
  );
};

const resolveProjectFsPath = (pathname: string) => {
  const raw = pathname.startsWith(projectFsMount)
    ? pathname.slice(projectFsMount.length)
    : pathname;

  const decoded = decodeURIComponent(raw);
  const rel = decoded.replace(/^\/+/, "");
  const fsPath = resolve(projectFsRootCanon, normalize(rel));

  const withinRoot = fsPath === projectFsRootCanon ||
    fsPath.startsWith(projectFsRootCanon + "/") ||
    fsPath.startsWith(projectFsRootCanon + "\\");

  return { raw, decoded, rel, fsPath, withinRoot };
};

const listDirSafe = async (path: string, limit = 200) => {
  try {
    const out: Array<
      { name: string; kind: "file" | "dir" | "symlink" | "other" }
    > = [];
    let count = 0;
    for await (const e of Deno.readDir(path)) {
      out.push({
        name: e.name,
        kind: e.isFile
          ? "file"
          : e.isDirectory
          ? "dir"
          : e.isSymlink
          ? "symlink"
          : "other",
      });
      count += 1;
      if (count >= limit) break;
    }
    return out;
  } catch (err) {
    return { error: String(err) };
  }
};

Deno.serve({ port: indexPort }, async (req) => {
  const url = new URL(req.url);

  if (url.pathname === projectFsMount) {
    return new Response(null, {
      status: 307,
      headers: { location: `${projectFsMount}/` },
    });
  }

  if (url.pathname.startsWith(`${projectFsMount}/`)) {
    const resolved = resolveProjectFsPath(url.pathname);

    if (!resolved.withinRoot) {
      return htmlDiagnostics("Forbidden: request escaped project root", {
        requestPath: url.pathname,
        mount: projectFsMount,
        fsRoot: projectFsRootCanon,
        computedFsPath: resolved.fsPath,
        rel: resolved.rel,
      });
    }

    try {
      const info = await Deno.stat(resolved.fsPath);
      if (info.isFile) return serveFile(req, resolved.fsPath);

      if (info.isDirectory) {
        return serveDir(req, {
          fsRoot: projectFsRootCanon,
          urlRoot: projectFsMount,
          showDirListing: true,
        });
      }

      return htmlDiagnostics("Unsupported filesystem node", {
        requestPath: url.pathname,
        fsPath: resolved.fsPath,
        stat: info,
      });
    } catch (err) {
      const parent = dirname(resolved.fsPath);
      const parentListing = await listDirSafe(parent);
      return htmlDiagnostics("ProjectFS path not found", {
        requestPath: url.pathname,
        mount: projectFsMount,
        fsRoot: projectFsRootCanon,
        computedFsPath: resolved.fsPath,
        rel: resolved.rel,
        cwd: Deno.cwd(),
        error: String(err),
        parentDir: parent,
        parentListing,
      });
    }
  }

  if (url.pathname === "/") return serveIndex();
  if (url.pathname === "/frame-top") return serveTopFrame();
  if (url.pathname === "/frame-blank") return serveBlankFrame();
  if (url.pathname === "/resources") return serveResources();

  if (url.pathname === "/start" && req.method === "POST") {
    const body = await req.json().catch(() => null);
    const id = body?.id;
    if (typeof id !== "string") {
      return jsonResponse({ error: "missing id" }, 400);
    }

    const resource = resourceById.get(id);
    if (!resource) return jsonResponse({ error: "unknown id" }, 404);

    await ensureStarted(resource);
    return jsonResponse({ ok: true, id });
  }

  return new Response("not found", { status: 404 });
});

console.log(
  `Learning Resources Server running on http://localhost:${indexPort}/`,
);
console.log(
  `Project FS mounted at http://localhost:${indexPort}${projectFsMount}/ (rooted at ${projectFsRoot})`,
);
