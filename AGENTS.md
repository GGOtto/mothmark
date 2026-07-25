# Repository agent guidance

## Test data

- Build schema-backed objects in tests with `createDefaultFieldObject(schema)`, then override only the fields relevant to the behavior under test.
- Do not hand-write complete schema-backed fixtures or cast partial object literals to schema-inferred types. Tests should remain valid when unrelated schema fields are added.
- Small helpers may wrap `createDefaultFieldObject`, merge targeted overrides, and handle nested overrides when that makes tests clearer.
- Hand-written values are still appropriate for primitives, narrow non-schema types, and deliberately invalid inputs used to test validation failures.

## Immutable object updates

- Use Immer for immutable updates to large or deeply nested objects instead of manually spreading every level.
- Follow this especially in engine code, where game and world state objects are large and nested.
- Keep simple direct construction or shallow copies when they are clearer for small objects; do not introduce Immer when no meaningful nested update is involved.

## Be proactive when fixing typescript errors

- Run `pnpm ts-check` to surface any errors.
- Fix these errors, even if they're not part of your work.
- Note that any typescript errors block preview deployments.

## Maintaining this file

- Keep `AGENTS.md` current as repository conventions evolve.
- When the user identifies a recurring frustration, correction, or preferred working convention that is likely to apply to future tasks, add or refine a concise rule here as part of the same task.
- Avoid recording one-off preferences that have no likely future relevance, and consolidate overlapping rules instead of accumulating duplicates.
