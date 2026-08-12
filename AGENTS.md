# Repository agent guidance

## Collaboration

- Treat exploratory product and interface ideas as design discussion until the user explicitly asks to build them. Do not turn an open design conversation into implementation prematurely.
- Keep application secrets in the matching Phase environment, including local Development; do not
  add secrets to local `.env` files.
- Do not assume API responses always contain JSON. Client request helpers must accept empty successful
  responses and surface a stable application error for empty or malformed error responses.
- Keep each feedback submission as one two-way support conversation mirrored in the admin inbox,
  every active administrator's email, and the customer's email thread. Send customer-facing mail as
  `Mothmark Support <support@mothmark.app>` and never expose an administrator's personal address.
  Preserve a separate, stable Message-ID reference chain for the customer and for each administrator;
  a new feedback form starts a new thread, while every reply to that submission stays in its thread.

## Test data

- Build schema-backed objects in tests with `createDefaultFieldObject(schema)`, then override only the fields relevant to the behavior under test.
- Do not hand-write complete schema-backed fixtures or cast partial object literals to schema-inferred types. Tests should remain valid when unrelated schema fields are added.
- Small helpers may wrap `createDefaultFieldObject`, merge targeted overrides, and handle nested overrides when that makes tests clearer.
- Hand-written values are still appropriate for primitives, narrow non-schema types, and deliberately invalid inputs used to test validation failures.
- Keep migration tests outside `db/migrations`; Knex imports every module in that directory as an executable migration. Put them in `db/migrationTests` instead.

## Persisted schema compatibility

- Persisted world, game-state, and message schemas must remain backward compatible by default. Read `SCHEMA_COMPATIBILITY_README.md` before changing them.
- After any persisted schema or nested schema dependency changes, run `pnpm storage:contract` and review `storage-contract.snapshot.json`; never approve the generated diff mechanically.
- Safe changes add optional fields, neutral defaults, or accepted variants. Removing or renaming fields, narrowing validation, changing meaningful defaults or transforms, or removing variants requires a numbered migration documented in `BREAKING_SCHEMA_MIGRATIONS_README.md`.
- A breaking change must increment `PERSISTED_SCHEMA_VERSION` exactly once, add and register the adjacent migration, and explicitly migrate or mark unchanged worlds, game states, and messages.
- Apply a migration only to rows at its exact `fromVersion`, and couple every transform (including `unchanged`) to the adjacent `schema_version` bump. Never edit, reorder, or reuse an applied migration.
- Treat a migration's transitive output as immutable too. Do not update the pinned v1-to-v2 output digest when shared blank-world or initial-command data changes; preserve the historical output and add the next adjacent migration.
- Migration inputs are legacy `unknown` JSON. Do not cast them to current schema-inferred types, mutate them, query the database from a transform, or discard unrelated authored data.
- Keep compatibility transformations in `src/compat/migrations`. Do not add them to components, page loaders, route handlers, or ordinary repositories.
- Decode retained database and import JSON through `src/compat/storageCodec.ts`; do not parse persisted JSON directly with the current `WorldSchema`, `GameStateSchema`, or `GameMessageSchema`.
- Add focused legacy-fixture tests for every migration and player-path replay coverage for any change that can affect play. Do not weaken schemas, fixtures, or player-facing expectations to make compatibility checks pass.
- `pnpm release:migrate` must parse every retained draft, template, publication snapshot, playthrough, transcript, and turn and replay every command before production promotion. Never replace exhaustive validation with sampling.
- Database migrations run through the gated release workflow described in `DEPLOYMENT_STORAGE_GATE_README.md`, never from `next build` or application startup. Do not force-promote a deployment whose storage compatibility check failed.

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
- Reuse the existing typed-field command-variable path for condition and effect inputs. Expose ordinary schema fields such as `itemId`, then bind command blocks through `commandVariables` so the shared variable UI and runtime resolver handle them; do not introduce parallel source selectors or command-target resolution systems.

## Initial commands

- Load every new initial command through `src/data/commands/initialCommands.ts` and compose it from reusable conditions and effects. Do not put command-specific gameplay behavior in the command definition; when the available schemas cannot express the command, add the missing condition or effect and implement its focused and player-path coverage first.
- Standard item commands such as take, examine, and use must remain saved command documents whose behavior is entirely composed from item conditions and effects. Do not add command-name checks or action-specific branches to command parsing or dispatch.
- Store each saved initial command as a complete JSON document in `src/data/commands`, then import and validate it with `CommandSchema` at the shared loading boundary. Do not maintain saved command documents as TypeScript object builders.

## Items

- Model scenery and former room features as global items. A fixed item is simply an item without the `takeable` important tag; do not reintroduce a separate feature entity.
- Use one `size` value for carrying, container, and surface capacity. Containers and surfaces limit their contents by size, but their own external size stays fixed when filled.

## Immutable object updates

- Use Immer for immutable updates to large or deeply nested objects instead of manually spreading every level.
- Follow this especially in engine code, where game and world state objects are large and nested.
- Keep simple direct construction or shallow copies when they are clearer for small objects; do not introduce Immer when no meaningful nested update is involved.

## UI visual language

- Treat `docs/design-system.md` and the semantic tokens in `src/app/globals.css` as the production
  color and usage contract. New app-facing styles must use those tokens.
- Use sentence case for interface headings and labels. Reserve all-caps text for rare, genuinely useful compact markers; do not use repeated uppercase eyebrow or section-heading patterns.
- Keep UI styling restrained, task-specific, and consistent with Mothmark's quiet archive-workbench character. Avoid generic AI-generated dashboard patterns, excessive pills or cards, decorative gradients, glow effects, and ornamental copy.
- Do not expose production navigation to placeholder pages that have no real schema-backed object or
  user task. Hide unfinished destinations until their functionality exists instead of filling them
  with generic cards, roadmap copy, invented examples, or decorative content.
- Let primary page and workspace content use the available canvas. Do not place catalogs, settings,
  detail views, or other substantial content in an arbitrarily narrow centered card or max-width
  wrapper; constrain width only when a deliberately short reading measure or compact form requires it.
- When a page or workspace can grow vertically, keep its title, search, filters, and primary actions
  in a non-scrolling header region and scroll only the content body. Do not use one outer scroller that
  carries page-level controls out of view with the content.
- Present worlds as restrained, content-led cards in private libraries and public discovery surfaces;
  do not reduce worlds to table or list rows.
- Treat Items as a two-surface workflow: a full-workspace object selector followed by a dedicated
  full-workspace item page. Do not bring the map into the Items view or make the right property
  inspector the primary item editor. Do not assume, generate, or infer item imagery that authors have
  not supplied, and do not fall back to dashboard grids or decorative fields of names. The selector's
  visual identity may use a small maintained library of flat, stylized, reusable SVG categories
  selected by recognized item tags; never create bespoke or inferred artwork for each item. Keep
  item names horizontal and visible, avoid realistic or metallic rendering, and avoid RPG inventory
  conventions or ornamental fantasy chrome.
- Color may distinguish entity types, but apply it to small identification cues such as icons, markers, badge outlines, and subtle selection tints rather than filling entire rows or panels. Avoid repeating colored edge rails across controls and results.
- Use action blue for interaction, brass for focus and rare identity emphasis, and semantic colors only
  for their named statuses. Do not introduce another primary-action color.
- Keep the header and activity rail in one compact, neutral, theme-aware shell family. Use subtle
  borders, surface hover states, and a single action-blue selected indicator instead of a saturated
  frame around the workspace.
- Preserve the established left activity-rail button geometry, spacing, compact typography, and
  label-reveal behavior when changing site styling. Color migrations may retheme it but must not
  redesign its controls.
- Render the authored map and all map previews with the light map palette in both application themes.
  Keep the dark map palette defined but inactive, preserve geometry and semantic color roles, and let
  floating map controls follow the application surface tokens.
- Keep the embedded player terminal monospace and theme-aware. Preserve its command prompt and
  uninterrupted output flow; do not style it as a form, chat, or card list.
- Preserve a property inspector's scroll position when editing the current selection. Scroll to the
  top only when the user navigates to a different entity or editor view.
- Present active account sessions as structured records rather than plain bullet text, and keep a
  self-service action for signing out every device. Derive a short browser-and-device label when the
  session is created; do not retain the raw user-agent string or add fingerprinting data just to make
  the session list more detailed.
- Open condition and effect editors directly from their workspace buttons; do not require selecting
  them in the right inspector before their popup can open.
- Verify inspector control layouts at both the normal 447px width and the 310px minimum. Fields,
  bound-variable controls, and floating menus must not introduce horizontal overflow or leave the
  viewport.
- Build production dialogs, menus, pickers, and popovers with the shared overlay primitives. Keep
  them inside the visual viewport, promote complex phone popovers to sheets, trap and return focus,
  lock background scrolling, and keep scrollable content and actions usable above onscreen keyboards.
- Keep command selection in the command library rather than adding a second command scroller inside
  the editor. Pin command behavior and pattern creation controls above the pattern workspace.
- Treat repeated command block IDs as shared block identities across patterns. Block edits propagate
  to every occurrence, while ordering remains pattern-specific. Single-pattern block changes are
  immediate; with alternatives, structural changes prompt for scope and value-block changes confirm
  their shared all-pattern impact.
- Use 4px control, 6px panel/popover, and 8px dialog radii. Use shadows only for floating layers.
- Hard-coded production colors are limited to the authored map palettes, ordered entity palette, and
  deliberately bounded theme previews. All other production colors must use semantic tokens.
- Keep private-world navigation under `/worlds`: the library is `/worlds` and an editor is
  `/worlds/[editorSlug]`. Use a stable, owner-scoped readable editor slug for private URLs and export
  filenames while keeping the world UUID internal. Editor slugs are distinct from future publication
  slugs and do not grant or broaden access. Treat old UUID and `/editor` URLs as redirects, not the
  primary route family.
- Keep public user profiles under `/users/[username]`. Display the username as the public name unless
  the user explicitly supplies a display name; never derive a public name from email or expose the
  email on a public profile. Link author usernames on published-world cards to that profile. Accept
  bare website domains in profile settings and normalize them to HTTPS instead of requiring users to
  type the scheme.
- A blank-world choice must contain no authored rooms, items, connections, layers, conditions,
  effects, or events. The first room a user adds becomes its starting room.
- Keep the bundled starter world small, plainspoken, and clearly instructional. Avoid sprawling
  lore, ornamental descriptions, or generated-sounding filler in maintained starter content.

## Local browser testing

- Assume the development app is usually already running at `http://localhost:3000`. When using the
  browser skill for local UI testing, try that URL before starting another development server.

## Browser and UX testing

- Treat Playwright tests in `e2e/` as the source of truth for intentional, user-visible browser
  workflows. If current behavior conflicts with an intentional UX test, fix the experience instead
  of weakening the test unless the product expectation has deliberately changed.
- Add or update Playwright coverage when changing routes, navigation, dialogs, or multi-step author
  workflows. Cover the shortest intended path and assert the useful visible result, focus or state
  change—not merely that a control can be clicked.
- Prefer accessible role, label, and visible-name locators. Improve production semantics when a
  control cannot be located accessibly; use test IDs only when no meaningful semantic locator exists.
- Keep browser tests deterministic. Start from maintained test data or intercept external persistence
  boundaries, and do not depend on a developer's database, local draft, theme preference, or prior
  browser state.
- Fail browser workflows on uncaught page errors and unexpected console errors. Retain traces,
  screenshots, and video on failure for diagnosis; use screenshot assertions only when visual layout
  itself is the product contract.
- For app-facing UI changes, run the relevant Playwright tests with `pnpm test:e2e`, along with focused
  unit tests and `pnpm ts-check`, before finishing.
- Use `pnpm test:all` to run the complete Jest and Playwright suites. The pre-commit hook runs this
  command after staged-file formatting and must remain blocking when either suite fails.

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
