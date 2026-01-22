/**
 * @module lib/natural-html/dialog.ts
 *
 * Natural HTML Dialog is a small forms infrastructure that leans on Zod schemas for
 * compile-time safety and the browser's native form/dialog primitives for runtime
 * ergonomics. It wraps `<dialog>`/`<form>` combinations in a fluent builder so teams
 * can declare fields that mirror their schema contracts, attach helpers for styling
 * and scripting, and emit the companion head tags that design systems expect.
 */
import * as h from "./elements.ts";
import type {
  Attrs,
  Child,
  ClassSpec,
  RawHtml,
  UaDependency,
} from "./elements.ts";
import { z } from "@zod";

/**
 * Narrow the Zod object shape we can work with.
 */
export type DialogZodObject = z.ZodObject<z.ZodRawShape>;

type DialogSchemaShape<Schema extends DialogZodObject> = Schema["_def"] extends
  {
    shape: infer Shape;
  } ? Shape extends z.ZodRawShape ? Shape
  : never
  : never;

export type DialogFieldName<Schema extends DialogZodObject> =
  & keyof DialogSchemaShape<Schema>
  & string;

type DialogZodIssue = z.core.$ZodIssue;

export interface DialogClassNames {
  readonly root?: string;
  readonly surface?: string;
  readonly header?: string;
  readonly title?: string;
  readonly description?: string;
  readonly form?: string;
  readonly body?: string;
  readonly field?: string;
  readonly fieldLabel?: string;
  readonly fieldDescription?: string;
  readonly fieldError?: string;
  readonly fieldInput?: string;
  readonly actions?: string;
  readonly footer?: string;
  readonly actionPrimary?: string;
  readonly actionSecondary?: string;
}

const DEFAULT_CLASS_NAMES: Required<DialogClassNames> = {
  root: "natural-dialog",
  surface: "natural-dialog__surface",
  header: "natural-dialog__header",
  title: "natural-dialog__title",
  description: "natural-dialog__description",
  form: "natural-dialog__form",
  body: "natural-dialog__body",
  field: "natural-dialog__field",
  fieldLabel: "natural-dialog__label",
  fieldDescription: "natural-dialog__field-description",
  fieldError: "natural-dialog__error",
  fieldInput: "natural-dialog__control",
  actions: "natural-dialog__actions",
  footer: "natural-dialog__footer",
  actionPrimary: "natural-dialog__action natural-dialog__action--primary",
  actionSecondary: "natural-dialog__action natural-dialog__action--secondary",
};

const DEFAULT_DIALOG_CSS = `
.natural-dialog {
  border: none;
  background: transparent;
  padding: 0;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.natural-dialog__surface {
  background-color: #fff;
  border-radius: 1rem;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.25);
  width: min(510px, 100%);
  margin: 1rem;
  overflow: hidden;
}

.natural-dialog__form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem 1.25rem 1.5rem;
}

.natural-dialog__header {
  padding: 1.25rem 1.5rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.natural-dialog__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.natural-dialog__description {
  margin: 0;
  color: #5a6b7c;
  font-size: 0.95rem;
}

.natural-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.natural-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.natural-dialog__label {
  font-size: 0.9rem;
  font-weight: 600;
}

.natural-dialog__control {
  border: 1px solid #cbd5f5;
  border-radius: 0.5rem;
  padding: 0.75rem 0.85rem;
  font-size: 1rem;
  background: #fff;
  color: #0f172a;
}

.natural-dialog__control:focus {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}

.natural-dialog__field-description {
  margin: 0;
  font-size: 0.85rem;
  color: #475569;
}

.natural-dialog__error {
  margin: 0;
  font-size: 0.82rem;
  color: #dc2626;
}

.natural-dialog__actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.natural-dialog__footer {
  width: 100%;
}

.natural-dialog__action {
  border-radius: 0.65rem;
  border: none;
  padding: 0.65rem 1.35rem;
  font-size: 0.95rem;
  cursor: pointer;
  transition: transform 0.15s ease;
}

.natural-dialog__action--primary {
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  color: white;
}

.natural-dialog__action--secondary {
  background: #f3f4f6;
  color: #111827;
}

.natural-dialog__action:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}
`;

export interface DialogFieldRenderCtx<
  Schema extends DialogZodObject,
  Name extends DialogFieldName<Schema>,
> {
  readonly html: typeof h;
  readonly schema: Schema;
  readonly fieldName: Name;
  readonly fieldSchema: DialogSchemaShape<Schema>[Name];
  readonly value: z.infer<Schema>[Name];
  readonly errors: readonly DialogZodIssue[];
  readonly hasError: boolean;
  readonly autoFocus: boolean;
  readonly inputId: string;
  readonly nameAttr: string;
  readonly errorId: string;
  readonly formId: string;
  readonly classes: Required<DialogClassNames>;
  readonly label?: Child;
  readonly description?: Child;
}

export type DialogFieldRenderer<
  Schema extends DialogZodObject,
  Name extends DialogFieldName<Schema>,
> = (ctx: DialogFieldRenderCtx<Schema, Name>) => RawHtml;

export interface DialogFieldSpec<
  Schema extends DialogZodObject,
  Name extends DialogFieldName<Schema>,
> {
  readonly label?: Child;
  readonly description?: Child;
  readonly renderer: DialogFieldRenderer<Schema, Name>;
  readonly wrapper?: (
    fieldHtml: RawHtml,
    ctx: DialogFieldRenderCtx<Schema, Name>,
  ) => RawHtml;
}

export interface DialogRenderOptions<Schema extends DialogZodObject> {
  readonly dialogAttrs?: Attrs;
  readonly formAttrs?: Attrs;
  readonly action?: string;
  readonly method?: string;
  readonly data?: Partial<z.infer<Schema>>;
  readonly errors?: readonly DialogZodIssue[];
  readonly mode?: DialogRenderMode;
  readonly fieldOrder?: readonly DialogFieldName<Schema>[];
  readonly headerTitle?: Child;
  readonly headerDescription?: Child;
  readonly submit?: {
    readonly label?: Child;
    readonly attrs?: Attrs;
  };
  readonly cancel?: {
    readonly label?: Child;
    readonly attrs?: Attrs;
    readonly href?: string;
  };
  readonly footer?: Child;
  readonly open?: boolean;
  readonly autoFocusField?: DialogFieldName<Schema>;
  readonly fieldNamePrefix?: string;
  readonly dialogId?: string;
  readonly formId?: string;
  readonly hiddenFields?: Record<
    string,
    string | number | boolean | null | undefined
  >;
  readonly classes?: DialogClassNames;
}

export interface Dialog<Schema extends DialogZodObject> {
  readonly name: string;
  readonly schema: Schema;
  readonly fieldNames: readonly DialogFieldName<Schema>[];
  readonly render: (options?: DialogRenderOptions<Schema>) => RawHtml;
  readonly headTags: () => RawHtml;
  readonly styles: () => readonly RawHtml[];
  readonly scripts: () => readonly RawHtml[];
  readonly uaDependencies: () => readonly UaDependency[];
  readonly getField: <Name extends DialogFieldName<Schema>>(
    name: Name,
  ) => DialogFieldSpec<Schema, Name> | undefined;
}

export interface DialogBuilder<Schema extends DialogZodObject> {
  field<Name extends DialogFieldName<Schema>>(
    name: Name,
    spec: DialogFieldSpec<Schema, Name>,
  ): DialogBuilder<Schema>;
  fields(
    specs: Partial<
      {
        readonly [K in DialogFieldName<Schema>]: DialogFieldSpec<Schema, K>;
      }
    >,
  ): DialogBuilder<Schema>;
  mode(mode: DialogRenderMode): DialogBuilder<Schema>;
  style(cssText: string, attrs?: Attrs): DialogBuilder<Schema>;
  rawStyle(style: RawHtml): DialogBuilder<Schema>;
  script(js: string, attrs?: Attrs): DialogBuilder<Schema>;
  rawScript(script: RawHtml): DialogBuilder<Schema>;
  uaDependency(dep: UaDependency): DialogBuilder<Schema>;
  classes(classes: DialogClassNames): DialogBuilder<Schema>;
  build(): Dialog<Schema>;
}

export type DialogRenderMode = "modal" | "inline";

export interface DialogSelectOption {
  readonly value: string;
  readonly label: Child;
  readonly attrs?: Attrs;
}

export interface DialogSelectFieldOptions {
  readonly options: readonly DialogSelectOption[];
  readonly includeBlank?: Child;
  readonly blankValue?: string;
  readonly attrs?: Attrs;
}

export function inputField<
  Schema extends DialogZodObject,
  Name extends DialogFieldName<Schema>,
>(
  options?: {
    readonly type?: string;
    readonly placeholder?: string;
    readonly attrs?: Attrs;
  },
): DialogFieldRenderer<Schema, Name> {
  return (ctx) => {
    const attr = h.attrs(
      {
        id: ctx.inputId,
        name: ctx.nameAttr,
        type: options?.type ?? guessInputType(ctx.fieldSchema),
        value: normalizeScalarValue(ctx.value),
        class: ctx.classes.fieldInput,
        placeholder: options?.placeholder,
        ...(ctx.autoFocus ? { autofocus: true } : null),
        ...(ctx.hasError
          ? { "aria-invalid": "true", "aria-describedby": ctx.errorId }
          : null),
      },
      options?.attrs,
    );
    return h.input(attr);
  };
}

export function textareaField<
  Schema extends DialogZodObject,
  Name extends DialogFieldName<Schema>,
>(
  options?: {
    readonly rows?: number;
    readonly placeholder?: string;
    readonly attrs?: Attrs;
  },
): DialogFieldRenderer<Schema, Name> {
  return (ctx) => {
    const attr = h.attrs(
      {
        id: ctx.inputId,
        name: ctx.nameAttr,
        rows: options?.rows ?? 4,
        class: ctx.classes.fieldInput,
        placeholder: options?.placeholder,
        ...(ctx.autoFocus ? { autofocus: true } : null),
        ...(ctx.hasError
          ? { "aria-invalid": "true", "aria-describedby": ctx.errorId }
          : null),
      },
      options?.attrs,
    );
    return h.textarea(attr, normalizeScalarValue(ctx.value));
  };
}

export function checkboxField<
  Schema extends DialogZodObject,
  Name extends DialogFieldName<Schema>,
>(
  options?: {
    readonly value?: string;
    readonly attrs?: Attrs;
  },
): DialogFieldRenderer<Schema, Name> {
  return (ctx) => {
    const attr = h.attrs(
      {
        id: ctx.inputId,
        name: ctx.nameAttr,
        type: "checkbox",
        value: options?.value ?? "true",
        class: ctx.classes.fieldInput,
        ...(ctx.value ? { checked: true } : null),
        ...(ctx.autoFocus ? { autofocus: true } : null),
        ...(ctx.hasError
          ? { "aria-invalid": "true", "aria-describedby": ctx.errorId }
          : null),
      },
      options?.attrs,
    );
    return h.input(attr);
  };
}

export function selectField<
  Schema extends DialogZodObject,
  Name extends DialogFieldName<Schema>,
>(
  options: DialogSelectFieldOptions,
): DialogFieldRenderer<Schema, Name> {
  return (ctx) => {
    const attr = h.attrs(
      {
        id: ctx.inputId,
        name: ctx.nameAttr,
        class: ctx.classes.fieldInput,
        ...(ctx.autoFocus ? { autofocus: true } : null),
        ...(ctx.hasError
          ? { "aria-invalid": "true", "aria-describedby": ctx.errorId }
          : null),
      },
      options.attrs,
    );

    const normalized = normalizeScalarValue(ctx.value);
    const blankOption = options.includeBlank
      ? h.option({ value: options.blankValue ?? "" }, options.includeBlank)
      : null;

    const optionNodes = options.options.map((item) =>
      h.option(
        h.attrs(
          {
            value: item.value,
            ...(item.value === normalized ? { selected: true } : null),
          },
          item.attrs,
        ),
        item.label,
      )
    );

    return h.select(attr, blankOption, ...optionNodes);
  };
}

function normalizeScalarValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  return JSON.stringify(value);
}

function collectFieldIssues<Name extends string>(
  issues: readonly DialogZodIssue[],
  fieldName: Name,
): readonly DialogZodIssue[] {
  return issues.filter((issue) => issue.path[0] === fieldName);
}

function unwrapSchema(schema: z.ZodTypeAny): z.ZodTypeAny {
  const def = schema._def as {
    typeName?: string;
    innerType?: z.ZodTypeAny;
    schema?: z.ZodTypeAny;
  };
  if (
    def.typeName === "ZodOptional" ||
    def.typeName === "ZodNullable" ||
    def.typeName === "ZodDefault"
  ) {
    return def.innerType ? unwrapSchema(def.innerType) : schema;
  }
  if (def.typeName === "ZodEffects" && def.schema) {
    return unwrapSchema(def.schema);
  }
  return schema;
}

function guessInputType(schema: z.ZodTypeAny): string {
  const unwrapped = unwrapSchema(schema);
  const typeName = (unwrapped._def as { typeName?: string }).typeName;
  switch (typeName) {
    case "ZodNumber":
      return "number";
    case "ZodBoolean":
      return "checkbox";
    case "ZodDate":
      return "date";
    case "ZodLiteral": {
      const literalDef = unwrapped._def as {
        values?: readonly unknown[];
        value?: unknown;
      };
      const literalValue = literalDef.values?.[0] ?? literalDef.value;
      if (typeof literalValue === "number") return "number";
      if (typeof literalValue === "boolean") return "checkbox";
      return "text";
    }
    default:
      return "text";
  }
}

function defaultFieldWrapper<
  Schema extends DialogZodObject,
  Name extends DialogFieldName<Schema>,
>(
  fieldHtml: RawHtml,
  ctx: DialogFieldRenderCtx<Schema, Name>,
): RawHtml {
  return h.div(
    { class: ctx.classes.field, "data-field": ctx.fieldName },
    ctx.label
      ? h.label(
        { class: ctx.classes.fieldLabel, for: ctx.inputId },
        ctx.label,
      )
      : null,
    fieldHtml,
    ctx.description
      ? h.p({ class: ctx.classes.fieldDescription }, ctx.description)
      : null,
    ctx.hasError
      ? h.p(
        { class: ctx.classes.fieldError, id: ctx.errorId },
        ctx.errors[0]?.message ?? "Please resolve this field",
      )
      : null,
  );
}

function mergeAttrsWithClass(base: Attrs, overrides?: Attrs): Attrs {
  if (!overrides) return base;
  const { class: overrideClass, className: overrideClassName, ...rest } =
    overrides;
  const merged = h.attrs(base, rest);
  const existingClass: string | undefined = merged.class != null
    ? String(merged.class)
    : undefined;
  const combinedClass = h.cls(
    existingClass,
    overrideClass as ClassSpec,
    overrideClassName as ClassSpec,
  );
  if (combinedClass) merged.class = combinedClass;
  return merged;
}

function captureShape<Schema extends DialogZodObject>(
  schema: Schema,
): DialogSchemaShape<Schema> {
  const rawShape = (schema._def as { shape?: unknown }).shape;
  if (!rawShape) {
    throw new Error("dialog: schema shape is not defined");
  }
  const resolvedShape = typeof rawShape === "function" ? rawShape() : rawShape;
  return resolvedShape as DialogSchemaShape<Schema>;
}

function createDialogImpl<Schema extends DialogZodObject>(
  name: string,
  schema: Schema,
  fields: Map<
    DialogFieldName<Schema>,
    DialogFieldSpec<Schema, DialogFieldName<Schema>>
  >,
  fieldSequence: DialogFieldName<Schema>[],
  styles: RawHtml[],
  scripts: RawHtml[],
  uaDeps: UaDependency[],
  classes: Required<DialogClassNames>,
  mode: DialogRenderMode,
): Dialog<Schema> {
  const shape = captureShape(schema);

  class Impl implements Dialog<Schema> {
    readonly name = name;
    readonly schema = schema;
    readonly styles = () => [...styles];
    readonly scripts = () => [...scripts];
    readonly uaDependencies = () => [...uaDeps];
    readonly fieldNames = fieldSequence;

    getField<Name extends DialogFieldName<Schema>>(name: Name) {
      return fields.get(name) as DialogFieldSpec<Schema, Name> | undefined;
    }

    headTags() {
      return h.children((emit) => {
        for (const style of styles) emit(style);
        for (const script of scripts) emit(script);
        if (uaDeps.length > 0) emit(h.browserUserAgentHeadTags(uaDeps));
      }) as unknown as RawHtml;
    }

    render(options?: DialogRenderOptions<Schema>) {
      const opts = options ?? {};
      const dialogId = opts.dialogId ?? `${name}-dialog`;
      const formId = opts.formId ?? `${dialogId}-form`;
      const effectiveClasses: Required<DialogClassNames> = {
        ...classes,
        ...(opts.classes ?? {}),
      };

      const titleId = opts.headerTitle ? `${dialogId}-title` : undefined;
      const descriptionId = opts.headerDescription
        ? `${dialogId}-description`
        : undefined;

      const effectiveMode = opts.mode ?? mode;
      const isModal = effectiveMode === "modal";
      const baseDialogAttrs = h.attrs(
        {
          id: dialogId,
          class: effectiveClasses.root,
          role: isModal ? "dialog" : "region",
        },
        isModal && opts.open !== false ? { open: true } : null,
        titleId ? { "aria-labelledby": titleId } : null,
        descriptionId ? { "aria-describedby": descriptionId } : null,
      );

      const dialogAttrs = mergeAttrsWithClass(
        baseDialogAttrs,
        opts.dialogAttrs,
      );

      const baseFormAttrs = h.attrs(
        {
          id: formId,
          class: effectiveClasses.form,
          method: opts.method ?? "dialog",
          action: opts.action ?? "",
        },
      );
      const formAttrs = mergeAttrsWithClass(baseFormAttrs, opts.formAttrs);

      const data = (opts.data ?? {}) as Partial<z.infer<Schema>>;
      const errors = opts.errors ?? [];
      const prefix = opts.fieldNamePrefix ?? "";
      const order = (opts.fieldOrder ?? fieldSequence).filter((fieldName) =>
        fields.has(fieldName)
      );

      const fieldNodes = order.map((fieldName) => {
        const spec = fields.get(fieldName) as
          | DialogFieldSpec<Schema, typeof fieldName>
          | undefined;
        if (!spec) return null;
        const fieldSchema = shape[fieldName];
        if (!fieldSchema) return null;
        const fieldErrors = collectFieldIssues(errors, fieldName);

        const ctx: DialogFieldRenderCtx<Schema, typeof fieldName> = {
          html: h,
          schema,
          fieldName,
          fieldSchema,
          value: data[fieldName] as z.infer<Schema>[typeof fieldName],
          errors: fieldErrors,
          hasError: fieldErrors.length > 0,
          autoFocus: opts.autoFocusField === fieldName,
          inputId: `${formId}-${fieldName}`,
          errorId: `${formId}-${fieldName}-error`,
          nameAttr: `${prefix}${fieldName}`,
          formId,
          classes: effectiveClasses,
          label: spec.label,
          description: spec.description,
        };

        const inner = spec.renderer(ctx);
        const wrapper = spec.wrapper ?? defaultFieldWrapper;
        return wrapper(inner, ctx);
      }).filter((node): node is RawHtml => Boolean(node));

      const hiddenNodes: RawHtml[] = [];
      if (opts.hiddenFields) {
        for (const [key, value] of Object.entries(opts.hiddenFields)) {
          hiddenNodes.push(
            h.input({
              type: "hidden",
              name: key,
              value: normalizeScalarValue(value),
            }),
          );
        }
      }

      const defaultSubmit = opts.submit?.label ?? "Submit";
      const submitAttrs = mergeAttrsWithClass(
        { type: "submit", class: effectiveClasses.actionPrimary },
        opts.submit?.attrs,
      );
      const submitButton = h.button(submitAttrs, defaultSubmit);

      let cancelNode: RawHtml | null = null;
      if (opts.cancel) {
        const text = opts.cancel.label ?? "Cancel";
        const baseCancel = opts.cancel.href
          ? { class: effectiveClasses.actionSecondary, href: opts.cancel.href }
          : { type: "button", class: effectiveClasses.actionSecondary };
        cancelNode = opts.cancel.href
          ? h.a(mergeAttrsWithClass(baseCancel, opts.cancel.attrs), text)
          : h.button(mergeAttrsWithClass(baseCancel, opts.cancel.attrs), text);
      }

      const actions = h.div(
        { class: effectiveClasses.actions },
        cancelNode,
        submitButton,
      );

      const footerContent = opts.footer ? [opts.footer] : [actions];
      const footer = h.div(
        { class: effectiveClasses.footer },
        ...footerContent,
      );

      const headerChildren: RawHtml[] = [];
      if (opts.headerTitle) {
        headerChildren.push(
          h.h2(
            { id: titleId, class: effectiveClasses.title },
            opts.headerTitle,
          ),
        );
      }
      if (opts.headerDescription) {
        headerChildren.push(
          h.p(
            { id: descriptionId, class: effectiveClasses.description },
            opts.headerDescription,
          ),
        );
      }

      const header = headerChildren.length > 0
        ? h.header({ class: effectiveClasses.header }, ...headerChildren)
        : null;

      const bodyContent = h.div(
        { class: effectiveClasses.body },
        ...fieldNodes,
      );

      const wrapper = isModal ? h.dialog : h.div;
      return wrapper(
        dialogAttrs,
        h.div(
          { class: effectiveClasses.surface },
          header,
          h.form(formAttrs, ...hiddenNodes, bodyContent, footer),
        ),
      );
    }
  }

  return new Impl();
}

export function createDialog<Schema extends DialogZodObject>(
  name: string,
  schema: Schema,
): DialogBuilder<Schema> {
  const fields = new Map<
    DialogFieldName<Schema>,
    DialogFieldSpec<Schema, DialogFieldName<Schema>>
  >();
  const sequence: DialogFieldName<Schema>[] = [];
  const styles: RawHtml[] = [h.styleCss(DEFAULT_DIALOG_CSS)];
  const scripts: RawHtml[] = [];
  const uaDeps: UaDependency[] = [];
  const classOverrides: DialogClassNames = {};
  const registerField = <Name extends DialogFieldName<Schema>>(
    fieldName: Name,
    spec: DialogFieldSpec<Schema, Name>,
  ) => {
    if (!fields.has(fieldName)) sequence.push(fieldName);
    fields.set(
      fieldName,
      spec as DialogFieldSpec<Schema, DialogFieldName<Schema>>,
    );
  };

  let renderMode: DialogRenderMode = "modal";

  const builder: DialogBuilder<Schema> = {
    field<Name extends DialogFieldName<Schema>>(
      fieldName: Name,
      spec: DialogFieldSpec<Schema, Name>,
    ) {
      registerField(fieldName, spec);
      return builder;
    },
    fields(specs) {
      const keys = Object.keys(specs) as DialogFieldName<Schema>[];
      for (const key of keys) {
        const spec = specs[key];
        if (!spec) continue;
        registerField(key, spec);
      }
      return builder;
    },
    style(cssText, attrs) {
      styles.push(h.styleCss(cssText, attrs));
      return builder;
    },
    rawStyle(style) {
      styles.push(style);
      return builder;
    },
    script(js, attrs) {
      scripts.push(h.scriptJs(js, attrs));
      return builder;
    },
    rawScript(input) {
      scripts.push(input);
      return builder;
    },
    uaDependency(dep) {
      uaDeps.push(dep);
      return builder;
    },
    classes(values) {
      Object.assign(classOverrides, values);
      return builder;
    },
    mode(value: DialogRenderMode) {
      renderMode = value;
      return builder;
    },
    build() {
      const builtClasses: Required<DialogClassNames> = {
        ...DEFAULT_CLASS_NAMES,
        ...classOverrides,
      };
      return createDialogImpl(
        name,
        schema,
        new Map(fields),
        [...sequence],
        [...styles],
        [...scripts],
        [...uaDeps],
        builtClasses,
        renderMode,
      );
    },
  };

  return builder;
}
