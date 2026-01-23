# Natural HTML

Natural HTML is a tiny, functional HTML authoring library for TypeScript that
generates deterministic HTML without JSX, template strings, or DOM mutation. It
builds a HAST (Hypertext AST) tree and renders it to HTML, so your UI is
explicit, type-safe, and inspectable. If you have used hyperscript, tagged
templates, or JSX render functions, this will feel familiar, but more strict and
deterministic.

Natural HTML contains no server behavior. Rendering is pure functional
composition that emits HAST (and HTML downstream), so the same code works in
interactive or non-interactive contexts, with or without a browser DOM. It is
safe for static site generation, batch rendering, tests, and server responses.

Natural HTML is the foundation for Junxion UX server-rendered UI and the Natural
Design System runtime.

## Why it exists

Most TypeScript web stacks force you into a template DSL (JSX, Handlebars, etc.)
and then re-interpret the output at runtime. Natural HTML avoids that:

- No template DSLs or JSX transforms
- No DOM mutation for server rendering
- Deterministic output (sorted attributes, stable serialization)
- HAST output that is compatible with the unified / syntax-tree ecosystem

The result is HTML you can reason about, test exactly, and keep fully in
TypeScript.

## Core modules

### `elements.ts`

A dependency-free, type-safe HTML builder:

- Typed tag API for all standard HTML tags
- Explicit child model (strings are escaped, null/undefined dropped)
- Raw HTML insertion with policy controls for dev/test
- Deterministic attribute ordering for stable output
- Renderers for compact or pretty HTML

If you have used JSX, think of this as a pure-function renderer that produces
HAST instead of VDOM.

### `dialog.ts`

A schema-driven dialog and form system built on top of Natural HTML and Zod.

This module provides a fluent builder for `<dialog>` and `<form>` composition,
where the structure, fields, and validation rules are derived from a Zod object
schema. The goal is to make form UIs a direct projection of data contracts,
rather than an independent, loosely-coupled artifact.

Key properties:

- Dialogs are defined against Zod object schemas
- Field names are type-safe and schema-derived
- Validation errors map deterministically to fields
- Rendering is pure and server-safe, with no DOM dependency
- Supports modal or inline rendering modes

Included capabilities:

- Built-in field renderers for inputs, textareas, checkboxes, and selects
- Automatic wiring of labels, descriptions, errors, ARIA attributes, and IDs
- Deterministic layout for headers, bodies, actions, and footers
- Integrated CSS, scripts, and UA dependencies emitted as head tags

Dialogs expose a small, explicit surface:

- `render()` to produce HTML
- `headTags()` to emit required styles and scripts
- Access to registered fields and ordering

This module is intentionally not a client-side form framework. It produces
correct, accessible HTML that can be enhanced by progressive JavaScript if
needed.

### `dialog-zod.ts`

A convenience layer that binds dialog metadata directly to Zod schemas and
fields.

This module allows dialog-related information to live alongside the schema
definition itself, rather than in a separate builder call. Metadata is attached
using Zod’s `.meta()` mechanism and stored in weak maps.

What it enables:

- Define field labels, descriptions, placeholders, and renderers on schema
  fields
- Define dialog-level defaults such as title, description, submit/cancel labels,
  field order, default data, and attributes
- Auto-generate dialogs directly from annotated schemas
- Deterministic merging of schema defaults with per-render overrides

The result is a single source of truth: the schema describes the data shape,
validation rules, and the default UI projection.

### `dialog-lform.ts`

An adapter that turns LHC-Forms style questionnaire JSON into Natural HTML
dialogs.

This module loads a form definition from a local file or remote URL and maps it
into:

- A generated Zod object schema
- A set of dialog field renderers inferred from item types
- Default values derived from `initial*` fields
- A stable field order matching the questionnaire definition

Supported mappings include:

- Boolean items to checkboxes
- Choice and open-choice items to selects (with answer options)
- Integer and decimal items to numeric inputs
- Date and date-time items to date inputs
- String and text items to text inputs

The output is a fully functional `Dialog` instance that can be rendered like any
other Natural HTML dialog, with titles, descriptions, defaults, and ordering
automatically applied.

This is designed for interoperability and reuse, not as a replacement for
FHIR-native tooling. It provides a deterministic, inspectable HTML projection of
questionnaire-style forms.

### `design-system.ts`

The Natural Design System runtime. It defines layouts, regions, slots, and
components as typed contracts so invalid UI states are unrepresentable. This is
similar in spirit to component composition frameworks, but without a runtime
component model or state management layer.

Key properties:

- Layouts and regions are compile-time enforced structures
- Slots are exact, required/optional keys with runtime validation in dev
- Components are pure render functions that return HAST
- No hidden global registry or runtime mutation

### UA dependencies (integrated CSS and JS)

Natural HTML includes first-class modeling for user agent dependencies such as
CSS, JS modules, and fonts. Design systems and dialogs declare these dependencies
as data so the server can expose routes and emit correct `<link>` and `<script>`
tags.

This enables integrated styling and behavior without relying on external CSS
frameworks or build-time tooling.

## How it fits in Junxion UX

Natural HTML is the rendering substrate. Dialogs provide schema-driven form
infrastructure. Continuux handles typed interaction contracts and SSE. Natural
DS defines the canonical design system, all layered without runtime coupling.

Each layer is explicit, testable, and replaceable.

## Example

```ts
import * as h from "./elements.ts";

const page = h.render(
  h.doctype(),
  h.html(
    h.head(
      h.meta({ charset: "utf-8" }),
      h.title("Hello"),
    ),
    h.body(
      h.main({ class: "container" }, h.h1("Natural HTML")),
    ),
  ),
);
