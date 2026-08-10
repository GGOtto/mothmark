# Command variables

This folder owns command-variable authoring and interpolation end to end. The rest of the app only
passes a command-scoped catalog into `UniversalEditor`, stores bindings on command templates, and
calls the runtime resolver.

## Stored text syntax

Text stores stable command-block IDs, never author-facing roles:

```text
{variable <command-block-id>}
{variable <command-block-id> name}
{variable <command-block-id> description}
{variable <command-block-id> text}
```

`name` and `description` are entity projections. `text` is the player's entered text and is the
only value available from the block whose fallback is running. The editor renders these strings as
atomic colored chips and serializes them back to this syntax.

Every matched block exposes the player's entered text through the `text` projection, including
phrase and relation blocks. Non-structural blocks also expose their typed value, and targets expose
their resolved entity, current name, and current description.

## Whole-field bindings

Non-text controls use `commandVariables` on the containing command condition or effect:

```ts
{
  blockId: toID("command-block", "amount"),
  field: "value",
}
```

The catalog and editor control metadata are intersected before a choice is shown. Boolean fields
only receive boolean variables, numeric fields only numbers, directions only directions, and entity
pickers only compatible targets. The authored field stays in place as the fallback value.
That fallback is used only when the command did not produce a value for the bound block; removing
the variable makes the authored value unconditional again.

## Files

- `model.ts` builds the catalog and owns compatibility rules.
- `syntax.ts` parses and serializes stable inline tokens.
- `runtime.ts` resolves scalar values, entered text, and current player-facing entity state.
- `VariableTextEditor.tsx` renders the token-aware text surface.
- `VariableFieldEditor.tsx` wraps typed controls with binding and fallback UI.
- `VariableMenu.tsx`, `VariableToken.tsx`, and `variableEditor.scss` own the shared presentation.
- Tests beside these files cover syntax, catalogs, runtime behavior, UI, and the player path.
