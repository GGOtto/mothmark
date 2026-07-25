# Repository agent guidance

## Test data

- Build schema-backed objects in tests with `createDefaultFieldObject(schema)`, then override only the fields relevant to the behavior under test.
- Do not hand-write complete schema-backed fixtures or cast partial object literals to schema-inferred types. Tests should remain valid when unrelated schema fields are added.
- Small helpers may wrap `createDefaultFieldObject`, merge targeted overrides, and handle nested overrides when that makes tests clearer.
- Hand-written values are still appropriate for primitives, narrow non-schema types, and deliberately invalid inputs used to test validation failures.

## Working on the engine

- Every engine behavior must be covered by a player-path test that plays the game through `resolveTurn`, issuing commands in the same way a player would.
- Put player-path coverage in a separate companion test file named `*.player.test.ts`. For example, behavior tested in `resolveEffects.test.ts` should have its player-path coverage in `resolveEffects.player.test.ts`.
- Player-path tests are required in addition to normal focused tests; they do not replace them. Keep unit and lower-level integration tests for precise inputs, outputs, edge cases, and failure diagnosis, then cover the same behavior through `resolveTurn` to verify that parsing, command dispatch, state updates, effects, and turn resolution work together.
- Use the shared engine test utility file for a small set of maintained test worlds and corresponding game states. Prefer extending one of these canonical scenarios when the behavior fits instead of creating a new full world fixture in each test.
- Keep shared test worlds intentionally small, coherent, schema-valid, and broadly reusable. Construct them with the repository's schema-backed test-data helpers and typed ID utilities so they remain maintainable as schemas evolve.
- A specialized test may define its own world or game state when the shared scenarios would make the setup less clear or cannot represent an important edge case. Keep that fixture narrowly scoped and follow the same schema-backed object and typed-ID conventions.
- Assert player-observable results and the resulting game state in `resolveTurn` tests. Avoid bypassing the command path by calling an internal engine function when the purpose of the test is to demonstrate behavior available during normal play.

### Maintaining player-path tests

- When adding or changing engine behavior, update its focused tests and its `*.player.test.ts` companion coverage in the same change.
- Review the shared engine test worlds and game states whenever schemas, command syntax, parsing, initial-state construction, or turn-resolution behavior changes. Update the maintained fixtures so they continue to represent valid games that can be played through `resolveTurn`.
- Keep commands, expected messages, and state assertions aligned with actual player-facing behavior. Do not preserve obsolete commands or outputs merely to keep an old fixture passing.
- When a specialized fixture begins to support several tests or engine areas, promote and consolidate it into the shared engine test utility instead of allowing duplicate worlds to drift independently.
- Remove or revise shared fixture details that no longer exercise supported behavior. Each maintained room, feature, item, flag, event, and command should have a clear purpose in player-path coverage.
- Before finishing engine work, run both the focused test files and the relevant `*.player.test.ts` files, then run `pnpm ts-check`.

## Immutable object updates

- Use Immer for immutable updates to large or deeply nested objects instead of manually spreading every level.
- Follow this especially in engine code, where game and world state objects are large and nested.
- Keep simple direct construction or shallow copies when they are clearer for small objects; do not introduce Immer when no meaningful nested update is involved.

## IDs

- Represent every entity ID as a typed `ID` object such as `{type: "room", id: "atrium"}`. Do not use bare strings for IDs.
- Use the ID utilities in `src/utils/idUtils.ts` instead of manually constructing, reading, comparing, or generating IDs.
- Use `toID` to create or normalize an ID, `idValue` when the underlying string value is needed, `compareIds` for equality, and `generateUniqueId` when generating a new unique value.
- Preserve the entity type when passing IDs between schemas, engine state, editor state, and tests.
- Test fixtures must also use the ID utilities; do not hide invalid string IDs behind type assertions.

## Be proactive when fixing typescript errors

- Run `pnpm ts-check` to surface any errors.
- Fix these errors, even if they're not part of your work.
- Note that any typescript errors block preview deployments.

## Maintaining this file

- Keep `AGENTS.md` current as repository conventions evolve.
- When the user identifies a recurring frustration, correction, or preferred working convention that is likely to apply to future tasks, add or refine a concise rule here as part of the same task.
- Avoid recording one-off preferences that have no likely future relevance, and consolidate overlapping rules instead of accumulating duplicates.
