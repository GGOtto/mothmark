# Universal Editor UX Improvement Spec

## Goal

Improve the Mothmark Universal Editor so it feels clear, polished, and manageable even when editing large schemas with many nested fields.

The current Universal Editor has strong foundations:

- visible controls use shared `EditorControlProps`
- visible controls render through `FieldShell`
- shared visual metadata lives on `EditorControlMetadata`
- control-specific behavior lives in `metadata.features`
- runtime services live in `context`
- appearance resolves as `default appearance < context.appearance < metadata.appearance`
- entity and flag options should come from registries/context, not static schema metadata

This spec keeps that architecture, but adds a clearer editor shell, field prioritization, progressive disclosure, summaries, navigation, better empty states, and stronger visual affordances.

The target result: the editor should feel like a guided authoring tool, not a raw schema dump.

---

## Core UX Problem

As the schemas grow, the editor can become overwhelming because everything has equal visual weight:

- important fields compete with rare/internal fields
- nested objects and arrays create huge vertical walls
- condition/effect builders can dominate the page
- users may not know what to edit first
- repeated metadata descriptions can create noise
- arrays/objects are hard to scan when collapsed poorly
- link-like controls need clearer click affordance
- validation and warnings need to be visible without becoming stressful

The fix is not one giant redesign. It is a layered system:

1. **Prioritize important fields.**
2. **Group related fields.**
3. **Collapse advanced/detail-heavy regions by default.**
4. **Show human-readable summaries before raw controls.**
5. **Let users drill into child editors instead of expanding everything inline.**
6. **Make actions obvious and safe.**
7. **Keep the visual language beautiful, calm, and consistent.**

---

## Design Principles

### 1. The editor should guide the user

Every schema object should have a sensible “start here” path. For example, a room editor should make the name/id, description, exits, and important state obvious before showing rare metadata.

Do not make users scan twenty fields to find the two they usually need.

### 2. Editing should happen in layers

The main editor should show the most important fields directly. Secondary fields should live in collapsed sections, child editors, drawers, or expandable groups.

Prefer:

```txt
Room
  Identity
  Description
  Connections
  Advanced
```

over:

```txt
id
aliases
tags
state
description
features
exits
conditions
effects
metadata
...
```

### 3. Readability matters as much as capability

A field that technically works but looks dense is not done. Every control should have enough spacing, title hierarchy, affordance, and summary text to be understandable at a glance.

### 4. Metadata controls behavior; context controls runtime data

Schema metadata can describe how a field wants to render. It should not contain live entity lists, app state, mutable navigation state, or registry data.

### 5. The editor should never punish exploration

Opening a nested editor, expanding an advanced section, or previewing a condition should feel safe. Back buttons, breadcrumbs, stable focus behavior, and non-destructive previews are mandatory for complex flows.

---

## Proposed User Experience

### Top-level editor shell

Add a stronger Universal Editor shell around the rendered fields.

The shell should support:

```ts
export type UniversalEditorShellMetadata = {
  title?: string;
  description?: string;
  eyebrow?: string;
  icon?: string;
  summary?: string;
  status?: "draft" | "valid" | "warning" | "error" | "readonly";
  density?: "comfortable" | "compact";
  showSearch?: boolean;
  showOutline?: boolean;
  showJsonPreview?: boolean;
};
```

Recommended layout:

```txt
┌──────────────────────────────────────────────┐
│ Room                                         │
│ Edit the room identity, description, exits…  │
│ [Search fields...]          Valid · 2 notes  │
├──────────────────────────────────────────────┤
│ Outline / Sections                           │
│                                              │
│ Identity                                     │
│ Description                                  │
│ Connections                                  │
│ Advanced                                     │
└──────────────────────────────────────────────┘
```

The shell should provide:

- title and short description
- optional status summary
- optional field search
- optional section outline
- sticky top bar for deeply nested editors
- breadcrumbs when inside child editors
- global validation summary
- optional code/json preview toggle

---

## Field Prioritization

Add metadata for ordering fields independently from schema order.

Schema order is still the default, but it should not be the only authoring order.

```ts
export type EditorFieldPriority = {
  order?: number;
  group?: string;
  pinned?: boolean;
  importance?: "primary" | "secondary" | "advanced" | "internal";
};
```

Add this to shared metadata:

```ts
export type EditorControlMetadata = {
  type: EditorControlType;
  title?: string;
  description?: string;
  placeholder?: string;
  disabled?: boolean;
  readonly?: boolean;
  hidden?: boolean;
  required?: boolean;
  appearance?: EditorControlAppearance;
  className?: string;
  testId?: string;

  priority?: EditorFieldPriority;
};
```

Sorting rules:

1. `hidden` fields do not render.
2. `pinned: true` fields render first.
3. lower `priority.order` renders earlier.
4. `importance: "primary"` renders before secondary/advanced/internal.
5. schema order breaks ties.

Example:

```ts
editor.input({
  title: "Room ID",
  description: "Stable ID used by commands, exits, and references.",
  priority: {
    group: "Identity",
    order: 10,
    pinned: true,
    importance: "primary",
  },
});
```

This gives us the exact thing we wanted for rooms: the most commonly edited fields can rise to the top without contorting the schema itself.

---

## Field Groups and Sections

Add first-class section metadata.

```ts
export type EditorFieldGroupMetadata = {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  defaultCollapsed?: boolean;
  collapsible?: boolean;
  importance?: "primary" | "secondary" | "advanced" | "internal";
  order?: number;
};
```

Add this to editor-level metadata:

```ts
export type EditorObjectFeatures = {
  layout?: "stack" | "grid" | "section";
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  showFieldCount?: boolean;
  groups?: EditorFieldGroupMetadata[];
};
```

Example:

```ts
features: {
  layout: "section",
  groups: [
    {
      id: "identity",
      title: "Identity",
      description: "Names, IDs, aliases, and tags.",
      order: 10
    },
    {
      id: "content",
      title: "Description",
      description: "What the player sees and reads.",
      order: 20
    },
    {
      id: "logic",
      title: "Logic",
      description: "Conditions, effects, and state changes.",
      defaultCollapsed: true,
      order: 40
    },
    {
      id: "advanced",
      title: "Advanced",
      defaultCollapsed: true,
      importance: "advanced",
      order: 90
    }
  ]
}
```

Each field can point at a group:

```ts
priority: {
  group: "content",
  order: 20,
  importance: "primary"
}
```

If a field references a group that does not exist, render it in an automatically generated group using the group ID as a fallback title.

---

## Progressive Disclosure

Add consistent disclosure levels across all complex controls.

```ts
export type EditorDisclosure = {
  defaultCollapsed?: boolean;
  collapsible?: boolean;
  preview?: "none" | "summary" | "count" | "first-item" | "custom";
  advanced?: boolean;
};
```

Add to shared metadata:

```ts
disclosure?: EditorDisclosure;
```

Usage:

```ts
editor.array({
  title: "Room Features",
  disclosure: {
    collapsible: true,
    defaultCollapsed: true,
    preview: "count",
  },
  features: {
    addLabel: "Add feature",
    collapsibleItems: true,
    defaultCollapsedItems: true,
  },
});
```

Default behavior:

- primary fields are expanded
- secondary groups can be expanded
- advanced groups default collapsed
- internal fields should use `hidden` or an explicit “Internal” section
- arrays with many items default to collapsed item cards
- nested objects default to summary cards once deeper than one level

---

## Summary-First Editing

Complex controls should show a deterministic summary above or inside the control.

This is especially important for:

- object
- array
- discriminated-union
- condition-builder
- effect-list
- entity-picker
- link-list
- code-preview

Add shared summary metadata:

```ts
export type EditorSummaryMetadata = {
  summary?: string;
  summaryTemplate?: string;
  emptySummary?: string;
  warningSummary?: string;
};
```

Add to shared metadata:

```ts
summary?: EditorSummaryMetadata;
```

Template examples:

```ts
summary: {
  summaryTemplate: "{id} · {aliases.length} aliases · {features.length} features",
  emptySummary: "No room details yet"
}
```

The summary system should be deterministic. Do not use generative text here.

For conditions and effects:

```txt
Condition summary:
"Player has key AND lantern is lit"

Effect summary:
"Set flag door_open = true"
```

If the deterministic summary cannot be generated, fall back to:

```txt
Condition
Effect
3 effects
No conditions
```

---

## Child Editor Navigation

Large nested objects should not always expand inline. Some fields should open as child editors inside the Universal Editor shell.

The link-list spec already introduces an internal editor navigation stack: editor links should replace the current Universal Editor content with a child editor view, with a back link by default. The child editor should continue using the same context, appearance, disabled/readonly state, and root value update mechanism. Its `onChange` must write back to the root value by path, not just local state.

Generalize that into a reusable editor navigation service:

```ts
export type EditorNavigationEntry = {
  title?: string;
  description?: string;
  schema: z.ZodTypeAny;
  value: unknown;
  path: EditorPath;
  metadata?: EditorControlMetadata;
};

export type EditorNavigationContext = {
  openChildEditor?: (entry: EditorNavigationEntry) => void;
  goBack?: () => void;
  canGoBack?: boolean;
  breadcrumbs?: Array<{
    label: string;
    path?: EditorPath;
  }>;
};
```

Add this to `EditorControlContext`:

```ts
editorNavigation?: EditorNavigationContext;
```

Recommended child editor UI:

```txt
← Back to Room
Room / Connections / North Exit

[child editor content]
```

Rules:

- child editors are local to the Universal Editor shell
- do not browser-navigate for child editors
- breadcrumbs should be visible for nested navigation
- back pops one navigation entry
- child edits write through to the root value
- missing paths should show a friendly warning instead of crashing

---

## Link List Control Integration

Add `link-list` as a supported Universal Editor control.

The control should support:

- internal app links
- external URLs
- editor links
- read mode
- edit mode
- single-link mode
- entity-picker integration for editor targets
- add/create behavior for metadata-defined child targets
- visible click affordance
- graceful handling of missing targets

Editor links should use the child editor navigation system instead of changing browser routes. The link control should call navigation services rather than constructing child schemas itself.

Add the control type:

```ts
type EditorControlType =
  | "input"
  | "textarea"
  | "number"
  | "toggle"
  | "select"
  | "multi-select"
  | "message"
  | "tag-list"
  | "string-list"
  | "object"
  | "array"
  | "discriminated-union"
  | "entity-picker"
  | "flag-picker"
  | "condition-builder"
  | "effect-list"
  | "code-preview"
  | "link-list"
  | "hidden";
```

Add render case:

```tsx
case "link-list":
  return <LinkListEditor {...props} />;
```

The link-list visual style should be stronger than plain tags: use a pointer cursor, underline or suffix arrow, hover/focus state, and a keyboard focus ring. Browser links should use anchors while editor links should use buttons.

---

## Better Object Editing

The `object` control should become the main place where overwhelm is solved.

Current object behavior supports nested editing and can use fields supplied through metadata. Improve it with:

```ts
export type ObjectEditorFeatures = {
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  showFieldCount?: boolean;
  layout?: "stack" | "grid" | "section";
  groups?: EditorFieldGroupMetadata[];
  fields?: ObjectFieldMetadata[];
  showOutline?: boolean;
  searchable?: boolean;
  emptyState?: string;
};
```

Object editor behavior:

- Render grouped sections when `layout: "section"`.
- Render compact two-column grids only for small scalar fields.
- Never put long textareas in cramped grid columns.
- Auto-collapse advanced/internal groups.
- Show section field counts only when useful.
- Use deterministic group summaries.
- Support field search at large field counts.
- Support “Open full editor” for deeply nested fields.

Recommended default object behavior:

```txt
0-5 fields: render directly
6-12 fields: render grouped sections
13+ fields: render grouped sections with search/outline
Nested depth > 1: prefer collapsible cards or child editor links
```

---

## Better Array Editing

Arrays are one of the biggest sources of visual clutter.

Improve array cards with item summaries and safer default collapse behavior.

```ts
export type ArrayEditorFeatures = {
  addLabel?: string;
  reorderable?: boolean;
  duplicateable?: boolean;
  removable?: boolean;
  collapsibleItems?: boolean;
  defaultCollapsedItems?: boolean;
  minItems?: number;
  maxItems?: number;
  getItemTitle?: string;
  getItemSummary?: string;
  itemMetadata?: EditorControlMetadata & Record<string, unknown>;
  defaultItem?: unknown;
  itemDisplay?: "inline" | "card" | "child-editor";
  emptyState?: string;
};
```

Recommended behavior:

- Empty array shows a nice empty state and clear add button.
- Each item has a title, summary, and actions.
- Long object items default to collapsed cards.
- Very complex item types can use `itemDisplay: "child-editor"`.
- Reorder controls should be visible but not visually loud.
- Duplicate and remove should be secondary actions.
- Remove should be visually careful, especially for important entities.

Example item card:

```txt
[Room Feature: fireplace]
Warm stone fireplace with soot marks
[Edit] [Duplicate] [Remove]
```

---

## Better Discriminated Union Editing

Discriminated unions can be confusing if the branch selector looks like just another field.

Improve branch selection:

```ts
export type DiscriminatedUnionFeatures = {
  discriminator: string;
  options: Array<{
    label: string;
    value: string;
    description?: string;
    defaultValue?: Record<string, unknown>;
    fields?: ObjectFieldMetadata[];
    icon?: string;
    summary?: string;
  }>;
  display?: "select" | "cards" | "segmented";
  confirmBranchChange?: boolean;
};
```

Behavior:

- Use card display when options have meaningful descriptions.
- Use select display for compact/technical branches.
- If changing branch would discard fields, ask for confirmation.
- Show the active branch description directly under the selector.
- Render branch fields in a grouped object section.

---

## Better Condition Builder

Condition editing should be powerful but not visually intimidating.

Current condition-builder supports nested condition groups and common scalar condition shapes. Improve it with a deterministic summary, compact mode, and nested group cards.

```ts
export type ConditionBuilderFeatures = {
  allowNestedGroups?: boolean;
  maxDepth?: number;
  allowedConditionTypes?: string[];
  compact?: boolean;
  showSummary?: boolean;
  defaultCollapsedGroups?: boolean;
  operatorDisplay?: "select" | "segmented";
  addConditionLabel?: string;
  addGroupLabel?: string;
};
```

Recommended behavior:

- Always show an English summary.
- Use select boxes for operator pickers.
- Use existing select/entity/flag picker subcomponents instead of rebuilding custom pickers.
- Nested groups render as cards.
- Empty condition state says what it means.
- Add buttons should be explicit: “Add condition” and “Add group”.
- Max depth should protect the UI from unreadable nesting.
- Compact mode should reduce spacing but keep labels.

Example:

```txt
Allowed when
Player has flag `door_unlocked`
AND
Item `brass_key` is in inventory
```

Do not support non-deterministic summary generation. The same condition should always produce the same summary string.

---

## Better Effect List

Effect lists need scanability because order matters.

```ts
export type EffectListFeatures = {
  reorderable?: boolean;
  duplicateable?: boolean;
  removable?: boolean;
  allowedEffectTypes?: string[];
  collapsibleItems?: boolean;
  defaultCollapsedItems?: boolean;
  showSummary?: boolean;
  itemDisplay?: "compact" | "card";
};
```

Recommended behavior:

- Each effect row shows an order number.
- Each effect has a deterministic summary.
- Collapsed effect cards should still show what they do.
- Reorder buttons should be clear: move up/down.
- Use select boxes for effect type/operator choices.
- Use existing subcomponents for nested fields.
- Empty state should be friendly: “No effects run yet.”
- Destructive effects should have a warning tone if metadata marks them dangerous later.

Example:

```txt
1. Set `door_open` to true
2. Move player to `hallway`
3. Show message: “The door swings open.”
```

---

## Better Entity Picker and Flag Picker

Pickers should reduce cognitive load by showing meaningful labels, descriptions, and search.

```ts
export type PickerFeatures = {
  allowCreate?: boolean;
  showPreview?: boolean;
  clearButton?: boolean;
  searchable?: boolean;
  emptyState?: string;
  createLabel?: string;
};
```

Recommended picker behavior:

- Searchable by label, ID, aliases, and tags.
- Show ID in muted text.
- Show short preview/description when available.
- Allow clear only when field is not required.
- Missing selected value should show a warning but preserve the raw value.
- Create action should be explicit and route through context, not metadata.

Example missing value:

```txt
Missing room: kitchen_old
This reference still exists in data, but no matching room was found.
```

---

## Better Message and Code Preview Controls

### Message

The `message` control should support visually calm helper blocks.

```ts
features: {
  variant?: "info" | "warning" | "error" | "success" | "empty";
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  icon?: string;
}
```

Rules:

- Use `info` for guidance.
- Use `warning` for fixable problems.
- Use `error` for blocked/invalid state.
- Use `empty` for quiet placeholder states.
- Do not overuse warnings.

### Code Preview

The `code-preview` control should be useful without dominating the editor.

```ts
features: {
  language?: "json" | "ts" | "text";
  copyButton?: boolean;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  maxHeight?: number;
  label?: string;
}
```

Recommended behavior:

- Default collapsed unless it is the main content.
- Use max height.
- Copy button should be visible.
- JSON should be formatted.
- Errors in serialization should show a message control, not crash.

---

## FieldShell Improvements

Because every visible control renders through `FieldShell`, this is the highest-leverage polish point.

Add slots:

```ts
export type FieldShellSlots = {
  headerAction?: React.ReactNode;
  summary?: React.ReactNode;
  footer?: React.ReactNode;
  validation?: React.ReactNode;
  toolbar?: React.ReactNode;
};
```

Improve `FieldShell` layout:

```txt
Label / Required / Status / Header Action
Description
Summary
Control
Warnings / Errors
Footer help
```

FieldShell should support:

- consistent label typography
- optional description
- optional summary
- error/warning display
- required marker
- disabled/readonly visual state
- action slot, such as copy/clear/open/edit
- footer slot for small hints
- compact density
- focus-within styling
- stable spacing when descriptions are omitted

Rules:

- Hide title/description if metadata does not provide them.
- Do not reserve blank space for missing descriptions.
- Keep errors close to the field.
- Use warning/error icons sparingly.
- Required marker should be clear but not noisy.

---

## Visual Design Direction

The editor should feel like a polished authoring tool: warm, readable, slightly tactile, and not generic admin-panel flat.

### Layout

Use:

- cards for major sections
- soft borders
- subtle background layering
- generous vertical rhythm
- calm muted helper text
- sticky nested editor header
- clear focus rings

Avoid:

- dense walls of equal-weight fields
- excessive borders inside borders
- loud buttons everywhere
- long labels wrapping awkwardly
- tiny click targets
- controls that look disabled when they are merely quiet

### Density

Support two density modes:

```ts
type EditorDensity = "comfortable" | "compact";
```

Comfortable mode:

- best for full-page editing
- larger gaps
- more visible descriptions
- expanded summaries

Compact mode:

- best for sidebars
- shorter descriptions
- tighter controls
- collapsed advanced sections

### Tone

Continue using the existing appearance model, but make tone/chrome do useful work.

```ts
type EditorControlTone = "default" | "quiet" | "terminal" | "paper" | "panel";

type EditorControlChrome = "field" | "card" | "inline" | "compact" | "bare";
```

Recommended mapping:

- `field`: normal form row
- `card`: nested object/array item
- `inline`: compact child control
- `compact`: dense side panel control
- `bare`: hidden chrome for custom layouts

---

## Validation and Warnings

Validation should help users fix things without making the whole editor feel broken.

Add field-level validation display:

```ts
error?: string;
warnings?: string[];
```

Already part of `EditorControlProps`, but the visual display should be standardized in `FieldShell`.

Add editor-level validation summary:

```ts
export type EditorValidationSummary = {
  errors: Array<{
    path: EditorPath;
    message: string;
    label?: string;
  }>;
  warnings: Array<{
    path: EditorPath;
    message: string;
    label?: string;
  }>;
};
```

Top-level summary behavior:

- Show count of errors/warnings.
- Clicking a validation item scrolls/focuses the field.
- Collapsed sections with errors should show an error badge.
- Child editor breadcrumbs should show if the active child has issues.
- Missing references should warn, not crash.
- Invalid URLs/IDs should preserve user input while warning.

---

## Empty States

Empty states should tell users what will happen next.

Bad:

```txt
No items.
```

Good:

```txt
No effects yet.
Add an effect to change flags, move the player, or show a message when this command runs.
[Add effect]
```

Add per-control empty copy:

```ts
emptyState?: {
  title?: string;
  description?: string;
  actionLabel?: string;
};
```

Use for:

- arrays
- string-list
- tag-list
- effect-list
- condition-builder
- link-list
- entity-picker
- flag-picker
- object preview fallback

---

## Field Search

For large editors, add optional field search.

```ts
export type EditorSearchFeatures = {
  enabled?: boolean;
  placeholder?: string;
  includeDescriptions?: boolean;
  includeHiddenAdvanced?: boolean;
};
```

Behavior:

- Search by title, key, description, aliases, and group title.
- Matched fields temporarily reveal collapsed parent sections.
- Non-matching sections collapse or dim.
- Search should not mutate disclosure state permanently.
- Keep it local to the active editor view.

---

## Outline Navigation

For editors with many groups, add an outline.

```ts
export type EditorOutlineFeatures = {
  enabled?: boolean;
  sticky?: boolean;
  showCounts?: boolean;
  showValidationBadges?: boolean;
};
```

Outline example:

```txt
Identity
Description
Connections     2 warnings
Logic
Advanced
```

Clicking an outline item scrolls to that section.

In sidebars, the outline can become a small segmented/nav row instead of a side rail.

---

## Recommended Room Editor Layout

Example priority plan for `RoomSchema`:

```txt
Identity
  id
  name/title if present
  aliases
  tags

Description
  description.default
  description.variants

Connections
  exits / linked connections / return exits

Features
  room features
  objects/items in room if present

Logic
  state defaults
  conditions
  effects/events

Advanced
  coordinates
  internal metadata
  migration/generated fields
```

Recommended defaults:

- Identity expanded
- Description expanded
- Connections expanded
- Features collapsed if many
- Logic collapsed by default
- Advanced collapsed by default
- Internal metadata hidden unless explicitly enabled

---

## Metadata Additions Summary

Add these optional shared metadata fields:

```ts
export type EditorControlMetadata = {
  type: EditorControlType;
  title?: string;
  description?: string;
  placeholder?: string;
  disabled?: boolean;
  readonly?: boolean;
  hidden?: boolean;
  required?: boolean;
  appearance?: EditorControlAppearance;
  className?: string;
  testId?: string;

  priority?: {
    order?: number;
    group?: string;
    pinned?: boolean;
    importance?: "primary" | "secondary" | "advanced" | "internal";
  };

  disclosure?: {
    defaultCollapsed?: boolean;
    collapsible?: boolean;
    preview?: "none" | "summary" | "count" | "first-item" | "custom";
    advanced?: boolean;
  };

  summary?: {
    summary?: string;
    summaryTemplate?: string;
    emptySummary?: string;
    warningSummary?: string;
  };
};
```

Add editor/object-level grouping:

```ts
export type EditorFieldGroupMetadata = {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  defaultCollapsed?: boolean;
  collapsible?: boolean;
  importance?: "primary" | "secondary" | "advanced" | "internal";
  order?: number;
};
```

Add navigation context:

```ts
export type EditorNavigationContext = {
  openChildEditor?: (entry: EditorNavigationEntry) => void;
  goBack?: () => void;
  canGoBack?: boolean;
  breadcrumbs?: Array<{
    label: string;
    path?: EditorPath;
  }>;
};
```

---

## Implementation Plan

### Phase 1: Foundation polish

1. Update `FieldShell` with summary/footer/action/validation slots.
2. Add shared metadata types for `priority`, `disclosure`, and `summary`.
3. Add sorting logic for pinned/order/importance.
4. Add object section rendering.
5. Add better empty states.
6. Add validation badges on collapsed sections.

### Phase 2: Reduce nested overwhelm

1. Add Universal Editor shell header.
2. Add section outline for large objects.
3. Add local field search.
4. Add child editor navigation stack.
5. Add breadcrumbs/back behavior.
6. Ensure child edits write through to the root value by path.

### Phase 3: Improve complex controls

1. Improve array item cards with deterministic summaries.
2. Improve discriminated-union branch selector.
3. Improve condition-builder summaries and nested group cards.
4. Improve effect-list summaries and order affordances.
5. Improve entity-picker/flag-picker search and missing-value warnings.
6. Add `link-list` control using the existing link-list spec.

### Phase 4: Visual finish

1. Refine spacing, borders, hover states, and focus rings.
2. Add compact/comfortable density handling.
3. Make advanced sections visually quieter.
4. Make clickable editor links clearly clickable.
5. Add polished loading/empty/error states.
6. Review all `/test/*` matrix pages for consistency.

---

## Files Codex Should Inspect First

```txt
src/types/universalEditorTypes.ts
src/components/editor/universal/UniversalEditor.tsx
src/components/editor/universal/renderEditorControl.tsx
src/components/editor/universal/FieldShell.tsx
src/components/editor/universal/ObjectEditor.tsx
src/components/editor/universal/ArrayEditor.tsx
src/components/editor/universal/DiscriminatedUnionEditor.tsx
src/components/editor/universal/ConditionBuilderEditor.tsx
src/components/editor/universal/EffectListEditor.tsx
src/components/editor/universal/EntityPickerEditor.tsx
src/components/editor/universal/FlagPickerEditor.tsx
src/components/editor/universal/TagListEditor.tsx
src/components/editor/universal/StringListEditor.tsx
src/utils/resolveEditorMetadata.ts
src/utils/buildEditorRegistries.ts
src/utils/editorPathTypes.ts
src/schemas/editorSchemaHelpers.ts
src/schemas/worldSchema.ts
src/schemas/roomSchema.ts
```

If names differ, search for:

```txt
EditorControlMetadata
EditorControlContext
EditorControlProps
FieldShell
renderEditorControl
resolveEditorMetadata
metadata.features
condition-builder
effect-list
entity-picker
flag-picker
```

---

## Acceptance Criteria

The Universal Editor improvement pass is complete when:

- Important fields can be pinned and ordered independently of schema order.
- Object fields can be grouped into titled sections.
- Advanced groups can default collapsed.
- Complex fields show deterministic summaries.
- Arrays render readable item cards.
- Conditions and effects show clear English summaries.
- Entity/flag pickers have better search/preview/missing-value states.
- The Universal Editor shell has a clear header, optional outline, and optional search.
- Child editors can replace the current editor content and navigate back.
- Validation appears both near fields and in collapsed section summaries.
- Empty states are specific and action-oriented.
- `FieldShell` provides consistent title, description, summary, action, footer, and validation layout.
- `link-list` is integrated as a real control.
- All controls still use `metadata.features` for control-specific behavior and `context` for runtime services.
- Existing controls continue to work without requiring new metadata.
- Test pages demonstrate comfortable and compact layouts.
- The full editor feels calmer, more readable, and harder to get lost in.

---

## Avoid These Mistakes

- Do not solve overwhelm by hiding everything.
- Do not put live registries or app state into schema metadata.
- Do not make field ordering require schema reordering.
- Do not render every nested object inline by default.
- Do not use generated/nondeterministic summaries.
- Do not make readonly mode block navigation or preview actions.
- Do not let child editor state drift from root editor state.
- Do not crash on missing entity IDs, paths, flags, or links.
- Do not make advanced fields impossible to find.
- Do not make compact mode too cramped to read.
- Do not rebuild select/picker logic inside every specialized control.
- Do not let visual polish depend on every schema having perfect metadata.

---

## Final Recommendation

The highest-impact improvement is to make `object` + `FieldShell` smarter before polishing every individual control.

Order of importance:

1. `FieldShell` slots and validation display.
2. field priority/order metadata.
3. section/group rendering for objects.
4. summaries for object/array/condition/effect controls.
5. child editor navigation.
6. better array cards.
7. improved picker empty/missing states.
8. link-list integration.
9. field search and outline.
10. visual density polish.

That order gives the editor immediate relief from “everything everywhere all at once” while preserving the clean metadata/context architecture already in place.
