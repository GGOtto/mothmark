# UniversalEditor Control Improvements README

This README captures the recommended control improvements and additions for the Mothmark UniversalEditor. It focuses on making the editor easier to use, more consistent, more maintainable, and better suited to authoring text-adventure world data.

The central theme is simple:

> Authors should write content, choose behavior from guided controls, and never have to remember magic strings.

---

## 1. Core Design Principles

### 1.1 Authors write content; controls guide behavior

Use free text inputs for author-created content:

- IDs, names, titles, and labels
- Room prose
- Description text
- Failure messages
- Custom aliases
- Custom command phrases
- Narrative text

Use select-style controls for fixed vocabularies:

- Condition operators
- Effect types
- Effect operators/actions
- Union variants
- Scope types
- Pathway modes
- Match modes
- Priority presets
- Template categories

Use specialized pickers for references into world data:

- Rooms
- Entities
- Flags
- Connections
- Directions
- Commands
- Items
- Features

Use builder controls for nested domain logic:

- Conditions
- Effects
- Conditional text
- Logic branches
- Command patterns

### 1.2 Complex controls compose smaller controls

Complex controls should not privately rebuild primitive UI behavior.

A composed control may own:

- Layout
- Grouping
- Summaries
- Domain-specific behavior
- Recursive rendering
- Validation orchestration

A composed control should not duplicate:

- Select rendering
- Option rendering
- Keyboard behavior
- Focus behavior
- Error display
- Accessibility behavior
- Primitive input styling
- Theme/chrome/size handling

Examples:

- `condition-builder` uses `select`, `flag-picker`, `entity-picker`, `number`, `text`, and recursive `condition-builder` children.
- `effect-list` uses `select`, `flag-picker`, `entity-picker`, `room-picker`, `number`, and `message`.
- `conditional-text` uses `textarea` or `rich-text`, `array`, and `condition-builder`.
- `logic-branch-list` uses `condition-builder`, `effect-list`, and `message`.
- `connection-picker` uses `room-picker`, `direction-picker`, `select`, and `condition-builder`.

### 1.3 Determinism over cleverness

Generated summaries, especially condition summaries, must be deterministic.

The same condition object should always produce the same summary string. Summaries should not use AI, author-written prose, display-label heuristics, localization, or dynamic registry labels.

---

## 2. Recommended Final Control Enum

```ts
export type EditorControlType =
  | "text"
  | "id"
  | "textarea"
  | "rich-text"
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
  | "conditional-text"
  | "condition-builder"
  | "effect-list"
  | "logic-branch-list"
  | "command-pattern"
  | "alias-suggestions"
  | "entity-picker"
  | "room-picker"
  | "connection-picker"
  | "flag-picker"
  | "flag-editor"
  | "direction-picker"
  | "scope-picker"
  | "priority-control"
  | "template-picker"
  | "validation-summary"
  | "code-preview"
  | "json-inspector"
  | "diff-preview"
  | "hidden";
```

---

## 3. Control Categories

### 3.1 Primitive controls

Primitive controls are stable leaf controls. They own low-level UI behavior.

```ts
"text";
"textarea";
"number";
"toggle";
"select";
"multi-select";
"tag-list";
"string-list";
"code-preview";
"hidden";
```

### 3.2 Picker controls

Picker controls are reusable and domain-aware. They usually wrap primitive controls.

```ts
"id";
"entity-picker";
"room-picker";
"connection-picker";
"flag-picker";
"direction-picker";
"scope-picker";
"priority-control";
"template-picker";
```

Examples:

- `room-picker` wraps a searchable select/picker and may show room preview metadata.
- `direction-picker` can render a compass UI with a select fallback.
- `priority-control` can render a preset select and reveal a number field when set to `custom`.

### 3.3 Composed controls

Composed controls orchestrate primitives and pickers.

```ts
"condition-builder";
"effect-list";
"conditional-text";
"logic-branch-list";
"command-pattern";
"discriminated-union";
"object";
"array";
"validation-summary";
"json-inspector";
"diff-preview";
```

---

## 4. Existing Control Improvements

### 4.1 Standardize `text` instead of `input`

Use `"text"` as the public control type name.

The internal component may still be named `InputControl`, but schemas and metadata should use:

```ts
type: "text";
```

This avoids drift between `input` and `text` terminology.

### 4.2 Add universal preview support

Many controls should support showing what the runtime/player sees.

Examples:

- `textarea` shows rendered room-description preview.
- `condition-builder` shows a deterministic generated summary.
- `effect-list` shows a deterministic effect summary.
- `entity-picker` shows selected entity preview.
- `tag-list` shows alias collision/normalization information.

Suggested metadata:

```ts
type EditorPreviewFeatures = {
  showPreview?: boolean;
  previewMode?: "inline" | "below" | "popover";
};
```

### 4.3 Improve object and array empty states

Empty objects and arrays should explain what belongs there and offer an obvious action.

Suggested metadata:

```ts
type EditorEmptyStateFeatures = {
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
};
```

Example array empty state:

```txt
No room features yet.
Add objects the player can examine, use, or interact with.

[Add feature]
```

### 4.4 Improve array row summaries

Array rows should show useful summaries instead of generic labels like `Item 3`.

Suggested metadata:

```ts
type EditorArrayFeatures = {
  getItemTitle?: string;
  getItemSubtitle?: string;
  getItemBadge?: string;
  getItemStatus?: "valid" | "warning" | "error";
  confirmRemove?: boolean;
  collapsedSummary?: boolean;
  addMenu?: Array<{
    label: string;
    defaultItem: unknown;
  }>;
};
```

Example row:

```txt
Brass Key
feature - 3 aliases - listed in room
```

### 4.5 Add safer duplication behavior

Duplicating structured rows should avoid duplicate IDs.

Suggested metadata:

```ts
type EditorDuplicateFeatures = {
  duplicateBehavior?: "exact" | "with-new-id" | "from-template";
  idField?: string;
  idPrefix?: string;
};
```

Use cases:

- Duplicating a room feature creates a new feature ID.
- Duplicating a connection creates a new connection ID.
- Duplicating a command creates a new command ID.

### 4.6 Upgrade select and multi-select

Native selects are not enough for large registries.

Suggested metadata:

```ts
type EditorPickerFeatures = {
  searchable?: boolean;
  groupBy?: string;
  showDescriptions?: boolean;
  showBadges?: boolean;
  allowCreate?: boolean;
  clearButton?: boolean;
};
```

Use searchable picker behavior for:

- Room IDs
- Flags
- Commands
- Feature IDs
- Entity references
- Effect types
- Condition subjects

### 4.7 Improve tag-list for aliases

`tag-list` should support authoring aliases intelligently.

Suggested metadata:

```ts
type EditorTagListFeatures = {
  suggestions?: string[];
  autoSuggestFrom?: "title" | "description" | "registry";
  showCollisions?: boolean;
  showNormalization?: boolean;
  suggestPlural?: boolean;
  suggestArticleless?: boolean;
};
```

Example: if a feature is named `the brass key`, the editor could suggest:

- `brass key`
- `key`
- `brass`

The control should also warn when aliases collide with nearby entities.

### 4.8 Improve number controls

Numbers should adapt to their semantic purpose.

Suggested metadata:

```ts
type EditorNumberFeatures = {
  kind?: "plain" | "coordinate" | "percentage" | "priority" | "count" | "weight";
  nudgeButtons?: boolean;
  resetButton?: boolean;
};
```

Examples:

- Coordinates get small nudge buttons.
- Percentages display `%`.
- Priority values explain ordering meaning.

---

## 5. New Controls to Add

### 5.1 `id`

Specialized text control for canonical IDs.

```ts
type: "id";
```

Suggested metadata:

```ts
type IdControlFeatures = {
  scope?: "world" | "room" | "feature" | "connection" | "command" | "flag";
  prefix?: string;
  checkUnique?: boolean;
  renameReferences?: boolean;
};
```

Use for:

- Room IDs
- Feature IDs
- Command IDs
- Connection IDs
- Flag keys

### 5.2 `rich-text`

A better prose editor for player-facing text. This does not need to be a full WYSIWYG editor.

```ts
type RichTextFeatures = {
  allowedMarks?: Array<"bold" | "italic" | "code">;
  conditionalSnippets?: boolean;
  variableInsert?: boolean;
  preview?: boolean;
};
```

Use for:

- Room descriptions
- Intro text
- Command responses
- Failure messages
- Examine descriptions

### 5.3 `conditional-text`

First-class control for conditional prose.

Recommended data shape:

```ts
type ConditionalText = {
  default: string;
  variants: Array<{
    text: string;
    when: Condition[];
  }>;
};
```

The control should render:

- Default text editor
- Conditional variants list
- Each variant text editor
- Each variant condition builder
- Deterministic condition summaries

### 5.4 `command-pattern`

Control for author-defined commands, aliases, command targets, and parser patterns.

Suggested metadata:

```ts
type CommandPatternFeatures = {
  allowTargets?: boolean;
  allowConnectors?: boolean;
  showExamples?: boolean;
  validateAmbiguity?: boolean;
};
```

Should compose:

- `select` for match mode
- `select` for target mode
- `tag-list` or `multi-select` for verbs
- `tag-list` for aliases
- `entity-picker` for targets
- `scope-picker` for scope
- `priority-control` for priority

### 5.5 `alias-suggestions`

Guided helper for alias generation.

Suggested metadata:

```ts
type AliasSuggestionsFeatures = {
  sourcePath?: EditorPath;
  targetPath?: EditorPath;
  includeSynonyms?: boolean;
  includePluralization?: boolean;
  showCollisionWarnings?: boolean;
};
```

### 5.6 `direction-picker`

Directions should never be plain text.

```ts
type Direction = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";
```

Suggested metadata:

```ts
type DirectionPickerFeatures = {
  mode?: "compass" | "list" | "compact";
  includeDiagonals?: boolean;
  showOpposite?: boolean;
};
```

### 5.7 `connection-picker`

Specialized editor for room connections.

Should compose:

- `room-picker` for from/to rooms
- `direction-picker`
- `select` for pathway
- `select` for lock/visibility state
- `condition-builder`
- `effect-list`

Suggested metadata:

```ts
type ConnectionPickerFeatures = {
  showRooms?: boolean;
  showDirections?: boolean;
  allowReverse?: boolean;
  allowCreate?: boolean;
  validateDuplicateExits?: boolean;
};
```

### 5.8 `room-picker`

Specialized room selector.

Suggested metadata:

```ts
type RoomPickerFeatures = {
  showMapPreview?: boolean;
  showStartRoomBadge?: boolean;
  showIssueBadges?: boolean;
  allowCreate?: boolean;
};
```

Use for:

- Start room
- Teleport/move-player effects
- Command scope
- Room references
- Connection endpoints

### 5.9 `flag-editor`

Registry-style editor for known flags.

Suggested metadata:

```ts
type FlagEditorFeatures = {
  allowKinds?: Array<"boolean" | "number" | "string">;
  showUsageCount?: boolean;
  showUnusedWarnings?: boolean;
  allowRenameReferences?: boolean;
};
```

This is different from `flag-picker`, which selects a flag reference.

### 5.10 `logic-branch-list`

High-level control for branching command behavior.

Suggested metadata:

```ts
type LogicBranchListFeatures = {
  branchTypes?: Array<"if" | "else-if" | "else">;
  showFlowSummary?: boolean;
  reorderable?: boolean;
};
```

Should compose:

- `select` for branch type
- `condition-builder`
- `message` / `textarea` / `rich-text`
- `effect-list`

### 5.11 `scope-picker`

Scope should be selected from a fixed set.

```ts
type Scope = "global" | "world" | "room" | "feature" | "item" | "character" | "command";
```

Each option should include a description.

Example descriptions:

- `global` - Available everywhere.
- `room` - Available only in selected rooms.
- `feature` - Attached to a specific room feature.
- `item` - Available when the player has or sees an item.

### 5.12 `priority-control`

Priority can be numeric internally, but the author should get presets.

```ts
type PriorityPreset = "lowest" | "low" | "normal" | "high" | "highest" | "custom";
```

If `custom` is selected, reveal the number field.

### 5.13 `validation-summary`

Read-only control that shows scoped validation issues.

Suggested metadata:

```ts
type ValidationSummaryFeatures = {
  scope?: "field" | "object" | "room" | "world";
  showWarnings?: boolean;
  showErrors?: boolean;
  clickToNavigate?: boolean;
};
```

### 5.14 `json-inspector`

More capable than `code-preview`.

Suggested metadata:

```ts
type JsonInspectorFeatures = {
  editable?: boolean;
  collapsible?: boolean;
  highlightChanged?: boolean;
  copyButton?: boolean;
};
```

### 5.15 `diff-preview`

Shows changes after an edit, import, template application, processor action, or autofix.

Suggested metadata:

```ts
type DiffPreviewFeatures = {
  beforePath?: EditorPath;
  afterPath?: EditorPath;
  mode?: "inline" | "side-by-side";
};
```

### 5.16 `template-picker`

Creates new objects from presets.

Suggested metadata:

```ts
type TemplatePickerFeatures = {
  templates: Array<{
    label: string;
    description?: string;
    value: unknown;
  }>;
};
```

Useful templates:

- Locked door
- Takeable item
- Examine-only feature
- Conditional room description
- Basic unlock command

---

## 6. Select-Style Picker Rules

### 6.1 Effects should use select pickers

Effects should have at least two select-style fields:

1. Effect type picker
2. Effect operator/action picker

Example effect type options:

```ts
const effectTypeOptions = [
  {label: "Set flag", value: "set-flag"},
  {label: "Clear flag", value: "clear-flag"},
  {label: "Toggle flag", value: "toggle-flag"},
  {label: "Increment counter", value: "increment-counter"},
  {label: "Move player", value: "move-player"},
  {label: "Show message", value: "show-message"},
  {label: "Add item", value: "add-item"},
  {label: "Remove item", value: "remove-item"},
];
```

Operator options should depend on the selected effect type.

```ts
const effectOperatorOptionsByType = {
  "set-flag": [
    {label: "Set to true", value: "set-true"},
    {label: "Set to false", value: "set-false"},
    {label: "Toggle", value: "toggle"},
  ],
  counter: [
    {label: "Set", value: "set"},
    {label: "Add", value: "add"},
    {label: "Subtract", value: "subtract"},
  ],
  inventory: [
    {label: "Add item", value: "add"},
    {label: "Remove item", value: "remove"},
    {label: "Toggle item", value: "toggle"},
  ],
};
```

### 6.2 Conditions should use select pickers

Condition builder should use layered selects:

1. Condition type picker
2. Subject picker
3. Operator picker
4. Value control

Example condition types:

```ts
type ConditionType =
  "flag" | "counter" | "inventory" | "room" | "feature-state" | "command" | "group";
```

Boolean operators:

```ts
type BooleanConditionOperator = "is-true" | "is-false";
```

Numeric operators:

```ts
type NumberConditionOperator =
  | "equals"
  | "not-equals"
  | "greater-than"
  | "greater-than-or-equal"
  | "less-than"
  | "less-than-or-equal";
```

String operators:

```ts
type StringConditionOperator =
  "equals" | "not-equals" | "contains" | "starts-with" | "ends-with" | "matches";
```

List/inventory operators:

```ts
type ListConditionOperator = "contains" | "does-not-contain" | "is-empty" | "is-not-empty";
```

Room/location operators:

```ts
type RoomConditionOperator = "is-current-room" | "has-visited" | "has-not-visited";
```

### 6.3 Other fields that should use select-style controls

Use select/picker behavior for:

- `discriminated-union` variant selection
- `command-pattern` match mode
- `command-pattern` target mode
- `alias-suggestions` generation settings
- `direction-picker` fallback selection
- `connection-picker` pathway/visibility/lock mode
- `scope-picker` scope type
- `priority-control` priority preset
- `message` block type, if messages become structured
- `validation-summary` severity/scope filters
- `template-picker` category/filter

### 6.4 Fields that should not use select boxes

Keep these as text/prose inputs:

- ID
- Title
- Name
- Description
- Message text
- Custom alias
- Custom command phrase
- Failure message
- Room prose

Use specialized pickers instead of generic selects for:

- `roomId` -> `room-picker`
- `entityId` -> `entity-picker`
- `flag` -> `flag-picker`
- `direction` -> `direction-picker`
- `condition` -> `condition-builder`
- `effect` -> `effect-list`

---

## 7. Shared Option Model

Use one shared option model across selects, multi-selects, condition operators, effect operators, and picker-like controls.

```ts
export type EditorSelectOption = {
  label: string;
  value: string;
  description?: string;
  group?: string;
  icon?: string;
  tone?: EditorControlTone;
  disabled?: boolean;
};
```

Suggested picker metadata:

```ts
type PickerMetadata = {
  options?: EditorSelectOption[];
  optionSource?: string;
  placeholder?: string;
  searchable?: boolean;
  clearable?: boolean;
  grouped?: boolean;
};
```

For dynamic/serializable sources:

```ts
type OperatorOptionSource =
  | "condition.boolean"
  | "condition.number"
  | "condition.string"
  | "condition.list"
  | "condition.room"
  | "effect.flag"
  | "effect.counter"
  | "effect.inventory";
```

---

## 8. Child Control Overrides

Composed controls should be able to customize child controls without rebuilding them.

Generic option:

```ts
export type EditorChildControlOverrides = {
  [key: string]: Partial<EditorControlMetadata>;
};
```

Example:

```ts
{
	type: "condition-builder",
	title: "Allowed when",
	childControls: {
		conditionType: {
			type: "select",
			chrome: "inline",
			size: "sm",
		},
		operator: {
			type: "select",
			chrome: "inline",
			size: "sm",
		},
		flag: {
			type: "flag-picker",
			chrome: "inline",
			size: "sm",
		},
	},
}
```

For important controls, strongly typed child overrides may be better:

```ts
type ConditionBuilderChildControls = {
  conditionType?: Partial<EditorControlMetadata>;
  groupOperator?: Partial<EditorControlMetadata>;
  operator?: Partial<EditorControlMetadata>;
  flag?: Partial<EditorControlMetadata>;
  value?: Partial<EditorControlMetadata>;
};
```

---

## 9. `renderChildControl` Helper

A helper keeps composed controls clean while preserving centralized rendering.

```ts
export function renderChildControl<TValue>({
  type,
  value,
  onChange,
  metadata,
  context,
  childKey,
  parentMetadata,
}: {
  type: EditorControlType;
  value: TValue;
  onChange: (value: TValue) => void;
  metadata: EditorControlMetadata;
  context: EditorControlContext;
  childKey: string;
  parentMetadata?: EditorControlMetadata;
}) {
  const override = parentMetadata?.childControls?.[childKey];

  return renderEditorControl({
    type,
    value,
    onChange,
    context,
    metadata: {
      ...metadata,
      ...override,
    },
  });
}
```

Example inside condition builder:

```tsx
renderChildControl({
  type: "select",
  childKey: "operator",
  value: condition.operator,
  onChange: updateOperator,
  metadata: {
    title: "Operator",
    options: operatorOptions,
    chrome: "inline",
    size: "sm",
  },
  parentMetadata: metadata,
  context,
});
```

---

## 10. Recursive Conditions

Conditions must support recursive nesting. A condition can be:

1. A single condition
2. A typed expression
3. A group containing more conditions

Groups may contain any valid condition, including other groups.

### 10.1 Type model

```ts
export type Condition = SingleCondition | ConditionExpression | ConditionGroup;

export type SingleCondition = {
  kind: "single";
  flag: string;
  value: boolean;
};

export type ConditionExpression = {
  kind: "expression";
  subject: string;
  operator: ConditionOperator;
  value?: string | number | boolean;
};

export type ConditionGroup = {
  kind: "group";
  operator: "all" | "any" | "none";
  conditions: Condition[];
};
```

The recursive piece is:

```ts
conditions: Condition[];
```

### 10.2 Example nested condition

```ts
const condition: Condition = {
  kind: "group",
  operator: "all",
  conditions: [
    {
      kind: "single",
      flag: "hasLantern",
      value: true,
    },
    {
      kind: "group",
      operator: "any",
      conditions: [
        {
          kind: "single",
          flag: "doorUnlocked",
          value: true,
        },
        {
          kind: "expression",
          subject: "lockpickSkill",
          operator: "greater-than-or-equal",
          value: 3,
        },
      ],
    },
  ],
};
```

This represents:

```txt
hasLantern AND (doorUnlocked OR lockpickSkill >= 3)
```

### 10.3 Group operators

```ts
type ConditionGroupOperator = "all" | "any" | "none";
```

Meaning:

- `all` - every child condition must pass
- `any` - at least one child condition must pass
- `none` - no child condition may pass

The group operator should use the shared `select` control.

Example options:

```ts
const conditionGroupOperatorOptions = [
  {label: "All conditions", value: "all"},
  {label: "Any condition", value: "any"},
  {label: "No conditions", value: "none"},
];
```

### 10.4 Recursive editor structure

```tsx
function ConditionBuilderControl({value, onChange, metadata, context}: Props) {
  return (
    <ConditionNodeEditor
      condition={value}
      onChange={onChange}
      depth={0}
      metadata={metadata}
      context={context}
    />
  );
}
```

```tsx
function ConditionNodeEditor({
  condition,
  onChange,
  depth,
  metadata,
  context,
}: ConditionNodeEditorProps) {
  if (condition.kind === "group") {
    return (
      <ConditionGroupEditor
        group={condition}
        onChange={onChange}
        depth={depth}
        metadata={metadata}
        context={context}
      />
    );
  }

  return (
    <ConditionLeafEditor
      condition={condition}
      onChange={onChange}
      metadata={metadata}
      context={context}
    />
  );
}
```

Group editor recursively renders children:

```tsx
{
  group.conditions.map((child, index) => (
    <ConditionNodeEditor
      key={index}
      condition={child}
      onChange={(nextChild) => updateChild(index, nextChild)}
      depth={depth + 1}
      metadata={metadata}
      context={context}
    />
  ));
}
```

### 10.5 Recursion guardrails

Support recursive nesting, but add UI guardrails.

Suggested metadata:

```ts
type ConditionBuilderFeatures = {
  maxDepth?: number;
  defaultGroupOperator?: "all" | "any" | "none";
  allowGroups?: boolean;
  allowNestedGroups?: boolean;
  showGeneratedSummary?: boolean;
};
```

Recommended defaults:

```ts
const defaultConditionBuilderFeatures = {
  maxDepth: 5,
  defaultGroupOperator: "all",
  allowGroups: true,
  allowNestedGroups: true,
  showGeneratedSummary: true,
};
```

If the author reaches max depth, disable `Add group` and show a tooltip:

```txt
Maximum nesting depth reached.
```

### 10.6 Default condition factories

```ts
export function createDefaultCondition(): Condition {
  return {
    kind: "single",
    flag: "",
    value: true,
  };
}

export function createDefaultConditionGroup(): Condition {
  return {
    kind: "group",
    operator: "all",
    conditions: [createDefaultCondition()],
  };
}
```

---

## 11. Deterministic Condition Summaries

Condition summaries must be generated automatically from the condition tree.

Authors should not manually write summaries. The system should not store author-written summaries. The system should not use AI, fuzzy rewriting, localization, display-label resolvers, or registry display names to produce condition summaries.

### 11.1 Rule

```md
The same condition object must always produce the same summary string.
```

This means a condition should generate:

```txt
hasLantern is true and (doorUnlocked is true or lockpickSkill is at least 3)
```

It should not generate:

```txt
The player has the lantern and either the door is unlocked or they are skilled enough.
```

### 11.2 Summary labels

Use fixed labels.

```ts
export const conditionOperatorSummaryLabels = {
  equals: "is",
  "not-equals": "is not",
  "greater-than": "is greater than",
  "greater-than-or-equal": "is at least",
  "less-than": "is less than",
  "less-than-or-equal": "is at most",
  contains: "contains",
  "does-not-contain": "does not contain",
  "is-true": "is true",
  "is-false": "is false",
} as const;
```

Use fixed group joiners.

```ts
export const conditionGroupSummaryLabels = {
  all: "and",
  any: "or",
  none: "none of",
} as const;
```

### 11.3 Summary examples

Single boolean condition:

```txt
hasLantern is true
```

Expression condition:

```txt
coins is at least 3
```

All group:

```txt
hasLantern is true and doorUnlocked is true
```

Any group:

```txt
doorUnlocked is true or lockpickSkill is at least 3
```

Nested group:

```txt
hasLantern is true and (doorUnlocked is true or lockpickSkill is at least 3)
```

None group:

```txt
none of (hasLantern is true or doorUnlocked is true)
```

### 11.4 Summary generator

```ts
export function generateConditionSummary(condition: Condition): string {
  if (condition.kind === "group") {
    return generateConditionGroupSummary(condition, 0);
  }

  return generateConditionLeafSummary(condition);
}
```

```ts
function generateConditionGroupSummary(group: ConditionGroup, depth: number): string {
  const childSummaries = group.conditions
    .map((child) => {
      if (child.kind === "group") {
        return generateConditionGroupSummary(child, depth + 1);
      }

      return generateConditionLeafSummary(child);
    })
    .filter(Boolean);

  if (childSummaries.length === 0) {
    return "no conditions";
  }

  if (group.operator === "none") {
    return `none of (${childSummaries.join(" or ")})`;
  }

  const joiner = group.operator === "all" ? " and " : " or ";
  const summary = childSummaries.join(joiner);

  if (depth > 0 && childSummaries.length > 1) {
    return `(${summary})`;
  }

  return summary;
}
```

```ts
function generateConditionLeafSummary(condition: SingleCondition | ConditionExpression): string {
  if (condition.kind === "single") {
    return `${condition.flag} is ${String(condition.value)}`;
  }

  const operatorLabel = conditionOperatorSummaryLabels[condition.operator];

  if (condition.value === undefined) {
    return `${condition.subject} ${operatorLabel}`;
  }

  return `${condition.subject} ${operatorLabel} ${String(condition.value)}`;
}
```

### 11.5 No label resolvers in summaries

Do not use these in deterministic summaries:

```ts
resolveFlagLabel(flag);
resolveRoomLabel(roomId);
resolveEntityLabel(entityId);
```

The summary should use canonical IDs only.

Use:

```txt
hasLantern is true
```

Not:

```txt
the player has the lantern
```

Display labels can still appear inside picker controls, but generated summaries should remain canonical and stable.

### 11.6 Where summaries appear

Show generated condition summaries in:

1. The bottom/top of the full `condition-builder`
2. Collapsed nested condition groups
3. Parent controls that reference conditions

Examples:

- `conditional-text` variant: `Shown when: hasLantern is true`
- `command-pattern`: `Available when: doorUnlocked is false and hasKey is true`
- `connection-picker`: `Usable when: bridgeLowered is true`

---

## 12. Zod Schema Sketch for Recursive Conditions

Recursive Zod schemas usually require `z.lazy`.

```ts
import {z} from "zod";

export const ConditionOperatorSchema = z.enum([
  "equals",
  "not-equals",
  "greater-than",
  "greater-than-or-equal",
  "less-than",
  "less-than-or-equal",
  "contains",
  "does-not-contain",
  "is-true",
  "is-false",
]);

export type Condition =
  | {
      kind: "single";
      flag: string;
      value: boolean;
    }
  | {
      kind: "expression";
      subject: string;
      operator: z.infer<typeof ConditionOperatorSchema>;
      value?: string | number | boolean;
    }
  | {
      kind: "group";
      operator: "all" | "any" | "none";
      conditions: Condition[];
    };

export const ConditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("single"),
      flag: z.string().min(1),
      value: z.boolean().default(true),
    }),
    z.object({
      kind: z.literal("expression"),
      subject: z.string().min(1),
      operator: ConditionOperatorSchema,
      value: z.union([z.string(), z.number(), z.boolean()]).optional(),
    }),
    z.object({
      kind: z.literal("group"),
      operator: z.enum(["all", "any", "none"]).default("all"),
      conditions: z.array(ConditionSchema).default([]),
    }),
  ]),
);
```

---

## 13. Suggested Internal File Structure

```txt
components/editor/universal/
	renderEditorControl.tsx

	controls/
		TextControl.tsx
		TextareaControl.tsx
		NumberControl.tsx
		ToggleControl.tsx
		SelectControl.tsx
		MultiSelectControl.tsx
		TagListControl.tsx
		ArrayControl.tsx
		ObjectControl.tsx

	pickers/
		IdControl.tsx
		FlagPickerControl.tsx
		EntityPickerControl.tsx
		RoomPickerControl.tsx
		ConnectionPickerControl.tsx
		DirectionPickerControl.tsx
		ScopePickerControl.tsx
		PriorityControl.tsx

	composed/
		ConditionBuilderControl.tsx
		EffectListControl.tsx
		ConditionalTextControl.tsx
		CommandPatternControl.tsx
		LogicBranchListControl.tsx
		DiscriminatedUnionControl.tsx

	shared/
		EditorControlShell.tsx
		EditorControlLabel.tsx
		EditorControlDescription.tsx
		EditorControlErrors.tsx
		EditorOptionList.tsx
		EditorInlineRow.tsx
		renderChildControl.tsx
```

---

## 14. Build Order

### Phase 1: Make current controls better

1. Standardize `text` instead of `input`.
2. Improve `array` row summaries.
3. Improve `object` and `array` empty states.
4. Build searchable `select` / picker behavior.
5. Improve `tag-list` suggestions and collisions.
6. Add shared preview support.
7. Add child-control composition helper.

### Phase 2: Add Mothmark-specific authoring controls

1. `id`
2. `direction-picker`
3. `conditional-text`
4. `room-picker`
5. `connection-picker`
6. `alias-suggestions`
7. `command-pattern`

### Phase 3: Logic authoring

1. Recursive `condition-builder`
2. Deterministic condition summary generator
3. Upgraded `effect-list`
4. `logic-branch-list`
5. `scope-picker`
6. `priority-control`
7. `flag-editor`

### Phase 4: Power/debug controls

1. `validation-summary`
2. `json-inspector`
3. `diff-preview`
4. `template-picker`

---

## 15. Final Summary

The UniversalEditor should not merely ask what type a value is. It should ask what the author is trying to do with the value.

A string may be:

- Text
- An ID
- A flag reference
- A room reference
- A command pattern
- A prose block
- An alias

An object may be:

- A generic object
- A condition tree
- An effect
- A connection
- Conditional text
- A command branch

The editor becomes much better when each concept gets the right authoring surface.

The final guiding philosophy:

```txt
Authors write content.
Authors choose behavior from guided controls.
Complex controls compose existing controls.
Primitive controls own low-level UI behavior.
Composed controls own domain logic and layout.
Condition summaries are deterministic and generated from canonical condition data.
```
