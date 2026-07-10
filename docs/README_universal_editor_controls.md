# Universal Editor Controls

This is the current practical reference for Mothmark's Universal Editor controls. It describes every control supported by `renderEditorControl`, how to configure it, what value shape it expects, and what it looks like in the editor.

The older working notes live in `README_universal_editor_controls_current.md`; this file is intended to be the fuller authoring reference.

## Shared Model

Every visible control receives the same core props:

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

Most controls render inside `FieldShell`, so these metadata fields work broadly:

```ts
{
  type;
  title?;
  description?;
  placeholder?;
  required?;
  disabled?;
  readonly?;
  hidden?;
  advanced?;
  appearance?;
  layout?;
  features?;
  className?;
  testId?;
}
```

Appearance resolution is:

```txt
default appearance < UniversalEditor context.appearance < metadata.appearance
```

Shared appearance fields:

```ts
{
  theme?: "auto" | "plain" | "parchment" | "blueprint" | "terminal" | "mothmark";
  scheme?: "auto" | "light" | "dark";
  tone?: "default" | "quiet" | "paper" | "panel" | "terminal";
  chrome?: "field" | "card" | "inline" | "compact" | "bare";
  size?: "sm" | "md" | "lg";
}
```

Shared layout fields:

```ts
{
  group?: string;
  section?: string;
  order?: number;
  pinned?: boolean;
  width?: "full" | "half" | "third" | "auto";
}
```

`advanced` marks fields intended for power users. ID controls are advanced by default and sort late: `layout.order: 1000`, `layout.pinned: false`.

## Test Pages

Control matrix pages live under `src/app/test`:

- `/test/text`
- `/test/textarea`
- `/test/number`
- `/test/toggle`
- `/test/select`
- `/test/multi-select`
- `/test/message`
- `/test/tag-list`
- `/test/link-list`
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

Some specialized controls are exercised indirectly through schema-driven editor surfaces rather than dedicated matrix pages.

## Schema Helpers

Most schema files use helpers from `src/schemas/editorSchemaHelpers.ts`.

Common helpers:

```ts
editor.input(metadata)
editor.id(metadata)
editor.textarea(metadata)
editor.richText(metadata)
editor.number(metadata)
editor.boolean(metadata)
editor.select(schema, metadata)
editor.multiSelect(metadata, schema?)
editor.tagList(source, metadata)
editor.linkList(metadata, schema?)
editor.array(itemSchema, metadata)
editor.object(schema, metadata)
```

Picker/link helpers:

```ts
editor.entityId(entityType, metadata);
editor.optionalEntityId(entityType, metadata);
editor.entityIdList(entityType, metadata);
editor.roomId(metadata);
editor.optionalRoomId(metadata);
editor.connectionId(metadata);
editor.flagKey(metadata);
editor.optionalFlagKey(metadata);
editor.direction(metadata);
editor.scope(schema, metadata);
editor.editorLinkList(entityType, metadata);
editor.singleEditorLink(entityType, metadata);
editor.internalLinkList(metadata);
editor.externalLinkList(metadata);
```

## Controls

### `text` / `input`

Use for short strings: names, labels, keys, compact command text, URLs, and one-line notes.

Value:

```ts
string;
```

Important metadata:

```ts
{
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
}
```

What it looks like:

A single-line rectangular text input. Prefixes and suffixes render as attached affix blocks on the left or right. Clear and Copy render as small attached buttons. In compact chrome, padding and type size tighten. In bare chrome, borders/background mostly disappear.

Use `transform: "id"` for canonical IDs and `transform: "slug"` for URL-like labels.

### `id`

Use for stable object IDs. It renders through the same text-field component as `input`, with ID-oriented defaults.

Value:

```ts
string;
```

Important defaults:

```ts
{
  type: "id";
  required: true;
  placeholder: "stable-id";
  advanced: true;
  layout: {
    order: 1000;
    pinned: false;
  }
}
```

What it looks like:

A normal single-line input, usually late in object forms because IDs are advanced settings. If Copy/Clear are enabled through features, they appear as attached buttons like regular text controls.

### `textarea`

Use for descriptions, narration, notes, failure messages, and longer prose.

Value:

```ts
string;
```

Important metadata:

```ts
{
  minLength?: number;
  maxLength?: number;
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
    showPreview?: boolean;
    previewMode?: "inline" | "below" | "popover";
  };
}
```

What it looks like:

A bordered multi-line textarea. Optional Clear/Copy buttons sit in an action row below the text area. `monospace` switches the input font. `showPreview` adds a separate preview box below the editor. `maxRows` limits visual height with scrolling.

### `rich-text`

Use for authored text that benefits from helper tooling around marks, variables, condition snippets, or preview.

Value:

```ts
string;
```

Important metadata:

```ts
{
  features?: {
    allowedMarks?: Array<"bold" | "italic" | "code">;
    conditionalSnippets?: boolean;
    variableInsert?: boolean;
    preview?: boolean;
    clearButton?: boolean;
    copyButton?: boolean;
  };
}
```

What it looks like:

Currently it renders as a rich-text flavored specialized editor built from textarea-style editing plus optional helper actions and preview. It is more author-facing than `textarea`, but it is still string-backed.

### `number`

Use for coordinates, counts, weights, limits, cooldowns, chances, distances, priorities, and indexes.

Value:

```ts
number;
```

Important metadata:

```ts
{
  min?: number;
  max?: number;
  step?: number;
  features?: {
    kind?: "plain" | "coordinate" | "percentage" | "priority" | "count" | "weight";
    unit?: string;
    prefix?: string;
    suffix?: string;
    slider?: boolean;
    clearButton?: boolean;
    clampOnBlur?: boolean;
    nudgeButtons?: boolean;
    resetButton?: boolean;
    resetValue?: number;
  };
}
```

What it looks like:

A numeric input with optional prefix/suffix, Clear, Reset, nudge buttons, and range slider. `kind: "coordinate"` makes the control compact, right-aligned, and tabular so X/Y fields can sit inline. `kind: "priority"` adds a hint explaining that higher priority runs first.

The input can temporarily contain an invalid draft, but committed values are numbers. Clear resets to `min` if present, otherwise `0`.

### `toggle`

Use for booleans: visible/listed, enabled, locked, active, required, and mode flags.

Value:

```ts
boolean;
```

Important metadata:

```ts
{
  features?: {
    labels?: {
      on: string;
      off: string;
    };
    display?: "switch" | "checkbox" | "button";
  };
}
```

What it looks like:

`switch` renders a pill-like button with a small track indicator and on/off label. `checkbox` renders a conventional checkbox row. `button` renders a compact pressed/unpressed button. Read-only state uses disabled interaction styling.

### `select`

Use for one choice from a known list.

Value:

```ts
string;
```

Important metadata:

```ts
{
  features: {
    options: Array<{
      label: string;
      value: string;
      description?: string;
      group?: string;
      badge?: string;
      disabled?: boolean;
    }>;
    placeholder?: string;
    searchable?: boolean;
    grouped?: boolean;
    showDescriptions?: boolean;
    showBadges?: boolean;
    allowCreate?: boolean;
    clearButton?: boolean;
    clearable?: boolean;
  };
}
```

What it looks like:

A native select with optional Clear button. If searchable or createable, a search/create row appears below. The selected option may show a small preview box with badge/description, but the long description list under every option is intentionally not rendered by the plain select control. Badges render inside option labels as parenthesized text.

### `multi-select`

Use for multiple choices from a known list.

Value:

```ts
string[]
```

Important metadata:

```ts
{
  features: {
    options: SelectOption[];
    maxSelected?: number;
    searchable?: boolean;
    clearButton?: boolean;
    allowCreate?: boolean;
    grouped?: boolean;
    showDescriptions?: boolean;
    showBadges?: boolean;
  };
}
```

What it looks like:

A summary row shows how many options are selected and, if configured, the max. Options render as a stacked checklist of bordered rows. Checked rows get selected styling. Descriptions appear under labels when `showDescriptions` is enabled or when options include descriptions. Search/add controls appear above the checklist when configured.

### `tag-list`

Use for compact string arrays: aliases, tags, keywords, labels, and command synonyms.

Value:

```ts
string[]
```

Important metadata:

```ts
{
  features?: {
    allowDuplicates?: boolean;
    suggestions?: string[];
    autoSuggestFrom?: "title" | "description" | "registry";
    sourceText?: string;
    collisionValues?: string[];
    showCollisions?: boolean;
    showNormalization?: boolean;
    suggestPlural?: boolean;
    suggestArticleless?: boolean;
    transform?: "none" | "slug" | "id" | "lowercase" | "uppercase";
    addOnBlur?: boolean;
    addOnComma?: boolean;
    maxItems?: number;
  };
}
```

What it looks like:

A bordered tag well containing inline pill-like tags. Each tag has text and a small `x` remove button. The add input sits inside the same well and wraps with the tags. Optional suggestions render as small buttons below. Collision/normalization/max count messages render as small metadata text.

### `link-list`

Use for tag-like clickable links: internal routes, external URLs, and editor targets. Room features currently use this control.

Value:

```ts
string[] |
EditorLinkRef[] |
Array<{ id: string }> |
string |
EditorLinkRef |
null
```

Important metadata:

```ts
{
  features: {
    mode?: "read" | "edit" | "single-link";
    linkType: "internal-link" | "external-link" | "editor";
    display?: "inline" | "block" | "compact";
    openBehavior?: "same-tab" | "new-tab";
    editorTarget?: EditorLinkTargetMetadata;
    addLabel?: string;
    inputPlaceholder?: string;
    pickerPlaceholder?: string;
    emptyText?: string;
    clickHint?: string;
  };
}
```

What it looks like:

By default, it looks like a tag list with inline bordered chips. Editor links include a pencil icon and optional hint text such as `Edit`; labels are not underlined. `display: "block"` makes full-width rows. `display: "compact"` tightens padding. External links render as anchors; editor links render as buttons that push a child editor view inside `UniversalEditor`.

Behavior:

- Selecting an existing editor target from the picker immediately adds it.
- The add/create button creates a new blank child value when `editorTarget.create.enabled` is true.
- Back from a linked editor restores the parent scroll position.
- Parent data changes clear child navigation and return to the parent editor.

### `string-list`

Use for arrays of longer strings: command examples, alternate messages, notes, and prose variants.

Value:

```ts
string[]
```

Important metadata:

```ts
{
  features?: {
    addLabel?: string;
    itemPlaceholder?: string;
    reorderable?: boolean;
    duplicateable?: boolean;
    minItems?: number;
    maxItems?: number;
  };
}
```

What it looks like:

A vertical list of row cards. Each row contains a two-line textarea and action buttons. Reorderable rows show Up/Down buttons; duplicateable rows show Duplicate. Remove is always shown but respects `minItems`.

### `object`

Use for nested structured objects.

Value:

```ts
Record<string, unknown>;
```

Important metadata:

```ts
{
  features?: {
    collapsible?: boolean;
    defaultCollapsed?: boolean;
    showFieldCount?: boolean;
    layout?: "stack" | "grid" | "section" | "inline";
    fields?: Array<{
      key: string;
      metadata: EditorControlMetadata & Record<string, unknown>;
      defaultValue?: unknown;
      error?: string;
      warnings?: string[];
    }>;
    emptyTitle?: string;
    emptyDescription?: string;
    emptyActionLabel?: string;
    defaultValue?: Record<string, unknown>;
  };
}
```

What it looks like:

A bordered object panel containing child controls. `stack` uses one field per row. `grid` uses responsive columns. `section` adds a stronger left border. `inline` wraps compact child controls side-by-side, used for coordinate pairs. Collapsible objects render as a `details` block with a summary row.

If no fields are supplied, it renders a read-only key/value preview. Schema introspection usually supplies fields automatically.

### `array`

Use for repeatable structured lists.

Value:

```ts
unknown[]
```

Important metadata:

```ts
{
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
    getItemSubtitle?: string;
    getItemBadge?: string;
    getItemStatus?: "valid" | "warning" | "error";
    confirmRemove?: boolean;
    collapsedSummary?: boolean;
    itemMetadata?: EditorControlMetadata & Record<string, unknown>;
    defaultItem?: unknown;
    addMenu?: Array<{ label: string; defaultItem: unknown }>;
    emptyTitle?: string;
    emptyDescription?: string;
    emptyActionLabel?: string;
    duplicateBehavior?: "exact" | "with-new-id" | "from-template";
    idField?: string;
    idPrefix?: string;
  };
}
```

What it looks like:

A vertical list of bordered item panels. Each item has a title row and optional subtitle/badge/status. Items can be collapsible. Move, Duplicate, and Remove buttons appear in the item chrome when enabled. The item body renders another Universal Editor control from `itemMetadata`.

Template strings such as `{name}` or `{label}` are supported for item titles/subtitles.

### `discriminated-union`

Use for objects whose active shape is selected by a discriminator field.

Value:

```ts
Record<string, unknown>;
```

Important metadata:

```ts
{
  features: {
    discriminator: string;
    options: Array<{
      label: string;
      value: string;
      description?: string;
      defaultValue?: Record<string, unknown>;
      fields?: ObjectFieldMetadata[];
    }>;
  }
}
```

What it looks like:

A select at the top chooses the branch. The selected branch's fields render below in an object editor. Changing branch applies that option's `defaultValue` and sets the discriminator.

### `message`

Use for read-only helper text, empty states, validation explanations, and preview messages.

Value:

```ts
string;
```

Important metadata:

```ts
{
  features?: {
    variant?: "info" | "warning" | "error" | "success" | "empty";
    collapsible?: boolean;
    defaultCollapsed?: boolean;
  };
}
```

What it looks like:

A non-editable message box. Variants change tone and border/background color. Collapsible messages render as a `details` disclosure with the placeholder/title as summary.

### `hidden`

Use for values that exist in data but should not render on this editor surface.

Value:

```ts
unknown;
```

Important metadata:

```ts
{
  features?: {
    reason?: string;
  };
}
```

What it looks like:

Nothing. The component returns `null`.

### `entity-picker`

Use for choosing an entity ID from the editor registry.

Value:

```ts
string;
```

Important metadata:

```ts
{
  features: {
    entityType: EntityType | "npc" | "command";
    allowCreate?: boolean;
    showPreview?: boolean;
    clearButton?: boolean;
    options?: EntityPickerOption[];
  };
}
```

What it looks like:

A native select with optional Clear button. If `allowCreate` is true, an extra input row lets the author type an unknown ID and confirm it with `Use ID`. A selected preview box shows the entity label and description/id. Unknown values display an unknown-entity preview.

Registry notes:

- `npc` maps to the character registry.
- `command` currently needs explicit options unless a command registry is provided.

### `room-picker`

Use for choosing a room ID.

Value:

```ts
string;
```

Important metadata:

```ts
{
  features?: {
    options?: Array<{
      id: string;
      label?: string;
      description?: string;
      isStartRoom?: boolean;
      issues?: number;
    }>;
    showMapPreview?: boolean;
    showStartRoomBadge?: boolean;
    showIssueBadges?: boolean;
    allowCreate?: boolean;
    clearButton?: boolean;
  };
}
```

What it looks like:

A room-specific picker built from a select-like control plus optional metadata. Start-room and issue indicators can appear when supplied. In specialized editors it is used for connection endpoints and room-targeted commands/effects.

### `connection-picker`

Use for choosing a connection ID or connection-like target.

Value:

```ts
string;
```

Important metadata:

```ts
{
  features?: Record<string, unknown>;
}
```

What it looks like:

A specialized picker surface for connection references. It follows the FieldShell style and uses registry/context options when available.

### `flag-picker`

Use for choosing a known flag key.

Value:

```ts
string;
```

Important metadata:

```ts
{
  features?: {
    allowCreate?: boolean;
    showUsageCount?: boolean;
    clearButton?: boolean;
    filter?: "all" | "boolean" | "number" | "string";
    options?: Array<FlagOption & {
      kind?: "boolean" | "number" | "string";
      usageCount?: number;
    }>;
  };
}
```

What it looks like:

A native select with optional Clear button. If `allowCreate` is true, an extra input row lets the author type an unknown flag and confirm it with `Use Flag`. A preview box shows the selected flag label, description, unknown state, and optional usage count.

### `flag-editor`

Use for editing flag definitions rather than choosing a flag.

Value:

```ts
(Record<string, unknown> | (Record < string), unknown > []);
```

Important metadata:

```ts
{
  features?: Record<string, unknown>;
}
```

What it looks like:

A specialized structured editor for flag rows. It typically renders ID, kind, and description controls inside an array/object surface.

### `direction-picker`

Use for choosing room directions.

Value:

```ts
string;
```

Important metadata:

```ts
{
  features?: {
    options?: Array<SelectOption & {
      opposite?: string;
      diagonal?: boolean;
    }>;
    optionSource?: string;
    mode?: "compass" | "list" | "compact";
    includeDiagonals?: boolean;
    showOpposite?: boolean;
    clearButton?: boolean;
  };
}
```

What it looks like:

A grid/button-style direction control for compass-like choices, with fallback directions `n`, `ne`, `e`, `se`, `s`, `sw`, `w`, `nw`, `up`, `down`, `in`, and `out`. The selected direction is visually pressed. `showOpposite` can show the opposite exit hint.

### `scope-picker`

Use for choosing authored-command scope or availability scope.

Value:

```ts
string;
```

Important metadata:

```ts
{
  features?: {
    options?: SelectOption[];
    optionSource?: string;
    clearButton?: boolean;
  };
}
```

What it looks like:

A select-like specialized picker. Built-in scope options include global/world/room/feature/item/character/command-style scopes when used through command-pattern editors.

### `priority-control`

Use for command, branch, or effect priority numbers.

Value:

```ts
number;
```

Important metadata:

```ts
{
  features?: {
    presets?: Record<string, number>;
    presetOptions?: SelectOption[];
    presetOptionSource?: string;
    customLabel?: string;
  };
}
```

What it looks like:

A preset select paired with a numeric priority editor. It uses compact numeric controls with reset/nudge affordances. Higher priority runs first.

### `condition-builder`

Use for visual editing of condition objects and condition groups.

Value:

```ts
Record<string, unknown> | Array<Record<string, unknown>>;
```

Important metadata:

```ts
{
  features?: {
    allowGroups?: boolean;
    allowNestedGroups?: boolean;
    maxDepth?: number;
    defaultGroupOperator?: "all" | "any" | "none";
    allowedConditionTypes?: string[];
    conditionTypeOptions?: SelectOption[];
    groupOperatorOptions?: SelectOption[];
    comparisonOperatorOptions?: SelectOption[];
    operatorOptions?: SelectOption[];
    operatorOptionsByType?: Record<string, SelectOption[]>;
    conditionTypeOptionSource?: string;
    groupOperatorOptionSource?: string;
    comparisonOperatorOptionSource?: string;
    operatorOptionSource?: string;
    operatorOptionSourcesByType?: Record<string, string>;
    showGeneratedSummary?: boolean;
    compact?: boolean;
  };
}
```

What it looks like:

A structured condition panel with rows for condition type, operator, subject, value, and nested group children. Group rows have add/remove controls for child conditions. Optional generated summaries render human-readable condition text.

Fallback condition types include flag, counter, inventory, current room, and group.

### `effect-list`

Use for ordered gameplay effects.

Value:

```ts
Array<Record<string, unknown>>;
```

Important metadata:

```ts
{
  features?: {
    reorderable?: boolean;
    duplicateable?: boolean;
    removable?: boolean;
    allowedEffectTypes?: string[];
    effectTypeOptions?: SelectOption[];
    operationOptionsByType?: Record<string, SelectOption[]>;
    effectTypeOptionSource?: string;
    operationOptionSourcesByType?: Record<string, string>;
    collapsibleItems?: boolean;
    showGeneratedSummary?: boolean;
  };
}
```

What it looks like:

A vertical list of effect panels. Each effect has type and operation controls, then fields relevant to that effect. Row actions can move, duplicate, and remove effects. Summaries can show generated effect text. Fallback effect types include message, flag, counter, inventory, item-location, object-state, room, npc, event, flow, group, and conditional.

### `conditional-text`

Use for a default text plus conditional variants.

Value:

```ts
{
  default?: string;
  variants?: Array<{
    text?: string;
    when?: Record<string, unknown>;
  }>;
}
```

Important metadata:

```ts
{
  features?: Record<string, unknown>;
}
```

What it looks like:

A specialized text editor: a primary textarea for default text plus an array of variants. Each variant contains variant text and a condition-builder field.

### `logic-branch-list`

Use for conditional branches that combine conditions, messages, and effects.

Value:

```ts
Array<Record<string, unknown>>;
```

Important metadata:

```ts
{
  features?: Record<string, unknown>;
}
```

What it looks like:

A structured array of branch panels. Each branch has a branch type selector plus condition, message, and effect-list fields. It is used by authored commands and similar branching workflows.

### `command-pattern`

Use for authored command matching patterns.

Value:

```ts
Record<string, unknown>;
```

Important metadata:

```ts
{
  features?: Record<string, unknown>;
}
```

What it looks like:

A composed command-authoring surface with select controls for match/target modes, tag lists for verbs or raw phrases, scope pickers, room/feature/entity pickers, and priority controls. It is not a single primitive field; it renders a domain-specific command pattern form.

### `alias-suggestions`

Use for generated alias suggestions.

Value:

```ts
string[]
```

Important metadata:

```ts
{
  features?: {
    sourceText?: string;
    includeSynonyms?: boolean;
    includePluralization?: boolean;
    showCollisionWarnings?: boolean;
    collisionValues?: string[];
  };
}
```

What it looks like:

A specialized suggestion surface that displays proposed aliases as compact selectable chips/buttons. It can show collision warnings when suggestions overlap existing aliases.

### `template-picker`

Use for selecting a template or preset structure.

Value:

```ts
unknown;
```

Important metadata:

```ts
{
  features?: Record<string, unknown>;
}
```

What it looks like:

A specialized picker that displays template options as selectable rows/cards. Template descriptions can appear below labels.

### `validation-summary`

Use for displaying validation issues.

Value:

```ts
unknown;
```

Important metadata:

```ts
{
  features?: Record<string, unknown>;
}
```

What it looks like:

A read-only list of validation findings. Issues are styled by severity and are meant to sit inside editor flow near the data they describe.

### `code-preview`

Use for generated code, JSON, or structured data previews.

Value:

```ts
unknown;
```

Important metadata:

```ts
{
  features?: {
    language?: "json" | "ts" | "text";
    copyButton?: boolean;
    collapsible?: boolean;
    defaultCollapsed?: boolean;
    maxHeight?: number;
  };
}
```

What it looks like:

A toolbar row showing the language and optional Copy button, followed by a bordered code block. Collapsible mode wraps the code block in a disclosure. JSON values are formatted with indentation; text and TypeScript strings are shown as-is.

### `json-inspector`

Use for inspecting or optionally editing raw structured data.

Value:

```ts
unknown;
```

Important metadata:

```ts
{
  features?: {
    editable?: boolean;
    collapsible?: boolean;
    highlightChanged?: boolean;
    copyButton?: boolean;
  };
}
```

What it looks like:

A JSON-oriented specialized editor. In read-only mode it behaves like an inspector/code preview. In editable mode it provides a JSON textarea-like editing surface. Copy and collapsible modes are available.

### `diff-preview`

Use for showing differences between two values or generated previews.

Value:

```ts
unknown;
```

Important metadata:

```ts
{
  features?: Record<string, unknown>;
}
```

What it looks like:

A read-only diff-style preview surface. It is intended for comparing generated output, changes, or before/after states inside the editor.

## Control Selection

`renderEditorControl` currently supports these `metadata.type` values:

```ts
"text";
"input";
"id";
"textarea";
"rich-text";
"number";
"toggle";
"select";
"multi-select";
"tag-list";
"link-list";
"string-list";
"object";
"array";
"discriminated-union";
"conditional-text";
"condition-builder";
"effect-list";
"logic-branch-list";
"command-pattern";
"alias-suggestions";
"entity-picker";
"room-picker";
"connection-picker";
"flag-picker";
"flag-editor";
"direction-picker";
"scope-picker";
"priority-control";
"template-picker";
"validation-summary";
"code-preview";
"json-inspector";
"diff-preview";
"hidden";
"message";
```

Unknown control types render nothing.

## Current Visual Conventions

- Short scalar controls are rectangular, dense, and FieldShell-wrapped.
- Tags and link lists are inline chip-like controls by default.
- Link-list row mode is available through `display: "block"`, but the default is inline.
- Plain selects do not show long option-description lists. Use the selected preview or a separate preview panel instead.
- Coordinates should use `number` with `features.kind: "coordinate"` and an inline object layout.
- IDs are advanced settings and should not be pinned to the top of author-facing forms.
- Object and array controls are intentionally utilitarian: bordered panels, predictable headings, and dense action buttons rather than decorative cards.
