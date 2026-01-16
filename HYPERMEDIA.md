# Hypermedia in Fluent (dependency-free)

This document explains how Fluent implements hypermedia-style interactivity
without external JavaScript dependencies. The approach is inspired by systems
like HTMX and DataStar, but the runtime is fully local, minimal, and designed to
work naturally with Fluent’s typed HTML builders on both server and client.

The core principle is that HTML is the interface. The server emits HTML plus
declarative `data-*` attributes. The browser runtime interprets those attributes
and performs the necessary behavior: event handling, HTTP requests, DOM updates,
lightweight state management, and optional server-sent events.

There is no client framework, no virtual DOM, and no required third-party
runtime.

## The mental model

Fluent hypermedia has three aligned layers.

1. The server renders HTML using Fluent tag functions. Interactivity is
   described declaratively using attributes.
2. The browser runtime scans the DOM (or a ShadowRoot) and wires behavior based
   on those attributes.
3. The server responds with HTML fragments or JSON, and the browser applies
   updates using simple, predictable rules.

Everything flows through standard browser primitives: attributes, events,
`fetch`, and DOM mutations.

## Actions and events

User interactions are declared with `data-on:*` attributes. The attribute value
describes what should happen when the event fires.

A typical server-rendered button might look like this:

```ts
button(
  attrs({ "data-on:click": '@get("/items")' }),
  "Load items",
);
```

There is no JavaScript handler attached in user code. The Fluent runtime scans
for `data-on:click`, attaches a listener, and interprets the `@get("/items")`
action.

Supported actions are:

- `@get(url)`
- `@post(url)`
- `@put(url)`
- `@patch(url)`
- `@delete(url)`

When the event fires, the runtime issues a `fetch()` request using the specified
HTTP method.

This is directly comparable to HTMX’s `hx-get` or DataStar’s
`data-on:click="@get(...)"`, but implemented locally and without a dependency.

## Server responses and DOM updates

The server controls how the browser updates the DOM by setting response headers.

Common headers include:

- `datastar-selector`: CSS selector of the target element
- `datastar-mode`: how to apply the update (`inner`, `replace`, `append`, etc.)
- `datastar-only-if-missing`: guard against overwriting existing content

A server handler might return an HTML fragment and include headers like:

```http
Datastar-Selector: #items
Datastar-Mode: inner
```

The runtime receives the response, finds the target element, and applies the
HTML fragment according to the specified mode.

This keeps control firmly on the server while allowing fine-grained client-side
updates.

## Signals and lightweight state

Fluent includes a minimal state mechanism called signals. Signals are plain JSON
objects attached to the DOM using `data-signals`.

Example server-rendered markup:

```ts
div(
  attrs({ "data-signals": JSON.stringify({ count: 0 }) }),
  span(attrs({ "data-text": "signals.getPath('count')" })),
  button(
    attrs({
      "data-on:click": "signals.setPath('count', signals.getPath('count') + 1)",
    }),
    "+",
  ),
);
```

The runtime parses `data-signals` and maintains an internal store. Expressions
in `data-text`, `data-show`, `data-class:*`, and similar attributes are
re-evaluated when signals change.

This is not a general-purpose reactive system. It is intentionally small and
explicit, suitable for counters, flags, filters, and UI state that naturally
lives close to the DOM.

## Data binding

Form elements can bind directly to signals using `data-bind:*`.

```ts
input(attrs({
  type: "text",
  "data-bind:user.name": "",
}));
```

When the user types, the signal path `user.name` is updated. When signals change
programmatically, the input value is updated.

This provides simple two-way binding without a framework.

## Conditional rendering and attributes

Fluent supports common conditional behaviors via attributes:

- `data-show="expr"` toggles visibility
- `data-class:active="expr"` toggles a CSS class
- `data-attr:href="expr"` sets or removes an attribute

Expressions run in a constrained context with access to `signals`, the current
event (when applicable), and the element.

## Server-Sent Events (SSE)

Fluent supports SSE using `data-sse` attributes.

```ts
div(attrs({ "data-sse": "/events" }));
```

When present, the runtime opens an `EventSource`. Incoming messages can:

- Merge JSON payloads into signals
- Swap HTML into a target element using the same update rules as fetch responses

Connections are automatically closed when the element or its containing custom
element is disconnected.

## Custom elements and Shadow DOM

Fluent’s hypermedia runtime works with both the light DOM and Shadow DOM.

Custom elements typically extend a shared base class and render using Fluent
builders. After each render, the runtime is invoked with the element’s root
(either `this` or `this.shadowRoot`).

This ensures that `data-on:*`, `data-bind:*`, and `data-sse` attributes inside a
component are wired correctly and scoped to that component.

## Comparison to HTMX and DataStar

The ideas are similar:

- HTML-first behavior
- Server-driven UI updates
- Minimal client logic

The key differences are:

- Fluent is dependency-free
- The runtime is small, inspectable, and local
- The HTML is generated with strong typing via Fluent builders
- Shadow DOM and custom elements are first-class concerns

Instead of importing a framework, Fluent treats hypermedia as a small,
composable capability that fits naturally into a typed HTML pipeline.

## Summary

Fluent’s hypermedia layer lets you build interactive applications using:

- Typed server-rendered HTML
- Declarative `data-*` attributes
- Standard HTTP and SSE
- A minimal, dependency-free browser runtime

The result is a system that feels modern and interactive while remaining simple,
inspectable, and aligned with the web’s native architecture.
