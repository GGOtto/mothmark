# Link List Editor Spec for Codex

## Goal

Build a `link-list` Universal Editor control that can render and edit lists of clickable links. A link can target:

1. An internal app route, built by adding a metadata-supplied nav string to the current site base URL.
2. An external URL, opened as-is.
3. An editor target, which replaces the current Universal Editor content with an editor for a child target.

Editor links are special. They do not navigate the browser. They push a child editor view inside the Universal Editor shell. The child editor can represent an entity, a specific nested path/control, or a condition/effect editor target defined by metadata. A back link appears at the top of the child editor unless metadata disables it.

This spec is designed to reduce Codex token use: follow the file list and acceptance checklist before exploring broadly.

---

## Existing architecture to preserve

The current Universal Editor docs establish these rules:

- All visible controls receive `EditorControlProps`.
- All visible controls render through `FieldShell`.
- Shared visual metadata stays on `EditorControlMetadata`.
- Control-specific behavior goes in `metadata.features`.
- Runtime data and services belong in `context`, not schema metadata.
- Appearance resolution is `default appearance < context.appearance < metadata.appearance`.
- Entity/flag/counter lists come from registries/context, not from static metadata.

Do not put live world lists, entity option arrays, mutable editor state, or parent navigation state inside schema metadata.

---

## Naming

Use the control type:

```ts
type: "link-list";
```

Add it to the central `EditorControlType` union and `renderEditorControl` switch.

Recommended component files:

```txt
src/components/editor/universal/LinkListEditor.tsx
src/components/editor/universal/LinkListEditor.scss
src/components/editor/universal/LinkListItem.tsx
```

`LinkListItem.tsx` is optional but recommended. It keeps a single clickable chip/row small and reusable.

Recommended test/demo files:

```txt
src/app/test/link-list/page.tsx
src/app/test/link-list/linkListTestData.ts
```

Recommended type/context updates:

```txt
src/types/universalEditorTypes.ts
src/components/editor/universal/renderEditorControl.tsx
src/components/editor/universal/UniversalEditor.tsx
```

---

## Value model

Support both list and single-link mode without making consumers wrap one link in an array by hand.

```ts
export type LinkListLinkType = "internal-link" | "external-link" | "editor";

export type EditorLinkRef = {
  type: string;
  id: string;
  label?: string;
};

export type LinkListValue = string[] | EditorLinkRef[];
export type SingleLinkValue = string | EditorLinkRef | null | undefined;
```

Interpretation:

- `internal-link`: value items are strings, usually route fragments such as `/editor/world` or `rooms/kitchen`.
- `external-link`: value items are URL strings.
- `editor`: value items are `EditorLinkRef` objects with `{ type, id }`.

For `mode: "single-link"`, the value should be a single `string` for internal/external links or a single `EditorLinkRef` for editor links.

Do not store derived labels in the canonical value unless the caller already has them. Labels can be resolved from metadata/context at render time.

---

## Metadata contract

Replace the stub metadata with this shape:

```ts
export type LinkListMode = "read" | "edit" | "single-link";
export type LinkListDisplay = "inline" | "block" | "compact";
export type LinkListOpenBehavior = "same-tab" | "new-tab";

export type EditorLinkTargetKind = "entity" | "path" | "control" | "condition" | "effect";

export type EditorLinkTargetMetadata = {
  kind: EditorLinkTargetKind;

  // Required for entity targets. Example: "room", "connection", "object", "feature".
  entityType?: EntityType;

  // Optional fixed path for a nested editor target. Can contain templates.
  // Example: ["rooms", "{id}"] or ["authoredCommands", "{id}", "conditions"]
  path?: EditorPath;

  // Optional schema metadata key or control override when the target is not entity-based.
  schemaKey?: string;
  controlType?: EditorControlType;

  // Used when a target is created inline instead of selected from existing records.
  create?: {
    enabled?: boolean;
    buttonLabel?: string;
    defaultLabel?: string;
  };

  // Defaults to true.
  showBackLink?: boolean;

  // Optional custom copy.
  backLabel?: string;
  emptyLabel?: string;
};

export type LinkListFeatures = {
  mode?: LinkListMode;
  linkType: LinkListLinkType;

  display?: LinkListDisplay;
  clearButton?: boolean;
  removeButton?: boolean;
  addButton?: boolean;

  // Internal/external link behavior.
  openBehavior?: LinkListOpenBehavior;
  basePath?: string;
  normalizeInternalPath?: boolean;
  validateExternalUrl?: boolean;

  // Editor link behavior.
  editorTarget?: EditorLinkTargetMetadata;

  // UI copy.
  addLabel?: string;
  inputPlaceholder?: string;
  pickerPlaceholder?: string;
  emptyText?: string;
  clickHint?: string;
};

export type LinkListControlMetadata = EditorControlMetadata & {
  type: "link-list";
  features: LinkListFeatures;
};
```

Notes:

- `features.linkType` is required.
- `features.editorTarget` is required when `linkType === "editor"`.
- `showBackLink` defaults to true.
- `mode` defaults to `read` if omitted.
- `removeButton` defaults to true in `edit` mode and false in `read` mode.
- `addButton` defaults to true in `edit` mode.
- `clickHint` should default to clear copy such as `Open` or `Edit` depending on link type.

---

## Runtime context additions

Add editor navigation services to `EditorControlContext`. Keep them optional so old controls do not break.

```ts
export type EditorNavigationEntry = {
  title?: string;
  description?: string;
  schema: z.ZodTypeAny;
  value: unknown;
  path: EditorPath;
  metadata?: EditorControlMetadata;
};

export type EditorLinkOpenRequest = {
  ref: EditorLinkRef;
  target: EditorLinkTargetMetadata;
  sourcePath: EditorPath;
};

export type EditorCreateLinkRequest = {
  target: EditorLinkTargetMetadata;
  sourcePath: EditorPath;
};

export type EditorNavigationContext = {
  openEditorLink?: (request: EditorLinkOpenRequest) => void;
  createEditorLink?: (request: EditorCreateLinkRequest) => EditorLinkRef | undefined;
  resolveEditorLinkLabel?: (ref: EditorLinkRef, target?: EditorLinkTargetMetadata) => string;
  resolveEditorLinkDescription?: (
    ref: EditorLinkRef,
    target?: EditorLinkTargetMetadata,
  ) => string | undefined;
};
```

Then add this field to `EditorControlContext`:

```ts
editorNavigation?: EditorNavigationContext;
```

The link control calls `context.editorNavigation.openEditorLink(...)` for editor links. It should not know how to build child schemas itself.

---

## UniversalEditor child-view behavior

`UniversalEditor` should own an internal navigation stack. This keeps child editor replacement local to the editor shell and avoids global app routing.

Add state:

```ts
type UniversalEditorView = {
  title?: string;
  description?: string;
  schema: z.ZodTypeAny;
  value: unknown;
  path: EditorPath;
  metadata?: EditorControlMetadata;
};

const [viewStack, setViewStack] = useState<UniversalEditorView[]>([]);
```

Render behavior:

- If `viewStack` is empty, render the current root metadata/value exactly as today.
- If `viewStack` has entries, render the last entry instead of the root editor content.
- If the active view allows back navigation, render a small top bar above the active editor with a back button/link.
- Back pops one entry from `viewStack`.
- The child editor should still use the same `context`, `appearance`, disabled/readonly state, and `setValueAtPath` mechanism.

Important: child view `onChange` should update the original root value by path, not only local stack state.

Pseudo-flow:

```ts
function openEditorLink(request: EditorLinkOpenRequest) {
  const entry = resolveEditorNavigationEntry(request, rootSchema, value, metadata, registries);
  if (!entry) return;
  setViewStack((views) => [...views, entry]);
}

function changeActiveView(nextValue: unknown) {
  const activeView = viewStack.at(-1);
  if (!activeView) return;
  onChange(setValueAtPath(value, activeView.path, nextValue) as TValue);
}
```

Because `value` changes from the parent, recompute the active view value from `getValueAtPath(value, activeView.path)` during render. Do not let stack entries hold stale values longer than needed.

---

## Resolving editor targets

Codex should research the existing schema and metadata resolver before implementing final target resolution. Start with entity targets and path targets because those are most important.

### Entity target resolution

For an editor ref:

```ts
{ type: "room", id: "kitchen" }
```

and metadata:

```ts
editorTarget: {
  kind: "entity",
  entityType: "room",
  path: ["rooms", "{id}"]
}
```

Resolution should:

1. Confirm the ref type matches `entityType` when `entityType` is provided.
2. Find the entity index by ID using the root value/world.
3. Replace `"{id}"` path template with the actual array index path if needed.
4. Resolve the schema for that path.
5. Resolve metadata for that schema.
6. Push a child view.

Prefer real paths like `["rooms", index]` for editing, not display paths like `["rooms", id]`, because `setValueAtPath` currently writes arrays by numeric index.

### Path/control target resolution

For a metadata-defined target to a nested control, the metadata should provide a concrete `path` or enough information to derive one.

Examples:

```ts
editorTarget: {
  kind: "path",
  path: ["rooms", 0, "description"]
}
```

```ts
editorTarget: {
  kind: "condition",
  path: ["authoredCommands", 0, "conditions", 2]
}
```

This is internal-only metadata. Users should not type arbitrary paths.

### Condition/effect targets

Condition and effect links should work the same way as other path targets once their location is known. The only special requirement is display labeling:

- Use deterministic summaries when available.
- Fall back to `Condition`, `Effect`, or the operation name.

---

## LinkListEditor behavior

### Read mode

`mode: "read"` renders an unchanging clickable list.

- No text input.
- No remove buttons.
- Each item is visibly clickable.
- Internal/external links use anchors.
- Editor links use buttons.
- Empty state uses `features.emptyText` or a quiet default.

### Edit mode

`mode: "edit"` renders a tag-like list.

For internal/external links:

- Existing links are chips with clickable labels.
- Each chip can show an `x` remove button when editable.
- The add field is a normal text input.
- Enter adds the typed value.
- Blur should not auto-add unless existing tag-list behavior does this already.
- Optional clear button removes all values.
- External URLs should be validated enough to warn on obvious invalid input.

For editor links with existing selectable entities:

- Existing refs are chips with clickable labels.
- Each chip can show an `x` remove button when editable.
- Add uses the existing entity picker service or existing `EntityPicker` component if available.
- The picker should filter by `features.editorTarget.entityType`.
- Do not allow duplicates unless a future metadata option explicitly permits them.

For editor links that create new child values instead of selecting existing ones:

- Show an add button.
- Clicking add calls `context.editorNavigation.createEditorLink(...)`.
- If the create service returns a ref, append it to the value and optionally open it.
- Use default creation helpers if present, but do not hard-code large default objects inside `LinkListEditor`.

### Single-link mode

`mode: "single-link"` renders one link editor or one clickable link.

- Value is a single string/ref, not an array.
- Internal/external link uses a normal text box when editable.
- Editor link uses entity picker or add button when editable.
- When a value exists, render it as visibly clickable.
- When a value does not exist, render placeholder/empty copy.

---

## Accessibility and click affordance

Every link item should clearly look clickable. Use at least two of these:

- pointer cursor
- underline or dotted underline on label
- small leading icon or suffix arrow
- hover/focus raised background
- visible keyboard focus ring
- `aria-label` that includes the target label and action

Use real `<a>` elements for browser navigation links. Use `<button type="button">` for editor links.

Keyboard behavior:

- Tab reaches every clickable item and remove button.
- Enter/Space opens editor links.
- Enter in text input adds a link in edit mode.
- Escape in a child editor view can optionally go back later, but do not add this unless there is already a keyboard shortcut convention.

External link safety:

```tsx
<a target="_blank" rel="noreferrer noopener">
```

Use `new-tab` only when metadata requests it. Same-tab is fine by default for internal links.

---

## Styling

Rename the copied tag-list class names. Do not keep `.tagListEditor` in `LinkListEditor.scss`.

Recommended classes:

```txt
.linkListEditor
.linkListEditor--inline
.linkListEditor--block
.linkListEditor--compact
.linkListEditor__items
.linkListEditor__item
.linkListEditor__itemButton
.linkListEditor__itemAnchor
.linkListEditor__itemText
.linkListEditor__itemHint
.linkListEditor__removeButton
.linkListEditor__inputRow
.linkListEditor__input
.linkListEditor__addButton
.linkListEditor__empty
.linkListEditor__warning
.linkListEditor__childBar
.linkListEditor__backButton
```

Use existing field CSS variables:

```txt
--field-text
--field-muted
--field-soft
--field-border
--field-bg
--field-bg-raised
--field-bg-strong
--field-danger-bg
--field-font-family
```

Keep the look consistent with tag-list and field controls, but add a stronger click affordance than plain tags. A subtle arrow, link underline, or `Edit` hint is enough.

---

## renderEditorControl update

Add a case:

```tsx
case "link-list":
  return <LinkListEditor {...props} />;
```

Also add `link-list` to any test control registry or docs-driven control list.

---

## Schema helper update

Add an `editor.linkList(...)` helper in `src/schemas/editorSchemaHelpers.ts` if helpers are the current pattern.

Possible helpers:

```ts
editor.linkList(schema, metadata);
editor.internalLinkList(metadata);
editor.externalLinkList(metadata);
editor.editorLinkList(entityType, metadata);
editor.singleEditorLink(entityType, metadata);
```

Keep helpers thin. They should attach metadata only. They should not capture world data.

---

## Suggested implementation order

1. Add `link-list` to shared control type unions.
2. Replace the `LinkListEditor.tsx` stub with real link-list types and component shell.
3. Rename SCSS classes from `tagListEditor` to `linkListEditor`.
4. Implement read mode for internal/external/editor links.
5. Implement edit mode for string links with text input add/remove.
6. Implement editor link display using labels from `context.editorNavigation` and registries.
7. Add optional `LinkListItem.tsx` if the component starts getting large.
8. Add UniversalEditor view stack and `editorNavigation.openEditorLink`.
9. Implement entity target resolution for rooms first.
10. Generalize target resolution to other entity types via registries/path mapping.
11. Implement path/control/condition/effect target support.
12. Implement create/add behavior for metadata-defined child targets.
13. Add `/test/link-list` matrix page.
14. Add targeted tests.
15. Update Universal Editor docs/control list.

---

## Files to inspect before coding

Codex should inspect these files first:

```txt
src/types/universalEditorTypes.ts
src/components/editor/universal/UniversalEditor.tsx
src/components/editor/universal/renderEditorControl.tsx
src/components/editor/universal/FieldShell.tsx
src/components/editor/universal/TagListEditor.tsx
src/components/editor/universal/TagListEditor.scss
src/components/editor/universal/EntityPickerEditor.tsx
src/components/editor/universal/ConditionBuilderEditor.tsx
src/components/editor/universal/EffectListEditor.tsx
src/utils/resolveEditorMetadata.ts
src/utils/buildEditorRegistries.ts
src/schemas/editorSchemaHelpers.ts
src/schemas/worldSchema.ts
```

If some names differ, search for:

```txt
EditorControlType
EditorControlContext
EditorControlProps
registerEntityPicker
renderEditorControl
resolveEditorMetadata
entity-picker
condition-builder
effect-list
```

---

## Things Codex should research in-repo

1. How schemas currently attach editor metadata.
2. Whether path-to-schema resolution already exists. If not, implement a tiny local utility.
3. Whether `EntityPickerEditor` is reusable as a child component or only renderable through `renderEditorControl`.
4. How `ConditionBuilderEditor` stores recursive/nested conditions.
5. Whether default entity creation helpers exist, such as `createDefaultEntity`.
6. Whether test pages use centralized control matrix data.
7. Whether `FieldShell` already exposes any action/footer slot that can host link hints.
8. Whether warnings/errors are already generated for invalid entity IDs.

---

## Path-to-schema utility

If no utility exists, add one near metadata resolution:

```ts
export function getSchemaAtPath(schema: z.ZodTypeAny, path: EditorPath): z.ZodTypeAny | undefined {
  // Handle ZodObject shape fields.
  // Handle ZodArray element schema for numeric path segments.
  // Handle ZodDefault/ZodOptional/ZodNullable by unwrapping.
  // Handle discriminated unions only when enough value is supplied, if needed later.
}
```

Keep this utility conservative. It is better to return `undefined` and avoid opening than to guess the wrong child schema.

---

## Entity path resolution utility

Add a helper in or near `UniversalEditor.tsx`:

```ts
function getEntityPathByRef(value: unknown, ref: EditorLinkRef): EditorPath | undefined {
  if (ref.type === "room") return findArrayEntityPath(value, ["rooms"], ref.id);
  if (ref.type === "connection") return findArrayEntityPath(value, ["connections"], ref.id);
  if (ref.type === "command") return findArrayEntityPath(value, ["authoredCommands"], ref.id);
  // Expand as schemas support more top-level entity collections.
}
```

For nested entities such as room features, the metadata should provide enough parent context. Do not scan the whole world and mutate the first matching nested ID unless IDs are globally guaranteed.

---

## Invalid/missing target behavior

If a link cannot resolve:

- Render the item disabled-looking but still visible.
- Show a small warning such as `Missing target: room/kitchen`.
- Do not throw.
- Do not remove it automatically.
- In edit mode, allow removal.

For external links:

- Invalid URL input should not crash.
- In read mode, invalid URLs render as disabled text or a button that does nothing with a warning.

For internal links:

- Normalize duplicate slashes if `normalizeInternalPath !== false`.
- Preserve query/hash strings.

---

## Testing checklist

Add tests for:

- read mode renders internal links as anchors.
- read mode renders external links as anchors with safe rel when new-tab.
- read mode renders editor links as buttons.
- clicking an editor link calls `openEditorLink` with ref, target, and source path.
- edit mode adds an internal link from text input on Enter.
- edit mode removes a link with the remove button.
- edit mode does not add duplicates.
- readonly disables add/remove but still allows opening links.
- disabled disables add/remove and should also disable editor opening.
- single-link mode writes a single string/ref instead of an array.
- missing editor target shows warning and does not throw.
- UniversalEditor back link returns to parent editor.
- child editor changes write through to root value at the correct path.

---

## Acceptance criteria

The feature is complete when:

- `link-list` is a supported Universal Editor control.
- It supports internal, external, and editor links.
- It supports read, edit, and single-link modes.
- Internal/external edit fields use normal text input.
- Editor edit fields use entity picker for existing entity refs.
- Editor targets that must be filled out use an add button.
- Editor links replace the current Universal Editor body with the target child editor.
- Child editor has a back link by default.
- Back link can be disabled by metadata.
- Link items visibly communicate clickability.
- Missing targets are handled gracefully.
- Tests/demo page cover the main modes.
- Docs/control list mention the new control.

---

## Feature-complete additions worth considering

These are not all required for the first pass, but they make the control durable:

1. `allowDuplicates?: boolean`, default false.
2. `maxItems?: number` for constrained lists.
3. `sort?: "manual" | "label" | "none"`, default manual.
4. Drag reorder for edit mode later, if array order matters.
5. `openAfterCreate?: boolean`, default true for editor-created children.
6. `confirmRemove?: boolean` for destructive nested links.
7. Label override function in context for condition/effect summaries.
8. Per-item warning support from validation issues.
9. Breadcrumb stack for nested child editors, not just one Back button.
10. Optional `copyLinkButton` for internal/external links.
11. Optional `previewOnHover` later for condition/effect summaries.
12. Better URL normalization for external links using `URL` constructor.

---

## Avoid these mistakes

- Do not keep the copied `ToggleEditor` types in `LinkListEditor.tsx`.
- Do not keep `.tagListEditor` class names in link-list SCSS.
- Do not put entity option lists in metadata.
- Do not browser-navigate for editor links.
- Do not mutate root values from inside a link item directly; use `onChange` or context setters.
- Do not guess nested entity paths when IDs are only locally unique.
- Do not make child editor state separate from the root editor value.
- Do not block link opening in readonly mode; readonly means no editing, not no navigation.
- Do not throw for missing targets.

---

## Minimal first-pass metadata examples

### Internal links

```ts
{
  type: "link-list",
  title: "Related pages",
  features: {
    mode: "edit",
    linkType: "internal-link",
    display: "inline",
    inputPlaceholder: "Add internal path..."
  }
}
```

Value:

```ts
["/editor/world", "/editor/issues"];
```

### External links

```ts
{
  type: "link-list",
  title: "References",
  features: {
    mode: "edit",
    linkType: "external-link",
    openBehavior: "new-tab",
    validateExternalUrl: true,
    inputPlaceholder: "https://..."
  }
}
```

Value:

```ts
["https://example.com"];
```

### Editor links to rooms

```ts
{
  type: "link-list",
  title: "Connected rooms",
  features: {
    mode: "edit",
    linkType: "editor",
    display: "inline",
    pickerPlaceholder: "Choose a room...",
    editorTarget: {
      kind: "entity",
      entityType: "room",
      showBackLink: true,
      backLabel: "Back to parent editor"
    }
  }
}
```

Value:

```ts
[
  {type: "room", id: "kitchen"},
  {type: "room", id: "library"},
];
```

### Editor link that creates a condition child

```ts
{
  type: "link-list",
  title: "Conditions",
  features: {
    mode: "edit",
    linkType: "editor",
    addLabel: "Add condition",
    editorTarget: {
      kind: "condition",
      path: ["authoredCommands", 0, "conditions"],
      create: {
        enabled: true,
        buttonLabel: "Add condition"
      },
      showBackLink: true
    }
  }
}
```

For this case, the add action should create a new condition at the metadata-defined path, then open the newly created child editor.
