#!/usr/bin/env -S deno run -A --watch --unstable-bundle --node-modules-dir=auto
/**
 * ContinuUX “Hello Dialog” sample.
 *
 * Demonstrates:
 * - Natural Dialog form composition with SSE-backed live validation.
 * - ContinuUX CX helper wiring (actions + SSE hub + boot script).
 * - Server-sent validation messages and submit summary updates displayed inline.
 *
 * Run:
 *   deno run -A support/learn/04-dialog/hello.ts
 */

import { z } from "@zod";
import {
  createSseDiagnostics,
  type SseDiagnosticEntry,
} from "../../../lib/continuux/http-ux/aide.ts";
import { Application, htmlResponse } from "../../../lib/continuux/http.ts";
import {
  actionSchemas,
  createCx,
  type CxActionHandlers,
} from "../../../lib/continuux/interaction-html.ts";
import {
  CxMiddlewareBuilder,
  decodeCxEnvelope,
} from "../../../lib/continuux/interaction.ts";
import {
  checkboxField,
  createDialog,
  type DialogFieldName,
  type DialogFieldRenderCtx,
  type DialogRenderOptions,
  type DialogZodObject,
  inputField,
  selectField,
} from "../../../lib/natural-html/dialog.ts";
import type { RawHtml } from "../../../lib/natural-html/elements.ts";
import * as H from "../../../lib/natural-html/elements.ts";
import { customElement } from "../../../lib/natural-html/elements.ts";

type Vars = Record<string, never>;

const dialogName = "hello-dialog";
const dialogId = `${dialogName}-dialog`;
const formId = `${dialogId}-form`;
const summaryId = `${formId}-summary`;
const diagId = `${formId}-diagnostics`;

const pointingMood = ["optimistic", "curious", "reflective"] as const;
const palette = ["ember", "emerald", "azure"] as const;

const nameSchema = z.string().min(2, "Enter at least two characters");
const emailSchema = z.string().email("Provide a valid email address");
const ageSchema = z.preprocess((value) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return value;
    const numeric = Number(trimmed);
    return Number.isFinite(numeric) ? numeric : value;
  }
  return value;
}, z.number().int().min(13, "Age must be at least 13").max(120));
const moodSchema = z.enum(pointingMood).optional();
const colorSchema = z.enum(palette);
const subscribeSchema = z.preprocess((value) => {
  if (typeof value === "string") return value === "true";
  if (typeof value === "boolean") return value;
  return false;
}, z.boolean());

const formSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  age: ageSchema,
  mood: moodSchema,
  color: colorSchema,
  subscribe: subscribeSchema,
}) as DialogZodObject;

type FormSubmission = z.infer<typeof formSchema>;
type State = { submissions: FormSubmission[] };

const appState: State = { submissions: [] };

const fieldSchemas: Record<string, z.ZodTypeAny> = {
  name: nameSchema,
  email: emailSchema,
  age: ageSchema,
  mood: moodSchema,
  color: colorSchema,
  subscribe: subscribeSchema,
};

const validationWrapper = (
  fieldHtml: RawHtml,
  ctx: DialogFieldRenderCtx<DialogZodObject, DialogFieldName<DialogZodObject>>,
): RawHtml => {
  const feedbackId = `${ctx.formId}-${ctx.fieldName}-feedback`;
  return H.div(
    { class: ctx.classes.field, "data-field": ctx.fieldName },
    ctx.label
      ? H.label(
        { class: ctx.classes.fieldLabel, for: ctx.inputId },
        ctx.label,
      )
      : null,
    fieldHtml,
    ctx.description
      ? H.p({ class: ctx.classes.fieldDescription }, ctx.description)
      : null,
    H.p(
      {
        id: feedbackId,
        class: ctx.classes.fieldDescription,
        "data-valid": "pending",
      },
      "",
    ),
    ctx.hasError
      ? H.p(
        { class: ctx.classes.fieldError, id: ctx.errorId },
        ctx.errors[0]?.message ?? "Resolve this field",
      )
      : null,
  );
};

const feedbackElementId = (field: string) => `${formId}-${field}-feedback`;
const inputElementId = (field: string) => `${formId}-${field}`;

const setValidationFeedbackJs = (
  field: string,
  message: string,
  valid: boolean,
): string => `
  {
    const fb = document.getElementById(${
  JSON.stringify(feedbackElementId(field))
});
    if (fb) {
      fb.textContent = ${JSON.stringify(message)};
      fb.dataset.valid = ${JSON.stringify(valid ? "true" : "false")};
    }
    const inputEl = document.getElementById(${
  JSON.stringify(inputElementId(field))
});
    if (inputEl && "classList" in inputEl) {
      if (${valid}) {
        inputEl.classList.remove("natural-dialog__field-input--invalid");
        inputEl.removeAttribute("aria-invalid");
      } else {
        inputEl.classList.add("natural-dialog__field-input--invalid");
        inputEl.setAttribute("aria-invalid", "true");
      }
    }
  }
`;

const setSubmissionMessageJs = (message: string, success: boolean): string => `
  {
    const target = document.getElementById(${JSON.stringify(summaryId)});
    if (target) {
      target.textContent = ${JSON.stringify(message)};
      target.dataset.status = ${JSON.stringify(success ? "success" : "error")};
    }
  }
`;

const normalizeFieldValue = (
  fieldName: string,
  input?: Partial<{ value?: string; checked?: boolean }>,
): unknown => {
  switch (fieldName) {
    case "age": {
      const raw = input?.value ?? "";
      if (!raw.trim()) return raw;
      const numeric = Number(raw);
      return Number.isFinite(numeric) ? numeric : raw;
    }
    case "subscribe":
      return !!input?.checked;
    default:
      return input?.value ?? "";
  }
};

const interactivityAide = <
  State extends { submissions: FormSubmission[] },
  Vars extends Record<string, unknown>,
>(_state: State) => {
  const actions = actionSchemas({
    validateField: decodeCxEnvelope,
    submitForm: decodeCxEnvelope,
  });

  type ServerEvents = {
    readonly js: string;
    readonly diag: SseDiagnosticEntry;
    readonly connection: SseDiagnosticEntry;
  };

  const cx = createCx<State, Vars, typeof actions, ServerEvents>(actions);
  const hub = cx.server.sseHub();
  const sseDiagnostics = createSseDiagnostics(hub, "diag", "connection");
  const builder = new CxMiddlewareBuilder<ServerEvents>({ hub });
  const sseInspectorTag = customElement("sse-inspector");

  const sendDiagEvent = (
    sessionId: string | undefined,
    entry: Partial<SseDiagnosticEntry>,
  ) => {
    if (!sessionId) return;
    sseDiagnostics.diag(sessionId, entry);
  };

  const handlers: CxActionHandlers<
    State,
    Vars,
    typeof actions,
    ServerEvents,
    "action"
  > = {
    validateField: ({ cx: env, emit, sessionId }) => {
      const fieldName = env.element.name ?? "";
      if (!fieldName) return { ok: true };
      const schemaForField = fieldSchemas[fieldName];
      if (!schemaForField) return { ok: true };
      const normalized = normalizeFieldValue(fieldName, env.input);
      const parsed = schemaForField.safeParse(normalized);
      const message = parsed.success
        ? "Looks good"
        : parsed.error.issues[0]?.message ?? "Please fix this field";
      emit.js(setValidationFeedbackJs(fieldName, message, parsed.success));
      sendDiagEvent(sessionId, {
        message: `${fieldName} validation -> ${
          parsed.success ? "ok" : "fail"
        }: ${message}`,
        level: parsed.success ? "info" : "warn",
        payload: { field: fieldName, valid: parsed.success },
      });
      return { ok: true };
    },
    submitForm: ({ cx: env, emit, state, sessionId }) => {
      const parsed = formSchema.safeParse(env.form ?? {});
      if (!parsed.success) {
        const issues = parsed.error.issues
          .map((issue) =>
            `${String(issue.path[0] ?? "field")}: ${issue.message}`
          )
          .join("; ");
        sendDiagEvent(sessionId, {
          message: `submit validation failed: ${issues}`,
          level: "error",
          payload: { issues },
        });
        for (const issue of parsed.error.issues) {
          if (typeof issue.path[0] === "string") {
            emit.js(
              setValidationFeedbackJs(issue.path[0], issue.message, false),
            );
          }
        }
        emit.js(setSubmissionMessageJs(`Validation errors: ${issues}`, false));
        return { ok: false, status: 400, message: "validation" };
      }
      state.submissions.push(parsed.data);
      const successMessage =
        `Submitted ${parsed.data.name}. Total submissions: ${state.submissions.length}.`;
      emit.js(setSubmissionMessageJs(successMessage, true));
      sendDiagEvent(sessionId, {
        message: successMessage,
        level: "info",
        payload: { submissions: state.submissions.length },
      });
      return { ok: true };
    },
  };

  const middleware = builder.middleware<State, Vars, typeof actions, "action">({
    uaCacheControl: "no-store",
    onConnect: async ({ session, sessionId }) => {
      await session.sendWhenReady(
        "js",
        setSubmissionMessageJs(
          "Connected. Form values stream validation as you move between fields.",
          true,
        ),
      );
      sseDiagnostics.connection(sessionId, {
        message: "SSE diagnostics channel established",
        level: "info",
      });
    },
    interaction: {
      cx,
      handlers,
    },
  });

  return { cx, builder, middleware, sseDiagnostics, sseInspectorTag };
};

const {
  cx,
  middleware: interactivityMiddleware,
  sseDiagnostics,
  sseInspectorTag,
} = interactivityAide<State, Vars>(appState);

const changeAttr = () => cx.html.change("validateField");

const fieldOrder = [
  "name",
  "email",
  "age",
  "mood",
  "color",
  "subscribe",
] as const;

const dialogBuilder = createDialog(dialogName, formSchema);

dialogBuilder.field("name", {
  label: "Full name",
  description: "How should we address you in follow-ups?",
  renderer: inputField({
    placeholder: "Ada Lovelace",
    attrs: changeAttr(),
  }),
  wrapper: validationWrapper,
});

dialogBuilder.field("email", {
  label: "Email",
  description: "We will never spam your inbox.",
  renderer: inputField({
    type: "email",
    placeholder: "you@example.com",
    attrs: changeAttr(),
  }),
  wrapper: validationWrapper,
});

dialogBuilder.field("age", {
  label: "Age",
  description: "Used for contextualizing recommendations.",
  renderer: inputField({
    type: "number",
    placeholder: "30",
    attrs: changeAttr(),
  }),
  wrapper: validationWrapper,
});

dialogBuilder.field("mood", {
  label: "Current mood",
  renderer: selectField({
    options: pointingMood.map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
    includeBlank: "Pick a mood",
    blankValue: "",
    attrs: changeAttr(),
  }),
  wrapper: validationWrapper,
});

dialogBuilder.field("color", {
  label: "Favorite hue",
  renderer: selectField({
    options: palette.map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
    includeBlank: "Pick a color",
    blankValue: "",
    attrs: changeAttr(),
  }),
  wrapper: validationWrapper,
});

dialogBuilder.field("subscribe", {
  label: "Subscribe to updates",
  renderer: checkboxField({
    value: "true",
    attrs: changeAttr(),
  }),
  wrapper: validationWrapper,
});

const dialog = dialogBuilder.mode("inline").build();

const initialData: Partial<z.infer<typeof formSchema>> = {
  name: "Ada",
  email: "ada@continuux.dev",
  age: 29,
  mood: "curious",
  color: "emerald",
  subscribe: true,
};

const orderedFieldOrder = fieldOrder as unknown as readonly DialogFieldName<
  typeof formSchema
>[];

const renderDefaults: DialogRenderOptions<typeof formSchema> = {
  dialogId,
  formId,
  fieldOrder: orderedFieldOrder,
  headerTitle: "Live Validation Dialog",
  headerDescription:
    "Type into each field and watch how SSE streams validation feedback.",
  fieldNamePrefix: "",
  data: initialData,
  formAttrs: cx.html.submit("submitForm"),
};

const dialogMarkup = dialog.render(renderDefaults);

const pageHtml = (): string => {
  const boot = cx.html.bootModuleScriptTag({
    attrs: { id: "cxBoot" },
    diagnostics: false,
    debug: false,
    autoConnect: true,
  });

  return H.render(
    H.doctype(),
    H.html(
      H.head(
        H.meta({ charset: "utf-8" }),
        H.meta({
          name: "viewport",
          content: "width=device-width, initial-scale=1",
        }),
        H.title("ContinuUX Hello Dialog"),
        H.link({
          rel: "stylesheet",
          href: "https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css",
        }),
        H.style(
          `
:root {
  font-size: 85%;
}
  
.dialog-summary {
  margin-top: 0.5rem;
  padding: 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.95rem;
}
.dialog-summary[data-status="success"] {
  border: 1px solid #1a7f37;
  background-color: #ecfdf3;
  color: #0f5132;
}
.dialog-summary[data-status="error"] {
  border: 1px solid #b91c1c;
  background-color: #fee2e2;
  color: #861b1b;
}
.dialog-summary[data-status="pending"] {
  border: 1px solid #5f5f5f;
  background-color: #f8fafc;
  color: #475569;
}
.dialog-diagnostics {
  margin-top: 1rem;
  padding: 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid #cbd5f5;
  background-color: #f9fafc;
}
.dialog-diagnostics h3 {
  margin-top: 0;
  margin-bottom: 0.5rem;
  font-size: 1rem;
}
.dialog-diagnostics ul {
  margin: 0;
  padding-left: 1rem;
}
`,
        ),
      ),
      H.body(
        { class: "container", style: "max-width:720px; padding-top:2rem;" },
        H.header(
          H.h1("Hello Dialog"),
          H.p(
            "A moderately complex Natural Dialog form that validates live via SSE.",
          ),
        ),
        H.main(
          H.section(
            { style: "margin-bottom:1rem;" },
            H.h2("Live validation"),
            H.p(
              "Move through each field (change event fires on blur) and watch the ",
              "server stream inline feedback before you even submit.",
            ),
          ),
          dialogMarkup,
          H.section(
            {
              class: "dialog-summary",
              id: summaryId,
              "data-status": "pending",
              style: "margin-top:1rem;",
            },
            "Connected to SSE. Start changing values to validate.",
          ),
          H.section(
            { class: "dialog-diagnostics", id: diagId },
            H.h3("SSE diagnostics"),
            H.p(
              "Watch how ContinuUX SSE updates carry validation and submission events.",
            ),
            sseInspectorTag(),
          ),
        ),
        boot,
        H.script(
          { type: "module" },
          H.trustedRaw(sseDiagnostics.inspectorScript()),
        ),
        H.script(
          { type: "module" },
          H.trustedRaw(`window.__page_ready = "ok";`),
        ),
      ),
    ),
  );
};

const app = Application.sharedState<State, Vars>(appState);

app.use(sseDiagnostics.middleware<State, Vars>());
app.use(interactivityMiddleware);

app.get("/", () => htmlResponse(pageHtml()));

app.serve({ port: 7744 });
