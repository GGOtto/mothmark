# Mothmark Feature Recommendations

This document is based on a pass through the current codebase and planning docs. It is meant to be a practical feature backlog: each recommendation includes the product value, the main implementation home, supporting files, and notes about sequencing.

## Current Shape

Mothmark is already pointed in a clear direction: a map-first text adventure studio with a live parser preview.

The codebase currently has:

- A Next.js app with routes for the home page, editor, starter JSON generator, and health check.
- A shared world schema in `src/schemas/worldSchema.ts`.
- A small runtime engine in `src/engine/` for state, room descriptions, movement, commands, flags, and conditional descriptions.
- A map editor in `src/components/map/` with room dragging, node-based connection creation, connection selection, connection redrawing, and directional pathway styles.
- An editor shell in `src/app/editor/page.tsx` with map, world, logic, issues, world settings, and editor settings tabs.
- A room inspector in `src/components/editor/right-side-bar/RoomEditor.tsx` and a connection inspector in `src/components/editor/right-side-bar/ConnectionEditor.tsx`.
- A live command preview in `src/components/player/`.
- Detailed existing product docs for the map-first spec, authored commands, alias suggestions, sprints, phases, and brand direction.

The biggest opportunity is to connect the good pieces already present: make room features truly playable, surface validation inside the editor, add save/checkpoint behavior, and turn the placeholder tabs into focused tool surfaces.

## Recommended Build Order

1. Finish the local authoring loop: edit room content, add/delete features, validate the world, and preview commands.
2. Make parser targets real: resolve room features, aliases, visibility, and active conditions in engine commands.
3. Add persistence: autosave, manual checkpoints, restore, import, and export.
4. Expand the map editor: toolbar actions, zoom/fit, issues overlays, floors, and templates.
5. Add authored logic: safe command rules, conditions, effects, scheduled events, and a logic debugger.
6. Add platform features: games dashboard, published player, playthroughs, review workflow, automap, creator feedback.

## High-Impact Near-Term Features

### 1. Add Feature Creation, Deletion, and Duplication

**Why it matters:** The room inspector can edit existing `features`, but authors cannot yet create or remove them from the UI. This blocks the next engine milestone: commands interacting with room objects.

**Where it would live:**

- Primary UI: `src/components/editor/right-side-bar/RoomEditor.tsx`
- Styling: `src/components/editor/right-side-bar/RightSideBar.scss`
- ID helper: `src/utils/idUtils.ts`
- Schema: `src/schemas/worldSchema.ts`
- Example data: `src/data/worlds/exampleWorld.ts`

**Suggested behavior:**

- Add a compact `Add feature` button in the Features panel.
- Create a default feature with a unique id, empty aliases, empty description, `listedInRoom: false`, and `activeWhen: []`.
- Add `Delete` and `Duplicate` actions inside each expanded feature card.
- Validate duplicate feature ids within a room.
- Keep the newly created or duplicated feature expanded.

**Implementation notes:**

- Reuse `generateUniqueId("feature", features)` from `src/utils/idUtils.ts`.
- Consider making `features` default to `[]` in `RoomSchema` instead of optional, so UI and engine code do less `?? []` handling.

### 2. Make Room Features Playable in Commands

**Why it matters:** `src/engine/commands.ts` already has TODOs for resolving `examine`, `take`, `use`, `put`, `give`, and `unlock` targets. The schema already has room features, aliases, active conditions, and descriptions. The first satisfying engine upgrade is to make `examine feature` work for real.

**Where it would live:**

- Target resolution: new `src/engine/targetResolution.ts`
- Command behavior: `src/engine/commands.ts`
- Room visibility helpers: `src/engine/rooms.ts`
- Condition checks: `src/engine/descriptions.ts`
- Tests: `src/engine/commands.test.ts` and a new `src/engine/targetResolution.test.ts`

**Suggested behavior:**

- Resolve target text against visible active room features using `name` and `aliases`.
- Use `namedThingMatchesText` from `src/engine/commands.ts` or move it into a shared parser utility.
- Respect `activeWhen` before a feature can be examined or listed.
- On `examine`, show the resolved feature description and set `getFeatureExaminedFlag(roomId, feature.id)`.
- If multiple things match, return an ambiguity message.
- If nothing matches, use a better fallback than echoing the target.

**Implementation notes:**

- `buildRoomDescription` in `src/engine/rooms.ts` currently prints every feature description when `room.features` exists. It should only list features when `listedInRoom` is true and `activeWhen` passes.
- Start with `examine`; then wire `take/use/put/unlock` once item and object state exist.

### 3. Add an Issues Panel and On-Map Warnings

**Why it matters:** The left sidebar already has an `issues` tab, and the spec calls for validation directly on the map. This is one of the clearest ways to make the editor feel trustworthy.

**Where it would live:**

- Validation core: new `src/engine/worldValidation.ts` or `src/utils/worldValidation.ts`
- Existing schema checks: `src/schemas/worldSchema.ts`
- Issues tab: `src/app/editor/page.tsx`
- Issues UI: new `src/components/editor/issues/IssuesPanel.tsx`
- Map badges: `src/components/map/Room.tsx`, `src/components/map/Connection.tsx`
- Styles: `src/components/map/Room.scss`, `src/components/map/Connection.scss`

**Suggested checks:**

- Missing start room.
- Duplicate room ids.
- Duplicate connection ids.
- Connections pointing to missing rooms.
- Duplicate exits from the same room/direction.
- Empty room names.
- Empty room descriptions.
- Duplicate feature ids within a room.
- Feature aliases that collide within the same room.
- Orphaned rooms unreachable from `startRoomId`.
- Dead ends, marked as warnings rather than errors.

**Suggested behavior:**

- Show a count badge on the Issues tab.
- Clicking an issue selects the related room or connection and switches to the map.
- Draw warning/error state on room cards and connection paths.
- Keep validation live and local while editing.

### 4. Build the Map Toolbar

**Why it matters:** `src/components/editor/ToolBar.tsx` is currently empty. A real toolbar would make the map feel like an authoring tool rather than a canvas-only experiment.

**Where it would live:**

- Toolbar UI: `src/components/editor/ToolBar.tsx`
- Toolbar styling: `src/components/editor/ToolBar.scss`
- Editor state handlers: `src/app/editor/page.tsx`
- Map controls: `src/components/map/Map.tsx`

**Suggested first controls:**

- Fit map to rooms.
- Zoom in/out and reset zoom.
- Add room.
- Delete selected room or connection.
- Set selected room as start.
- Undo/redo once history exists.
- Save checkpoint once persistence exists.
- Issues count shortcut.

**Implementation notes:**

- Use lucide icons already available through `lucide-react`.
- Keep destructive actions disabled until a valid selection exists.
- When deleting a room, also delete connections that reference it.

### 5. Improve Connection Editing

**Why it matters:** The connection inspector can change `pathway` and delete a connection, but it cannot edit endpoints or directions through form controls. The map drag behavior is good, but authors also need exact editing.

**Where it would live:**

- Inspector UI: `src/components/editor/right-side-bar/ConnectionEditor.tsx`
- Conflict helpers: `src/utils/connectionUtils.ts`
- Schema: `src/schemas/worldSchema.ts`
- Map selection behavior: `src/components/map/Map.tsx`

**Suggested behavior:**

- Show room names next to ids in From/To fields.
- Allow changing `fromRoomId`, `toRoomId`, `direction`, and `returnDirection`.
- Use existing duplicate-shape and node-occupancy helpers before applying changes.
- Warn when a change creates one-way or no-way behavior.
- Add a `Reverse connection` action.

### 6. Add World Settings

**Why it matters:** The `world-settings` tab exists, and core world-level settings need a proper home. This keeps room editing focused on the selected room.

**Where it would live:**

- Settings panel: new `src/components/editor/world-settings/WorldSettingsPanel.tsx`
- Editor tab switch: `src/app/editor/page.tsx`
- Schema: `src/schemas/worldSchema.ts`

**Suggested settings:**

- World title.
- Start room.
- Intro text.
- Default parser messages such as "I don't understand that command" and "You can't go that way."
- Optional author notes.
- Export metadata.

**Implementation notes:**

- `src/engine/movement.ts` has a TODO to move "You can't go that way." into world data. This panel is the right UI home for that.

### 7. Add Import and Export

**Why it matters:** The `/starter` route can generate JSON, but the editor still works from the hardcoded example world. Import/export gives authors an immediate workflow before full accounts and database persistence.

**Where it would live:**

- Import/export UI: `src/components/editor/ToolBar.tsx` or a new world settings panel.
- Validation: `src/schemas/worldSchema.ts`
- Starter route reuse: `src/app/starter/page.tsx`
- Editor state: `src/app/editor/page.tsx`

**Suggested behavior:**

- Export current world as formatted JSON.
- Import JSON through a file picker or paste dialog.
- Validate with `WorldSchema.safeParse`.
- Show import errors in the Issues panel instead of replacing the current world.
- Offer a reset-to-example action for local development.

## Engine and Parser Features

### 8. Add a Target Resolution Layer

**Why it matters:** Commands should not each reinvent how a phrase maps to a room feature, item, NPC, inventory object, exit, or topic. A shared resolver makes authored commands possible later.

**Where it would live:**

- New resolver: `src/engine/targetResolution.ts`
- Parser helpers: possibly split from `src/engine/commands.ts` into `src/engine/parser.ts`
- Tests: `src/engine/targetResolution.test.ts`

**Suggested API shape:**

```ts
resolveTarget({
  world,
  gameState,
  targetText,
  scope: ["current-room-features", "inventory"],
});
```

**Suggested result shape:**

```ts
type TargetResolution =
  | {status: "found"; target: ResolvedTarget}
  | {status: "missing"}
  | {status: "ambiguous"; targets: ResolvedTarget[]};
```

### 9. Add Authored Command MVP

**Why it matters:** The existing docs define a strong no-code command model. The smallest useful version can be much smaller than the final spec: trigger aliases, optional connector, conditions, effects, and messages.

**Where it would live:**

- Schema additions: `src/schemas/worldSchema.ts`
- Command compiler: new `src/engine/authoredCommands.ts`
- Effect runner: new `src/engine/effects.ts`
- Condition helpers: expand `src/engine/descriptions.ts` or add `src/engine/conditions.ts`
- Logic UI: new `src/components/editor/logic/LogicPanel.tsx`
- Editor tab switch: `src/app/editor/page.tsx`
- Tests: new `src/engine/authoredCommands.test.ts`

**First supported conditions:**

- Current room is room id.
- Flag equals boolean.
- Feature examined.
- Room visited.
- Inventory has item, once inventory items exist.

**First supported effects:**

- Show message.
- Set flag.
- Move player to room.
- Add/remove inventory item, once items exist.
- Mark feature examined.

**Implementation notes:**

- Compile authored commands into `CommandDefinition[]` and merge them before calling `findCommand`.
- Keep protected commands such as `help` and movement coded until overriding rules are explicit.

### 10. Add Parser Preview and Alias Conflict Warnings

**Why it matters:** Parser games live or die on whether the player can guess accepted words. The current parser already supports longest-first aliases, optional leading articles, connectors, and quoted phrases. That makes a deterministic preview tool very feasible.

**Where it would live:**

- Preview engine: new `src/engine/parserPreview.ts`
- Alias helpers: new `src/engine/aliasSuggestions.ts`
- Logic or room UI: `src/components/editor/right-side-bar/RoomEditor.tsx` and future `src/components/editor/logic/LogicPanel.tsx`
- Tests: `src/engine/commands.test.ts`, plus alias-specific tests

**Suggested behavior:**

- Authors type a sample command and see which command, alias, connector, and target would match.
- Alias fields warn about conflicts in the current room.
- Suggestions are deterministic and explainable, following `docs/README_alias_suggestion_system_spec.md`.

## Map and Editor Experience

### 11. Add Pan, Zoom, Fit, and Large-World Navigation

**Why it matters:** The map is the flagship surface. It works well for a small world, but larger worlds need navigation tools before more content is added.

**Where it would live:**

- Map component: `src/components/map/Map.tsx`
- Toolbar: `src/components/editor/ToolBar.tsx`
- Map styles: `src/components/map/Map.scss`
- Point math: `src/utils/pointUtils.ts`

**Suggested behavior:**

- Pan empty canvas.
- Zoom around pointer.
- Fit all rooms.
- Reset to selected room.
- Keep room labels readable at lower zoom levels.
- Add a minimap later, after pan/zoom is stable.

### 12. Add Floors and Vertical Exits

**Why it matters:** The spec mentions floors for up/down exits, but `DirectionSchema` currently only supports eight compass directions.

**Where it would live:**

- Schema: `src/schemas/worldSchema.ts`
- Direction constants: `src/types/mapTypes.ts`
- Movement: `src/engine/movement.ts`
- Map UI: `src/components/map/Map.tsx`
- New floor controls: `src/components/editor/ToolBar.tsx` or `src/components/map/FloorSwitcher.tsx`

**Suggested behavior:**

- Add `u` and `d` to directions.
- Add `floor` to room position data, either as `room.floor` or `room.position.floor`.
- Show only one floor at a time by default.
- Render stairs markers on rooms with vertical exits.
- Allow a floor overview later.

### 13. Add Map Templates

**Why it matters:** Templates are a strong way to turn common parser-game structures into fast authoring actions: locked door, key, one-way passage, hidden room, conditional description.

**Where it would live:**

- Template definitions: new `src/data/templates/`
- Template insertion: new `src/utils/templateUtils.ts`
- UI: `src/components/editor/ToolBar.tsx` or a new left-panel drawer
- Validation: `src/engine/worldValidation.ts`

**Suggested first templates:**

- Locked door with key.
- Hidden feature revealed after examining another feature.
- One-way passage.
- Two-room puzzle with flag unlock.
- Conditional room description.

## Persistence and Platform Features

### 14. Add Local Autosave First, Then Database Save

**Why it matters:** Full auth and database work is a larger platform step. Local autosave can protect author work immediately and help shape the later `GameVersion` API.

**Where it would live:**

- Local save hook: new `src/hooks/useLocalWorldDraft.ts`
- Editor state: `src/app/editor/page.tsx`
- Toolbar status: `src/components/editor/ToolBar.tsx`
- Future API: `src/app/api/games/...`

**Suggested behavior:**

- Debounce editorWorld into `localStorage`.
- Show saved/unsaved/restored state in the toolbar.
- Store a local schema version.
- Offer clear local draft.
- Later replace or supplement with server-side `GameVersion` autosave.

### 15. Add Game, GameVersion, and Checkpoints

**Why it matters:** The spec depends on structural version history. The app needs a persistent save model before publishing, admin review, or player playthroughs.

**Where it would live:**

- Database schema: likely new `src/db/schema.ts`
- Data access: new `src/server/games.ts` or `src/lib/games.ts`
- API/server actions: `src/app/api/games/` or server actions colocated with pages
- Dashboard route: new `src/app/games/page.tsx`
- Editor load/save: `src/app/editor/[gameId]/page.tsx`

**Suggested behavior:**

- Create/list/rename games.
- Autosave current draft.
- Save named checkpoint.
- Restore checkpoint.
- Show checkpoint history.
- Diff two versions structurally.

### 16. Add Published Player and PlayThrough State

**Why it matters:** The engine already runs client-side. A published player page is the natural next product surface once games can be saved.

**Where it would live:**

- Player route: new `src/app/play/[gameId]/page.tsx`
- Player state: `src/engine/gameState.ts`
- Playthrough persistence: future `PlayThrough` API/data layer
- Player UI: `src/components/player/GamePlayer.tsx`

**Suggested behavior:**

- Load approved game world data.
- Start or resume a playthrough.
- Save `currentRoomId`, flags, inventory, messages or transcript slice, and visited rooms.
- Keep author preview and published player on the same engine path.

### 17. Add Player-Facing Automap

**Why it matters:** This is one of the strongest differentiators in the spec: the same map grammar becomes a fog-of-war player artifact.

**Where it would live:**

- Shared map renderer extraction: `src/components/map/`
- Player automap: new `src/components/player/Automap.tsx`
- Game state: `src/engine/gameState.ts`
- Room flags: `src/engine/flags.ts`

**Suggested behavior:**

- Track visited rooms in `GameState` or derive from room visited flags.
- Render only visited rooms and traversed connections.
- Highlight current room.
- Animate newly discovered rooms later.

## Product Surfaces

### 18. Replace the Placeholder Home Page with a Work-Object Entry

**Why it matters:** `src/app/page.tsx` still says "Text adventure tools, eventually." The brand docs warn against generic landing pages. The home page should route authors straight to real work.

**Where it would live:**

- Home route: `src/app/page.tsx`
- Home styles: `src/app/page.scss`
- Dashboard route later: `src/app/games/page.tsx`

**Suggested behavior:**

- Show current local draft or most recent games once persistence exists.
- Keep the primary action as `Open editor` or `Create game`.
- Avoid marketing copy until the authoring loop is strong.

### 19. Add Admin Review Workflow

**Why it matters:** Review is part of the product promise and safety story. It depends on persistence, status, ownership, and published player routes.

**Where it would live:**

- Data model: `Game.status`, `review_note`, owner/admin role fields
- Admin routes: new `src/app/admin/review/page.tsx`
- Review actions: new server actions or `src/app/api/admin/...`
- Map-anchored notes: future extension of map selection state

**Suggested behavior:**

- Submit draft for review.
- Admin sees pending games.
- Admin opens game in read-only map and player preview.
- Approve or reject with a note.
- Later, anchor notes to room ids.

### 20. Add Creator Feedback and Playthrough Insights

**Why it matters:** The spec's "small creators first" idea is strong. Once `PlayThrough` exists, Mothmark can show meaningful feedback without large social features.

**Where it would live:**

- Playthrough model/API: future persistence layer
- Creator dashboard: `src/app/games/page.tsx` or `src/app/games/[gameId]/insights/page.tsx`
- Automap overlay: shared map renderer

**Suggested behavior:**

- Show how many players started a game.
- Show latest room reached.
- Show rooms most players never reached.
- Show one player's fog-of-war overlay on the author's map.
- Add likes/follows later, after published play exists.

## Technical Quality Recommendations

### 21. Add World Factory Helpers

**Why it matters:** Defaults are currently duplicated in `src/utils/connectionUtils.ts`, `src/data/worlds/exampleWorld.ts`, and tests. A shared factory reduces drift.

**Where it would live:**

- New `src/utils/worldFactory.ts`
- Existing use site: `src/utils/connectionUtils.ts`
- Starter JSON route: `src/app/starter/page.tsx`
- Tests: `src/utils/connectionUtils.test.ts`

**Suggested helpers:**

- `createDefaultRoom(options)`
- `createDefaultFeature(options)`
- `createDefaultConnection(options)`
- `createDefaultWorld()`

### 22. Strengthen Schema and Validation Tests

**Why it matters:** The editor will mutate world data constantly. Schema tests catch invalid states before they become weird UI or engine bugs.

**Where it would live:**

- Schema tests: new `src/schemas/worldSchema.test.ts`
- Validation tests: new `src/engine/worldValidation.test.ts`
- Existing config: `jest.config.ts`

**Suggested coverage:**

- Duplicate room ids fail.
- Duplicate connection ids fail.
- Missing start room fails.
- Missing connection endpoints fail.
- Duplicate feature ids are caught after that rule is added.
- Default factory output passes `WorldSchema`.

### 23. Split Parser Utilities from Command Definitions

**Why it matters:** `src/engine/commands.ts` currently contains parser helpers, command definitions, command execution, and display text helpers. As authored commands grow, this file will become crowded.

**Where it would live:**

- New `src/engine/parser.ts` for normalization, alias matching, connector parsing.
- Keep `src/engine/commands.ts` for coded command definitions and `runCommand`.
- New `src/engine/commandTypes.ts` if types need to be shared.

**Suggested migration:**

- Move pure helpers first: `normalizeInput`, `phraseMatches`, `namedThingMatchesText`, `parseInputWithAlias`.
- Keep existing tests passing.
- Add authored command compiler later against the same parser helpers.

### 24. Add Undo/Redo History

**Why it matters:** Map editing includes destructive and spatial operations. Authors need confidence to experiment.

**Where it would live:**

- History hook: new `src/hooks/useUndoableWorld.ts`
- Editor state: `src/app/editor/page.tsx`
- Toolbar buttons: `src/components/editor/ToolBar.tsx`

**Suggested behavior:**

- Track world-level patches or snapshots.
- Group drag movement into a single history entry.
- Support keyboard shortcuts later.
- Clear redo after new edits.

### 25. Add Interaction Tests for Map Editing

**Why it matters:** The map uses pointer interactions across rooms, nodes, SVG paths, and window listeners. Unit tests cover utilities, but the core experience needs browser-level confidence.

**Where it would live:**

- Playwright config: new `playwright.config.ts`
- E2E tests: new `tests/editor-map.spec.ts`
- Stable selectors: `src/components/map/*.tsx`

**Suggested scenarios:**

- Click an east node creates a new room and connection.
- Drag a room moves it without selecting it.
- Click a room selects it.
- Drag a node to another room creates a connection.
- Select and delete a connection.
- Editing a room name updates the map label.

## Small Codebase Cleanups

These are not product features, but they remove friction.

- Remove the unused `DefaultDeserializer` import from `src/engine/descriptions.ts`.
- Fix the comment typo "Starting romm" in `src/schemas/worldSchema.ts`.
- Make `features` consistently default to `[]` if optional rooms are no longer useful.
- Move the default room creation TODO out of `src/utils/connectionUtils.ts` by adding `src/utils/worldFactory.ts`.
- Replace generic placeholder copy in `src/app/page.tsx` once the local authoring loop is ready.
- Consider using `world.startRoomId` in `src/components/player/CommandLine.tsx` instead of `world.rooms[0]?.id`.

## Suggested Milestone Slices

### Slice A: Playable Features

- Add feature create/delete.
- Add active/listed feature filtering in room descriptions.
- Add target resolution.
- Make `examine feature` real.
- Add tests.

**Main files:** `RoomEditor.tsx`, `worldSchema.ts`, `commands.ts`, `rooms.ts`, new `targetResolution.ts`.

### Slice B: Trustworthy Editor

- Add validation module.
- Add Issues panel.
- Add map warning badges.
- Add import/export.
- Add local autosave.

**Main files:** `src/app/editor/page.tsx`, new `worldValidation.ts`, new `IssuesPanel.tsx`, `ToolBar.tsx`, `Map.tsx`.

### Slice C: Real Project Workflow

- Add games dashboard.
- Add persistence.
- Add autosave drafts and checkpoints.
- Add editor route per game.
- Add version restore.

**Main files:** future `src/db/`, `src/app/games/`, `src/app/editor/[gameId]/`, server actions or API routes.

### Slice D: Authored Logic

- Add authored command schema.
- Add condition/effect runner.
- Add first Logic tab UI.
- Add parser preview.
- Add alias conflict warnings.

**Main files:** `worldSchema.ts`, new `authoredCommands.ts`, new `effects.ts`, new `LogicPanel.tsx`, new `parserPreview.ts`.

### Slice E: Published Play

- Add published player route.
- Add playthrough persistence.
- Add player automap.
- Add review workflow.
- Add creator insights.

**Main files:** `GamePlayer.tsx`, new `Automap.tsx`, future `PlayThrough` API/data layer, `admin/review`.

## Best Next Bet

The best next feature is **Playable Features**.

It is small enough to finish without database or auth work, it builds directly on code that already exists, and it unlocks the core parser fantasy: the author can add an object to a room, give it aliases, test `examine object`, and see the engine respond with real authored content.

After that, the best follow-up is **Trustworthy Editor**: validation, issues, import/export, and local autosave.
