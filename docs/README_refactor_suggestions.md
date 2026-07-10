# Refactor Suggestions

## Executive Summary

Mothmark has the right long-term direction already: Zod schemas define the data contract, editor metadata describes how that data should be edited, and UniversalEditor renders controls from that resolved metadata. The current tech debt is mostly from the transition period. A lot of important domain knowledge now exists in two places:

- schemas and editor metadata helpers
- control-local fallback lists, default factories, summary helpers, and ad hoc world lookups

The most valuable refactor is to make schemas the source of truth for domain shape, option catalogs, defaults, summaries, validation, and picker targeting. Controls should become mostly generic renderers that consume resolved metadata, option sources, registries, and schema-derived child metadata.

This document recommends what to add, what to refactor, what to fix, and how to resolve the current TODOs.

## Current Architecture Smells

### 1. Controls Still Encode Schema Knowledge

`src/components/editor/universal/ConditionBuilderEditor.tsx` and `src/components/editor/universal/EffectListEditor.tsx` define fallback condition/effect type lists, operation lists, default object builders, and summary-related behavior.

That logic overlaps with:

- `src/schemas/conditionSchema.ts`
- `src/schemas/effectSchema.ts`
- `src/schemas/editorSchemaHelpers.ts`
- `src/utils/resolveEditorMetadata.ts`
- `src/utils/universalEditorUtils.ts`

The result is expensive drift. Adding a new condition or effect often requires touching the schema, one or more controls, summaries, tests, and maybe metadata helpers.

Recommended target: controls render resolved metadata and request catalog/default data by source id. They should not know the full list of condition/effect operations.

### 2. Option Catalogs Are Not First-Class

Some option lists live in schema metadata, some are inferred from enums, and some are hard-coded inside controls. The system needs a first-class catalog layer that can be derived from schemas and exposed through `context.getOptionList`.

Suggested module:

- `src/schemas/editorCatalogs.ts`

Suggested exports:

- `conditionTypeOptions`
- `conditionOperationOptionsByType`
- `effectTypeOptions`
- `effectOperationOptionsByType`
- `comparisonOperatorOptions`
- `stringComparisonOperatorOptions`
- `directionOptions`
- `scopeOptions`
- `messageTypeOptions`

Each catalog entry should use the existing `EditorOption` shape. Schema helpers can attach `optionSource` or typed feature source ids rather than embedding arrays everywhere.

### 3. Defaults Are Split Between Schemas and Controls

`resolveEditorMetadata.createDefaultValue` can create generic defaults from schemas, but specialized controls still hand-build objects such as default conditions and effects. `src/utils/createDefaultWorld.ts` also contains entity factories that partially duplicate schema defaults.

Recommended target:

- One schema-aware default factory for all editor-created data.
- Domain-specific factory wrappers only where they add business rules, such as unique ids or initial map positions.
- Control add buttons call a default factory from metadata/context instead of local switch statements.

Suggested module:

- `src/utils/createDefaultEntity.ts` as the canonical entity/default layer, or a new `src/utils/schemaDefaults.ts` if the concern becomes broad enough.

### 4. Runtime Schemas Are Missing

The authored-data schemas are ahead of the engine. The engine still uses plain TypeScript runtime shapes and command parsing output that are not schema-backed. This is why command resolution TODOs pile up in `src/engine/commands.ts`.

Add these schemas before expanding engine behavior much further:

- `src/schemas/gameStateSchema.ts`
- `src/schemas/commandParseSchema.ts`
- `src/schemas/commandRuntimeSchema.ts`
- `src/schemas/worldValidationSchema.ts`
- `src/schemas/aliasSchema.ts`

These were already proposed in `docs/README_feature_complete_schema_roadmap.md`; they should become the backbone of the parser, resolver, effect executor, condition evaluator, and validation UI.

### 5. Registries Are Half Migrated

`src/types/universalEditorTypes.ts` still exposes legacy `registerEntityPicker` and `registerFlagPicker` fields alongside `EditorRegistries`. `src/utils/buildEditorRegistries.ts` is already the better direction.

Recommended target:

- All pickers read from `context.registries`.
- Delete legacy picker fields after controls migrate.
- Add registry selectors, such as `getEntityOptions(entityType)`, `getFlagOptions()`, `getCounterOptions()`, and `getTagOptions(source)`.
- Keep `getOptionList(source)` for static catalogs, not world-entity registries.

### 6. Validation Is Too Schema-Local

`WorldSchema.superRefine` can catch simple structure and reference errors, but the editor needs richer diagnostics: duplicate aliases, ambiguous parser matches, unreachable rooms, missing referenced effects, invalid command scopes, impossible condition/effect references, and priority conflicts.

Recommended target:

- Add a `worldValidation.ts` service backed by `WorldValidationResultSchema`.
- UniversalEditor receives validation issues by path.
- `validation-summary` becomes a real control backed by that service.

## Priority Refactors

### P0: Make Condition and Effect Builders Schema-Driven

Move these out of controls:

- fallback condition type options
- fallback condition operation options
- fallback effect type options
- fallback effect operation options
- `createDefaultCondition`
- `defaultEffect`
- condition/effect summary label maps

Put the source of truth in schemas/catalog modules, then feed the controls through metadata features:

```ts
features: {
  conditionTypeOptionSource: "conditions.types",
  operatorOptionSourcesByType: {
    flag: "conditions.flag.operations",
    counter: "conditions.counter.operations",
  },
  defaultItemSource: "conditions.defaults",
}
```

Controls should keep only UI state, layout behavior, add/remove/reorder mechanics, and calls to `renderChildControl`.

### P0: Add Runtime Parser and Resolver Types

The command engine needs schema-backed parse and resolution objects:

- parsed command
- connector parse
- resolved target
- ambiguity result
- command match result
- command execution result

This unlocks all `examine`, `take`, `use`, `put`, `give`, and `unlock` TODOs without inventing one-off shapes per command.

### P0: Build an Alias and Target Resolution Index

Add `aliasSchema.ts` and a runtime builder:

- canonical names
- aliases
- generated article variants
- entity type
- world path
- visibility
- scope
- ambiguity metadata

Then implement a resolver service:

- visible room features
- visible room items
- inventory items
- NPCs in room
- room exits
- topics
- surfaces and containers
- lockable/usable/takeable filtering

Commands should ask the resolver for typed targets instead of formatting the raw text back to the player.

### P1: Centralize Editor Catalog and Default Generation

Add a schema/catalog utility that can:

- derive enum options from schema
- read editor metadata options
- read discriminated union variants
- return default values for each variant
- expose option lists through stable source ids

This lets controls declare, "I need effect type options" without owning the list.

### P1: Finish Registry Migration

Replace legacy control context fields with `EditorRegistries`. Then update:

- `EntityPickerEditor`
- `FlagPickerEditor`
- `MultiSelectEditor` when used for entity ids
- `TagListEditor`
- specialized picker stubs in `SpecializedEditors.tsx`

The registry should be the only way controls discover world entities.

### P1: Introduce World-Level Messages

Hard-coded system text such as `"You can't go that way."` should move into world or runtime copy config.

Suggested schema addition:

```ts
messages: {
  movementBlocked: string;
  unknownCommand: string;
  missingTarget: Record<string, string>;
}
```

This lets authors control tone and localization later, and it removes player-facing prose from engine modules.

### P1: Expand Condition Evaluation

`src/engine/descriptions.ts` only evaluates groups and flags. The schema supports many condition kinds. Add a condition evaluator registry keyed by condition `type` and `operation`.

Suggested files:

- `src/engine/conditions/evaluateCondition.ts`
- `src/engine/conditions/evaluators/flag.ts`
- `src/engine/conditions/evaluators/counter.ts`
- `src/engine/conditions/evaluators/inventory.ts`
- `src/engine/conditions/evaluators/itemLocation.ts`
- `src/engine/conditions/evaluators/objectState.ts`
- `src/engine/conditions/evaluators/npc.ts`
- `src/engine/conditions/evaluators/quest.ts`
- `src/engine/conditions/evaluators/commandHistory.ts`
- `src/engine/conditions/evaluators/scheduledEvent.ts`
- `src/engine/conditions/evaluators/resolvedTarget.ts`

### P2: Reduce Specialized Control Stubs

`renderEditorControl.tsx` routes many specialized controls. Some are real, some appear to be placeholders or thin wrappers. Audit specialized controls and classify each as:

- generic renderer with metadata
- specialized renderer required for UX
- placeholder that should be removed or converted into a real schema-backed control

This will make the editor surface easier to reason about.

### P2: Create a Schema Coverage Test

Add tests that walk important schemas and verify every editable field has editor metadata or an accepted generated fallback.

This catches the exact drift causing current control-local workarounds.

## TODO Inventory and Recommendations

### `src/engine/commands.ts`

Current TODOs:

- Resolve `examine a in front of b` connector sides against visible room things.
- Resolve `examine target` against visible room items, inventory, NPCs, and scenery.
- Resolve `take target` against takeable room items and move the item to inventory.
- Resolve `use a on/with b` connector sides into game objects.
- Resolve `use target` into a usable item or visible object.
- Resolve `put a in/on b` as inventory item plus destination/container/surface.
- Resolve `give a to b` as inventory item plus NPC/recipient.
- Resolve `unlock a with b` as lockable object plus key/tool.

Recommendation:

Do not solve these command-by-command with local search logic. Add a shared command target resolver first:

- `buildAliasIndex(world, gameState)`
- `resolveCommandTarget(text, scope, constraints)`
- `resolveConnectorTargets(connector, leftConstraints, rightConstraints)`
- `applyResolutionToParsedCommand(parsed, resolution)`

Then each built-in command can become a small policy layer over the same resolver. This also gives authored commands the same resolution machinery.

### `src/engine/movement.ts`

Current TODO:

- Move `"You can't go that way."` into world data.

Recommendation:

Add world/runtime message defaults. `movePlayer` should call something like `getWorldMessage(world, "movement.blocked")`.

### `src/engine/descriptions.ts`

Current TODO:

- Evaluate the rest of the universal condition types against `GameState`.

Recommendation:

Create a condition evaluator registry and test it against every condition schema variant. Keep `conditionsMatch` as the public API, but move implementation out of the description module.

### `src/engine/commands.test.ts`

Current TODO tests:

- resolves take targets against actual room items
- resolves examine targets against visible items, scenery, NPCs, and inventory
- resolves use targets against inventory and visible objects

Recommendation:

Keep these as acceptance tests for the new resolver. Add ambiguity cases too, such as two visible objects sharing an alias.

### `src/schemas/conditionSchema.ts`

Current TODO:

- NPC condition operation options should belong to schema/catalog logic.

Recommendation:

Move NPC operation options into the proposed catalog layer or attach them directly through schema metadata in a reusable helper. The control should not need to know NPC operations.

### `src/schemas/commandTestSchema.ts`

Current TODO:

- Fill out command test schema.

Recommendation:

Add this after `commandParseSchema.ts` and `commandRuntimeSchema.ts`. The command test schema should store:

- input text
- starting world/state fixture reference
- expected parse
- expected resolved targets
- expected messages
- expected effects/state patches
- expected turn consumption

This will make authored command behavior testable from editor-authored fixtures.

### `src/types/mapTypes.ts`

Current TODO:

- Replace fallback vectors for `up`, `down`, `in`, and `out` when floor/contextual exit layout exists.

Recommendation:

Add an exit layout schema or metadata on connections:

- `layoutMode: "directional" | "floor" | "portal" | "manual"`
- optional `mapVector`
- optional `floorLevelDelta`
- optional `portalGroup`

The map should use explicit layout metadata for non-cardinal exits rather than pretending they are 2D compass directions.

### `src/types/universalEditorTypes.ts`

Current TODO:

- Move legacy picker registries into `EditorRegistries`.

Recommendation:

Finish this soon. It is a central blocker for schema-first controls because controls are still receiving ad hoc picker services.

### `src/components/editor/right-side-bar/RoomEditor.tsx`

Current TODO:

- Maybe add an auto chrome mode that adjusts based on available space.

Recommendation:

Add an appearance resolver that considers editor surface/context:

- sidebar inspector: `chrome: "field"`, compact density
- full workbench: `chrome: "card"` or sectioned object layout
- inline nested rows: `chrome: "inline"` or `bare`

Avoid hard-coding sidebar layout decisions at the call site.

### `src/components/editor/right-side-bar/ConnectionEditor.tsx`

Current TODO:

- Same auto chrome issue as `RoomEditor`.

Recommendation:

Use the same appearance resolver and remove duplicated appearance literals from both editors.

### `src/utils/createDefaultWorld.ts`

Current TODOs:

- Add `createDefaultFeature` when feature creation UI exists.
- Add `createDefaultWorld` when the starter route moves off ad hoc schema default generation.

Status and recommendation:

`createDefaultFeature` already exists, so remove or update the stale TODO. Add `createDefaultWorld` and use it from the starter route so new-world creation has one source of truth.

### `src/utils/universalEditorUtils.ts`

Current TODO:

- Summary/label maps require editing multiple locations when condition operations change.

Recommendation:

Move label and summary metadata into schemas/catalogs. `generateConditionSummary` should read label metadata from the resolved condition variant or catalog entry.

### `src/components/editor/universal/ConditionBuilderEditor.tsx`

Current TODO:

- Condition type and operation fallback lists should be schema-owned.

Recommendation:

Replace fallback lists with schema-derived catalogs. Keep tiny emergency fallbacks only for rendering broken data, and make them visibly marked as unknown/unsupported.

### `docs/README_current_tasks.md`

Current TODO:

- Remove stale TODOs after target resolution is implemented.

Recommendation:

Resolve after the command target resolver lands and the command TODO tests pass.

## Things to Add

### Runtime and Validation Schemas

Add:

- `gameStateSchema.ts`
- `commandParseSchema.ts`
- `commandRuntimeSchema.ts`
- `worldValidationSchema.ts`
- `aliasSchema.ts`
- possibly `eventSchema.ts`

These should become the contract between schemas, editor, parser, engine, and tests.

### Resolver Services

Add:

- `src/engine/aliases/buildAliasIndex.ts`
- `src/engine/commands/resolveTarget.ts`
- `src/engine/commands/resolveConnectorTargets.ts`
- `src/engine/commands/applyCommandEffects.ts`
- `src/engine/conditions/evaluateCondition.ts`

### Editor Catalog Layer

Add:

- `src/schemas/editorCatalogs.ts`
- `src/utils/buildEditorOptionSources.ts`

The first module defines static schema/domain catalogs. The second combines static catalogs with world registries for the active editor context.

### Schema Metadata Tests

Add tests for:

- all editable schema fields resolve to a supported control
- discriminated union variants have labels/defaults
- option sources resolve
- picker entity types have registries
- no control-local catalog has drifted from schema variants

### World Diagnostics

Add validation for:

- duplicate ids
- missing references
- duplicate aliases
- ambiguous aliases
- invalid condition/effect references
- impossible command scopes
- unreachable rooms
- one-way/two-way connection mistakes
- command priority conflicts

## Things to Refactor or Fix

1. Move condition/effect operation lists out of controls.
2. Move summary labels out of `universalEditorUtils`.
3. Replace legacy picker context fields with `EditorRegistries`.
4. Move hard-coded engine messages into world data/default message config.
5. Split condition evaluation out of `descriptions.ts`.
6. Add command parse/resolution/runtime schemas before expanding authored command behavior.
7. Use a shared resolver for built-in and authored commands.
8. Centralize default object creation.
9. Remove stale TODOs that are already resolved, especially `createDefaultFeature`.
10. Add schema coverage and catalog drift tests.

## Pass-Off Context Bundles

Use this section when handing one task to a ChatGPT window that does not have the full repository. For each task, include the listed files plus the specific task description from this document. If the task requires implementation, also include the relevant tests or ask the model to add tests in the same area.

### Schema-Driven Condition and Effect Builders

Goal: move condition/effect type catalogs, operation catalogs, default object creation, and summary labels out of universal controls and into schema/catalog utilities.

Required files:

- `src/components/editor/universal/ConditionBuilderEditor.tsx`
- `src/components/editor/universal/EffectListEditor.tsx`
- `src/components/editor/universal/renderChildControl.tsx`
- `src/components/editor/universal/renderEditorControl.tsx`
- `src/schemas/conditionSchema.ts`
- `src/schemas/effectSchema.ts`
- `src/schemas/editorSchemaHelpers.ts`
- `src/types/editor/editorMetadataTypes.ts`
- `src/types/editor/editorContextTypes.ts`
- `src/types/universalEditorTypes.ts`
- `src/utils/resolveEditorMetadata.ts`
- `src/utils/universalEditorUtils.ts`
- `src/utils/editorMetadata.ts`
- `src/utils/mergeEditorMetadata.ts`
- `src/utils/schemaIntrospection.ts`

Useful tests and docs:

- `src/schemas/effectSchema.test.ts`
- `src/utils/schemaIntrospection.test.ts`
- `src/utils/resolveEditorMetadata.test.ts`
- `docs/README_universal_editor_controls_current.md`
- `docs/README_universal_editor_metadata_design.md`

Expected new or changed files:

- `src/schemas/editorCatalogs.ts`
- `src/utils/buildEditorOptionSources.ts`
- tests for catalog coverage and schema/catalog drift

### Runtime Parser and Resolver Schemas

Goal: add schema-backed parse, target resolution, match, and execution result shapes that can be shared by built-in commands, authored commands, tests, and editor debugging.

Required files:

- `src/engine/commands.ts`
- `src/engine/commands.test.ts`
- `src/engine/gameState.ts`
- `src/schemas/authoredCommandSchema.ts`
- `src/schemas/conditionSchema.ts`
- `src/schemas/effectSchema.ts`
- `src/schemas/worldSchema.ts`
- `src/schemas/roomSchema.ts`
- `src/schemas/commandTestSchema.ts`
- `src/types/universalEditorTypes.ts`
- `docs/README_author_defined_commands.md`
- `docs/README_feature_complete_schema_roadmap.md`

Useful nearby files:

- `src/engine/author-commands/action.ts`
- `src/data/worlds/exampleWorld.ts`

Expected new or changed files:

- `src/schemas/commandParseSchema.ts`
- `src/schemas/commandRuntimeSchema.ts`
- `src/schemas/gameStateSchema.ts`
- expanded `src/schemas/commandTestSchema.ts`
- command runtime tests

### Alias Index and Target Resolver

Goal: resolve player text into typed world targets using names, aliases, generated forms, current visibility, inventory, room contents, NPCs, exits, topics, surfaces, containers, and command-specific constraints.

Required files:

- `src/engine/commands.ts`
- `src/engine/commands.test.ts`
- `src/engine/gameState.ts`
- `src/engine/rooms.ts`
- `src/engine/descriptions.ts`
- `src/schemas/worldSchema.ts`
- `src/schemas/roomSchema.ts`
- `src/schemas/conditionSchema.ts`
- `src/schemas/objectStateSchema.ts`
- `src/utils/buildEditorRegistries.ts`
- `src/utils/createDefaultWorld.ts`
- `src/data/worlds/exampleWorld.ts`

Useful docs:

- `docs/README_author_defined_commands.md`
- `docs/README_alias_suggestion_system_spec.md`

Expected new or changed files:

- `src/schemas/aliasSchema.ts`
- `src/engine/aliases/buildAliasIndex.ts`
- `src/engine/commands/resolveTarget.ts`
- `src/engine/commands/resolveConnectorTargets.ts`
- resolver-focused tests

### Command TODO Implementation

Goal: replace placeholder text handling for `examine`, `take`, `use`, `put`, `give`, and `unlock` with real target resolution and state changes.

Required files:

- `src/engine/commands.ts`
- `src/engine/commands.test.ts`
- `src/engine/gameState.ts`
- `src/engine/movement.ts`
- `src/engine/rooms.ts`
- `src/engine/descriptions.ts`
- `src/schemas/worldSchema.ts`
- `src/schemas/roomSchema.ts`
- `src/schemas/objectStateSchema.ts`
- `src/data/worlds/exampleWorld.ts`

Also include if already created:

- `src/schemas/aliasSchema.ts`
- `src/schemas/commandParseSchema.ts`
- `src/schemas/commandRuntimeSchema.ts`
- `src/engine/aliases/buildAliasIndex.ts`
- `src/engine/commands/resolveTarget.ts`
- `src/engine/commands/resolveConnectorTargets.ts`

Expected changed files:

- `src/engine/commands.ts`
- `src/engine/commands.test.ts`
- target resolver files
- fixtures in `src/data/worlds/exampleWorld.ts` if test coverage needs richer world data

### Condition Evaluation Expansion

Goal: evaluate all universal condition schema variants against `GameState` and world data instead of only groups and flags.

Required files:

- `src/engine/descriptions.ts`
- `src/engine/descriptions.test.ts`
- `src/engine/gameState.ts`
- `src/schemas/conditionSchema.ts`
- `src/schemas/worldSchema.ts`
- `src/schemas/roomSchema.ts`
- `src/schemas/objectStateSchema.ts`
- `src/schemas/effectSchema.ts`
- `src/data/worlds/exampleWorld.ts`

Useful follow-up files:

- `src/engine/commands.ts`
- `src/engine/rooms.ts`

Expected new or changed files:

- `src/engine/conditions/evaluateCondition.ts`
- evaluator modules under `src/engine/conditions/evaluators/`
- condition evaluator tests
- updates to `src/engine/descriptions.ts` so it delegates evaluation

### World-Level Messages

Goal: move hard-coded engine prose such as movement blocked messages into world data or a default message config.

Required files:

- `src/engine/movement.ts`
- `src/engine/commands.ts`
- `src/engine/gameState.ts`
- `src/schemas/worldSchema.ts`
- `src/schemas/roomSchema.ts`
- `src/data/worlds/exampleWorld.ts`
- `src/utils/createDefaultWorld.ts`
- `src/utils/createDefaultWorld.test.ts`

Useful tests:

- `src/engine/commands.test.ts`
- `src/engine/rooms.test.ts`

Expected new or changed files:

- world message schema fields in `src/schemas/worldSchema.ts`
- default message helper, if not kept in schema defaults
- movement/command tests for fallback and custom messages

### Editor Registry Migration

Goal: remove legacy picker context fields and make every picker use `EditorRegistries`.

Required files:

- `src/types/universalEditorTypes.ts`
- `src/types/editor/editorContextTypes.ts`
- `src/types/editor/editorRegistryTypes.ts`
- `src/utils/buildEditorRegistries.ts`
- `src/components/editor/universal/EntityPickerEditor.tsx`
- `src/components/editor/universal/FlagPickerEditor.tsx`
- `src/components/editor/universal/MultiSelectEditor.tsx`
- `src/components/editor/universal/TagListEditor.tsx`
- `src/components/editor/universal/SpecializedEditors.tsx`
- `src/components/editor/universal/UniversalEditor.tsx`
- `src/components/editor/universal/renderEditorControl.tsx`

Useful tests:

- `src/utils/resolveEditorMetadata.test.ts`
- `src/utils/schemaIntrospection.test.ts`
- control matrix pages under `src/app/test/*`

Expected changed files:

- picker controls
- universal editor context assembly
- registry type definitions
- tests or test pages for picker behavior

### World Validation Service

Goal: move beyond schema-local validation and produce path-addressable diagnostics for missing references, duplicate ids, alias conflicts, unreachable rooms, command conflicts, and invalid condition/effect references.

Required files:

- `src/schemas/worldSchema.ts`
- `src/schemas/roomSchema.ts`
- `src/schemas/conditionSchema.ts`
- `src/schemas/effectSchema.ts`
- `src/schemas/authoredCommandSchema.ts`
- `src/schemas/objectStateSchema.ts`
- `src/utils/buildEditorRegistries.ts`
- `src/types/editor/editorContextTypes.ts`
- `src/components/editor/universal/UniversalEditor.tsx`
- `src/components/editor/universal/SpecializedEditors.tsx`
- `src/components/editor/right-side-bar/RoomEditor.tsx`
- `src/components/editor/right-side-bar/ConnectionEditor.tsx`

Useful tests:

- `src/utils/createDefaultWorld.test.ts`
- existing schema tests under `src/schemas/*.test.ts`

Expected new or changed files:

- `src/schemas/worldValidationSchema.ts`
- `src/utils/worldValidation.ts`
- validation tests
- UniversalEditor issue display wiring

### Schema Metadata Coverage Tests

Goal: fail tests when important editable schema fields lack editor metadata, unsupported controls are used, option sources do not resolve, or discriminated union variants lack labels/defaults.

Required files:

- `src/schemas/editorSchemaHelpers.ts`
- `src/schemas/worldSchema.ts`
- `src/schemas/roomSchema.ts`
- `src/schemas/conditionSchema.ts`
- `src/schemas/effectSchema.ts`
- `src/schemas/authoredCommandSchema.ts`
- `src/schemas/descriptionSchema.ts`
- `src/schemas/objectStateSchema.ts`
- `src/utils/editorMetadata.ts`
- `src/utils/resolveEditorMetadata.ts`
- `src/utils/schemaIntrospection.ts`
- `src/utils/sortEditorObjectFields.ts`
- `src/components/editor/universal/renderEditorControl.tsx`
- `src/types/editor/editorMetadataTypes.ts`

Useful tests:

- `src/utils/schemaIntrospection.test.ts`
- `src/utils/resolveEditorMetadata.test.ts`
- `src/utils/mergeEditorMetadata.test.ts`
- `src/utils/sortEditorObjectFields.test.ts`

Expected new or changed files:

- schema metadata coverage test file
- possible small helpers in `src/utils/schemaIntrospection.ts`

### Default World and Entity Creation Cleanup

Goal: centralize default world/entity creation and remove stale TODOs, especially the already-implemented `createDefaultFeature` TODO.

Required files:

- `src/utils/createDefaultWorld.ts`
- `src/utils/createDefaultWorld.test.ts`
- `src/utils/createDefaultEntity.ts`
- `src/schemas/worldSchema.ts`
- `src/schemas/roomSchema.ts`
- `src/schemas/objectStateSchema.ts`
- `src/app/starter/page.tsx`
- `src/data/worlds/exampleWorld.ts`

Useful files:

- `src/utils/connectionUtils.ts`
- `src/components/map/Map.tsx`
- `src/components/editor/ToolBar.tsx`

Expected changed files:

- `src/utils/createDefaultWorld.ts`
- starter route default-world creation
- tests for default world/entity factories

### Map Exit Layout Debt

Goal: replace fake 2D fallback vectors for `up`, `down`, `in`, and `out` with explicit connection layout metadata.

Required files:

- `src/types/mapTypes.ts`
- `src/components/map/Map.tsx`
- `src/components/map/Connection.tsx`
- `src/components/map/Room.tsx`
- `src/components/map/useConnectionDrag.ts`
- `src/utils/connectionUtils.ts`
- `src/utils/pointUtils.ts`
- `src/schemas/roomSchema.ts`
- `src/schemas/worldSchema.ts`

Useful tests:

- `src/utils/connectionUtils.test.ts`
- `src/utils/pointUtils.test.ts`

Expected changed files:

- connection schema/layout metadata
- map rendering and connection layout utilities
- tests for non-cardinal exits

### Auto Appearance and Chrome Resolver

Goal: stop hard-coding right-sidebar UniversalEditor appearance and let the editor resolve chrome/density from surface context.

Required files:

- `src/components/editor/right-side-bar/RoomEditor.tsx`
- `src/components/editor/right-side-bar/ConnectionEditor.tsx`
- `src/components/editor/right-side-bar/RightSideBar.tsx`
- `src/components/editor/universal/UniversalEditor.tsx`
- `src/components/editor/universal/FieldShell.tsx`
- `src/types/editor/editorMetadataTypes.ts`
- `src/types/universalEditorTypes.ts`
- `src/schemas/editorSchemaHelpers.ts`

Useful style files:

- `src/components/editor/right-side-bar/RightSideBar.scss`
- `src/components/editor/universal/UniversalEditor.scss`
- `src/components/editor/universal/FieldShell.scss`

Expected changed files:

- appearance resolver helper
- right sidebar editor calls
- optional metadata/context type additions

## Suggested Implementation Order

### Phase 1: Stabilize Sources of Truth

1. Add editor catalogs for conditions/effects/operators.
2. Wire `context.getOptionList` to those catalogs.
3. Update condition/effect controls to consume catalogs.
4. Move summary labels into catalog metadata.
5. Add drift tests comparing schema variants to catalog entries.

### Phase 2: Runtime Foundation

1. Add `gameStateSchema.ts`.
2. Add `commandParseSchema.ts`.
3. Add `commandRuntimeSchema.ts`.
4. Add `aliasSchema.ts`.
5. Build alias index and target resolver.

### Phase 3: Command TODOs

1. Implement `examine` resolution.
2. Implement `take` resolution and inventory movement.
3. Implement `use` resolution.
4. Implement `put`, `give`, and `unlock`.
5. Convert existing `it.todo` tests into real tests.

### Phase 4: Editor and Validation Cleanup

1. Finish `EditorRegistries` migration.
2. Add world validation service.
3. Surface validation issues in UniversalEditor.
4. Replace ad hoc duplicate checks in sidebars with validation issues.
5. Add world messages and remove hard-coded engine prose.

### Phase 5: Map and Layout Debt

1. Add connection layout metadata for non-cardinal exits.
2. Replace fallback vectors for `up`, `down`, `in`, and `out`.
3. Add the auto appearance/chrome resolver for right sidebar editors.

## Definition of Done

This refactor is in a good place when:

- adding a condition/effect variant starts in the schema and does not require editing a control-local catalog
- controls receive options/defaults through metadata, registries, or option sources
- built-in and authored commands use the same target resolver
- every current TODO is either implemented, converted into a tracked roadmap item, or removed as stale
- schema coverage tests fail when an editable field lacks metadata
- world validation can report reference and alias problems by editor path
- engine-facing runtime data has schemas, not only TypeScript interfaces
