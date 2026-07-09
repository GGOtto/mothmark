# Universal Editor Control Build Plan

This document defines the full set of controls needed for the Universal Editor, what each control is responsible for, where it fits in the build order, and what metadata/features each one should support.

The goal is to make the editor schema-driven without turning every field into a custom hand-built component. Each control should follow the same core model:

```ts
context.appearance = inherited editor/default appearance
metadata.appearance = per-control visual override
metadata.features = control-specific behavior/options
```

## Core Naming Model

The editor should keep visual styling separate from behavior.

```ts
type EditorControlAppearance = {
  theme?: EditorControlTheme;
  scheme?: EditorControlScheme;
  tone?: EditorControlTone;
  chrome?: EditorControlChrome;
  size?: EditorControlSize;
};
```

Use this rule everywhere:

```txt
default appearance < context.appearance < metadata.appearance
```

### Context vs Metadata

`context` describes where the control is being rendered and what services it can use.

Use context for:

- inherited appearance
- editor mode: create, edit, preview
- reading and writing values by path
- validation hooks
- registries such as entity and flag lookup

`metadata` describes the specific control being rendered.

Use metadata for:

- control type
- title and description
- placeholder
- required/disabled/readonly/hidden state
- per-control appearance overrides
- per-control features and behavior

## Final Control Type Enum

Eventually, the editor should support this full enum:

```ts
export type EditorControlType =
  | "input"
  | "textarea"
  | "message"
  | "number"
  | "toggle"
  | "select"
  | "multi-select"
  | "tag-list"
  | "string-list"
  | "object"
  | "array"
  | "discriminated-union"
  | "condition-builder"
  | "effect-list"
  | "entity-picker"
  | "flag-picker"
  | "code-preview"
  | "hidden";
```

## Recommended Build Order

Build in this order:

1. `input`
2. `textarea`
3. `number`
4. `toggle`
5. `select`
6. `multi-select`
7. `message`
8. `tag-list`
9. `string-list`
10. `object`
11. `array`
12. `discriminated-union`
13. `entity-picker`
14. `flag-picker`
15. `condition-builder`
16. `effect-list`
17. `code-preview`
18. `hidden`

This order starts with primitive controls, then moves into collections, then schema-aware controls, then registry-aware controls, and finally utility controls.

---

# Priority 1: Core Primitive Controls

These are the controls that most schemas need immediately. They should establish the shared component patterns for `FieldShell`, appearance, features, validation display, disabled/readonly behavior, and matrix testing.

## 1. `input`

### Purpose

Short string editing.

Use for:

- IDs
- names
- keys
- labels
- aliases
- short commands
- single-line values

### Value Type

```ts
string;
```

### Metadata

```ts
type TextFieldControlMetadata = EditorControlMetadata & {
  type: "input";

  minLength?: number;
  maxLength?: number;
  pattern?: string;

  inputMode?: "text" | "search" | "email" | "url" | "tel" | "numeric" | "decimal";

  autoComplete?: string;

  transform?: "none" | "slug" | "id" | "lowercase" | "uppercase";

  features?: {
    copyButton?: boolean;
    clearButton?: boolean;
    prefix?: string;
    suffix?: string;
    selectOnFocus?: boolean;
  };
};
```

### Notes

This is already started and should become the reference implementation for other controls.

It should support:

- `FieldShell`
- `appearance`
- error/warning output
- disabled and readonly state
- feature-driven buttons
- matrix test data

---

## 2. `textarea`

### Purpose

Long string editing.

Use for:

- room descriptions
- narration
- longer messages
- notes
- command failure messages
- prose-heavy fields

### Value Type

```ts
string;
```

### Metadata

```ts
type TextareaControlMetadata = EditorControlMetadata & {
  type: "textarea";

  minLength?: number;
  maxLength?: number;
  placeholder?: string;

  transform?: "none" | "trim";

  features?: {
    copyButton?: boolean;
    clearButton?: boolean;
    resize?: "none" | "vertical";
    minRows?: number;
    maxRows?: number;
    monospace?: boolean;
    autoGrow?: boolean;
    selectOnFocus?: boolean;
  };
};
```

### Notes

This should be built next because it can reuse most of the `input` structure.

---

## 3. `number`

### Purpose

Numeric editing.

Use for:

- coordinates
- weights
- counts
- limits
- cooldowns
- probabilities
- distances
- indexes

### Value Type

```ts
number;
```

### Metadata

```ts
type NumberControlMetadata = EditorControlMetadata & {
  type: "number";

  min?: number;
  max?: number;
  step?: number;

  features?: {
    unit?: string;
    prefix?: string;
    suffix?: string;
    slider?: boolean;
    clearButton?: boolean;
    clampOnBlur?: boolean;
  };
};
```

### Notes

The number control should decide how to handle empty input carefully. Internally, the input may briefly hold an empty string, but the committed value should remain a number unless the schema supports `undefined` or `null`.

---

## 4. `toggle`

### Purpose

Boolean editing.

Use for:

- enabled/disabled
- visible/hidden
- required/not required
- starts active
- unlocked/locked
- one-way/two-way flags if represented as booleans

### Value Type

```ts
boolean;
```

### Metadata

```ts
type ToggleControlMetadata = EditorControlMetadata & {
  type: "toggle";

  features?: {
    labels?: {
      on: string;
      off: string;
    };
    display?: "switch" | "checkbox" | "button";
  };
};
```

### Notes

This should still use `FieldShell`, especially for title/description/error/warning consistency.

---

## 5. `select`

### Purpose

Single choice from a known list.

Use for:

- direction
- pathway type
- command type
- effect type
- condition operator
- enum values

### Value Type

```ts
string;
```

### Metadata

```ts
type SelectControlMetadata = EditorControlMetadata & {
  type: "select";

  features: {
    options: Array<{
      label: string;
      value: string;
      description?: string;
      disabled?: boolean;
    }>;
    placeholder?: string;
    searchable?: boolean;
  };
};
```

### Notes

Start with native `select` behavior first. A custom popover can come later if needed.

---

## 6. `multi-select`

### Purpose

Multiple choices from a known list.

Use for:

- categories
- allowed commands
- required tags
- supported directions
- feature groups

### Value Type

```ts
string[]
```

### Metadata

```ts
type MultiSelectControlMetadata = EditorControlMetadata & {
  type: "multi-select";

  features: {
    options: Array<{
      label: string;
      value: string;
      description?: string;
      disabled?: boolean;
    }>;
    maxSelected?: number;
    searchable?: boolean;
    clearButton?: boolean;
  };
};
```

### Notes

This can initially render as a checklist or compact pill selector.

---

## 7. `message`

### Purpose

Read-only informational output.

Use for:

- helper text
- empty states
- warning panels
- validation summaries
- schema explanations
- preview messages

### Value Type

```ts
string;
```

or, for richer messages later:

```ts
{
  title?: string;
  body: string;
}
```

### Metadata

```ts
type MessageControlMetadata = EditorControlMetadata & {
  type: "message";

  features?: {
    variant?: "info" | "warning" | "error" | "success" | "empty";
    collapsible?: boolean;
    defaultCollapsed?: boolean;
  };
};
```

### Notes

This control does not need `onChange` in practice, but should still fit the universal control props shape.

---

# Priority 2: Collection Controls

These are needed once the editor starts handling arrays and nested values.

## 8. `tag-list`

### Purpose

Compact string array editing.

Use for:

- aliases
- tags
- keywords
- labels
- command synonyms

### Value Type

```ts
string[]
```

### Metadata

```ts
type TagListControlMetadata = EditorControlMetadata & {
  type: "tag-list";

  features?: {
    allowDuplicates?: boolean;
    suggestions?: string[];
    transform?: "none" | "slug" | "id" | "lowercase" | "uppercase";
    addOnBlur?: boolean;
    addOnComma?: boolean;
    maxItems?: number;
  };
};
```

### Notes

`tag-list` should feel compact and fast. It is best for short values, not long text entries.

---

## 9. `string-list`

### Purpose

Editable array of longer string rows.

Use for:

- command examples
- alternate messages
- notes
- text variants where each row is a full sentence

### Value Type

```ts
string[]
```

### Metadata

```ts
type StringListControlMetadata = EditorControlMetadata & {
  type: "string-list";

  features?: {
    addLabel?: string;
    itemPlaceholder?: string;
    reorderable?: boolean;
    duplicateable?: boolean;
    minItems?: number;
    maxItems?: number;
  };
};
```

### Notes

This differs from `tag-list` because each item should feel like a row editor, not a pill.

---

## 10. `object`

### Purpose

Nested object editing.

Use for:

- description objects
- nested config groups
- structured field sections
- schema branches that are always present

### Value Type

```ts
Record<string, unknown>;
```

### Metadata

```ts
type ObjectControlMetadata = EditorControlMetadata & {
  type: "object";

  features?: {
    collapsible?: boolean;
    defaultCollapsed?: boolean;
    showFieldCount?: boolean;
    layout?: "stack" | "grid" | "section";
  };
};
```

### Notes

The object control should not know about room/world schemas directly. It should render child controls from metadata/schema traversal.

---

## 11. `array`

### Purpose

Repeatable structured item editing.

Use for:

- rooms
- connections
- room features
- effects
- condition lists
- command aliases
- description variants

### Value Type

```ts
unknown[]
```

### Metadata

```ts
type ArrayControlMetadata = EditorControlMetadata & {
  type: "array";

  features?: {
    addLabel?: string;
    reorderable?: boolean;
    duplicateable?: boolean;
    removable?: boolean;
    collapsibleItems?: boolean;
    defaultCollapsedItems?: boolean;
    minItems?: number;
    maxItems?: number;
    getItemTitle?: string;
  };
};
```

### Notes

This will become one of the most important controls. It should provide consistent add, remove, duplicate, reorder, collapse, and item-title behavior.

---

# Priority 3: Schema-Specific Structured Controls

These controls know about common schema patterns, but they should still avoid direct coupling to a specific world file.

## 12. `discriminated-union`

### Purpose

Editing objects where one field controls the rest of the shape.

Use for:

- effect objects
- condition objects
- command action objects
- any object with a `type` discriminator

### Value Type

```ts
Record<string, unknown>;
```

### Metadata

```ts
type DiscriminatedUnionControlMetadata = EditorControlMetadata & {
  type: "discriminated-union";

  features: {
    discriminator: string;
    options: Array<{
      label: string;
      value: string;
      description?: string;
      defaultValue?: Record<string, unknown>;
    }>;
  };
};
```

### Notes

This control should render the discriminator selector first, then render the fields for the active branch.

---

## 13. `entity-picker`

### Purpose

Pick an entity from a registry.

Use for:

- rooms
- items
- NPCs
- commands
- features
- other known world entities

### Value Type

```ts
string;
```

Usually this stores the selected entity ID.

### Metadata

```ts
type EntityPickerControlMetadata = EditorControlMetadata & {
  type: "entity-picker";

  features: {
    entityType: "room" | "item" | "npc" | "command" | "feature";
    allowCreate?: boolean;
    showPreview?: boolean;
    clearButton?: boolean;
  };
};
```

### Context Dependency

Uses:

```ts
context.registerEntityPicker;
```

### Notes

This should come after primitive controls and basic schema rendering are stable because it depends on editor-wide registries.

---

## 14. `flag-picker`

### Purpose

Pick a known flag from a flag registry.

Use for:

- conditions
- effects
- visibility rules
- unlock rules
- requirement checks

### Value Type

```ts
string;
```

Usually this stores the selected flag ID.

### Metadata

```ts
type FlagPickerControlMetadata = EditorControlMetadata & {
  type: "flag-picker";

  features?: {
    allowCreate?: boolean;
    showUsageCount?: boolean;
    clearButton?: boolean;
    filter?: "all" | "boolean" | "number" | "string";
  };
};
```

### Context Dependency

Uses:

```ts
context.registerFlagPicker;
```

### Notes

Flag creation should be designed carefully so authors do not accidentally create near-duplicate flags with tiny spelling differences.

---

## 15. `condition-builder`

### Purpose

Visual editing for nested conditions.

This is needed for author-defined commands, room visibility, unlock rules, conditional text, and effect requirements.

### Value Type

```ts
type Condition = SingleCondition | ConditionExpression | ConditionGroup;
```

### Example Value

```ts
{
  type: "group",
  operator: "and",
  conditions: [
    {type: "flag", flag: "hasKey", value: true},
    {
      type: "group",
      operator: "or",
      conditions: [
        {type: "flag", flag: "doorUnlocked", value: true},
        {type: "flag", flag: "isAdmin", value: true}
      ]
    }
  ]
}
```

### Metadata

```ts
type ConditionBuilderControlMetadata = EditorControlMetadata & {
  type: "condition-builder";

  features?: {
    allowNestedGroups?: boolean;
    maxDepth?: number;
    allowedConditionTypes?: string[];
    compact?: boolean;
  };
};
```

### Notes

This should support nested groups without requiring authors to manually think in terms of raw JSON.

This is one of the highest-value custom controls, but it should wait until `object`, `array`, `select`, `toggle`, and `flag-picker` are stable.

---

## 16. `effect-list`

### Purpose

Visual editing for ordered gameplay effects.

Use for:

- command outcomes
- room entry effects
- interaction effects
- conditional effects
- scripted state changes

### Value Type

```ts
Array<Record<string, unknown>>;
```

### Example Value

```ts
[
  {type: "setFlag", flag: "doorOpen", value: true},
  {type: "movePlayer", roomId: "hallway"},
  {type: "showMessage", message: "The door creaks open."},
];
```

### Metadata

```ts
type EffectListControlMetadata = EditorControlMetadata & {
  type: "effect-list";

  features?: {
    reorderable?: boolean;
    duplicateable?: boolean;
    removable?: boolean;
    allowedEffectTypes?: string[];
    collapsibleItems?: boolean;
  };
};
```

### Notes

This likely combines `array`, `discriminated-union`, `entity-picker`, `flag-picker`, and `textarea` internally.

---

# Priority 4: Utility and Special Controls

These are useful but not urgent for the first complete editor pass.

## 17. `code-preview`

### Purpose

Read-only generated code or structured data preview.

Use for:

- JSON previews
- schema previews
- generated TypeScript snippets
- command previews
- debug output

### Value Type

```ts
string;
```

or:

```ts
unknown;
```

if the control handles JSON serialization itself.

### Metadata

```ts
type CodePreviewControlMetadata = EditorControlMetadata & {
  type: "code-preview";

  features?: {
    language?: "json" | "ts" | "text";
    copyButton?: boolean;
    collapsible?: boolean;
    defaultCollapsed?: boolean;
    maxHeight?: number;
  };
};
```

### Notes

This should be read-only. It may not need `onChange` behavior beyond fitting the generic control API.

---

## 18. `hidden`

### Purpose

Represents a value that exists in data but should not render a visible editor.

Use for:

- generated IDs
- internal metadata
- migration fields
- values edited elsewhere
- fields intentionally suppressed by schema metadata

### Value Type

```ts
unknown;
```

### Metadata

```ts
type HiddenControlMetadata = EditorControlMetadata & {
  type: "hidden";

  features?: {
    reason?: string;
  };
};
```

### Notes

This control should render `null`.

It is still useful as an explicit control because it lets schemas say, "this field exists, but the Universal Editor should not render it here."

---

# Suggested Test Route Structure

Each control should get a dedicated test route and data file.

```txt
src/app/test/
  ControlMatrix.tsx
  ControlMatrix.scss

src/app/test/input/
  page.tsx
  inputControlMatrixData.ts

src/app/test/textarea/
  page.tsx
  textareaControlMatrixData.ts

src/app/test/number/
  page.tsx
  numberControlMatrixData.ts
```

The shared matrix should be able to render any control type.

Each control-specific folder should own:

- its variants
- its test values
- its descriptions
- which variants directly test themes

## Matrix Rule for Themes

Do not repeat every theme for every variant.

Use this rule:

```txt
If a variant is testing tone, chrome, size, state, input behavior, or features:
  use theme: "auto"

If a variant is directly testing theme behavior:
  render explicit theme rows
```

This keeps the matrix readable while still testing inheritance across parent surfaces.

---

# Implementation Pattern for Every Control

Every control should follow this shape:

```tsx
export type SomeControlMetadata = EditorControlMetadata & {
  type: "some-control";
  features?: SomeControlFeatures;
};

export type SomeControlProps = EditorControlProps<ValueType, SomeControlMetadata>;

export function SomeControl({
  value,
  onChange,
  metadata,
  error,
  warnings,
  disabled,
  readonly,
  autoFocus,
  context,
}: SomeControlProps) {
  const appearance = resolveEditorControlAppearance(context.appearance, metadata.appearance);

  return (
    <FieldShell
      title={metadata.title}
      description={metadata.description}
      error={error}
      warnings={warnings}
      appearance={appearance}
      className={metadata.className}
      testId={metadata.testId}
    >
      {/* control body */}
    </FieldShell>
  );
}
```

## Standard Responsibilities

Each control should support:

- title
- description
- error
- warnings
- disabled
- readonly, if meaningful
- hidden, handled by renderer or schema traversal
- appearance resolution
- `metadata.features` for control-specific behavior
- test matrix variants

---

# Summary

The Universal Editor needs 18 controls:

1. `input`
2. `textarea`
3. `number`
4. `toggle`
5. `select`
6. `multi-select`
7. `message`
8. `tag-list`
9. `string-list`
10. `object`
11. `array`
12. `discriminated-union`
13. `entity-picker`
14. `flag-picker`
15. `condition-builder`
16. `effect-list`
17. `code-preview`
18. `hidden`

The first seven controls establish the editor foundation. The collection and structured controls make the schema editor powerful. The picker and builder controls make the editor feel purpose-built for the text adventure engine.
