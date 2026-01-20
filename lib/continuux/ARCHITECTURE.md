# Continuux architecture overview

Continuux is a lightweight, server-first UI library for building continuous,
hypermedia-driven web interfaces using pure TypeScript. It is intentionally not
a framework. Instead, it is a small stack of cooperating modules that make the
server and browser “know” each other through typed contracts, deterministic
HTML, and server-directed interactivity.

The core idea is continuity. HTML, interactions, state, and updates all flow
through the server. The browser acts as a thin user agent that observes events
and executes server instructions.

At a glance, the Continuux stack looks like this:

```
Browser
|
|  DOM events + SSE
v
interaction-browser-ua.js
|
|  JSON envelopes (POST) / JS instructions (SSE)
v
interaction.ts + interaction-html.ts
|
|  Typed handlers + SSE hub
v
http.ts (Application, router, SSE)
|
|  HTML + JS responses
v
elements.ts + bundle.ts
|
v
HTML / JS sent to browser
```

Each layer is small, explicit, and replaceable.

## Core architectural principles

1. Server-driven hypermedia
2. Typed contracts instead of string conventions
3. Minimal browser runtime, no client-owned application state
4. Deterministic HTML and deterministic interactivity
5. Optimized for small to medium microservice-style web UIs, not high-scale
   public SPAs

## Module-by-module architecture

### lib/natural-html/elements.ts

Role: deterministic HTML generation

This is the rendering foundation. It replaces JSX, templating engines, and
virtual DOMs.

What it provides:

- Typed tag functions like div(), form(), button(), etc.
- Safe-by-default escaping for text and attributes
- Explicit escape hatches for trusted raw HTML
- A lightweight internal AST to support deterministic pretty-printing
- No dependency on lib.dom or browser globals

How it fits:

- All HTML in Continuux is generated on the server using Fluent HTML
- HTML is plain HTML, suitable for SSR-only pages or interactive pages
- Interaction metadata is attached as attributes, not embedded JS logic

```
Fluent HTML
|
|  RawHtml (string + optional AST)
v
HTTP response body
```

### lib/continuux/http.ts

Role: server runtime, routing, SSE, and state semantics

This module is the HTTP and execution backbone.

What it provides:

- Fetch-native Application with typed routing
- Middleware with typed per-request vars
- Explicit application state semantics:

  - sharedState
  - snapshotState
  - stateFactory
- Type-safe Server-Sent Events
- Observability hooks
- Response helpers (html, js, json, text)

How it fits:

- Every request flows through Application.fetch()
- All SSE sessions are created and managed here
- State lifetime is explicit by construction

```
Request
|
v
Application.fetch()
|
+--> middleware
|
+--> route handler
|
+--> SSE producer
|
v
Response / SSE stream
```

### lib/continuux/interaction.ts

Role: interaction protocol and dispatch core

This module defines the interaction contract between browser and server.

What it provides:

- A structured interaction envelope (CxInteractionEnvelope)
- Defensive decoding and validation of envelopes
- A small router for interaction “specs”
- Typed handler context for interactions
- Diagnostics helpers shared by tests and tools
- Server-side support for serving the browser UA module

How it fits:

- It defines what an interaction is
- It does not generate HTML
- It does not know about DOM attributes
- It is the protocol layer between browser signals and server logic

```
Browser envelope (JSON)
|
v
decodeCxEnvelope()
|
v
cxRouter.dispatch()
|
v
Typed handler
```

### lib/continuux/interaction-html.ts

Role: developer-facing hypermedia surface (HTMX / Datastar equivalent)

This is the glue that makes Continuux pleasant and safe to use.

What it provides:

- createCx(): a typed “kit” combining HTML helpers and server helpers
- Type-safe action specs (no stringly-typed names)
- HTML helpers that generate correct data-cx-* attributes
- Typed server-side dispatch helpers
- A typed SSE hub for server-to-client events
- Convenience helpers for POST /cx and GET /cx/sse

How it fits:

- This is what application code uses directly
- Junior developers never type attribute strings or endpoint paths
- Fluent HTML is used to generate HTML with attached interaction metadata
- Server handlers receive typed data and SSE emitters

```
Fluent HTML tag
+
cx.html.click("save")
|
v <button data-cx-on-click="action:save">
```

### lib/continuux/interaction-browser-ua.js

Role: browser user agent runtime

This is the only required browser-side runtime.

What it does:

- Delegates DOM events
- Finds the nearest element with a cx spec
- Builds an interaction envelope
- POSTs it to the server
- Maintains an SSE connection
- Executes JavaScript instructions received over SSE

What it does not do:

- It does not manage application state
- It does not diff DOM
- It does not render HTML
- It does not try to be small or highly optimized (yet)

Design intent:

- Deterministic, inspectable behavior
- Debuggable via structured diagnostics
- Trusted to execute server-sent JS instructions

```
DOM event
|
v
find data-cx spec
|
v
POST /cx (JSON)
|
v
SSE "js" event
|
v
execute JS
```

### lib/continuux/bundle.ts

Role: lightweight in-memory JS bundling

This module supports serving small browser modules without a separate build
step.

What it provides:

- In-memory bundling using Deno.bundle
- Process-local caching
- JS module responses with correct headers
- Middleware that auto-serves TypeScript browser modules

How it fits:

- Used to serve interaction-browser-ua.js and similar small client modules
- Optimized for simplicity and developer ergonomics
- Not a production asset pipeline

```
GET /interaction-browser-ua.js
|
v
autoTsJsBundler
|
v
Deno.bundle
|
v
JS module response
```

## End-to-end interaction flow

Putting it all together:

1. Server renders HTML using Fluent HTML
2. HTML includes data-cx-* attributes via interaction-html helpers
3. Browser UA runtime is loaded (bundled or static)
4. User triggers a DOM event
5. Browser UA posts a typed interaction envelope
6. Server decodes, validates, and dispatches the action
7. Server responds with:

   - nothing (204), or
   - headers, or
   - SSE events (including JS instructions)
8. Browser executes server instructions

```
User click
|
v
Browser UA
|
| POST /cx
v
Interaction dispatch
|
| SSE /cx/sse
v
JS instruction
|
v
DOM updated
```

## Positioning and non-goals

Continuux is intentionally not:

- A React/Vue/Svelte replacement
- A client-side state management system
- A high-scale CDN-optimized frontend framework

Continuux is designed for:

- Server-owned UX
- Regulated or correctness-sensitive systems
- Microservice-style UIs
- Teams that value explicit contracts and determinism
- Gradual interactivity layered on top of SSR

In short, Continuux is a continuous UI stack: the server renders, the browser
signals, and the server instructs.
