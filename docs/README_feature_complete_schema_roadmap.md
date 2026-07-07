# Feature-Complete Schema Roadmap

This document lists the remaining schemas needed to make the authored-command system feature complete. The list is sorted by importance, from core engine requirements to later product/platform schemas.

## Current Core Schemas Already Drafted

These schemas form the static authored-data foundation:

1. `worldSchema.ts`
2. `conditionSchema.ts`
3. `effectSchema.ts`
4. `commandSchema.ts`

Together, they define rooms, entities, authored commands, authored events, conditions, and effects. The missing pieces are mainly runtime state, command parsing, execution results, validation, and alias/index support.

---

## 1. `gameStateSchema.ts`

**Importance:** Critical  
**Build next:** Yes

The world schema defines static world data. The command, condition, and effect schemas need a validated runtime state object to read from and write to.

Without this schema, effects are valid data, but there is no single validated runtime structure for them to mutate.

### Should define

- `GameStateSchema`
- `ItemRuntimeLocationSchema`
- `ObjectRuntimeStateSchema`
- `NpcRuntimeStateSchema`
- `QuestRuntimeStateSchema`
- `CommandHistoryEntrySchema`
- `ScheduledEventInstanceSchema`

### Suggested runtime fields

```ts
currentRoomId;
flags;
inventory;
messages;
turnCount;
counters;
itemLocations;
objectStates;
npcLocations;
npcStates;
scheduledEvents;
recentCommands;
visitedRoomIds;
viewedRoomIds;
examinedFeatures;
knownTopics;
questStates;
```

### Why it matters

This schema is the source of truth for playthrough state. Conditions check it, effects mutate it, and the command runtime uses it to decide what happens next.

### Notes

`ScheduledEventInstanceSchema` was previously drafted in `effectSchema.ts`, but it is runtime state. It probably belongs in `gameStateSchema.ts` or a shared `eventSchema.ts`.

---

## 2. `commandParseSchema.ts`

**Importance:** Critical  
**Build next:** Yes, after `gameStateSchema.ts`

The authored command schema defines what authors can create, but the engine also needs a validated shape for what the parser produces after reading player input.

This is especially important because some conditions depend on parsed command data, such as `resolved-target` conditions.

### Should define

- `ParsedCommandSchema`
- `ResolvedCommandTargetSchema`
- `CommandMatchSchema`
- `CommandMatchResultSchema`
- `CommandResolutionResultSchema`
- `CommandAmbiguitySchema`
- `CommandParseErrorSchema`

### Suggested parsed command fields

```ts
rawInput;
normalizedInput;
verb;
objectText;
connector;
targetText;
speechText;
direction;
resolvedObject;
resolvedTarget;
resolvedNpc;
resolvedTopic;
matchedPatternId;
matchedCommandId;
ambiguities;
errors;
```

### Why it matters

The engine needs a consistent object to pass through command matching, condition checking, branch selection, and effect execution.

For example, this condition needs parsed command context:

```ts
{
  type: "resolved-target",
  operation: "object-is",
  objectId: "apple"
}
```

---

## 3. `commandRuntimeSchema.ts`

**Importance:** Critical  
**Build next:** Yes, after `commandParseSchema.ts`

The authored command schema describes what should happen, but the engine needs a structured execution result after running a command.

This schema may not need to be stored in save data, but it is extremely useful for the engine pipeline, tests, editor debugging, and future UI.

### Should define

- `CommandExecutionContextSchema`
- `CommandExecutionResultSchema`
- `EffectExecutionContextSchema`
- `EffectExecutionResultSchema`
- `CommandRuntimeErrorSchema`

### Suggested execution result fields

```ts
matched;
handled;
shouldStopProcessing;
shouldRunGenericCommand;
shouldConsumeTurn;
extraTurns;
messages;
appliedEffectIds;
selectedBranchId;
errors;
```

### Why it matters

Authored commands support fallback behavior, generic command passthrough, stop-processing behavior, before/after branches, failure branches, and turn consumption. Those decisions need one typed runtime result.

---

## 4. `worldValidation.ts` / `worldValidationSchema.ts`

**Importance:** Very high  
**Build next:** Soon after runtime schemas

The current `WorldSchema.superRefine` can catch duplicate ids and some missing references, but the authored-command feature will quickly outgrow schema-local validation.

Validation should become its own module so the editor can show useful warnings and errors.

### Should define

- `WorldValidationIssueSchema`
- `WorldValidationResultSchema`
- `WorldReferenceIndexSchema`
- `WorldReferenceTargetSchema`
- `WorldValidationSeveritySchema`

### Should validate

- Duplicate ids
- Missing room, item, NPC, topic, quest, command, and event references
- Effects that schedule missing authored events
- Commands scoped to missing entities
- Conditions referencing impossible or missing entities
- Item locations pointing to missing containers, surfaces, rooms, or NPCs
- Duplicate aliases that create ambiguous parser matches
- Command priority conflicts
- Protected command override conflicts
- Impossible command scopes
- Unreachable rooms
- Orphan rooms
- Connection direction conflicts
- Authored event cycles, if needed later

### Why it matters

The editor needs validation that can say more than “schema parse failed.” It should tell the author exactly what is wrong and where.

---

## 5. `aliasSchema.ts`

**Importance:** High  
**Build after:** Basic runtime pipeline works

Command matching depends heavily on aliases. The world entities have aliases, but the parser needs a normalized alias index.

This schema can support manually written aliases and generated aliases.

### Should define

- `AliasEntrySchema`
- `AliasDictionarySchema`
- `GeneratedAliasesSchema`
- `EntityReferenceSchema`
- `AliasConflictSchema`

### Suggested alias entry shape

```ts
{
  entityId: "apple",
  entityType: "item",
  name: "apple",
  aliases: ["red apple", "fruit", "shiny apple"],
  generatedAliases: ["the apple", "an apple"]
}
```

### Why it matters

Aliases should not be scattered across entities without a parser-ready index. A normalized alias system makes command resolution more predictable and easier to debug.

---

## 6. `eventSchema.ts`

**Importance:** Medium-high  
**Build when:** Authored events and scheduled runtime events start feeling crowded

Right now event-related schemas are split conceptually between authored effects and runtime scheduling. If `effectSchema.ts` starts getting too broad, event schemas should be split out.

### Should define

- `AuthoredEventSchema`
- `ScheduledEventInstanceSchema`
- `EventTimingSchema`
- `EventRuntimeResultSchema`
- `EventCancellationSchema`

### Why it matters

Events sit between authored content and runtime state. Pulling them into their own file may reduce circular imports and keep `effectSchema.ts` focused on effect definitions.

---

## 7. `messageTemplateSchema.ts`

**Importance:** Medium  
**Build when:** Text output starts using variables heavily

The command schema currently has `messageVariables`, and effects can show messages. Eventually, player-facing text will probably need a consistent templating schema.

### Should define

- `MessageTemplateSchema`
- `MessageVariableSchema`
- `MessageRenderContextSchema`
- `MessageRenderResultSchema`

### Example variables

```ts
object.name;
object.displayName;
object.theName;
object.aName;
target.name;
target.displayName;
target.theName;
target.aName;
npc.name;
room.name;
connector;
rawCommand;
counter.someCounterId;
```

### Why it matters

It keeps authored messages consistent across command effects, room descriptions, NPC dialogue, failure text, and event messages.

---

## 8. `templateSchema.ts`

**Importance:** Medium-low  
**Build later

Templates are useful for reusable authored content patterns, but they are not required for the first full command engine.

### Should define

- `CommandTemplateSchema`
- `PuzzleTemplateSchema`
- `EffectTemplateSchema`
- `WorldTemplateSchema`

### Example templates

- Locked door puzzle
- Put object on surface puzzle
- Feed NPC item interaction
- Timed delayed consequence
- Ask NPC about topic interaction
- Repeated ritual sequence

### Why it matters

Templates will make the editor easier to use, especially for common text-adventure interactions. But the engine should work before templates exist.

---

## 9. `saveSchema.ts`

**Importance:** Medium-low for authored commands, high for product later  
**Build later

This is broader than authored commands. It becomes important once the game needs persistent playthroughs, imports/exports, save slots, or published versions.

### Should define

- `SaveFileSchema`
- `SaveMetadataSchema`
- `PlaythroughSchema`
- `GameSnapshotSchema`
- `SaveMigrationSchema`

### Why it matters

The save file should combine world version metadata with `GameStateSchema`, but it should not duplicate the entire editor schema unless needed.

---

## 10. `gameVersionSchema.ts`

**Importance:** Product-level  
**Build later

The broader app will probably need versioning for worlds, published games, migration, rollback, and compatibility checks.

### Should define

- `GameVersionSchema`
- `WorldVersionSchema`
- `MigrationRecordSchema`
- `CompatibilitySchema`

### Why it matters

Once users create real projects, schema changes need migrations. This is not needed to finish authored commands, but it is important for a durable editor.

---

## Recommended Build Order

1. `gameStateSchema.ts`
2. `commandParseSchema.ts`
3. `commandRuntimeSchema.ts`
4. `worldValidation.ts` / `worldValidationSchema.ts`
5. `aliasSchema.ts`
6. `eventSchema.ts`
7. `messageTemplateSchema.ts`
8. `templateSchema.ts`
9. `saveSchema.ts`
10. `gameVersionSchema.ts`

---

## Minimum Feature-Complete Core

The smallest set that makes authored commands truly engine-ready is:

```ts
worldSchema.ts;
conditionSchema.ts;
effectSchema.ts;
commandSchema.ts;
gameStateSchema.ts;
commandParseSchema.ts;
commandRuntimeSchema.ts;
worldValidation.ts;
```

Once those exist, the full engine pipeline can be typed and validated:

```txt
parse input
-> match authored command
-> resolve targets
-> check command conditions
-> select branch
-> execute effects
-> update game state
-> advance turn
-> fire scheduled events
-> validate/debug result
```

## Practical Recommendation

Build `gameStateSchema.ts` next. It unlocks meaningful tests for the effects and conditions we already designed.

After that, build `commandParseSchema.ts`, because conditions like `resolved-target` and command history need a reliable parser output shape.
