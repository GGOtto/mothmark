# Refactor Changes

This file documents the implementation work performed from `docs/README_refactor_suggestions.md`.

## Completed Changes

### Added first-class editor catalogs

- Added `src/schemas/editorCatalogs.ts`.
- Moved condition type options, condition operation options, group operators, comparison operators, effect type options, and effect operation options into the shared catalog module.
- Added stable catalog source IDs such as `schema.condition.types`, `schema.condition.flag.operations`, `schema.effect.types`, and `schema.effect.flag.operations`.
- Exposed all catalog options through `editorOptionCatalogs` so editor contexts can resolve them by source ID.

### Centralized condition and effect defaults

- Added `createDefaultConditionValue` and `createDefaultEffectValue` in `src/schemas/editorCatalogs.ts`.
- Updated `ConditionBuilderEditor` and `EffectListEditor` to delegate default object creation to the catalog module.
- Kept the existing exported `createDefaultCondition` wrapper for compatibility with current imports.

### Reduced schema knowledge in controls

- Removed the large local fallback condition/effect option lists from `ConditionBuilderEditor`.
- Removed the large local fallback effect type and operation lists from `EffectListEditor`.
- The controls now keep UI behavior, list mechanics, rendering, and summary display while sourcing domain option/default knowledge from `src/schemas/editorCatalogs.ts`.

### Attached catalog source IDs from schema helpers

- Updated `editorCondition`, `editorConditionList`, and `editorEffects` in `src/schemas/editorSchemaHelpers.ts`.
- These helpers now attach default `features` with condition/effect option source IDs.
- Existing metadata can still override those feature values.

### Wired catalogs into the live UniversalEditor context

- Updated `src/components/editor/universal/UniversalEditor.tsx` so `context.getOptionList(source)` first checks `editorOptionCatalogs`.
- Existing world-derived option sources for rooms, flags, and counters remain unchanged.

## Notes

- `src/schemas/editorSchemaHelpers.ts` already contained an unrelated local change to `editorAliasList`, switching aliases from `string-list` to `tag-list`. That pre-existing change was preserved.
- Runtime parser/resolver schemas, alias index work, world validation, condition evaluator expansion, and registry migration remain future work from the refactor suggestions document.
