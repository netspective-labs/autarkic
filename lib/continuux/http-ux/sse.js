const TEMPLATE = document.createElement("template");
TEMPLATE.innerHTML = `
  <style>
    @import url("https://cdn.jsdelivr.net/npm/picocss@2.1.0/css/pico.min.css");

    :root {
      font-size: 85%;
    }

    :host {
      display: block;
      width: 100%;
    }

    details {
      border: 1px solid var(--surface-500, #d7dadd);
      border-radius: 0.75rem;
      padding: 0.35rem 0.45rem 0.5rem;
      background: var(--surface-200, #ffffff);
      box-shadow: 0 0.25rem 1rem rgba(15, 23, 42, 0.07);
    }

    summary {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 0.65rem;
      padding-inline: 0.35rem;
      cursor: pointer;
    }

    summary > div {
      flex: 1;
      min-width: 0;
    }

    .summary-title {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 0.1rem;
    }

    .summary-details {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      font-size: 0.8rem;
      color: var(--text-500, #475569);
    }

    .count-pill {
      border-radius: 999px;
      padding: 0.15rem 0.6rem;
      background: var(--surface-300, #eef3ff);
      font-weight: 600;
    }

    .table-wrapper {
      margin-top: 0.65rem;
      max-height: 30rem;
      overflow: auto;
      border-top: 1px solid var(--surface-400, #e0e5eb);
      padding-top: 0.6rem;
    }

    table {
      width: 100%;
      table-layout: fixed;
      border-collapse: collapse;
    }

    th,
    td {
      padding: 0.35rem 0.5rem;
      vertical-align: top;
    }

    td:nth-child(1) {
      width: 13ch;
    }

    td:nth-child(2) {
      width: 9ch;
      text-transform: capitalize;
      font-weight: 600;
    }

    td:nth-child(3) {
      width: auto;
    }

    tbody tr {
      transition: background 0.2s ease;
    }

    tbody tr.connection-event {
      background: rgba(56, 189, 248, 0.16);
    }

    tbody tr:not(.connection-event):nth-child(even) {
      background: rgba(0, 0, 0, 0.03);
    }

    pre {
      margin: 0;
      font-size: 0.75rem;
      font-family: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 12rem;
      overflow: auto;
      background: transparent;
    }

    .empty-state {
      text-align: center;
      font-style: italic;
      color: var(--text-400, #94a3b8);
    }

    button {
      align-self: flex-start;
      white-space: nowrap;
    }
  </style>
  <details open>
    <summary>
      <div>
        <div class="summary-title">Server-Sent Events</div>
        <div class="summary-details">
          <span data-summary-text>Events: 0</span>
          <span class="count-pill" data-connection-count>Connections: 0</span>
        </div>
      </div>
      <button type="button" class="secondary" data-clear>Clear</button>
    </summary>
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col">Event</th>
            <th scope="col">Payload</th>
          </tr>
        </thead>
        <tbody data-events-body>
          <tr class="empty-row">
            <td colspan="3" class="empty-state">Awaiting SSE events...</td>
          </tr>
        </tbody>
      </table>
    </div>
  </details>
`;

class ServerSentEventsInspector extends HTMLElement {
  constructor() {
    super();
    this._events = [];
    this._connectionCount = 0;
    this._maxRows = 300;
    this._shadowRoot = this.attachShadow({ mode: "open" });
    this._shadowRoot.appendChild(TEMPLATE.content.cloneNode(true));
    this._summaryText = this._shadowRoot.querySelector("[data-summary-text]");
    this._connectionBadge = this._shadowRoot.querySelector(
      "[data-connection-count]",
    );
    this._tbody = this._shadowRoot.querySelector("[data-events-body]");
    this._clearButton = this._shadowRoot.querySelector("[data-clear]");
    if (this._clearButton) {
      this._clearButton.addEventListener("click", () => this.clearEvents());
    }
  }

  static get observedAttributes() {
    return [];
  }

  /**
   * Append a new SSE entry to the inspector.
   *
   * @param {Event|Record<string, unknown>} eventLike SSE message or a payload object
   * @param {Object} [options]
   * @param {string} [options.type]
   * @param {unknown} [options.payload]
   * @param {number|Date|string} [options.timestamp]
   * @param {string} [options.id]
   */
  recordEvent(eventLike, options = {}) {
    const entry = this._normalizeEntry(eventLike, options);
    if (!entry) return;

    this._events.unshift(entry);
    if (entry.type?.toLowerCase() === "connection") {
      this._connectionCount += 1;
    }
    this._renderEntry(entry);
    this._trimHistory();
    this._updateSummary();
  }

  /**
   * Convenience helper that wires a native EventSource into the inspector.
   * Returns a cleanup function that removes the registered listeners.
   *
   * @param {EventTarget} source
   */
  observeEventSource(source) {
    if (!source || typeof source.addEventListener !== "function") {
      return () => {};
    }

    const off = [];
    const bind = (event, handler) => {
      source.addEventListener(event, handler);
      off.push(() => source.removeEventListener(event, handler));
    };

    bind("message", (event) => this.recordEvent(event));
    bind("open", () =>
      this.recordEvent({ type: "connection", data: { status: "open" } }),
    );
    bind("error", (event) =>
      this.recordEvent({ type: "error", data: { message: event?.message ?? "error" } }),
    );

    return () => {
      off.forEach((fn) => fn());
    };
  }

  clearEvents() {
    this._events.length = 0;
    this._connectionCount = 0;
    this._tbody.innerHTML = "";
    this._renderEmptyState();
    this._updateSummary();
  }

  _updateSummary() {
    if (this._summaryText) {
      this._summaryText.textContent = `Events: ${this._events.length}`;
    }
    if (this._connectionBadge) {
      this._connectionBadge.textContent = `Connections: ${this._connectionCount}`;
    }
  }

  _renderEntry(entry) {
    if (!this._tbody) return;
    this._removeEmptyState();

    const row = document.createElement("tr");
    if (entry.type?.toLowerCase() === "connection") {
      row.classList.add("connection-event");
    }

    const timeTd = document.createElement("td");
    timeTd.textContent = entry.timestamp.toLocaleString();

    const typeTd = document.createElement("td");
    typeTd.textContent = entry.type ?? "message";

    const payloadTd = document.createElement("td");
    const pre = document.createElement("pre");
    pre.textContent = this._formatPayload(entry.payload);
    payloadTd.appendChild(pre);

    if (entry.id) {
      row.dataset.eventId = entry.id;
    }

    row.append(timeTd, typeTd, payloadTd);
    this._tbody.prepend(row);
  }

  _trimHistory() {
    if (!this._tbody) return;
    while (this._tbody.children.length > this._maxRows) {
      this._tbody.removeChild(this._tbody.lastElementChild);
    }
  }

  _renderEmptyState() {
    if (!this._tbody) return;
    const row = document.createElement("tr");
    row.className = "empty-row";
    const cell = document.createElement("td");
    cell.colSpan = 3;
    cell.className = "empty-state";
    cell.textContent = "Awaiting SSE events...";
    row.appendChild(cell);
    this._tbody.appendChild(row);
  }

  _removeEmptyState() {
    if (!this._tbody) return;
    const emptyRow = this._tbody.querySelector(".empty-row");
    if (emptyRow) {
      emptyRow.remove();
    }
  }

  _normalizeEntry(source, options) {
    const isEventLike =
      source &&
      typeof source === "object" &&
      ("data" in source || "type" in source || "event" in source);
    const payload = options?.payload ?? (isEventLike ? source.data : source);
    const eventType =
      options?.type ??
      (isEventLike
        ? source.event ?? source.type ?? "message"
        : "message");

    const rawTimestamp =
      options?.timestamp ??
      (isEventLike ? source.timestamp ?? source.timeStamp : Date.now());
    const timestamp = this._safeDate(rawTimestamp);

    const id =
      options?.id ??
      (isEventLike ? source.id ?? source.lastEventId ?? undefined : undefined);

    if (payload === undefined && !eventType) {
      return null;
    }

    return {
      type: eventType,
      payload,
      timestamp,
      id,
    };
  }

  _formatPayload(payload) {
    if (payload === undefined || payload === null) {
      return "null";
    }

    if (typeof payload === "object") {
      try {
        return JSON.stringify(payload, null, 2);
      } catch {
        return String(payload);
      }
    }

    if (typeof payload === "string") {
      try {
        const parsed = JSON.parse(payload);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return payload;
      }
    }

    return String(payload);
  }

  _safeDate(value) {
    if (value instanceof Date) {
      return value;
    }
    const candidate = new Date(value);
    if (Number.isNaN(candidate.getTime())) {
      return new Date();
    }
    return candidate;
  }
}

if (!customElements.get("sse-inspector")) {
  customElements.define("sse-inspector", ServerSentEventsInspector);
}

export { ServerSentEventsInspector };
