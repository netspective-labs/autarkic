# Fluent HTML (Server + Client)

This document explains the `fluent.ts` HTML builder used on both the server and
the browser. It is both a reference and a teaching guide.

The goal of Fluent HTML is to let you build HTML using plain TypeScript, with
strong typing, predictable output, and no magic. It deliberately avoids JSX,
virtual DOMs, and compile-time transforms.

Think of it as “HTML as code, not templates”.

## Core idea

Instead of writing HTML as strings or JSX, you write HTML as function calls:

```ts
div(
  { class: "container" },
  h1("Hello"),
  p("This is fluent HTML"),
);
```

Every HTML tag is a function. Children are passed as arguments. Attributes are
plain objects.

This works the same way on:

- the server (returns HTML strings)
- the browser (creates real DOM nodes)

The API is intentionally almost identical in both environments.

## Mental model

Fluent HTML follows three rules:

1. **HTML is data, not text**

   - You never concatenate HTML strings.
   - You never interpolate unescaped user input.

2. **TypeScript is the control flow**

   - Loops, conditionals, and composition are just normal TypeScript.
   - No template syntax to learn.

3. **Escape by default**

   - Text is always escaped.
   - Raw HTML must be explicitly opted into.

## Server vs client

### Server (`lib/html/server/fluent.ts`)

- Produces HTML strings
- Used for:

  - full page rendering
  - partial HTML responses
  - email templates
  - server-driven UI

```ts
const html = render(
  doctype(),
  html(
    head(title("My Page")),
    body(
      h1("Hello"),
      p("Rendered on the server"),
    ),
  ),
);
```

### Client (`src/html/browser-ua/fluent.ts`)

- Produces real DOM nodes
- Used for:

  - progressive enhancement
  - client-side rendering without frameworks
  - hypermedia-driven updates

```ts
mount(
  document.body,
  main(
    h1("Hello"),
    p("Rendered in the browser"),
  ),
);
```

The same tag functions exist in both.

## Basic usage

### Tags

Every standard HTML tag is exported as a function:

```ts
div(...)
span(...)
button(...)
form(...)
```

Reserved words use a suffix:

```ts
codeTag("const x = 1");
varTag("x");
qTag("quote");
```

### Attributes

Attributes are plain objects:

```ts
input({ type: "text", disabled: true });
```

Rules:

- `true` → emits a bare attribute
- `false`, `null`, `undefined` → omitted
- ordering is deterministic

```ts
input({ disabled: true, hidden: false, value: "x" });
// <input disabled value="x">
```

## Children

Children can be:

- strings
- numbers
- other elements
- arrays
- builder functions (important)

```ts
div(
  "text",
  span("child"),
  ["a", "b", "c"],
);
```

### Text is escaped by default

```ts
div("<script>alert(1)</script>");
// renders escaped, not executable
```

### Raw HTML (explicit)

```ts
div(raw("<b>ok</b>"));
```

This is intentionally noisy. Juniors should feel friction here.

## Builders (imperative children)

This is the most important concept.

Anywhere you can pass a child, you can pass a **builder function**:

```ts
ul((e) => {
  for (const x of items) {
    e(li(x));
  }
});
```

This works anywhere, not just in special positions.

### Conditionals

```ts
div((e) => {
  e(h1("Items"));

  if (items.length === 0) {
    e(p("No items"));
  } else {
    e(ul((e) => {
      for (const it of items) e(li(it));
    }));
  }
});
```

No ternaries. No fragments. No JSX rules.

Just TypeScript.

## Helpers for juniors

### `attrs(...)`

Merge attribute objects safely and deterministically.

```ts
button(
  attrs(
    { id: "save" },
    isPrimary && { class: "primary" },
  ),
  "Save",
);
```

Later objects win.

### `cls(...)`

Build class strings safely.

```ts
div({
  class: cls(
    "card",
    { active: isActive, disabled: isDisabled },
    extraClasses,
  ),
});
```

No accidental `"false"` or `"undefined"` classes.

### `css(...)`

Inline styles as objects.

```ts
div({
  style: css({
    backgroundColor: "#f6f6f6",
    padding: "1rem",
  }),
});
```

Stable output, kebab-cased automatically.

### `each(...)`

Safer than `.map()` for juniors.

```ts
ul(
  each(items, (it) => li(it.name)),
);
```

No forgotten `return`, no nested arrays.

## Script and style safety

### Problem

This is wrong:

```ts
script("alert('x')");
```

It gets escaped.

### Correct

Use helpers:

```ts
scriptJs(`
  console.log("safe inline JS");
`);
```

```ts
styleCss(`
  body { background: #eee; }
`);
```

This avoids teaching juniors to use `raw()`.

## Hypermedia helpers (JunxionUX)

The server fluent API includes helpers for hypermedia-style attributes:

```ts
button(
  attrs(
    { id: "ping" },
    JunxionUX.clickGet("/ping"),
  ),
  "Ping",
);
```

This emits:

```html
<button id="ping" data-on:click="@get(&quot;/ping&quot;)">Ping</button>
```

On the client, the runtime auto-loads when these attributes appear.

No manual wiring.

## Comparison with React

### Similarities

- Components are functions
- UI is composed hierarchically
- TypeScript drives correctness

### Key differences

#### No virtual DOM

React:

- builds an intermediate tree
- diffs on every render
- requires a runtime scheduler

Fluent HTML:

- produces final HTML or DOM directly
- no diffing
- no reconciliation
- no hooks

#### No JSX

React:

- requires JSX
- requires a build step
- has special syntax rules

Fluent HTML:

- plain TypeScript
- no compiler transforms
- works in Deno without tooling

#### No hidden lifecycle

React:

- effects
- hooks
- dependency arrays
- render cycles

Fluent HTML:

- what you write is what runs
- no reactivity unless you add it
- easy to reason about

## When Fluent HTML is better

- Server-rendered pages
- Hypermedia-driven apps
- Admin UIs
- Internal tools
- Docs, dashboards, control panels
- Teams with junior engineers
- Environments where determinism matters

## When React is better

- Highly interactive SPAs
- Complex client-side state machines
- Large component ecosystems
- Teams already deep into React tooling

Fluent HTML does not try to replace React everywhere.

It replaces:

- unnecessary complexity
- accidental XSS
- hidden runtime behavior
- JSX build chains

## Design philosophy (important for juniors)

- HTML is not a template language
- TypeScript is your templating language
- Escaping is the default
- Power is opt-in, not implicit
- What you read is what runs

If a junior can read this code:

```ts
main((e) => {
  e(h1("Users"));

  if (users.length === 0) {
    e(p("No users"));
  } else {
    e(ul(each(users, (u) => li(u.name))));
  }
});
```

They understand exactly what the HTML will be.

No magic. No surprises.

If you want, next good follow-ups are:

- a “dos and don’ts” cheat sheet for juniors
- a migration guide from JSX to Fluent HTML
- a set of lint rules specifically for fluent usage
- a cookbook of common UI patterns (tables, forms, layouts)
