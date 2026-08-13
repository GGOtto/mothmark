# Persisted schema compatibility

Mothmark treats authored worlds and saved playthroughs as durable executable content. A deployment
must continue to read every retained document unless it includes an explicit breaking-change
migration.

The compatibility boundary covers:

- `worlds.world`, including active, trashed, and template worlds;
- every immutable `world_versions.world` publication snapshot;
- `playthroughs.current_state` and `playthroughs.transcript`;
- every `playthrough_turns.resulting_state` and `output_messages` value.

## Normal schema changes

Persisted schemas must remain backward compatible by default. Safe changes include adding optional
fields, adding fields with neutral defaults, and adding enum or union variants. Removing or renaming
stored fields, narrowing validation, changing normalization, changing meaningful defaults, and
removing variants require a migration.

After changing a persisted schema:

1. Run `pnpm storage:contract`.
2. Review `storage-contract.snapshot.json`; never approve it mechanically.
3. Add focused tests proving old documents still parse and round-trip without losing meaningful
   fields.
4. Add or update player-path coverage when the change can affect runtime behavior.
5. Run the focused tests and `pnpm ts-check`.

The contract generator records object fields, missing-value behavior, defaults, unions, enums,
checks, transforms, and the persisted schema source digest. Its comparator is deliberately
conservative. If it cannot establish compatibility, use a migration rather than weakening the
guard.

## Deployment validation

`pnpm release:migrate` performs the release gate. It:

1. applies pending SQL migrations;
2. acquires the database-wide storage migration lock;
3. compares the database's last accepted contract with the candidate contract;
4. applies every required numbered storage migration in order;
5. parses every retained document with the candidate schemas;
6. verifies cross-record playthrough and publication relationships;
7. replays every retained playthrough through `resolveTurn` and compares player-visible messages
   and observable state;
8. commits only after all records pass.

Any error exits nonzero and prevents production promotion. Validation is exhaustive rather than
sampled. Error output identifies the table and record without printing full authored or player
content.

The reviewed contract file must exactly match the runtime schemas. A future unsupported storage
version is rejected rather than parsed or overwritten.

## Code boundaries

Persisted JSON must enter the application through `src/compat/storageCodec.ts`. Repository and
import code must not parse database JSON directly with `WorldSchema`, `GameStateSchema`, or
`GameMessageSchema`.

Compatibility transformations belong in `src/compat/migrations`. Do not put them in components,
page loaders, route handlers, or ordinary DBAL functions. The former client-only room-feature
conversion is intentionally superseded by the launch reset described below.

## Initial v1 to v2 reset

The first production migration, `v1-to-v2-reset-worlds-to-blank`, is intentionally destructive.
It replaces every version-1 editor world, template, and publication snapshot with the canonical
blank-world document while retaining its title (using the database world name when available).
Author, description, rooms, items, connections, map layers, conditions, effects, events, and initial
variables are cleared, and the authored version returns to `0.1.0`. The built-in saved command
documents from the time this migration shipped remain available as a frozen historical set. Newer
built-ins and metadata belong only to newly created worlds or later adjacent migrations.

This reset is coupled to the version advance from 1 to 2. The runner selects only rows whose
`schema_version` is exactly 1 and writes both the transformed JSON and `schema_version = 2` in the
same transaction. A rerun therefore cannot blank the world again, and a later migration cannot
reuse this transform. Publication snapshots receive the same reset. Playthrough JSON is unchanged
by this step but still advances to version 2 and must pass exhaustive parse and replay validation;
if any retained playthrough is incompatible with the blank snapshot, the entire deployment fails.

Schema compatibility does not by itself prove engine compatibility. The release validator replays
stored commands specifically to detect changes to parsing, initial-state construction, effects,
conditions, events, or turn resolution that still satisfy the Zod schemas.

See [BREAKING_SCHEMA_MIGRATIONS_README.md](BREAKING_SCHEMA_MIGRATIONS_README.md) when the proposed
change cannot remain backward compatible.

The v3-to-v4 migration records the reviewed command-help contract without rewriting retained
documents. Existing playthroughs therefore preserve their historical command results; newly
created worlds receive the expanded initial command set.

## Condition and effect domains in v6

The `v5-to-v6-reorganize-conditions-and-effects` migration makes the affected domain the outer
discriminator for every condition and effect. Player-facing item actions such as `take`, `drop`, and
`open` become Player effects; direct item-state mutations remain Item effects; movement and exit
locking become Navigation effects; and flags, counters, and text move under World, Room, or Item as
appropriate. Item conditions are flattened from their former nested `test` object.

The migration walks complete retained world documents, including commands, events, item hooks,
saved condition definitions, and saved effect groups. It preserves unrelated authored fields and
renames command-variable bindings whenever their target field moves or changes name. Retained game
states replay their commands to populate the new player runtime fields; messages remain unchanged.

## Empty legacy flags in v7

The `v6-to-v7-name-empty-logic-flags` migration replaces blank flag names in retained condition and
effect logic with the deterministic reserved key `legacy.empty-flag`. Using one key preserves the
relationship between legacy effects that write the unnamed flag and conditions that read it. Game
states and messages remain unchanged while their rows advance to schema version 7.

## Retained game-state replay in v8

The `v7-to-v8-replay-retained-game-states` migration rebuilds turn snapshots sequentially from each
playthrough's pinned world and recorded command log. The final replayed turn becomes the current
state. Each turn's output messages and the final transcript are regenerated from those replayed
states. The release gate verifies that every turn, transcript, and final state exactly matches
exhaustive replay before committing schema version 8.

## Saved condition names in v9

The `v8-to-v9-name-saved-conditions` migration adds an empty name to retained saved-condition
definitions that predate the reusable logic-library naming field. Existing authored names and all
condition logic remain unchanged. Game states and messages advance to version 9 without rewriting
their JSON.
