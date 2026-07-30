# Command variables in conditions and effects

Command variables let authored command behavior use values captured from player input without changing the normal condition and effect models. A command stores stable block IDs in its behavior. At runtime, the command runner attaches resolved values to those block IDs, the command logic resolver materializes ordinary conditions and effects, and the temporary values are cleared after the branch finishes.

Command parsing is not part of this implementation. The parsing or dispatch layer is responsible for producing the runtime command variables described below.

## Data flow

1. Each block in a command pattern has a typed `ID<"command-block">`.
2. A command condition or effect stores one or more bindings from a block ID to a top-level condition or effect field.
3. The command runner resolves the player's input and places the typed values in `game.variables.command`.
4. `resolveCommandCondition` or `resolveCommandEffect` copies those values into an authored template.
5. The resulting object is parsed by the normal `ConditionSchema` or `EffectSchema`.
6. Existing condition evaluation and effect execution receive only ordinary, fully validated conditions and effects.
7. `resolveCommandConditionBranch` clears `game.variables.command` after all applicable branch work has been materialized.

This keeps the two contexts separate:

- Authoring context: the editor can show a human-facing block role or label, while world data stores the stable block ID.
- Runtime context: game state maps that same block ID to the value resolved from the current player input.

## World block IDs

Every command block schema in `src/schemas/world/commandSchemas.ts` includes:

```ts
id: editor.id("command-block");
```

Block IDs must be unique across every pattern belonging to a command. `CommandSchema` also checks that every behavior binding references a block owned by that command.

Use the ID utilities rather than constructing IDs manually:

```ts
const amountBlockId = toID("command-block", "amount");
```

The block ID is persistent world data. The value associated with it is temporary runtime data.

## Runtime command variables

`CommandVariableSchema` in `src/schemas/states/gameStateSchemas.ts` defines the values stored in `game.variables.command`.

```ts
game.variables.command = [
  {
    blockId: toID("command-block", "amount"),
    type: "number",
    value: 3,
  },
];
```

The repository supports the same value categories as command blocks:

| Block type  | Runtime value           |
| ----------- | ----------------------- |
| `phrase`    | string                  |
| `relation`  | relationship enum value |
| `target`    | typed target reference  |
| `number`    | finite number           |
| `boolean`   | boolean                 |
| `direction` | direction enum value    |
| `choice`    | stable choice string    |
| `text`      | string                  |

Only one runtime value may exist for a block ID. These values belong to one command execution and are cleared after its branch is resolved.

## Bindings

`CommandVariableBindingSchema` connects one captured block value to one top-level field:

```ts
{
  blockId: toID("command-block", "amount"),
  field: "value",
}
```

Each field can have at most one binding. Structural fields cannot be replaced, including `type`, `operation`, `flag-type`, `conditions`, `effects`, and `commandVariables`. Prototype-related keys are rejected as well.

Bindings replace only values. They cannot change what kind of condition or effect is being run.

## Command condition and effect schemas

The command-aware schemas live in `src/schemas/world/commandLogicSchemas.ts`:

- `CommandLogicTemplateSchema` is the shared generic template. It requires a `type`, permits an optional `operation`, preserves authored fields, and accepts optional `commandVariables`.
- `CommandConditionSchema` adds recursive groups and the command-only numeric comparison condition.
- `CommandEffectSchema` represents an individual command effect template.
- `CommandEffectGroupSchema`, `CommandConditionWithEffectSchema`, and `CommandConditionBranchSchema` provide command-aware equivalents of the normal branch structures.

Values required by the canonical schemas may be omitted from command templates because bindings can supply them at runtime.

The normal `ConditionSchema`, `EffectSchema`, `ConditionBranchSchema`, and their editors are unchanged. They strip unknown `commandVariables` data and continue requiring their normal values.

## Resolution priority and safe behavior

For every binding, resolution follows this order:

1. If the referenced runtime command variable exists, its value replaces the target field.
2. If no runtime value exists, an authored field value remains as the fallback.
3. The materialized object is validated by the canonical schema.
4. If a condition cannot be validated, the entire command condition resolves to a guaranteed-false condition.
5. If an effect cannot be validated, it is omitted from the resolved effect group.

An unresolved child invalidates its entire condition tree, including when it appears inside a `none` group. This prevents a missing value from becoming accidentally true through negation.

Type mismatches are handled by the same rule. For example, binding a text value to a numeric effect field causes canonical effect validation to fail, so that effect is skipped.

## Examples

### Counter compared with an input variable

This template represents `count > {amount}`:

```ts
const condition = CommandConditionSchema.parse({
  type: "counter",
  operation: "compare",
  counter: "count",
  operator: "gt",
  commandVariables: [
    {
      blockId: toID("command-block", "amount"),
      field: "value",
    },
  ],
});

const resolved = resolveCommandCondition(game, condition);
// {type: "counter", operation: "compare", counter: "count", operator: "gt", value: 3}
```

An authored `value` may be included as a fallback. The runtime command value overrides it when present.

### Input variable compared with another input variable

The command-only `comparison` condition can resolve either side independently:

```ts
const condition = CommandConditionSchema.parse({
  type: "comparison",
  valueType: "number",
  operator: "lt",
  commandVariables: [
    {blockId: toID("command-block", "minimum"), field: "left"},
    {blockId: toID("command-block", "maximum"), field: "right"},
  ],
});
```

Numeric operands can be literal numbers, command-variable bindings, or counter operands:

```ts
{
  source: "counter",
  counter: "count",
}
```

For example, `{count} > {amount}` uses the counter operand for `left` and binds the `amount` block to `right`.

The comparison is evaluated during command resolution and becomes a canonical always-true or always-false condition group. Existing condition evaluation therefore needs no command-specific behavior.

### Effect value from player input

```ts
const effect = CommandEffectSchema.parse({
  type: "message",
  operation: "show",
  message: "Fallback message",
  commandVariables: [
    {
      blockId: toID("command-block", "message-text"),
      field: "message",
    },
  ],
});

const resolved = resolveCommandEffect(game, effect);
// {type: "message", operation: "show", message: "the player's captured text"}
```

`resolveCommandEffect` returns `undefined` when the template cannot become a valid canonical effect.

## Resolution functions

The functions live in `src/engine/commands/resolveCommandLogic.ts`.

### `resolveCommandTemplate(game, template, schema)`

This is the generic extension point. It applies bindings and validates the result with the supplied canonical Zod schema. It returns the parsed value or `undefined`.

Most callers should use the condition- or effect-specific wrappers instead.

### `resolveCommandCondition(game, condition)`

Returns a canonical `Condition`. It recursively resolves groups, supports command numeric comparisons, and returns a guaranteed-false condition when resolution is unsafe.

### `resolveCommandEffect(game, effect)`

Returns a canonical `Effect` or `undefined`. An undefined result means the caller should skip the effect.

### `resolveCommandEffectGroup(game, group)`

Returns a canonical `EffectGroup`. Each valid effect is retained in order; unresolved effects are dropped.

### `resolveCommandConditionBranchWithResult(world, game, branch)`

Resolves and executes a command-aware branch, then returns:

```ts
{
  game: GameState;
  actionTaken: boolean;
}
```

It handles `always`, the first passing `if`/`elif`, and `else`. Delayed effects are fully materialized before command variables are cleared, so later event execution does not depend on temporary command state.

### `resolveCommandConditionBranch(world, game, branch)`

Convenience wrapper that returns only the resulting `GameState`.

## Adding a new canonical condition or effect

Command logic intentionally does not maintain a second list of supported types or operations. To add a normal condition or effect:

1. Add its canonical Zod schema and include it in `ConditionSchema` or `EffectSchema`.
2. Add its normal evaluator or effect resolver.
3. Add its editor catalog entry, default value, and editor controls when it should be authorable in the UI.
4. Add focused tests for canonical validation and runtime behavior.
5. Add a command-resolution test showing any bindable field being supplied from `game.variables.command`.

No change to `CommandLogicTemplateSchema`, `CommandConditionSchema`, `CommandEffectSchema`, or an operation registry is needed. Once the canonical schema accepts the materialized object, `resolveCommandCondition` or `resolveCommandEffect` accepts it automatically.

The only exception is a genuinely command-only construct such as the two-sided numeric `comparison`. Those constructs need their own command schema and materializer because no equivalent canonical condition exists.

## Current scope

This work provides world and game-state schemas, binding validation, condition/effect materialization, branch resolution, and focused unit tests. It does not implement command parsing or dispatch, and it does not yet add player-path tests.
