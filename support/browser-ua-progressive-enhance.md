# Continuux client complexity strategy: SSR first, SSE next, Web Components when needed

Continuux should default to server-side rendering with hypermedia, because it
keeps the system simple, testable, and cheap to maintain. But client complexity
does grow over time. When it does, Continuux should not jump to a full SPA
framework. Instead, it should step through a progression that preserves the same
core principles: server-owned intent, typed contracts, deterministic testing,
and minimal dependencies.

This document explains when to stay with SSR, when to add lightweight SSE-based
interactivity, and when to move to Web Components and server-side JSON APIs.

## "Progressive Enhancement"

Stage 1: SSR only (hypermedia) Browser: renders HTML, navigates normally Server:
returns HTML

Stage 2: SSR + SSE interactivity (typed envelopes, server-directed JS) Browser:
thin UA posts envelopes and executes instructions Server: dispatches actions,
pushes updates via SSE

Stage 3: Web Components + JSON APIs (custom elements as client islands) Browser:
custom elements manage local interaction complexity Server: JSON APIs provide
typed data and commands, plus SSR fallback

```
      simplest ----------------------------------> most complex

Browser:   HTML only     + UA + SSE          + Custom Elements (islands)
Server:    SSR           SSR + actions       SSR + JSON APIs (+ optional SSE)
```

Core criteria you should optimize for

At every stage, Continuux should prioritize:

- Deterministic end-to-end testability (Deno tests + Playwright)
- Small surface area, low dependency burden
- Typed server-client contracts
- SSR as the default, progressive enhancement as the mechanism
- Clear boundaries between “page composition” and “interactive islands”

## Stage 1: Stay with SSR when

Use SSR only when the UI is mostly read-only or the interactivity can be handled
with navigation and forms. This is the sweet spot for Continuux and should
remain the default for most pages.

Good fits:

- Dashboards that refresh on navigation
- CRUD pages where create/update flows can be full page posts and redirects
- Reporting pages, tables, detail views
- Admin screens with simple filters and pagination
- Pages where “time-to-correctness” matters more than “time-to-animation”

Signals you should stay SSR-only:

- Interactions are low frequency and page reloads are acceptable
- The UI state can be represented as a URL (path + query params)
- You do not need optimistic UI
- You are not fighting layout thrash or complex client-side state
- The team wants maximum auditability and minimum moving parts

Pattern:

- Fluent HTML builds the page
- Standard links and forms drive actions
- Server returns new HTML
- Caching and response headers can do most performance work

```
Click / Submit
|
v
HTTP request
|
v
Server renders HTML
|
v
Browser replaces document
```

## Stage 2: Add lightweight SSE interactivity when

Add SSE-based interactivity when SSR is still the right model, but you need
smoother interactions than full page reloads, or you need the server to push
incremental updates. This stage keeps the browser runtime thin and keeps “real
logic” on the server.

Good fits:

- Inline form validation without navigation
- Partial updates (swap a table body, refresh a badge count, update a status
  row)
- Live progress for long-running tasks
- Notifications and server-driven UI changes
- Simple “click to do something” actions that should not navigate

Signals that it’s time for SSR + SSE:

- You want partial updates but you still want server ownership of behavior
- You want push updates (job progress, streaming results, alerts)
- You want to avoid building client state machines
- You can represent UI changes as server-sent “instructions”
- The interactivity is mostly command oriented, not model heavy

What Continuux provides here:

- Typed interaction envelopes posted from the browser UA
- A typed action registry and server dispatch layer
- SSE sessions keyed by sessionId
- Server-to-client messages including privileged JS instructions when necessary
- A hypermedia approach similar in spirit to HTMX or Datastar, but with typed
  specs

Important discipline:

- SSE-based JS instructions should remain small, deterministic, and testable
- If you start writing large amounts of client logic in JS instructions, you are
  drifting into an unstructured SPA

```
DOM event
|
v
Browser UA builds envelope
|
v
POST /cx (typed envelope)
|
v
Server handler decides update
|
v
SSE event(s) to client
|
v
Apply instruction (DOM patch, or small JS)
```

## Stage 3: Use Web Components and JSON APIs when

Move to Web Components (Custom Elements) when client-side interaction complexity
is becoming real application logic, and trying to keep it purely
“server-directed” creates friction, unreadable instruction streams, or fragile
behavior.

The goal is not to abandon SSR. The goal is to introduce bounded client islands
with strong contracts.

Good fits:

- Rich, stateful widgets (interactive charts, editors, complex filters)
- Highly interactive workflows (multi-step wizards, drag-drop, inline editing)
- Components with significant local state and derived UI
- Offline or poor-network scenarios
- Client-side performance needs that cannot be met with round trips
- UIs that need concurrency control, debouncing, buffering, or optimistic
  updates

Signals it’s time for custom elements:

- The JS instruction channel is growing into a mini framework
- You are encoding component state in server-driven snippets
- UI needs complex internal state transitions
- The number of interactions per minute is high (typing heavy, drag/drop)
- You need reusable, encapsulated UI primitives that can evolve independently
- You need a clear boundary where “this part is a client component”

### How to do it in a Continuux way

1. Keep SSR as the page composer Use Fluent HTML to render the page and place
   custom elements into it. The SSR output must be useful even before the custom
   element upgrades.

Example SSR output:

```html
<customer-search data-api="/api/customers/search" data-initial="...">
  <noscript>Basic search link...</noscript>
</customer-search>
```

2. Use Custom Elements as progressive enhancement islands Each element upgrades
   itself on the client. The component owns its internal DOM and state, but it
   should not own global routing or the overall application lifecycle.

3. Use proper server-side JSON APIs for the element contract When components
   become stateful, “action envelopes” are no longer the best tool. Instead,
   define JSON endpoints with typed schemas:

- Query endpoints for fetching data
- Command endpoints for mutations
- Optional SSE topics for streaming updates

This creates a stable interface that can be validated and tested independently.

```
SSR page (Fluent HTML)
|
v
<my-widget ...data-api...>
|
v
Custom Element upgrades
|
+--> fetch JSON query (GET)
+--> send commands (POST/PUT)
+--> optional SSE stream (GET)
|
v
Widget renders and manages state
```

4. Preserve Continuux invariants inside components Even in Stage 3, Continuux
   should keep the same constraints:

- No heavy framework dependency inside components by default
- Keep component logic readable and deterministic
- Strong schema validation on server and client boundaries
- Full end-to-end test coverage in Playwright

### Choosing between Stage 2 and Stage 3

A practical rule:

If the server can describe the UI update as a small instruction without encoding
component state, stay in Stage 2.

If the update requires maintaining complex client state, move to Stage 3.

Another rule:

If you can test the interaction as “event in, HTML out” or “event in,
instruction out,” Stage 2 is fine.

If you need to test “many events, local state transitions, frequent rendering,”
Stage 3 is appropriate.

What “proper JSON APIs” means in this context

When you move to custom elements, the server contract should be explicit and
stable:

- Every request/response has a schema
- Validation errors are structured
- The component can be hydrated with initial state embedded in SSR
- Mutations return updated state or a version token
- Authorization rules remain server enforced
- Observability remains consistent (requestId/sessionId correlation)

This is where Continuux can become more like “micro-frontend islands,” but with
much tighter discipline.

## Testing expectations across the stages

Stage 1 SSR:

- Deno unit tests for HTML generation and route handlers
- Optional Playwright tests for page rendering and navigation

Stage 2 SSR + SSE:

- Deno unit tests for envelope decoding, handler dispatch, SSE hub logic
- Playwright tests that:

  - click/submit triggers envelope posts
  - SSE is connected and receives events
  - DOM updates match expected output deterministically

Stage 3 Web Components + JSON:

- Deno unit tests for JSON APIs (schemas, auth, command behavior)
- Playwright tests that:

  - SSR output is correct pre-upgrade
  - component upgrades and renders consistently
  - API calls occur as expected
  - component behavior is deterministic under repeated runs

## A useful mental model

Continuux should always feel like this:

- The server composes the page. The client enhances where necessary. Complexity
  is isolated, typed, and testable.
- SSR remains the default. SSE interactivity remains the preferred enhancement.
  Custom elements are the scaling strategy for client complexity, implemented as
  bounded islands with proper JSON APIs when the UI truly needs local state and
  richer client behavior.
