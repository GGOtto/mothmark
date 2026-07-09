# Universal Editor Controls

This document is the working reference for the controls supported by Mothmark's Universal Editor.

Every visible control receives the shared `EditorControlProps` shape:

```ts
{
  value;
  onChange;
  metadata;
  path;
  error?;
  warnings?;
  disabled?;
  readonly?;
  autoFocus?;
  context;
}
```

Every visible control renders through `FieldShell`, so these shared metadata fields work consistently:

```ts
{
  type;
  title?;
  description?;
  placeholder?;
  disabled?;
  readonly?;
  hidden?;
  required?;
  appearance?;
  className?;
  testId?;
}
```

Appearance resolution is:

```txt
default appearance < context.appearance < metadata.appearance
```

Use `metadata.features` for control-specific behavior. Use `context` for editor-wide services such as inherited appearance, mode, path reads/writes, validation, entity registries, and flag registries.

## Test Pages

Each control has a matrix page under `src/app/test`:

- `/test/text`
- `/test/textarea`
- `/test/number`
- `/test/toggle`
- `/test/select`
- `/test/multi-select`
- `/test/message`
- `/test/tag-list`
- `/test/string-list`
- `/test/object`
- `/test/array`
- `/test/discriminated-union`
- `/test/entity-picker`
- `/test/flag-picker`
- `/test/condition-builder`
- `/test/effect-list`
- `/test/code-preview`
- `/test/hidden`

## `input`

Short string editing for IDs, names, keys, labels, aliases, and compact command text.

Value:

```ts
string;
```

Features:

```ts
{
  copyButton?: boolean;
  clearButton?: boolean;
  prefix?: string;
  suffix?: string;
  selectOnFocus?: boolean;
}
```

Additional metadata:

```ts
{
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  inputMode?: "text" | "search" | "email" | "url" | "tel" | "numeric" | "decimal";
  autoComplete?: string;
  transform?: "none" | "slug" | "id" | "lowercase" | "uppercase";
}
```

Use `transform: "id"` for canonical object IDs and `transform: "slug"` for URL-like labels.

## `textarea`

Long-form string editing for descriptions, narration, notes, and failure messages.

Value:

```ts
string;
```

Features:

```ts
{
  copyButton?: boolean;
  clearButton?: boolean;
  resize?: "none" | "vertical";
  minRows?: number;
  maxRows?: number;
  monospace?: boolean;
  autoGrow?: boolean;
  selectOnFocus?: boolean;
}
```

Additional metadata:

```ts
{
  minLength?: number;
  maxLength?: number;
  transform?: "none" | "trim";
}
```

Use `monospace` for script-like notes and `resize: "none"` in dense panels.

## `number`

Numeric editing for coordinates, weights, counts, limits, cooldowns, probabilities, distances, and indexes.

Value:

```ts
number;
```

Features:

```ts
{
  unit?: string;
  prefix?: string;
  suffix?: string;
  slider?: boolean;
  clearButton?: boolean;
  clampOnBlur?: boolean;
}
```

Additional metadata:

```ts
{
  min?: number;
  max?: number;
  step?: number;
}
```

The input can briefly hold an empty/invalid draft, but committed values remain numbers. `clearButton` resets to `min` when available, otherwise `0`.

## `toggle`

Boolean editing for enabled/disabled, visible/hidden, required/not required, locked/unlocked, and active/inactive state.

Value:

```ts
boolean;
```

Features:

```ts
{
  labels?: {
    on: string;
    off: string;
  };
  display?: "switch" | "checkbox" | "button";
}
```

Use `display: "switch"` for state, `checkbox` for conventional form booleans, and `button` for compact mode-like toggles.

## `select`

Single choice from a known list.

Value:

```ts
string;
```

Features:

```ts
{
  options: Array<{
    label: string;
    value: string;
    description?: string;
    disabled?: boolean;
  }>;
  placeholder?: string;
  searchable?: boolean;
}
```

The current implementation uses a native `select`. `searchable` is reserved for a future custom picker.

## `multi-select`

Multiple choices from a known list.

Value:

```ts
string[]
```

Features:

```ts
{
  options: Array<{
    label: string;
    value: string;
    description?: string;
    disabled?: boolean;
  }>;
  maxSelected?: number;
  searchable?: boolean;
  clearButton?: boolean;
}
```

The first implementation renders as a checklist. `maxSelected` disables unchecked options once the limit is reached.

## `message`

Read-only informational output for helper text, empty states, validation summaries, schema explanations, and preview messages.

Value:

```ts
string;
```

Features:

```ts
{
  variant?: "info" | "warning" | "error" | "success" | "empty";
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}
```

Use this when information belongs inside the editor flow but should not mutate data.

## `tag-list`

Compact string array editing for aliases, tags, keywords, labels, and command synonyms.

Value:

```ts
string[]
```

Features:

```ts
{
  allowDuplicates?: boolean;
  suggestions?: string[];
  transform?: "none" | "slug" | "id" | "lowercase" | "uppercase";
  addOnBlur?: boolean;
  addOnComma?: boolean;
  maxItems?: number;
}
```

Use this for short values. For full sentence rows, use `string-list`.

## `string-list`

Editable array of longer string rows.

Value:

```ts
string[]
```

Features:

```ts
{
  addLabel?: string;
  itemPlaceholder?: string;
  reorderable?: boolean;
  duplicateable?: boolean;
  minItems?: number;
  maxItems?: number;
}
```

Use this for command examples, alternate messages, notes, and prose variants.

## `object`

Nested object editing.

Value:

```ts
Record<string, unknown>;
```

Features:

```ts
{
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  showFieldCount?: boolean;
  layout?: "stack" | "grid" | "section";
  fields?: Array<{
    key: string;
    metadata: EditorControlMetadata & Record<string, unknown>;
    defaultValue?: unknown;
    error?: string;
    warnings?: string[];
  }>;
}
```

`fields` is the current bridge until full schema introspection supplies child metadata automatically. If no fields are supplied, the control renders a read-only key/value preview.

## `array`

Repeatable item editing for structured lists.

Value:

```ts
unknown[]
```

Features:

```ts
{
  addLabel?: string;
  reorderable?: boolean;
  duplicateable?: boolean;
  removable?: boolean;
  collapsibleItems?: boolean;
  defaultCollapsedItems?: boolean;
  minItems?: number;
  maxItems?: number;
  getItemTitle?: string;
  itemMetadata?: EditorControlMetadata & Record<string, unknown>;
  defaultItem?: unknown;
}
```

`itemMetadata` renders each row through another Universal Editor control. `getItemTitle` supports simple templates like `{name}` or `{label}` for object items.

## `discriminated-union`

Object editing where one discriminator field selects the active shape.

Value:

```ts
Record<string, unknown>;
```

Features:

```ts
{
  discriminator: string;
  options: Array<{
    label: string;
    value: string;
    description?: string;
    defaultValue?: Record<string, unknown>;
    fields?: ObjectFieldMetadata[];
  }>;
}
```

Changing the branch applies that option's `defaultValue` and sets the discriminator. Branch fields render through the same child metadata model used by `object`.

## `entity-picker`

Pick an entity ID from a registry.

Value:

```ts
string;
```

Features:

```ts
{
  entityType: "room" | "item" | "character" | "feature" | "connection" | "npc" | "command";
  allowCreate?: boolean;
  showPreview?: boolean;
  clearButton?: boolean;
  options?: EntityPickerOption[];
}
```

Uses `context.registerEntityPicker` when available. `npc` maps to the local `character` registry type. `command` is accepted for metadata compatibility, but needs explicit `options` until command entities have a registry.

## `flag-picker`

Pick a known flag from a flag registry.

Value:

```ts
string;
```

Features:

```ts
{
  allowCreate?: boolean;
  showUsageCount?: boolean;
  clearButton?: boolean;
  filter?: "all" | "boolean" | "number" | "string";
  options?: Array<FlagOption & {
    kind?: "boolean" | "number" | "string";
    usageCount?: number;
  }>;
}
```

Uses `context.registerFlagPicker` when available. `options` can be supplied for local/static picker lists or test matrices.

## `condition-builder`

Visual editing for condition objects and nested condition groups.

Value:

```ts
Record<string, unknown>;
```

Features:

```ts
{
  allowNestedGroups?: boolean;
  maxDepth?: number;
  allowedConditionTypes?: string[];
  compact?: boolean;
}
```

The first implementation edits common scalar condition shapes and group conditions. It is intentionally schema-compatible and can later be deepened with specialized flag/entity sub-controls.

## `effect-list`

Visual editing for ordered gameplay effects.

Value:

```ts
Array<Record<string, unknown>>;
```

Features:

```ts
{
  reorderable?: boolean;
  duplicateable?: boolean;
  removable?: boolean;
  allowedEffectTypes?: string[];
  collapsibleItems?: boolean;
}
```

The first implementation supports common effect types and scalar field editing. It preserves effect order and provides add, remove, duplicate, and move affordances.

## `code-preview`

Read-only generated code or structured data preview.

Value:

```ts
unknown;
```

Features:

```ts
{
  language?: "json" | "ts" | "text";
  copyButton?: boolean;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  maxHeight?: number;
}
```

JSON previews serialize non-string values with indentation. Text and TypeScript previews keep string values as-is.

## `hidden`

Explicitly represents a value that exists in data but should not render in this editor surface.

Value:

```ts
unknown;
```

Features:

```ts
{
  reason?: string;
}
```

This control returns `null`. Use it for generated IDs, migration fields, internal metadata, or fields edited elsewhere.
