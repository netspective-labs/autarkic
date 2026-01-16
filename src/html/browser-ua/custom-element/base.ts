/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

// src/html/browser-ua/custom-element/base.ts
//
// Base class for dependency-free Fluent custom elements.
// - Strongly typed state via generics
// - Deterministic rendering via a single render() method
// - Wires data-* semantics via our local runtime enhance()
// - Closes SSE connections on disconnect
//
// Bundles to:
//   lib/html/browser-ua/custom-element/base.auto.js

import { closeSseIfPresent, enhance } from "../runtime.ts";

export type RenderTarget = ShadowRoot | HTMLElement;

export type JunxionElementOptions = {
  useShadow?: boolean;
  // Optional: opt out of expression evaluation in directives.
  allowExpressions?: boolean;
};

export abstract class JunxionElement<S extends Record<string, unknown>>
  extends HTMLElement {
  #opts:
    & Required<Pick<JunxionElementOptions, "useShadow">>
    & Omit<JunxionElementOptions, "useShadow">;
  #root: RenderTarget;
  #state: S;
  #isConnected = false;

  protected constructor(initialState: S, opts: JunxionElementOptions = {}) {
    super();
    this.#opts = { useShadow: true, ...opts };
    this.#root = this.#opts.useShadow
      ? this.attachShadow({ mode: "open" })
      : this;
    this.#state = initialState;
  }

  protected get state(): S {
    return this.#state;
  }

  protected get root(): RenderTarget {
    return this.#root;
  }

  protected setState(patch: Partial<S>) {
    this.#state = { ...this.#state, ...patch } as S;
    this.rerender();
  }

  connectedCallback() {
    this.#isConnected = true;
    this.rerender();
  }

  disconnectedCallback() {
    this.#isConnected = false;
    closeSseIfPresent(this.#root);
  }

  protected rerender() {
    if (!this.#isConnected) return;

    const n = this.render();

    if (n instanceof DocumentFragment) {
      this.#root.replaceChildren(n);
    } else {
      this.#root.replaceChildren(n);
    }

    // Wire data-on:*, data-bind:*, data-sse, etc inside this element’s root
    enhance({
      root: this.#root,
      options: {
        allowExpressions: this.#opts.allowExpressions ?? true,
      },
    });
  }

  // subclasses implement
  protected abstract render(): Node | DocumentFragment;
}
