#!/usr/bin/env -S deno run -A --watch --unstable-bundle --node-modules-dir=auto
/**
 * Learning Resources Server
 *
 * Runs an index UI and proxies selected learning resources, spawning their
 * servers on demand via Deno.Command.
 */

type LearningResource = {
  id: string;
  name: string;
  description: string;
  path: string;
  entry: string;
  port: number;
};

const resources = [
  {
    id: "counter",
    name: "Hello Counter",
    description: "interactive counter (SSR + SSE) increment app",
    path: "support/learn/01-hello/counter.ts",
    entry: "./01-hello/counter.ts",
    port: 7681,
  },
  {
    id: "counter-ce",
    name: "Hello Counter CE",
    description:
      "interactive counter (SSR + Web Component + SSE) increment app",
    path: "support/learn/01-hello/counter-ce.ts",
    entry: "./01-hello/counter-ce.ts",
    port: 8000,
  },
  {
    id: "markdown",
    name: "Hello Markdown",
    description: "client-side markdown preview app with custom HTML",
    path: "support/learn/01-hello/markdown.ts",
    entry: "./01-hello/markdown.ts",
    port: 7690,
  },
  {
    id: "starter-ds",
    name: "Starter DS",
    description: "client-side markdown preview app with Starter DS",
    path: "support/learn/02-starter-ds/starter-ds.ts",
    entry: "./02-starter-ds/starter-ds.ts",
    port: 7665,
  },
  {
    id: "hello-fancy",
    name: "Hello Fancy",
    description: "client-side markdown preview app with Natural DS",
    path: "support/learn/03-natural-ds/hello-fancy.ts",
    entry: "./03-natural-ds/hello-fancy.ts",
    port: 7456,
  },
  {
    id: "guide",
    name: "Natural DS Guide",
    description: "demo of full Natural Design System",
    path: "support/learn/03-natural-ds/guide.ts",
    entry: "./03-natural-ds/guide.ts",
    port: 7599,
  },
] satisfies LearningResource[];

const resourceById = new Map(resources.map((r) => [r.id, r]));
const running = new Map<
  string,
  { resource: LearningResource; child: Deno.ChildProcess | null }
>();

const indexPort = 7700;
const defaultRunArgs = [
  "run",
  "-A",
  "--unstable-bundle",
  "--node-modules-dir=auto",
];

const clientResources = resources.map(
  ({ id, name, description, path, port }) => ({
    id,
    name,
    description,
    path,
    port,
  }),
);

const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Junxion UX Learning Resources</title>
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
      label {
        font-weight: 600;
        letter-spacing: 0.01em;
      }
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
      .status {
        color: var(--muted);
        font-size: 0.9rem;
        white-space: nowrap;
      }
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

      const setStatus = (text) => {
        status.textContent = text;
      };

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
            parent.frames.resourceFrame.location = \`http://localhost:\${res.port}/\`;
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
    <title>Learning Resource</title>
    <style>
      body {
        margin: 0;
        background: #f2f3f6;
        font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif;
        color: #3a3f4b;
        display: grid;
        place-items: center;
        height: 100vh;
      }
    </style>
  </head>
  <body>
    <p>Select a resource above.</p>
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

  if (await isPortReady(resource.port)) {
    running.set(resource.id, { resource, child: null });
    return;
  }

  const entryUrl = new URL(resource.entry, import.meta.url);
  const command = new Deno.Command(Deno.execPath(), {
    args: [...defaultRunArgs, entryUrl.pathname],
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

Deno.serve({ port: indexPort }, async (req) => {
  const url = new URL(req.url);

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
