# Mothmark Schema Metadata and Runtime Additions

This document describes what should be added around the current Mothmark schemas to make them more complete, easier to edit through the UniversalEditor, and better aligned with runtime game state.

The current schemas already define a strong authored world model:

- `worldSchema.ts` defines static world content such as rooms, items, connections, NPCs, topics, quests, authored commands, authored events, and initial state.
- `conditionSchema.ts` defines a universal recursive condition model.
- `effectSchema.ts` defines a universal effect model with groups and conditional effects.
- `authoredCommandSchema.ts` defines structured command authoring, command patterns, branches, target requirements, fallback behavior, and turn behavior.

The next step should not be to add a pile of random fields directly into those files. The next step should be to add support infrastructure around them:

1. Editor metadata, so fields know how they should render.
2. Editor context and registries, so pickers know what world data exists.
3. Runtime schemas, so conditions and effects have a formal game-state shape to read and modify.
4. Reference validation utilities, so world consistency is not buried inside one huge `superRefine` block.
5. Deterministic summaries, so conditions and effects can produce stable English previews.
6. Authoring support schemas, so commands and world settings become easier to test and manage.

---

## Core Architecture Rule

Separate schema validation, field metadata, and runtime editor context.

```txt
Schema validation
  What shape is valid data?

Editor metadata
  How should this field be edited?

Editor context
  What runtime editor data is available while editing?
```

For example:

```ts
roomId: z.string().min(1);
```

This validates a string, but the editor needs more information. It should know this field is a room reference and should render as a room picker.

The schema should eventually express that as:

```ts
roomId: editorEntityId("room", {
  title: "Room",
  description: "The room this field references.",
});
```

The helper still returns a Zod string schema, but attaches editor metadata.

---

# Recommended Files to Add

## Priority 1: UniversalEditor Metadata Infrastructure

These files unlock schema-driven editor rendering.

```txt
src/types/editorMetadataTypes.ts
src/types/editorContextTypes.ts
src/types/editorRegistryTypes.ts
src/utils/editorMetadata.ts
src/utils/resolveEditorMetadata.ts
src/schemas/editorSchemaHelpers.ts
src/utils/buildEditorRegistries.ts
src/utils/schemaIntrospection.ts
src/utils/conditionSummary.ts
src/utils/effectSummary.ts
```

## Priority 2: Runtime Completeness

These files make the runtime state model official and move cross-reference validation out of the giant world schema file.

```txt
src/schemas/gameStateSchema.ts
src/schemas/runtimeSchema.ts
src/utils/worldReferenceValidator.ts
src/utils/collectWorldReferences.ts
src/utils/collectWorldFlags.ts
src/utils/collectWorldCounters.ts
src/utils/collectWorldTags.ts
```

## Priority 3: Authoring Quality

These files improve parser configuration, testability, default object creation, and editor quality-of-life.

```txt
src/schemas/worldSettingsSchema.ts
src/schemas/worldLexiconSchema.ts
src/schemas/commandTestSchema.ts
src/schemas/legacyConditionSchema.ts
src/utils/conditionOptions.ts
src/utils/effectOptions.ts
src/utils/createDefaultWorld.ts
src/utils/createDefaultEntity.ts
src/utils/normalizeWorld.ts
```

---

# 1. `src/types/editorMetadataTypes.ts`

This file should define the metadata model for fields rendered by the UniversalEditor.

The metadata describes what a field is and how it should be edited. It should not contain the current list of rooms, items, NPCs, or flags. Those belong in editor context and registries.

## Suggested control type union

```ts
export type EditorControlType =
  | "text"
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
  | "counter-picker"
  | "code-preview"
  | "hidden";
```

## Suggested base metadata type

```ts
export type EditorFieldMetadata = {
  control: EditorControlType;

  title?: string;
  description?: string;
  placeholder?: string;

  required?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  hidden?: boolean;
  advanced?: boolean;
  deprecated?: boolean;

  group?: string;
  section?: string;
  order?: number;

  variant?: string;
  appearance?: EditorControlAppearance;
  layout?: EditorFieldLayoutMetadata;

  options?: EditorOption[];
  optionSource?: string;

  entityType?: EditorEntityType;
  tagSource?: EditorTagSource;

  summary?: {
    enabled?: boolean;
    mode?: "deterministic" | "preview";
  };

  tags?: string[];
  aliases?: string[];
  testId?: string;
  debugName?: string;
};
```

## Suggested entity type union

```ts
export type EditorEntityType =
  | "room"
  | "connection"
  | "item"
  | "npc"
  | "topic"
  | "quest"
  | "quest-objective"
  | "command"
  | "event"
  | "feature"
  | "container"
  | "surface"
  | "object"
  | "direction";
```

## Suggested option type

```ts
export type EditorOption = {
  value: string;
  label: string;
  description?: string;
  deprecated?: boolean;
  disabled?: boolean;
};
```

---

# 2. `src/utils/editorMetadata.ts`

This file should centralize attaching and reading editor metadata from Zod schemas.

```ts
import type {z} from "zod";
import type {EditorFieldMetadata} from "../types/editorMetadataTypes";

export function withEditorMetadata<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  metadata: EditorFieldMetadata,
): TSchema {
  return schema.meta({
    ...(schema.meta() ?? {}),
    editor: metadata,
  }) as TSchema;
}

export function getEditorMetadata(schema: z.ZodTypeAny): EditorFieldMetadata | undefined {
  return schema.meta()?.editor as EditorFieldMetadata | undefined;
}
```

This avoids scattering raw `.meta({ editor: ... })` calls throughout schema files.

---

# 3. `src/schemas/editorSchemaHelpers.ts`

This file should provide schema helpers that return Zod schemas with editor metadata attached.

The goal is to gradually migrate fields like this:

```ts
roomId: z.string().min(1).describe("The room id to compare against.");
```

into this:

```ts
roomId: editorEntityId("room", {
  title: "Room",
  description: "The room id to compare against.",
});
```

## Suggested helpers

```ts
editorString();
editorId();
editorTextarea();
editorMessage();
editorNumber();
editorBoolean();
editorSelect();
editorMultiSelect();
editorStringList();
editorTagList();
editorEntityId();
editorFlagKey();
editorCounterKey();
editorCondition();
editorConditionList();
editorEffects();
editorDiscriminatedUnion();
editorObject();
editorArray();
editorHidden();
```

## Example helper implementations

```ts
export function editorString(metadata: Omit<EditorFieldMetadata, "control">) {
  return withEditorMetadata(z.string(), {
    control: "text",
    ...metadata,
  });
}

export function editorId(metadata: Omit<EditorFieldMetadata, "control">) {
  return withEditorMetadata(z.string().min(1), {
    control: "text",
    placeholder: "stable-id",
    ...metadata,
  });
}

export function editorEntityId(
  entityType: EditorEntityType,
  metadata: Omit<EditorFieldMetadata, "control" | "entityType">,
) {
  return withEditorMetadata(z.string().min(1), {
    control: "entity-picker",
    entityType,
    ...metadata,
  });
}

export function editorFlagKey(metadata: Omit<EditorFieldMetadata, "control">) {
  return withEditorMetadata(z.string().min(1), {
    control: "flag-picker",
    ...metadata,
  });
}

export function editorCounterKey(metadata: Omit<EditorFieldMetadata, "control">) {
  return withEditorMetadata(z.string().min(1), {
    control: "counter-picker",
    ...metadata,
  });
}

export function editorCondition(metadata: Omit<EditorFieldMetadata, "control">) {
  return withEditorMetadata(ConditionSchema, {
    control: "condition-builder",
    summary: {
      enabled: true,
      mode: "deterministic",
    },
    ...metadata,
  });
}

export function editorEffects(metadata: Omit<EditorFieldMetadata, "control">) {
  return withEditorMetadata(z.array(EffectSchema).default([]), {
    control: "effect-list",
    summary: {
      enabled: true,
      mode: "deterministic",
    },
    ...metadata,
  });
}
```

---

# 4. `src/types/editorContextTypes.ts`

This file should define runtime editor context.

Metadata says this field is a room picker. Context says what rooms currently exist.

```ts
export type EditorContext = {
  world: World;
  path: EditorPath;
  mode: "edit" | "create" | "preview" | "debug";

  registries: EditorRegistries;

  getValue: (path: EditorPath) => unknown;
  setValue: (path: EditorPath, value: unknown) => void;
  patchValue?: (patch: EditorPatch) => void;

  getIssues?: (path: EditorPath) => EditorIssue[];
  validatePath?: (path: EditorPath) => EditorIssue[];

  readOnly?: boolean;
  disabled?: boolean;
  selectedPath?: EditorPath;
  focusedPath?: EditorPath;
};
```

---

# 5. `src/types/editorRegistryTypes.ts`

This file should define the shape of data used by pickers.

```ts
export type EditorEntityOption = {
  id: string;
  label: string;
  description?: string;
  aliases?: string[];
  tags?: string[];
  kind?: string;
  parentId?: string;
  path?: EditorPath;
};

export type EditorKeyOption = {
  key: string;
  label: string;
  description?: string;
  source?: string;
};

export type EditorTagRegistry = {
  rooms: string[];
  items: string[];
  features: string[];
  npcs: string[];
  topics: string[];
  quests: string[];
  commands: string[];
  events: string[];
};

export type EditorRegistries = {
  rooms: EditorEntityOption[];
  connections: EditorEntityOption[];
  items: EditorEntityOption[];
  npcs: EditorEntityOption[];
  topics: EditorEntityOption[];
  quests: EditorEntityOption[];
  commands: EditorEntityOption[];
  events: EditorEntityOption[];
  features: EditorEntityOption[];
  containers: EditorEntityOption[];
  surfaces: EditorEntityOption[];
  objects: EditorEntityOption[];
  flags: EditorKeyOption[];
  counters: EditorKeyOption[];
  tags: EditorTagRegistry;
};
```

---

# 6. `src/utils/buildEditorRegistries.ts`

This file should scan a world and produce picker data.

It should gather:

| Registry    | Source                                                    |
| ----------- | --------------------------------------------------------- |
| rooms       | `world.rooms`                                             |
| connections | `world.connections`                                       |
| items       | `world.items`                                             |
| npcs        | `world.npcs`                                              |
| topics      | `world.topics`                                            |
| quests      | `world.quests`                                            |
| commands    | `world.authoredCommands`                                  |
| events      | `world.authoredEvents`                                    |
| features    | `world.rooms[].features`                                  |
| containers  | room features where `kind === "container"`                |
| surfaces    | room features where `kind === "surface"`                  |
| objects     | items, features, containers, surfaces, doors, connections |
| flags       | initial flags plus referenced flags                       |
| counters    | initial counters plus referenced counters                 |
| tags        | all entity tags grouped by entity kind                    |

Example shape:

```ts
export function buildEditorRegistries(world: World): EditorRegistries {
  return {
    rooms: world.rooms.map((room) => ({
      id: room.id,
      label: room.name,
      description: room.description.default,
      aliases: room.aliases,
      tags: room.tags,
    })),

    items: world.items.map((item) => ({
      id: item.id,
      label: item.name,
      description: item.description.default,
      aliases: item.aliases,
      tags: item.tags,
    })),

    // Fill the rest from world data.
  };
}
```

This is essential for `entity-picker`, `flag-picker`, `counter-picker`, and tag controls.

---

# 7. `src/utils/schemaIntrospection.ts`

This file should walk a Zod schema and produce normalized editor nodes.

```ts
export type EditorSchemaNode = {
  path: EditorPath;
  schema: z.ZodTypeAny;
  metadata?: EditorFieldMetadata;
  kind:
    | "string"
    | "number"
    | "boolean"
    | "enum"
    | "literal"
    | "object"
    | "array"
    | "union"
    | "discriminated-union"
    | "lazy"
    | "unknown";
  children?: EditorSchemaNode[];
};
```

The UniversalEditor should render from this normalized node tree rather than manually inspecting Zod everywhere.

---

# 8. `src/utils/resolveEditorMetadata.ts`

This file should merge metadata from multiple sources.

Recommended order:

```txt
field override
schema metadata map
inline Zod metadata
description fallback
inferred fallback
```

Suggested API:

```ts
export function resolveEditorMetadata(args: {
  schema: z.ZodTypeAny;
  path: EditorPath;
  metadataMap?: EditorMetadataMap;
}): ResolvedEditorFieldMetadata;
```

The renderer should receive resolved metadata and should not care where it came from.

---

# 9. `src/utils/conditionOptions.ts`

Condition operator pickers should reuse the UniversalEditor select control instead of rebuilding option UI.

```ts
export const COMPARISON_OPERATOR_OPTIONS = [
  {value: "eq", label: "Equals"},
  {value: "neq", label: "Does not equal"},
  {value: "gt", label: "Greater than"},
  {value: "gte", label: "Greater than or equal to"},
  {value: "lt", label: "Less than"},
  {value: "lte", label: "Less than or equal to"},
];

export const STRING_OPERATOR_OPTIONS = [
  {value: "eq", label: "Equals"},
  {value: "neq", label: "Does not equal"},
  {value: "includes", label: "Includes"},
  {value: "starts-with", label: "Starts with"},
  {value: "ends-with", label: "Ends with"},
];

export const CONDITION_GROUP_OPERATOR_OPTIONS = [
  {value: "all", label: "All conditions pass"},
  {value: "any", label: "Any condition passes"},
  {value: "none", label: "No conditions pass"},
];
```

---

# 10. `src/utils/effectOptions.ts`

Effect type and operation pickers should also be centralized.

Create option lists for:

```txt
MESSAGE_EFFECT_OPTIONS
FLAG_EFFECT_OPERATION_OPTIONS
COUNTER_EFFECT_OPERATION_OPTIONS
INVENTORY_EFFECT_OPERATION_OPTIONS
ITEM_LOCATION_EFFECT_OPERATION_OPTIONS
OBJECT_STATE_EFFECT_OPERATION_OPTIONS
ROOM_EFFECT_OPERATION_OPTIONS
NPC_EFFECT_OPERATION_OPTIONS
EVENT_EFFECT_OPERATION_OPTIONS
FLOW_EFFECT_OPERATION_OPTIONS
QUEST_EFFECT_OPERATION_OPTIONS
TOPIC_EFFECT_OPERATION_OPTIONS
```

These should feed the existing `select` control.

---

# 11. `src/utils/conditionSummary.ts`

This file should provide deterministic English summaries for conditions.

Do not use AI generation here. Summaries should be predictable, stable, and easy to test.

```ts
export function summarizeCondition(condition: Condition): string;
```

Examples:

```txt
Flag kitchen.appleOnTable is true.
Player has item brass-key.
Current room is kitchen.
All of: flag door.unlocked is true; player has item brass-key.
Any of: quest lantern is active; room cellar has been visited.
None of: NPC guard is hostile; scheduled event ratsArrive exists.
```

The condition builder should use this for compact cards and collapsed group previews.

---

# 12. `src/utils/effectSummary.ts`

This file should provide deterministic English summaries for effects.

```ts
export function summarizeEffect(effect: Effect): string;
export function summarizeEffects(effects: Effect[]): string;
```

Examples:

```txt
Show message: "The door opens."
Set flag cellarDoor.unlocked to true.
Move player to cellar.
Move item apple to room kitchen.
Schedule event ratsArrive after 3 turns.
If conditions pass, run 2 effects; otherwise run 1 effect.
```

The effect list should use this for collapsed rows, cards, and debug previews.

---

# 13. `src/schemas/gameStateSchema.ts`

The current world schema explicitly says runtime-only data should live in game state. That game state should be formalized.

Suggested schema:

```ts
export const GameStateSchema = z.object({
  currentRoomId: IdSchema,
  turnCount: z.number().int().nonnegative().default(0),

  flags: z.record(z.string(), z.boolean()).default({}),
  counters: z.record(z.string(), z.number()).default({}),
  objectStates: z.record(z.string(), ObjectStateDefaultsSchema).default({}),

  itemLocations: z.record(z.string(), ItemLocationSchema).default({}),
  npcLocations: z.record(z.string(), z.string().optional()).default({}),

  knownTopics: z.array(IdSchema).default([]),
  inventory: z.array(IdSchema).default([]),

  visitedRooms: z.array(IdSchema).default([]),
  viewedRooms: z.array(IdSchema).default([]),
  examinedFeatures: z.array(z.string()).default([]),

  commandHistory: z.array(CommandHistoryEntrySchema).default([]),
  scheduledEvents: z.array(ScheduledEventInstanceSchema).default([]),
});

export type GameState = z.infer<typeof GameStateSchema>;
```

This matters because many conditions read runtime state and many effects modify runtime state.

---

# 14. `src/schemas/runtimeSchema.ts`

This file should hold runtime command/result schemas that are not authored world data.

Suggested schemas:

```txt
CommandHistoryEntrySchema
ResolvedCommandSchema
ResolvedTargetSchema
CommandResultSchema
EffectResultSchema
ConditionEvaluationResultSchema
```

Example:

```ts
export const CommandHistoryEntrySchema = z.object({
  turn: z.number().int().nonnegative(),
  rawCommand: z.string(),
  commandName: z.string().default(""),
  matchedCommandId: z.string().optional(),
  branchId: z.string().optional(),
  objectId: z.string().optional(),
  targetId: z.string().optional(),
  topicId: z.string().optional(),
  direction: z.string().optional(),
});
```

This supports `command-history` and `resolved-target` conditions cleanly.

---

# 15. `src/utils/worldReferenceValidator.ts`

The current `WorldSchema.superRefine` performs many useful checks, but it is becoming too large.

Move most cross-reference validation to a utility:

```ts
export function validateWorldReferences(world: World): WorldValidationIssue[];
```

It should check:

- duplicate room IDs
- duplicate connection IDs
- duplicate item IDs
- duplicate NPC IDs
- duplicate topic IDs
- duplicate quest IDs
- duplicate authored command IDs
- duplicate authored event IDs
- duplicate feature IDs within rooms
- duplicate full feature IDs
- missing start room
- connections pointing to missing rooms
- item initial locations pointing to missing rooms, containers, surfaces, or NPCs
- NPC initial rooms pointing to missing rooms
- NPC inventories pointing to missing items
- NPC known topics pointing to missing topics
- NPC schedules pointing to missing rooms
- initial inventory references pointing to missing items
- initial known topics pointing to missing topics
- quest objective references used by conditions or effects
- authored event references used by event effects
- command references used by command-history logic

Then `WorldSchema.superRefine` can delegate to this utility and remain readable.

---

# 16. `src/schemas/worldSettingsSchema.ts`

Separate world metadata from engine behavior.

`metadata` is about the project. `settings` are about how the world behaves.

```ts
export const WorldSettingsSchema = z.object({
  caseSensitiveCommands: z.boolean().default(false),
  stripPunctuation: z.boolean().default(true),
  defaultUnknownCommandMessage: z.string().default("I don't understand that."),
  defaultBlockedMessage: z.string().default("You can't do that right now."),
  defaultAmbiguousTargetMessage: z.string().default("Which one do you mean?"),
});

export const DefaultWorldSettings = {
  caseSensitiveCommands: false,
  stripPunctuation: true,
  defaultUnknownCommandMessage: "I don't understand that.",
  defaultBlockedMessage: "You can't do that right now.",
  defaultAmbiguousTargetMessage: "Which one do you mean?",
} satisfies z.infer<typeof WorldSettingsSchema>;
```

Add this to `WorldSchema`:

```ts
settings: WorldSettingsSchema.default(DefaultWorldSettings),
```

---

# 17. `src/schemas/worldLexiconSchema.ts`

This should hold parser vocabulary defaults.

Right now command connectors are defined in `authoredCommandSchema.ts`, which is useful for command-specific behavior. The parser also needs world-level defaults.

```ts
export const WorldLexiconSchema = z.object({
  articles: z.array(z.string()).default(["a", "an", "the"]),
  connectors: z.array(z.string()).default([...DEFAULT_COMMAND_CONNECTORS]),
  speechVerbs: z.array(z.string()).default([...DEFAULT_SPEECH_VERBS]),
  directionAliases: z.record(z.string(), DirectionSchema).default({}),
});
```

Add this to `WorldSchema`:

```ts
lexicon: WorldLexiconSchema.default(DefaultWorldLexicon),
```

This makes parser behavior more data-driven.

---

# 18. `src/schemas/commandTestSchema.ts`

Authored commands should support test cases.

```ts
export const CommandTestCaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().default(""),
  input: z.string().min(1),
  startRoomId: z.string().optional(),
  expectedCommandId: z.string().optional(),
  expectedBranchId: z.string().optional(),
  expectedEffects: z.array(z.string()).default([]),
  expectedMessageIncludes: z.array(z.string()).default([]),
  expectedTurnConsumed: z.boolean().optional(),
});
```

Add this to `AuthorCommandSchema`:

```ts
testCases: z.array(CommandTestCaseSchema).default([]),
```

This makes complex authored commands safer and easier to verify.

---

# Schema Changes to Make

## 1. Standardize condition fields around recursive `ConditionSchema`

The current schemas already support recursive condition groups:

```ts
export type ConditionGroup = {
  type: "group";
  operator: "all" | "any" | "none";
  conditions: Condition[];
};

export type Condition = SingleCondition | ConditionGroup;
```

However, many fields still use:

```ts
z.array(ConditionSchema).default([]);
```

That implies all conditions must pass, but it makes nested logic awkward.

Prefer:

```ts
ConditionSchema.default(DefaultEmptyCondition);
```

Use this especially for:

```txt
visibleWhen
hiddenWhen
activeWhen
takeableWhen
usableWhen
talkableWhen
knownWhen
completeWhen
startWhen
failWhen
cancelIf
travelAllowedWhen
lockedWhen
```

The editor can still display a simple list by default by creating a group with `operator: "all"`.

## 2. Keep `HasItemConditionSchema` only as legacy

`InventoryConditionSchema` now covers item checks more completely.

`HasItemConditionSchema` should either be:

- moved to `src/schemas/legacyConditionSchema.ts`, or
- left in the schema but hidden/deprecated in editor metadata.

Recommended editor metadata:

```ts
{
	deprecated: true,
	hidden: true,
}
```

## 3. Treat `RandomChanceConditionSchema` as advanced or hidden initially

Random chance is harder to reason about in deterministic authored logic.

Recommended approach:

- Keep it in schema support.
- Hide it from the first version of the condition builder.
- Re-enable it once seeded deterministic evaluation is implemented.

## 4. Add `QuestEffectSchema`

The project currently has quest conditions but no matching quest effects.

Add:

```ts
export const QuestEffectSchema = z.discriminatedUnion("operation", [
  z.object({
    type: z.literal("quest"),
    operation: z.literal("start"),
    questId: z.string().min(1),
  }),

  z.object({
    type: z.literal("quest"),
    operation: z.literal("complete"),
    questId: z.string().min(1),
  }),

  z.object({
    type: z.literal("quest"),
    operation: z.literal("fail"),
    questId: z.string().min(1),
  }),

  z.object({
    type: z.literal("quest"),
    operation: z.literal("complete-objective"),
    questId: z.string().min(1),
    objectiveId: z.string().min(1),
  }),

  z.object({
    type: z.literal("quest"),
    operation: z.literal("reset-objective"),
    questId: z.string().min(1),
    objectiveId: z.string().min(1),
  }),
]);
```

Then include `QuestEffectSchema` in `EffectSchema`.

## 5. Add `TopicEffectSchema`

The world has topics and known topics, but effects cannot teach or forget topics.

Add:

```ts
export const TopicEffectSchema = z.discriminatedUnion("operation", [
  z.object({
    type: z.literal("topic"),
    operation: z.literal("learn"),
    topicId: z.string().min(1),
  }),

  z.object({
    type: z.literal("topic"),
    operation: z.literal("forget"),
    topicId: z.string().min(1),
  }),
]);
```

Then include `TopicEffectSchema` in `EffectSchema`.

## 6. Add room history effects

The schema can check visited/viewed room history, but authored logic cannot explicitly set or clear it.

Either add a separate `RoomHistoryEffectSchema`, or extend `RoomEffectSchema` with:

```ts
operation: z.enum(["mark-visited", "mark-viewed", "clear-visited", "clear-viewed"]);
```

## 7. Validate counter ranges

`CounterEffectSchema` currently allows invalid clamp ranges like `min: 10, max: 5`.

Add validation so:

```txt
min <= max
```

Also apply this to `CounterConditionSchema` `between` branches.

---

# `worldSchema.ts` Additions

## Add `GlobalAliasSchema`

Aliases currently live on individual entities. A global alias table can support cross-cutting synonyms and parser redirects.

```ts
export const GlobalAliasSchema = z.object({
  id: IdSchema,
  aliases: AliasListSchema,
  targetType: z.enum(["room", "item", "feature", "npc", "topic", "command", "direction"]),
  targetId: IdSchema,
});
```

Add to `WorldSchema`:

```ts
globalAliases: z.array(GlobalAliasSchema).default([]),
```

## Add `settings`

```ts
settings: WorldSettingsSchema.default(DefaultWorldSettings),
```

## Add `lexicon`

```ts
lexicon: WorldLexiconSchema.default(DefaultWorldLexicon),
```

## Consider adding editor-only state

If editor state should be saved inside the world file:

```ts
export const WorldEditorStateSchema = z.object({
  selectedRoomId: IdSchema.optional(),
  canvas: z
    .object({
      zoom: z.number().default(1),
      pan: PointSchema.default({x: 0, y: 0}),
    })
    .default({}),
  collapsedSections: z.array(z.string()).default([]),
});
```

Then add:

```ts
editorState: WorldEditorStateSchema.default(DefaultWorldEditorState),
```

If exported worlds should not include editor UI state, store this in a separate project file instead.

---

# `authoredCommandSchema.ts` Additions

## Add `category`

Tags are flexible, but a category makes filtering easier.

```ts
category: z
	.enum([
		"movement",
		"examine",
		"inventory",
		"item-use",
		"dialogue",
		"puzzle",
		"quest",
		"system",
		"custom",
	])
	.default("custom"),
```

## Add `conflictGroup`

This helps detect commands that compete with one another.

```ts
conflictGroup: z.string().default(""),
```

Examples:

```txt
take-like
movement-like
speech-like
examine-like
```

## Add `authoringStatus`

`enabled` controls runtime behavior. `authoringStatus` controls editor workflow.

```ts
authoringStatus: z
	.enum(["draft", "ready", "needs-test", "disabled"])
	.default("draft"),
```

## Add `testCases`

```ts
testCases: z.array(CommandTestCaseSchema).default([]),
```

---

# Migration Plan

## Step 1: Add metadata infrastructure

Create:

```txt
src/types/editorMetadataTypes.ts
src/utils/editorMetadata.ts
src/schemas/editorSchemaHelpers.ts
```

Do not migrate every schema at once.

## Step 2: Add registries and context

Create:

```txt
src/types/editorContextTypes.ts
src/types/editorRegistryTypes.ts
src/utils/buildEditorRegistries.ts
```

This enables pickers to work.

## Step 3: Add deterministic summaries

Create:

```txt
src/utils/conditionSummary.ts
src/utils/effectSummary.ts
```

Wire these into condition and effect controls.

## Step 4: Migrate highest-value fields first

Start with fields that should obviously not be plain text boxes.

```txt
roomId -> entity-picker room
fromRoomId -> entity-picker room
toRoomId -> entity-picker room
itemId -> entity-picker item
npcId -> entity-picker npc
topicId -> entity-picker topic
questId -> entity-picker quest
eventId -> entity-picker event
featureId -> entity-picker feature
containerId -> entity-picker container
surfaceId -> entity-picker surface
objectId -> entity-picker object
flag -> flag-picker
counter -> counter-picker
operator -> select
conditions -> condition-builder
effects -> effect-list
tags -> tag-list
aliases -> string-list
description.default -> message
description.variants -> array/card-list
```

## Step 5: Add runtime schemas

Create:

```txt
src/schemas/gameStateSchema.ts
src/schemas/runtimeSchema.ts
```

Make condition/effect evaluation depend on these official types.

## Step 6: Move cross-reference validation

Create:

```txt
src/utils/worldReferenceValidator.ts
```

Delegate from `WorldSchema.superRefine` rather than keeping all validation inline.

## Step 7: Add missing effect categories

Add:

```txt
QuestEffectSchema
TopicEffectSchema
Room history effects
```

Then include them in `EffectSchema`, effect summaries, effect options, and editor metadata.

## Step 8: Add world settings, lexicon, and command tests

Create:

```txt
src/schemas/worldSettingsSchema.ts
src/schemas/worldLexiconSchema.ts
src/schemas/commandTestSchema.ts
```

Then add fields to `WorldSchema` and `AuthorCommandSchema`.

---

# Metadata Coverage Rule

Every editable schema field should have one of:

1. explicit editor metadata,
2. metadata from an editor schema helper,
3. an external metadata map entry,
4. an intentional hidden/internal marker.

A field like this should eventually fail metadata coverage:

```ts
name: z.string();
```

This should pass:

```ts
name: editorString({
  title: "Name",
  description: "Short author-facing name.",
});
```

This should also pass:

```ts
internalVersion: editorHidden({
  description: "Internal migration version.",
});
```

Add a future test like:

```ts
describe("schema editor metadata coverage", () => {
  it("WorldSchema has editor metadata for every editable field", () => {
    expectEditorMetadataCoverage(WorldSchema).toPass();
  });

  it("AuthorCommandSchema has editor metadata for every editable field", () => {
    expectEditorMetadataCoverage(AuthorCommandSchema).toPass();
  });
});
```

Error output should be practical:

```txt
Missing editor metadata:
- rooms[].name
- commands[].branches[].conditions
- effects[].targetRoomId

Add metadata with editorString(), editorCondition(), editorEntityId(), or mark the field editorHidden().
```

---

# Recommended First Implementation Batch

If you only do one batch, do this:

```txt
src/types/editorMetadataTypes.ts
src/types/editorContextTypes.ts
src/types/editorRegistryTypes.ts
src/utils/editorMetadata.ts
src/schemas/editorSchemaHelpers.ts
src/utils/buildEditorRegistries.ts
src/utils/resolveEditorMetadata.ts
src/utils/conditionSummary.ts
src/utils/effectSummary.ts
src/utils/conditionOptions.ts
src/utils/effectOptions.ts
```

Then migrate these field families first:

```txt
IDs and references
conditions
effects
operators
tags
aliases
descriptions
```

This gives the largest editor improvement with the least schema churn.

---

# Final Recommendation

The current schemas are structurally strong. They should now be treated as the authored data language for Mothmark.

The next layer should make that language:

- self-describing for the UniversalEditor,
- backed by runtime game-state schemas,
- cross-reference-validatable,
- easy to summarize deterministically,
- testable through authored command test cases,
- and configurable through world settings and lexicon schemas.

Avoid stuffing all of this into `worldSchema.ts`. Add small focused files, then gradually migrate the existing schemas to use metadata helpers.

The best first move is metadata infrastructure, not more world fields.
