## Current Tasks

This backlog is for getting Mothmark to a simple working version of the
map-first text adventure editor described in:

- `docs/README_spec.md`
- `docs/README_feature_recommendations.md`
- `docs/README_mothmark_brand_vibe.md`
- `docs/README_author_defined_commands.md`
- `docs/README_alias_suggestion_system_spec.md`

Keep tasks small. If a task starts feeling like a project, split it before
starting. Build the local authoring loop first: make a room, add a feature,
test a command, see validation, save locally, export JSON.

If you find a completed task that's not marked here in your normal search, add
it here as completed or check it off.

## Working Definition

A first working version should let an author:

- open the editor
- create and move rooms on the map
- connect rooms with directional exits
- edit room names, IDs, descriptions, and features
- test movement and feature examination in the command preview
- see clear validation issues
- import and export world JSON
- keep work through local autosave

Do not treat accounts, publishing, admin review, player automaps, or creator
analytics as required for this local working version.

## Task Rules

- [ ] Keep every visible label concrete: room, exit, connection, command, issue, checkpoint.
- [ ] Use `lucide-react` for new UI icons.
- [ ] Keep UI work aligned with the night-archive palette in the vibe doc.
- [ ] Use verdigris for selection and creation states.
- [ ] Reserve red lead or madder for warnings, errors, and destructive actions.
- [ ] Add or update tests when changing parser, validation, schema, or map utilities.
- [ ] Prefer JSON world data as the source of truth.
- [ ] Do not add AI positioning, generated copy, mascot art, or marketing cards.

## Map Tab

Purpose: the main canvas for rooms, exits, map editing, and the live command
preview.

### Already Done

- [x] Smooth curve for each passageway connector
- [x] Moving rooms
- [x] Moving where the passageways connect
- [x] New passageways and new rooms from the map
- [x] Select a room from the map
- [x] Click passageways to select them
- [x] Show selected passageway details in the inspector
- [x] Delete passageways
- [x] Edit connection pathway
- [x] Sync command preview to selected room

### Map Toolbar

- [ ] Put real controls into `src/components/editor/ToolBar.tsx`.
- [ ] Add `Add room` toolbar action.
- [ ] Add `Delete selected` toolbar action.
- [ ] Disable `Delete selected` when nothing is selected.
- [ ] Delete selected connections from the toolbar.
- [ ] Delete selected rooms from the toolbar.
- [ ] Delete connections attached to a deleted room.
- [ ] Add `Set start room` toolbar action.
- [ ] Disable `Set start room` for connection selections.
- [ ] Add start room marker to the selected room.
- [ ] Add an Issues shortcut button.
- [ ] Use lucide icons with visible labels or tooltips.

### Room Map Editing

- [ ] Add `createDefaultRoom` in `src/utils/worldFactory.ts`.
- [ ] Add `createDefaultConnection` in `src/utils/worldFactory.ts`.
- [ ] Move duplicated default room creation into `createDefaultRoom`.
- [ ] Use `createDefaultRoom` when the map creates a room.
- [ ] Update room ID changes to update related connections or block unsafe edits.
- [ ] Warn before changing a room ID used by connections.
- [ ] Add position metadata display for selected room.
- [ ] Add read-only connection count for selected room.
- [ ] Add read-only issue count for selected room.
- [ ] Add tests for `createDefaultRoom`.
- [ ] Add tests for `createDefaultConnection`.

### Connection Editing

- [ ] Show room names next to connection endpoint IDs.
- [ ] Add direction select for `direction`.
- [ ] Add direction select for `returnDirection`.
- [ ] Add from-room select.
- [ ] Add to-room select.
- [ ] Validate changed connection endpoints before applying.
- [ ] Validate changed directions before applying.
- [ ] Warn about duplicate exits before applying.
- [ ] Add `Reverse connection` action.
- [ ] Add tests for reversing a connection.
- [ ] Add tests for duplicate connection shape detection.

### Pan, Zoom, and Fit

- [ ] Add map viewport state.
- [ ] Add zoom in action.
- [ ] Add zoom out action.
- [ ] Add reset zoom action.
- [ ] Add fit-to-rooms action.
- [ ] Keep selected room visible after fit.
- [ ] Keep labels readable at small zoom.
- [ ] Add empty-space pan after viewport state is stable.
- [ ] Add tests for fit bounds math.

### Map Warning States

- [ ] Pass room issues into `Map`.
- [ ] Pass connection issues into `Map`.
- [ ] Add room warning state styles.
- [ ] Add room error state styles.
- [ ] Add connection warning state styles.
- [ ] Add connection error state styles.
- [ ] Add non-color cues for warning and error states.
- [ ] Replace selected connection bright red with verdigris.
- [ ] Replace selected room muted tan with a clearer verdigris state.
- [ ] Add tests for issue-target selection helpers.

### Command Preview Surface

- [ ] Use `world.startRoomId` in `CommandLine` instead of `world.rooms[0]?.id`.
- [ ] Keep command output readable and monospace.
- [ ] Add a test for `CommandLine` using `world.startRoomId`.
- [ ] Add a smoke test for opening `/editor`.
- [ ] Add a smoke test for creating a room from the map.
- [ ] Add a smoke test for editing a room name.
- [ ] Add a smoke test for examining a feature.

## World Tab

Purpose: structured world content editing: rooms, descriptions, features,
objects, and room-level data.

### Already Done

- [x] Select a room from the map
- [x] Show selected room details in the inspector
- [x] Edit room name
- [x] Edit room ID
- [x] Edit room description
- [x] Edit existing room feature fields

### World Factories

- [ ] Add `createDefaultFeature` in `src/utils/worldFactory.ts`.
- [ ] Add `createDefaultWorld` in `src/utils/worldFactory.ts`.
- [ ] Use `createDefaultWorld` in the starter JSON route.
- [ ] Add tests for `createDefaultFeature`.
- [ ] Add tests that default world output passes `WorldSchema`.

### Feature Schema

- [ ] Decide whether `RoomSchema.features` should default to `[]`.
- [ ] If yes, update `RoomSchema.features` to default to `[]`.
- [ ] Update room editor code to stop needing `selectedRoom.features ?? []`.
- [ ] Update engine room code to stop needing `room.features` guards.
- [ ] Add schema test for a room without features.
- [ ] Add schema test for a room with one feature.

### Feature Creation UI

- [ ] Add an `Add feature` button to the Features panel.
- [ ] Create new feature IDs with `generateUniqueId`.
- [ ] Expand a newly added feature automatically.
- [ ] Focus the new feature name field after creation.
- [ ] Add `Delete feature` inside expanded feature cards.
- [ ] Add `Duplicate feature` inside expanded feature cards.
- [ ] Keep duplicated features expanded after creation.
- [ ] Add a duplicate feature ID warning inside the selected room.
- [ ] Add a warning when a feature name is empty.
- [ ] Add a warning when a feature description is empty.
- [ ] Disable destructive feature actions when no feature is selected.
- [ ] Add helper text for room IDs.
- [ ] Add helper text for feature IDs.
- [ ] Style feature actions with the vibe doc palette.

### Feature Visibility

- [ ] Add a condition helper for checking `activeWhen`.
- [ ] Add tests for `activeWhen` with no conditions.
- [ ] Add tests for `activeWhen` with a matching flag.
- [ ] Add tests for `activeWhen` with a missing flag.
- [ ] Add a helper that returns active room features.
- [ ] Add a helper that returns listed room features.
- [ ] Update room descriptions to list only active features.
- [ ] Update room descriptions to list only `listedInRoom` features.
- [ ] Add a test that hidden features are not listed in room output.
- [ ] Add a test that inactive features are not listed in room output.

### World Content Tests

- [ ] Add schema tests for all new world fields.
- [ ] Add utility tests for world factory helpers.
- [ ] Keep docs updated when schema names change.

## Logic Tab

Purpose: parser behavior, target resolution, alias help, authored commands, and
safe rule-based interactions.

### Target Resolution

- [ ] Create `src/engine/targetResolution.ts`.
- [ ] Add a `ResolvedTarget` type for room features.
- [ ] Add a result type for found, missing, and ambiguous targets.
- [ ] Resolve a feature by exact name.
- [ ] Resolve a feature by alias.
- [ ] Ignore inactive features.
- [ ] Include unlisted but active features in examine resolution.
- [ ] Return ambiguous when two visible features match.
- [ ] Add tests for exact name resolution.
- [ ] Add tests for alias resolution.
- [ ] Add tests for inactive feature exclusion.
- [ ] Add tests for ambiguous target resolution.
- [ ] Move shared phrase matching helpers out of `commands.ts` only if needed.

### Examine Features

- [ ] Update `examine` to use target resolution.
- [ ] Show the resolved feature description on `examine`.
- [ ] Add a fallback message when no feature matches.
- [ ] Add an ambiguity message when multiple features match.
- [ ] Add a feature-examined flag helper in `src/engine/flags.ts`.
- [ ] Set the feature-examined flag after examining a feature.
- [ ] Add command tests for `examine feature-name`.
- [ ] Add command tests for `x feature-alias`.
- [ ] Add command tests for no matching feature.
- [ ] Add command tests for ambiguous feature names.
- [ ] Remove stale TODOs after target resolution is implemented.

### Parser Utilities

- [ ] Create `src/engine/parser.ts`.
- [ ] Move `normalizeInput` to parser utilities.
- [ ] Move `phraseMatches` to parser utilities.
- [ ] Move `namedThingMatchesText` to parser utilities.
- [ ] Move `parseInputWithAlias` to parser utilities.
- [ ] Keep existing command tests passing after the move.
- [ ] Add focused parser utility tests.

### Parser Preview

- [ ] Create `src/engine/parserPreview.ts`.
- [ ] Preview which command alias matches sample input.
- [ ] Preview connector parsing for sample input.
- [ ] Preview target text for sample input.
- [ ] Preview target resolution for current room features.
- [ ] Show missing target preview state.
- [ ] Show ambiguous target preview state.
- [ ] Add parser preview tests.

### Alias Warnings

- [ ] Add alias conflict detection within one room.
- [ ] Warn when a feature alias matches another feature name.
- [ ] Warn when a feature alias matches another feature alias.
- [ ] Warn when an alias is a direction word.
- [ ] Warn when an alias is a connector word.
- [ ] Warn when an alias is too generic.
- [ ] Show alias warnings in feature cards.
- [ ] Keep alias suggestions deterministic.
- [ ] Do not auto-add aliases.

### Authored Command Schema

- [ ] Add authored command type to world schema.
- [ ] Add trigger alias list.
- [ ] Add optional connector field.
- [ ] Add current-room condition.
- [ ] Add flag condition.
- [ ] Add feature-examined condition.
- [ ] Add show-message effect.
- [ ] Add set-flag effect.
- [ ] Add move-player effect.
- [ ] Add schema tests for authored commands.

### Authored Command Engine

- [ ] Create `src/engine/conditions.ts`.
- [ ] Move reusable condition checks into `conditions.ts`.
- [ ] Create `src/engine/effects.ts`.
- [ ] Run show-message effect.
- [ ] Run set-flag effect.
- [ ] Run move-player effect.
- [ ] Create `src/engine/authoredCommands.ts`.
- [ ] Compile authored commands into command definitions.
- [ ] Run authored commands before generic commands.
- [ ] Fall back to generic commands when authored conditions fail.
- [ ] Add tests for an authored show-message command.
- [ ] Add tests for an authored set-flag command.
- [ ] Add tests for authored command fallback.

### Logic UI

- [ ] Create `src/components/editor/logic/LogicPanel.tsx`.
- [ ] Render authored commands in the Logic tab.
- [ ] Add `Add command` action.
- [ ] Edit command name.
- [ ] Edit trigger aliases.
- [ ] Add a current-room condition.
- [ ] Add a flag condition.
- [ ] Add a show-message effect.
- [ ] Add a set-flag effect.
- [ ] Delete an authored command.
- [ ] Duplicate an authored command.
- [ ] Show parser preview for command aliases.

## Issues Tab

Purpose: validation, broken-world feedback, warnings, and quick navigation back
to the related room or connection.

### Validation Core

- [ ] Create `src/engine/worldValidation.ts`.
- [ ] Define issue severity values: error, warning.
- [ ] Define issue target values: world, room, connection, feature.
- [ ] Add validation for missing start room.
- [ ] Add validation for duplicate room IDs.
- [ ] Add validation for duplicate connection IDs.
- [ ] Add validation for connections from missing rooms.
- [ ] Add validation for connections to missing rooms.
- [ ] Add validation for duplicate exits from the same room and direction.
- [ ] Add validation for empty room names.
- [ ] Add validation for empty room descriptions.
- [ ] Add validation for duplicate feature IDs within one room.
- [ ] Add validation for duplicate feature aliases within one room.
- [ ] Add validation for unreachable rooms from `startRoomId`.
- [ ] Add validation for dead ends as warnings.
- [ ] Add tests for each validation rule.

### Issues State

- [ ] Run validation in `src/app/editor/page.tsx`.
- [ ] Store validation issues as derived editor state.
- [ ] Pass issue counts to the left sidebar.
- [ ] Show error count on the Issues nav item.
- [ ] Show warning count on the Issues nav item.
- [ ] Keep the Issues nav badge readable without relying only on color.

### Issues Panel

- [ ] Create `src/components/editor/issues/IssuesPanel.tsx`.
- [ ] Add issue list styles.
- [ ] Show issue severity.
- [ ] Show issue message.
- [ ] Show related room, connection, or feature ID.
- [ ] Add empty state copy: `No issues found.`
- [ ] Switch the Issues tab to render `IssuesPanel`.
- [ ] Click a room issue to select the room.
- [ ] Click a connection issue to select the connection.
- [ ] Click an issue to switch back to the map.
- [ ] Add keyboard focus styles for issue rows.

### Issues Reliability

- [ ] Add validation tests for editor issues.
- [ ] Add tests for issue sorting.
- [ ] Add tests for issue grouping by target.
- [ ] Ensure validation states are not color-only.
- [ ] Ensure keyboard selection works for issue rows.

## World Settings Tab

Purpose: world-level metadata and defaults that should not live on a selected
room.

### Already Done

- [x] Generate starter JSON from the schema

### World Settings Schema

- [ ] Add world title to `WorldSchema`.
- [ ] Add optional intro text to `WorldSchema`.
- [ ] Add optional author notes to `WorldSchema`.
- [ ] Add default parser messages to `WorldSchema`.
- [ ] Add default message for unknown command.
- [ ] Add default message for blocked movement.
- [ ] Add schema tests for world settings defaults.

### World Settings UI

- [ ] Create `src/components/editor/world-settings/WorldSettingsPanel.tsx`.
- [ ] Render world settings in the World Settings tab.
- [ ] Edit world title.
- [ ] Edit start room from a select.
- [ ] Edit intro text.
- [ ] Edit author notes.
- [ ] Edit unknown command message.
- [ ] Edit blocked movement message.
- [ ] Use world blocked movement message in `movePlayer`.
- [ ] Use world unknown command message in command fallback.
- [ ] Add tests for custom parser messages.

### Starter JSON

- [ ] Add a link from the editor to `/starter`.
- [ ] Add a link from `/starter` back to `/editor`.
- [ ] Make `/starter` copy text match the current schema.
- [ ] Keep `/starter` styling aligned with the vibe doc.

## Settings Tab

Purpose: local editor preferences, local drafts, import/export, app polish, and
other editor-level utilities.

### Local Autosave

- [ ] Create `src/hooks/useLocalWorldDraft.ts`.
- [ ] Save editor world to `localStorage`.
- [ ] Debounce local saves.
- [ ] Store a local draft schema version.
- [ ] Restore a valid local draft on editor load.
- [ ] Ignore invalid local draft data.
- [ ] Show restored draft state in the toolbar.
- [ ] Show saved state in the toolbar.
- [ ] Show unsaved state in the toolbar.
- [ ] Add a clear local draft action.
- [ ] Confirm before clearing a local draft.
- [ ] Add tests for local draft serialization helpers.

### Export JSON

- [ ] Add an `Export JSON` action.
- [ ] Serialize the current world with stable formatting.
- [ ] Download the exported JSON file.
- [ ] Name the file from the world title once titles exist.
- [ ] Use a fallback filename before world titles exist.
- [ ] Add a copy-to-clipboard fallback for export.

### Import JSON

- [ ] Add an `Import JSON` action.
- [ ] Add a file picker for JSON files.
- [ ] Add a paste JSON dialog.
- [ ] Validate imported JSON with `WorldSchema.safeParse`.
- [ ] Show import schema errors without replacing the current world.
- [ ] Show import validation issues in the Issues panel.
- [ ] Replace the editor world only after valid import.
- [ ] Select the imported `startRoomId` after import.
- [ ] Add a reset-to-example action for development.

### Home Page and App Shell

- [ ] Replace `Text adventure tools, eventually.`
- [ ] Use copy from the vibe doc: `A room-and-command editor for text adventures.`
- [ ] Keep the primary action as `Open editor`.
- [ ] Add a secondary link to starter JSON.
- [ ] Remove generic centered-card styling if it fights the app vibe.
- [ ] Show a real editor/map preview only if it uses current UI.
- [ ] Do not add fake testimonials, stats, or marketing feature cards.
- [ ] Keep route copy aligned with the vibe doc.

### Visual Alignment

- [ ] Replace generic `#111` shell colors with night-archive tokens.
- [ ] Replace generic `#161616` backgrounds with night-archive tokens.
- [ ] Replace bright white active rail marker with verdigris.
- [ ] Keep red lead for validation issues.
- [ ] Keep madder for destructive actions.
- [ ] Reduce large rounded placeholder cards.
- [ ] Verify focus states on toolbar controls.
- [ ] Verify focus states on sidebar nav.
- [ ] Verify focus states on issue rows.
- [ ] Verify focus states on inspector fields.

### Accessibility

- [ ] Add accessible names for icon-only controls.
- [ ] Add visible labels or tooltips for toolbar icons.
- [ ] Ensure keyboard focus can reach map-adjacent actions.
- [ ] Check text contrast for new styles.
- [ ] Keep button text short and verb-led.

### General Tests and Cleanups

- [ ] Consider adding Playwright after local authoring loop works.
- [ ] Fix the `Starting romm` typo in `src/schemas/worldSchema.ts`.
- [ ] Keep docs updated when schema names change.

## Later Work Outside Current Editor Tabs

Do this after the local authoring loop works. These features are important, but
they should not block the first tabbed editor version.

### Game Dashboard

- [ ] Choose persistence stack.
- [ ] Add `Game` data model.
- [ ] Add `GameVersion` data model.
- [ ] Add `PlayThrough` data model.
- [ ] Add games dashboard route.
- [ ] Create a new game from the dashboard.
- [ ] Open an existing game from the dashboard.
- [ ] Rename a game.
- [ ] Save named checkpoint.
- [ ] Restore named checkpoint.
- [ ] Show checkpoint history.
- [ ] Diff two versions structurally.

### Published Player

- [ ] Add player route.
- [ ] Load saved world data in player route.
- [ ] Start a playthrough.
- [ ] Resume a playthrough.
- [ ] Save current room.
- [ ] Save flags.
- [ ] Save inventory once inventory is real.
- [ ] Save visited rooms.
- [ ] Keep published player and editor preview on the same engine path.

### Player Automap

- [ ] Track visited rooms in game state.
- [ ] Track traversed connections in game state.
- [ ] Extract read-only map renderer pieces.
- [ ] Render only visited rooms.
- [ ] Render only traversed connections.
- [ ] Highlight current room.
- [ ] Add fog-of-war styling.

### Review Workflow

- [ ] Add draft status.
- [ ] Add pending review status.
- [ ] Add approved status.
- [ ] Add rejected status.
- [ ] Add submit-for-review action.
- [ ] Add admin pending-games view.
- [ ] Add read-only review preview.
- [ ] Add approve action.
- [ ] Add reject action with review note.
- [ ] Keep review notes practical and specific.

### Creator Feedback

- [ ] Count playthrough starts.
- [ ] Show latest room reached.
- [ ] Show rooms players rarely reach.
- [ ] Show one player's visited map overlay.
- [ ] Add likes only after published play works.
- [ ] Add follows only after published play works.
