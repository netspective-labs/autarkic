# Continuux Web UI Library for Deno

Continuux is a portmanteau of continuous and UX. The name reflects the idea of a
continuous user interface where the boundary between server and client is
intentionally thin and explicit rather than abstracted away by a heavy
framework. Continuux is designed as a lightweight library, not a framework, for
building UIs where the server and client know each other, share types, and
communicate directly using simple primitives. When interactivity is needed, the
server can push typed events over Server Sent Events to drive hypermedia-style
updates. When it is not, the same system works as plain, deterministic server
side rendering. The emphasis is on continuity of behavior and intent across the
server client boundary, not on client side reimplementation of application
logic.

## Continuux is an AI-first dependency-free library

Continuux is designed from the outset to be AI-first and dependency-free, with
the deliberate exception of Deno standard libraries and web platform standards.
This is not an incidental choice. It is a foundational architectural constraint
that shapes how the system evolves, how it is tested, and how it is maintained
over time.

AI-first does not mean “AI-assisted” in the loose sense of code completion or
occasional refactoring. It means the library is intentionally small, explicit,
deterministic, and structurally simple enough that a capable AI system can
understand, modify, extend, and maintain the entire codebase end to end without
relying on opaque external abstractions.

## Dependency-free by design

Continuux explicitly avoids large frameworks and third-party libraries with deep
dependency graphs. There is no React, no Vue, no templating engine, no
client-side state framework, and no build-time dependency ecosystem. The only
dependencies are:

- Deno `@std` modules, which are versioned, auditable, and intentionally
  conservative
- Web standards such as `fetch`, EventSource, DOM events, and ES modules

This constraint keeps the system small in both conceptual surface area and
operational complexity. Every module in Continuux is readable in isolation.
Every behavior can be traced directly to code in the repository rather than
through layers of indirection introduced by external libraries.

This matters for AI maintenance because large dependency graphs are hostile to
reasoning. When behavior emerges from the interaction of dozens of libraries, AI
systems struggle to infer intent, invariants, and failure modes. By contrast, a
small, self-contained library with explicit contracts is something an AI can
reason about holistically.

## Extensibility by humans, maintenance by AI

Continuux is meant to be extended by humans but maintained by AI.

Humans introduce new features by expressing intent in clear, typed code. Once a
feature exists, it should be straightforward enough that an AI system can:

- Understand why it exists
- Understand how it is used
- Modify it safely
- Extend it consistently
- Detect regressions deterministically

This is why Continuux favors explicit functions, typed interfaces, small
modules, and direct data flow over clever abstractions or meta-programming. The
goal is not minimal code but maximal clarity.

When a new feature is needed, the expectation is not to pull in a dependency
that already “solves” the problem. Instead, the feature should be implemented
directly in a way that fits the existing architecture and can be fully tested
end to end.

## Testing as the foundation for AI maintenance

Testing is not a secondary concern in Continuux. It is the primary enabler of
AI-driven maintenance.

AI systems do not maintain software by intuition. They maintain software by
running tests, observing failures, forming hypotheses, making changes, and
re-running tests. For this loop to work reliably, the test infrastructure must
be:

- Deterministic
- End to end
- Representative of real usage
- Free of hidden global state or timing dependencies

Continuux is structured so that every module is end to end testable.

### Server-side testing

On the server side, Continuux relies on Deno’s built-in unit testing framework.
This provides:

- Fast startup
- No external test runner dependencies
- Direct access to the same runtime used in production
- Strong typing throughout the test code

Server tests cover:

- HTML generation via elements.ts
- Interaction decoding and dispatch logic
- SSE session handling
- HTTP middleware behavior
- Bundling and module serving

Because the server code is deterministic and side-effect constrained, these
tests can assert exact outputs rather than approximate behavior.

### Browser-side testing

For browser behavior, Continuux integrates with Playwright. This is essential
because the browser user agent is a real JavaScript runtime interacting with a
real DOM.

Playwright tests validate:

- That server-rendered HTML behaves correctly when loaded in a browser
- That data-cx attributes are interpreted correctly
- That DOM events produce the correct interaction envelopes
- That server responses and SSE events result in the expected DOM changes
- That JavaScript instructions sent over SSE execute as intended

Crucially, these tests do not mock the browser user agent. They exercise the
real runtime end to end. This ensures that changes made by AI systems are
validated against actual browser behavior, not simulated assumptions.

### Determinism as a hard requirement

A core rule of Continuux development is that no feature should be added unless
it can be fully end to end tested deterministically.

If a feature cannot be tested reliably, it cannot be safely maintained by AI.
Non-deterministic behavior such as race conditions, timing-sensitive logic,
hidden global state, or reliance on external services without strict control all
undermine AI-driven maintenance.

This rule influences design decisions throughout the stack:

- HTML output is deterministic
- Interaction envelopes have explicit schemas
- SSE event handling is explicit and observable
- JavaScript execution is server-directed and testable
- Bundling behavior is cached and predictable

Tests are not merely checking that something “works.” They define the contract
that AI systems rely on to understand what correct behavior means.

## Important take-aways

Continuux is AI-first not because it uses AI, but because it is structured so AI
can safely maintain it. By avoiding large dependencies, favoring explicit
design, and treating deterministic end to end testing as a non-negotiable
requirement, Continuux creates a codebase that is understandable, evolvable, and
resilient in an AI-driven development lifecycle.
