# Junxion UX: an AI-first, hypermedia-native UX library

Junxion UX is a small, composable UX library designed for modern server-centric
web applications that must remain understandable, testable, and maintainable as
complexity grows. It is not a framework. It is a set of tightly scoped libraries
that work together to support progressive enhancement, typed hypermedia
interactions, and AI-first maintenance.

At a high level, Junxion UX brings together four ideas:

- Server-first HTML as the default UX substrate
- Typed hypermedia interactions instead of opaque client frameworks
- Progressive client complexity, added only when needed
- A codebase structured so AI systems can safely maintain it end to end

## Quick Start

To test:

```bash
# first time in your workspace
$ deno task test:install-deps            # playwright, et. al.

# every time you change code
$ deno task test                         # runs Deno unit tests
```

Get a flavor for the code in the initial developer experience (DX) entry points:

```bash
$ ./support/dx/hello/counter.ts      # interactive counter (SSR + SSE) increment app
$ ./support/dx/hello/counter-ce.ts   # interactive counter (SSR + Web Component + SSE) increment app
$ ./support/dx/hello/markdown.ts     # client-side markdown preview app
```

## Modules

Junxion UX is organized intentionally by concern, not by runtime.

### `lib/universal`

Modules that are broadly useful across server and client contexts, independent
of Continuux itself.

- `fluent-html.ts` is dependency-free, type-safe HTML builder for server-side
  rendering and tests. It replaces JSX, templating engines, and DOM mutation
  with explicit, deterministic HTML generation. It is the foundation for all SSR
  in Junxion UX.
- `fluent-html-dom.ts` is a twin of `fluent-html.ts` for web browser user
  agents.
- Other universal helpers Utilities that are safe to use anywhere and have no
  browser- or server-specific assumptions.

### `lib/continuux`

The hypermedia interaction layer. This is where server and browser “know” how to
talk to each other using typed contracts.

- `http.ts`, `bundle.ts`, and related helpers provide Infrastructure for SSE
  sessions, HTTP responses, and optional on-the-fly bundling of browser modules,
  kept minimal and auditable.

- `interaction.ts` defines the canonical interaction envelope, event metadata,
  schema decoding, routing, and diagnostics. This is the server-side foundation
  of SSE-based interactivity.

- `interaction-browser-ua.js` is a thin browser user agent runtime that:
  - Delegates DOM events
  - Builds structured interaction envelopes
  - Posts them to the server
  - Maintains an SSE connection
  - Executes server-sent JavaScript instructions It is intentionally simple,
    explicit, and not tuned for extreme performance or bundle size.

- `interaction-html.ts` is a type-safe HTML and server wiring helpers that
  provide the ergonomic surface area similar to HTMX or Datastar, but without
  stringly-typed attributes. It bridges Fluent HTML with Continuux interactions
  so developers write functions, not attribute names.

Together, these form Continuux: the server-directed interaction layer inside
Junxion UX.

## Core architectural concepts

Junxion UX treats HTML and hypermedia as the primary interface between server
and browser. The browser is not a co-equal application runtime by default. It is
a progressively enhanced client that becomes more capable only when necessary.

This can be visualized as layers:

```
Server
|
+-- Fluent HTML (SSR)
|
+-- Continuux actions (typed hypermedia)
|
+-- JSON APIs (only when client state demands it)
```

```
Browser
|
+-- Native HTML rendering (with Fluent HTML DOM for helpers)
|
+-- Continuux browser UA (events + SSE)
|
+-- Custom Elements (isolated islands, when needed)
```

## Progressive client complexity

Junxion UX explicitly supports a progression model rather than a single client
architecture.

**Stage 1**: SSR only Most pages should live here.

- Server renders HTML with Fluent HTML
- Links and forms drive navigation
- Full page reloads are acceptable
- State lives in URLs and server-side logic

This stage is maximally simple, maximally testable, and ideal for AI
maintenance.

**Stage 2**: SSR plus lightweight SSE interactivity This is the Continuux sweet
spot.

- HTML is still server-rendered
- DOM events post typed interaction envelopes
- Server dispatches actions and pushes updates via SSE
- Browser executes small, server-directed instructions

This is analogous in spirit to HTMX or Datastar, but with explicit typing,
schemas, and server-side routing.

**Stage 3**: Web Components with JSON APIs Used when client-side complexity
becomes real application logic.

- SSR still composes the page
- Custom Elements act as bounded client-side islands
- JSON APIs define explicit query and command contracts
- Optional SSE streams support live updates

This stage is not a failure of SSR or Continuux. It is a recognition that some
UI problems require local client state. Junxion UX supports this without forcing
a full SPA architecture.

Client complexity rules of thumb:

If the server can describe the UI change without encoding component state, stay
in Continuux.

If the client must own complex state transitions, move that part into a Custom
Element with a proper API.

## AI-first maintainability

Junxion UX is explicitly designed to be maintainable by AI systems, not just
assisted by them.

This influences several core decisions:

Small surface area There are no large frameworks or deep dependency graphs. Most
behavior is expressed directly in code within the repository.

Explicit contracts Interaction envelopes, schemas, SSE events, and APIs are all
typed and validated.

Deterministic behavior HTML output, interaction handling, and SSE messaging are
designed to be reproducible. This allows tests to assert exact outcomes.

End-to-end testing as a hard requirement Every feature must be fully testable
using:

- Deno unit tests on the server
- Playwright tests in a real browser

If a feature cannot be deterministically tested end to end, it should not be
added.

This is essential for AI maintenance. AI systems iterate by running tests,
observing failures, and refining behavior. Without deterministic tests, safe
autonomous maintenance is not possible.

## Why Junxion UX exists

Junxion UX exists to fill a gap between two extremes:

- Static SSR with no interactivity
- Large client frameworks that push most logic into the browser

It provides a disciplined middle ground:

- Server-first by default
- Hypermedia-driven interactions
- Typed contracts everywhere
- Progressive enhancement instead of premature complexity
- A codebase small enough for AI to fully understand

Continuux is the interaction engine. Fluent HTML is the rendering substrate. Web
Components are the scaling mechanism for client complexity. Deterministic
testing is the enforcement layer.

Together, these form Junxion UX: a pragmatic, AI-first library for building
modern web UIs that remain understandable long after the original authors, human
or otherwise, have moved on.
