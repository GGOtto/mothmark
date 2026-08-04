# Repository agent guidance

## Collaboration

- Treat exploratory product and interface ideas as design discussion until the user explicitly asks to build them. Do not turn an open design conversation into implementation prematurely.

## Test data

- Build schema-backed objects in tests with `createDefaultFieldObject(schema)`, then override only the fields relevant to the behavior under test.
- Do not hand-write complete schema-backed fixtures or cast partial object literals to schema-inferred types. Tests should remain valid when unrelated schema fields are added.
- Small helpers may wrap `createDefaultFieldObject`, merge targeted overrides, and handle nested overrides when that makes tests clearer.
- Hand-written values are still appropriate for primitives, narrow non-schema types, and deliberately invalid inputs used to test validation failures.

## Working on the engine

- The engine is under rapid construction. Expect schemas, command syntax, state shapes, and runtime behavior to change frequently; verify assumptions against the current code before implementing or testing engine work.
- The player experience is the highest authority. Judge engine behavior by what the player sees, can understand, and can successfully do—not merely by what the current implementation happens to produce.
- Intentional player-facing expectations and `*.player.test.ts` tests outrank conflicting implementation behavior. If the current code produces confusing, incorrect, or poor player output, fix the code to satisfy the player-path expectation; do not weaken or rewrite an authoritative test just to match broken behavior.
- Treat current code as evidence of implementation, not automatic proof of intended behavior. When intent is unclear, inspect the player view and surrounding player-path tests before deciding what should change.
- Treat target eligibility as a privacy boundary. Resolve names only among candidates allowed by the target block's source and filters, and collapse absent, hidden, inaccessible, and otherwise ineligible targets into the same unresolved-target result so command probing cannot reveal world contents.
- When intended engine behavior changes, update implementation, maintained fixtures, focused tests, and player-path tests together rather than preserving stale expectations or adding compatibility workarounds unless backward compatibility is explicitly required.
- Keep engine changes cohesive and easy to revise. Prefer small, direct abstractions over speculative frameworks, and remove obsolete helpers, fixture fields, and assertions as soon as the behavior they supported is replaced.
- Every engine behavior must be covered by a player-path test that plays the game through `resolveTurn`, issuing commands in the same way a player would.
- Put player-path coverage in a separate companion test file named `*.player.test.ts`. For example, behavior tested in `resolveEffects.test.ts` should have its player-path coverage in `resolveEffects.player.test.ts`.
- Player-path tests are required in addition to normal focused tests; they do not replace them. Keep unit and lower-level integration tests for precise inputs, outputs, edge cases, and failure diagnosis, then cover the same behavior through `resolveTurn` to verify that parsing, command dispatch, state updates, effects, and turn resolution work together.
- Use `src/engine/testUtils.ts` for the small set of maintained test worlds and corresponding game states. Prefer extending one of these canonical scenarios when the behavior fits instead of creating a new full world fixture in each test.
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

## Schema-driven editors

- Treat the effect and condition schemas as the sole source of truth for their editors. Derive supported types, operations, field controls, labels, and default values from schema structure and metadata; do not maintain parallel editor catalogs or type-specific fixtures in editor code.

## Initial commands

- Build every new command in `src/data/commands/initialCommands.ts` from reusable conditions and effects. Do not put command-specific gameplay behavior in the command definition; when the available schemas cannot express the command, add the missing condition or effect and implement its focused and player-path coverage first.

## Immutable object updates

- Use Immer for immutable updates to large or deeply nested objects instead of manually spreading every level.
- Follow this especially in engine code, where game and world state objects are large and nested.
- Keep simple direct construction or shallow copies when they are clearer for small objects; do not introduce Immer when no meaningful nested update is involved.

## UI visual language

- Treat `docs/design-system.md` and the semantic tokens in `src/app/globals.css` as the production
  color and usage contract. New app-facing styles must use those tokens.
- Use sentence case for interface headings and labels. Reserve all-caps text for rare, genuinely useful compact markers; do not use repeated uppercase eyebrow or section-heading patterns.
- Keep UI styling restrained, task-specific, and consistent with Mothmark's quiet archive-workbench character. Avoid generic AI-generated dashboard patterns, excessive pills or cards, decorative gradients, glow effects, and ornamental copy.
- Color may distinguish entity types, but apply it to small identification cues such as icons, markers, badge outlines, and subtle selection tints rather than filling entire rows or panels. Avoid repeating colored edge rails across controls and results.
- Use action blue for interaction, brass for focus and rare identity emphasis, and semantic colors only
  for their named statuses. Do not introduce another primary-action color.
- Keep the header and activity rail in one compact, neutral, theme-aware shell family. Use subtle
  borders, surface hover states, and a single action-blue selected indicator instead of a saturated
  frame around the workspace.
- Preserve the established left activity-rail button geometry, spacing, compact typography, and
  label-reveal behavior when changing site styling. Color migrations may retheme it but must not
  redesign its controls.
- Give the authored map deliberate light and dark palettes. Preserve its geometry and semantic color
  roles across themes; floating map controls follow the application surface tokens.
- Keep the embedded player terminal monospace and theme-aware. Preserve its command prompt and
  uninterrupted output flow; do not style it as a form, chat, or card list.
- Preserve a property inspector's scroll position when editing the current selection. Scroll to the
  top only when the user navigates to a different entity or editor view.
- Verify inspector control layouts at both the normal 447px width and the 310px minimum. Fields,
  bound-variable controls, and floating menus must not introduce horizontal overflow or leave the
  viewport.
- Keep command selection in the command library rather than adding a second command scroller inside
  the editor. Pin command behavior and pattern creation controls above the pattern workspace.
- Treat repeated command block IDs as shared block identities across patterns. Block edits propagate
  to every occurrence, while ordering remains pattern-specific. Single-pattern block changes are
  immediate; with alternatives, structural changes prompt for scope and value-block changes confirm
  their shared all-pattern impact.
- Use 4px control, 6px panel/popover, and 8px dialog radii. Use shadows only for floating layers.
- Hard-coded production colors are limited to the authored map palettes, ordered entity palette, and
  deliberately bounded theme previews. All other production colors must use semantic tokens.

## Local browser testing

- Assume the development app is usually already running at `http://localhost:3000`. When using the
  browser skill for local UI testing, try that URL before starting another development server.

## IDs

- Represent every entity ID as a typed `ID` object such as `{type: "room", id: "atrium"}`. Do not use bare strings for IDs.
- Use the ID utilities in `src/utils/idUtils.ts` instead of manually constructing, reading, comparing, or generating IDs.
- Use `toID` to create or normalize an ID, `idValue` when the underlying string value is needed, `compareIds` for equality, and `generateUniqueId` when generating a new unique value.
- Preserve the entity type when passing IDs between schemas, engine state, editor state, and tests.
- Keep command block IDs internal; do not display them in author-facing command controls or summaries.
- Test fixtures must also use the ID utilities; do not hide invalid string IDs behind type assertions.

## Be proactive when fixing typescript errors

- Run `pnpm ts-check` to surface any errors.
- Fix these errors, even if they're not part of your work.
- Note that any typescript errors block preview deployments.

## Maintaining this file

- Keep `AGENTS.md` current as repository conventions evolve.
- When the user identifies a recurring frustration, correction, or preferred working convention that is likely to apply to future tasks, add or refine a concise rule here as part of the same task.
- Avoid recording one-off preferences that have no likely future relevance, and consolidate overlapping rules instead of accumulating duplicates.
