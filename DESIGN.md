# JunxionUX design rules

This project is intentionally opinionated. Contributions are expected to
reinforce constraints, not relax them.

1. No generic element constructors in public APIs Do not export `el`,
   `createElement`, or any generic tag factory. All HTML tags must be exposed as
   named functions. This is not cosmetic. It is how we prevent misuse, enforce
   consistency, and make code review trivial. If a new HTML tag is missing, add
   it explicitly.

2. Safe by default, explicit escape hatches only All text content must be
   escaped by default. The only way to inject raw HTML is via `raw()`. Never add
   new implicit string interpolation paths. If something needs raw HTML, the
   call site must say so clearly.

3. Determinism beats convenience Attribute ordering must remain deterministic.
   Output must be stable across runs. Do not introduce APIs that depend on
   object iteration order, timestamps, random IDs, or environment state.

4. Server code emits intent, never behavior Server-side code may emit attributes
   that describe intent, but it must never embed executable behavior. No inline
   scripts, no event handlers, no browser-only assumptions. The server’s job is
   to describe state and affordances.

5. Browser code observes and reacts Browser-side code must treat the DOM as the
   source of truth. It should discover attributes, attach behavior, and
   communicate using standard web APIs. Do not introduce tight coupling between
   server modules and browser modules.

6. Prefer vocabulary over configuration If a common pattern emerges, add a
   helper to JunxionUX instead of asking users to assemble strings or attributes
   manually. Juniors should not have to remember spellings, attribute names, or
   protocol details.

7. No third-party front-end frameworks This project deliberately avoids React,
   Vue, testing frameworks, or build pipelines. Use platform APIs, Deno APIs,
   and minimal utilities only.

8. Tests must be explainable by reading HTML If a test fails, it should be
   possible to understand why by looking at the generated HTML or DOM. Avoid
   magic, mocks that hide behavior, or test-only abstractions.

## Server → HTML → Browser flow

The architecture is intentionally simple and linear.

```
┌─────────────────────┐
│  Server (Deno)      │
│                     │
│  fluent.ts          │
│  - named tags       │
│  - escape by default│
│  - JunxionUX attrs  │
│                     │
└─────────┬───────────┘
          │
          │ HTML (text/html)
          │
          ▼
┌─────────────────────┐
│  HTML Document      │
│                     │
│  <button            │
│    data-on:click=   │
│    "@get(&quot;/x&quot;)" │
│  >                  │
│                     │
└─────────┬───────────┘
          │
          │ DOM parsing
          │
          ▼
┌─────────────────────┐
│  Browser Runtime    │
│                     │
│  fluent-browser-ua  │
│  - scans DOM        │
│  - discovers attrs  │
│  - wires behavior   │
│                     │
└─────────┬───────────┘
          │
          │ fetch / SSE / headers
          │
          ▼
┌─────────────────────┐
│  Server Endpoints   │
│                     │
│  HTML fragments     │
│  SSE streams        │
│  JSON or text       │
│                     │
└─────────────────────┘
```

Key properties of this flow:

- HTML is the contract between server and browser
- JavaScript enhances, it does not define structure
- You can reason about behavior by viewing page source
- Progressive enhancement is the default, not an add-on

## Example: SSE integration

Server-side SSE endpoint:

```ts
import * as H from "@netspective-labs/junxion-ux/html/server/fluent";

const encoder = new TextEncoder();

Deno.serve((req) => {
  if (new URL(req.url).pathname === "/events") {
    const stream = new ReadableStream({
      start(controller) {
        let n = 0;
        const id = setInterval(() => {
          controller.enqueue(
            encoder.encode(`event: tick\ndata: ${n++}\n\n`),
          );
        }, 1000);

        setTimeout(() => {
          clearInterval(id);
          controller.close();
        }, 5000);
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
      },
    });
  }

  return new Response("not found", { status: 404 });
});
```

Server-side HTML emitting intent:

```ts
H.div(
  {
    ...H.JunxionUX.on("load", '@get("/events")'),
    "data-bind:tick": "",
  },
  "Waiting…",
);
```

The server does not handle updates. It only declares that events exist and where
they come from.

Browser-side behavior:

- The runtime sees `data-on:load`
- It opens an SSE connection
- It applies updates to bound signals
- The DOM updates without page reloads

Example: partial HTML updates

Server endpoint returning a fragment:

```ts
import * as H from "@netspective-labs/junxion-ux/html/server/fluent";

Deno.serve((req) => {
  if (new URL(req.url).pathname === "/partial") {
    return new Response(
      H.div({ class: "box" }, "Updated at ", new Date().toISOString()),
      { headers: { "content-type": "text/html" } },
    );
  }

  return new Response("not found", { status: 404 });
});
```

HTML emitting intent:

```ts
H.button(
  { ...H.JunxionUX.clickGet("/partial") },
  "Refresh",
);
```

Behavior:

- Clicking the button triggers a GET
- The server returns HTML, not JSON
- The browser swaps or inserts content according to JunxionUX rules
- No client-side rendering logic is required

## Mental model to keep in mind

- The server describes what can happen
- The browser decides how it happens
- HTML is the shared language
- JavaScript exists to connect, not to dominate

If contributors keep those principles intact, the library remains
understandable, auditable, and safe to scale across teams with mixed experience
levels.
