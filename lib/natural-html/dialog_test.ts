// lib/natural-html/dialog_test.ts
import { assertEquals } from "@std/assert";
import * as h from "./elements.ts";
import { z } from "@zod";
import {
  checkboxField,
  createDialog,
  DialogClassNames,
  DialogFieldRenderCtx,
  inputField,
} from "./dialog.ts";

const TEST_CLASSES: Required<DialogClassNames> = {
  root: "root",
  surface: "surface",
  header: "header",
  title: "title",
  description: "description",
  form: "form",
  body: "body",
  field: "field",
  fieldLabel: "field-label",
  fieldDescription: "field-description",
  fieldError: "field-error",
  fieldInput: "field-input",
  actions: "actions",
  footer: "footer",
  actionPrimary: "action-primary",
  actionSecondary: "action-secondary",
};

Deno.test("inputField helper renders a text input", () => {
  const schema = z.object({ name: z.string() });
  const ctx: DialogFieldRenderCtx<typeof schema, "name"> = {
    html: h,
    schema,
    fieldName: "name",
    fieldSchema: schema.shape.name,
    value: "Alice",
    errors: [] as readonly z.core.$ZodIssue[],
    hasError: false,
    autoFocus: true,
    inputId: "form-name",
    nameAttr: "name",
    errorId: "form-name-error",
    formId: "form",
    classes: TEST_CLASSES,
    label: "Name",
    description: "Full name",
  };

  const rendered = h.renderPretty(inputField({ placeholder: "Full name" })(ctx))
    .trim();

  assertEquals(
    rendered,
    `<input autofocus class="field-input" id="form-name" name="name" placeholder="Full name" type="text" value="Alice">`,
  );
});

Deno.test("dialog renders form, body, and actions as expected", () => {
  const schema = z.object({
    name: z.string(),
    subscribe: z.boolean().optional(),
  });
  const dialog = createDialog("signup", schema)
    .field("name", {
      label: "Full name",
      renderer: inputField({ placeholder: "First and last" }),
    })
    .field("subscribe", {
      label: "Subscribe",
      description: "Get updates",
      renderer: checkboxField({ value: "yes" }),
    })
    .build();

  const html = h.renderPretty(
    dialog.render({
      headerTitle: "Join",
      headerDescription: "Create an account",
      autoFocusField: "name",
      data: { name: "Sam", subscribe: true },
      hiddenFields: { source: "newsletter" },
      cancel: { label: "No thanks" },
      submit: { label: "Sign up" },
      fieldOrder: ["name", "subscribe"],
    }),
  ).trim();

  assertEquals(
    html,
    `<dialog aria-describedby="signup-dialog-description" aria-labelledby="signup-dialog-title" class="natural-dialog" id="signup-dialog" open role="dialog">
  <div class="natural-dialog__surface">
    <header class="natural-dialog__header">
      <h2 class="natural-dialog__title" id="signup-dialog-title">Join</h2>
      <p class="natural-dialog__description" id="signup-dialog-description">Create an account</p>
    </header>
    <form action="" class="natural-dialog__form" id="signup-dialog-form" method="dialog"><input name="source" type="hidden" value="newsletter">
      <div class="natural-dialog__body">
        <div class="natural-dialog__field" data-field="name"><label class="natural-dialog__label" for="signup-dialog-form-name">Full name</label><input autofocus class="natural-dialog__control" id="signup-dialog-form-name" name="name" placeholder="First and last" type="text" value="Sam"></div>
        <div class="natural-dialog__field" data-field="subscribe"><label class="natural-dialog__label" for="signup-dialog-form-subscribe">Subscribe</label><input checked class="natural-dialog__control" id="signup-dialog-form-subscribe" name="subscribe" type="checkbox" value="yes">
          <p class="natural-dialog__field-description">Get updates</p>
        </div>
      </div>
      <div class="natural-dialog__footer">
        <div class="natural-dialog__actions"><button class="natural-dialog__action natural-dialog__action--secondary" type="button">No thanks</button><button class="natural-dialog__action natural-dialog__action--primary" type="submit">Sign up</button></div>
      </div>
    </form>
  </div>
</dialog>`,
  );
});

Deno.test("dialog inline mode renders inline wrapper", () => {
  const schema = z.object({
    name: z.string(),
    subscribe: z.boolean().optional(),
  });
  const dialog = createDialog("signup", schema)
    .mode("inline")
    .field("name", {
      label: "Full name",
      renderer: inputField({ placeholder: "First and last" }),
    })
    .field("subscribe", {
      label: "Subscribe",
      description: "Get updates",
      renderer: checkboxField({ value: "yes" }),
    })
    .build();

  const html = h.renderPretty(
    dialog.render({
      headerTitle: "Join",
      headerDescription: "Create an account",
      autoFocusField: "name",
      data: { name: "Sam", subscribe: true },
      hiddenFields: { source: "newsletter" },
      cancel: { label: "No thanks" },
      submit: { label: "Sign up" },
      fieldOrder: ["name", "subscribe"],
    }),
  ).trim();

  assertEquals(
    html,
    `<div aria-describedby="signup-dialog-description" aria-labelledby="signup-dialog-title" class="natural-dialog" id="signup-dialog" role="region">
  <div class="natural-dialog__surface">
    <header class="natural-dialog__header">
      <h2 class="natural-dialog__title" id="signup-dialog-title">Join</h2>
      <p class="natural-dialog__description" id="signup-dialog-description">Create an account</p>
    </header>
    <form action="" class="natural-dialog__form" id="signup-dialog-form" method="dialog"><input name="source" type="hidden" value="newsletter">
      <div class="natural-dialog__body">
        <div class="natural-dialog__field" data-field="name"><label class="natural-dialog__label" for="signup-dialog-form-name">Full name</label><input autofocus class="natural-dialog__control" id="signup-dialog-form-name" name="name" placeholder="First and last" type="text" value="Sam"></div>
        <div class="natural-dialog__field" data-field="subscribe"><label class="natural-dialog__label" for="signup-dialog-form-subscribe">Subscribe</label><input checked class="natural-dialog__control" id="signup-dialog-form-subscribe" name="subscribe" type="checkbox" value="yes">
          <p class="natural-dialog__field-description">Get updates</p>
        </div>
      </div>
      <div class="natural-dialog__footer">
        <div class="natural-dialog__actions"><button class="natural-dialog__action natural-dialog__action--secondary" type="button">No thanks</button><button class="natural-dialog__action natural-dialog__action--primary" type="submit">Sign up</button></div>
      </div>
    </form>
  </div>
</div>`,
  );
});
