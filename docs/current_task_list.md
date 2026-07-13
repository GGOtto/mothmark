# Horizontal Slice Implementation Plan

Each slice delivers a coherent user-facing improvement across data, interaction, visuals, persistence, and tests. Avoid landing isolated infrastructure that cannot be exercised in the editor.

[x] ## Slice 1: Unified click-based map authoring

**Outcome:** Authors create rooms with blank clicks and create passages without dragging nodes.

Tasks:

- Remove the Add Room toolbar action.
- Remove passage-node drag behavior and related global pointer listeners.
- Keep room dragging and Pan dragging intact.
- Add a connection-draft state machine: idle, choosing destination, and choosing return node.
- Make blank Edit-mode clicks create rooms at transformed world coordinates.
- Make source-node then destination-node clicks connect existing rooms.
- Make source-node then blank click create a room and request its return node.
- Preserve a newly created room if the connection draft is cancelled.
- Add toolbar status for every draft state and a visible Cancel action.
- Ensure switching Edit/Pan cancels with visible feedback; layer switching is not present yet.

Verification:

- Test room creation at minimum, default, and maximum zoom after panning.
- Test node-to-node connection creation.
- Test new-room return-node selection.
- Test Escape, repeated source click, and tool-switch cancellation.
- Confirm room drag does not accidentally create a room.
- Browser-test all paths and confirm no native context menu or console error regressions.

[x] ## Slice 2: Pathway-aware capacity and fast pathway editing

**Outcome:** Shared nodes and directional pathway constraints are understandable and safe.

Tasks:

- Add helpers that derive outgoing capacity consumed at each endpoint.
- Validate at most one outgoing route per node.
- Validate at most one active outgoing semantic direction per room.
- Filter or disable invalid pathway choices during passage creation.
- Add the midpoint pathway glyph and preserve existing solid/half-dashed/no-way treatments.
- Add the four-option pathway popover.
- Add the neutral node busy indicator.
- Show node passage count only on hover/focus.
- Add a compact passage chooser for nodes with several passages.
- Fan shared passage lines deterministically after a short common stem.

Verification:

- Unit-test capacity for every pathway and endpoint orientation.
- Unit-test semantic-direction conflicts.
- Visual-test all four pathway treatments at several zoom levels.
- Test changing pathway frees and consumes outgoing capacity correctly.
- Verify busy nodes remain interactive and do not look disabled.

## Slice 3: Separate anchors from semantic directions

**Outcome:** Cardinal and special nodes share one model while unusual visual routing remains possible.

Tasks:

- Introduce explicit endpoint anchors in the passage schema.
- Migrate existing `direction` and `returnDirection` data to direction-plus-anchor endpoints.
- Keep default anchor/direction bindings for ordinary authoring.
- Update geometry to use anchors and traversal/commands to use semantic directions.
- Add fixed Up/Down and In/Out node rails.
- Add anchor-change behavior that offers to update direction.
- Ensure connection creation works for any source and destination anchor pairing.
- Update inspector controls, serialization, validation, and fixtures.

Verification:

- Test migration round trips without changing existing map appearance.
- Create Up→Down, Up→North, North→Down, In→Out, and cross-paired passages.
- Confirm keyboard/game direction resolution ignores visual anchor.
- Visually test special-node placement with long room names and all room sizes.

## Slice 4: Zoom-stable interaction targets and camera foundations

**Outcome:** The map remains precise at all zooms and every layer-ready camera can persist.

Tasks:

- Expose current zoom to map styling and interaction geometry.
- Counter-scale node visuals, pathway glyphs, badges, strokes, and hit targets.
- Implement the agreed slight 85–112% visual response curve.
- Keep pointer-centered zoom and unbounded pan.
- Replace Recenter with Focus Selected Room at exactly 100%.
- Add Frame All Rooms to the blank-map command API.
- Introduce per-layer-ready camera state containing center and zoom.
- Persist the current camera locally after pan/zoom settles.

Verification:

- Measure visible and hit sizes at min/default/max zoom.
- Test Focus with selected, offscreen, and no room.
- Test Frame All on empty, compact, and sprawling maps.
- Reload the editor and confirm camera plus zoom restoration.

## Slice 5: Shared layer data and floating navigation

**Outcome:** Authors can create, name, switch, and scroll through a continuous stack of layers.

Tasks:

- Add shared `WorldMap`, `MapLayer`, and `RoomPlacement` data.
- Migrate existing rooms onto Ground level 0 without moving them.
- Enforce continuous structural levels.
- Implement Ground, Upper N, and Lower N generated names and compact indicators.
- Add optional custom layer names and inline editing from map status.
- Add the floating three-button layer control.
- Show Arrow for existing adjacent layers and Plus for missing adjacent layers.
- Create and enter adjacent layers from Plus.
- Add hover expansion with explicit destination names.
- Add thresholded wheel switching while the control is hovered.
- Save and restore a separate working camera and zoom per layer.
- Reserve safe viewport space so Focus/Frame does not hide rooms behind the control.

Verification:

- Migrate an existing world and compare room positions.
- Create several Upper and Lower layers and confirm continuous ordering.
- Rename layers, clear names, and verify fallback names.
- Test mouse, trackpad, keyboard focus, and screen-edge tooltip behavior.
- Switch repeatedly and verify every layer restores its own camera and zoom.

## Slice 6: Cross-layer passage authoring

**Outcome:** The ordinary connection draft works across every layer and for every node direction.

Tasks:

- Preserve connection drafts during arrow, wheel, and Plus layer navigation.
- Include source room, anchor, direction, and layer in status.
- Highlight valid destination nodes on other layers.
- Allow a blank click on another layer to create a room and request its return node.
- Derive cross-layer status from endpoint room placements; do not store layer on passage.
- Add visible on-map stubs or destination labels for passages whose other endpoint is off-layer.
- Add Go to Source and Go to Destination actions that perform forced jumps.
- Apply capacity and semantic-direction validation across layers.

Verification:

- Connect adjacent and non-adjacent layers with cardinal and special nodes.
- Create an Up→Down passage that skips several layers.
- Create North→South and North→Down cross-layer passages.
- Cancel drafts before and after creating a destination room.
- Verify pathway changes remain valid across layers.

## Slice 7: Reusable previews and Layout stack

**Outcome:** Authors can understand and navigate the world as a physical stack.

Tasks:

- Build a reusable read-only `MapPreview` using the same room and passage geometry.
- Add static and inspect interaction modes.
- Initialize previews from the layer's persisted working camera and zoom.
- Keep preview camera changes local.
- Build Layout mode and the focused vertical plate stack.
- Implement higher-grow/lower-shrink scaling, preview-only blur, opacity, and reduced-motion behavior.
- Add wheel snapping, click focus, second-click/Enter open, Escape return, and floating-button focus changes.
- Preserve active connection drafts while entering and leaving Layout mode.
- Add focused-layer aggregated rails and an explicit destination/count list.
- Make preview room and passage clicks emit forced-jump requests.

Verification:

- Test worlds with one, three, seven, and many layers.
- Test layout at narrow and wide editor sizes.
- Confirm labels remain crisp while only previews blur.
- Confirm ordinary wheel navigates the stack while preview modifier-wheel zooms locally.
- Test explicit cross-layer counts against world data.
- Test reduced motion and keyboard-only operation.

## Slice 8: Selection, reveal, jumps, and graph traversal

**Outcome:** References and keyboard navigation move through the world visibly and spatially.

Tasks:

- Introduce explicit select, reveal, and jump APIs with camera policies.
- Record short camera history for forced jumps.
- Preserve the source room's screen coordinate when traversing a passage.
- Add player-path traversal keys for cardinal, diagonal, Up/Down, and In/Out directions.
- Respect pathway direction and semantic-direction uniqueness.
- Briefly highlight traversed passages and select destination rooms.
- Make Pan-mode arrows/WASD pan instead of graph-traverse.
- Add room nudging with Alt+Arrow and Shift+Alt+Arrow.
- Wire preview clicks, passage destination actions, and future search/issues references to forced jumps.

Verification:

- Traverse every direction and pathway mode.
- Traverse across layers with differing saved cameras.
- Confirm destination appears where source was on screen.
- Confirm shortcuts never fire in inputs, menus, or dialogs.
- Test camera Back after several forced jumps.

## Slice 9: Shared tooltips and specialized context menus

**Outcome:** Every compact control is understandable, and right-click exposes relevant actions without browser UI.

Tasks:

- Build the reusable portal-based tooltip and positioning utilities.
- Remove native `title` attributes from map and layer controls.
- Add tooltips with descriptions and shortcut labels to tools, nodes, glyphs, and layer controls.
- Build the reusable accessible context menu.
- Add blank-map, room, free-node, occupied-node, passage, and layer-plate menu models.
- Implement selection-before-open and pointer-relative placement.
- Add keyboard access through Shift+F10 and full menu navigation.
- Route pathway changes, jumps, Focus, Frame, layer creation, and deletion through shared commands.

Verification:

- Test every menu at all viewport edges.
- Test keyboard-only menus and tooltips.
- Confirm right-click never opens the browser menu inside map/Layout views.
- Confirm disabled actions explain why they are unavailable.

## Slice 10: Document-level undo/redo with visible reveal

**Outcome:** Every authoring action can be reversed and its effect is always visible.

Tasks:

- Introduce transaction-based world history shared by map and sidebar editors.
- Group room drag, field edit, pathway change, layer creation, and passage creation into coherent transactions.
- Record affected entities, layers, bounds, primary entity, and human-readable labels.
- Implement Ctrl/Cmd+Z, Ctrl+Y, and Ctrl/Cmd+Shift+Z.
- Preserve native input undo until the field edit commits.
- On undo/redo, switch layers and reveal affected entities or stored locations.
- Add pulses, passage highlights, and deletion/restoration markers.
- Add toolbar status such as `Undid room move`.
- Keep camera changes outside world history.

Verification:

- Undo and redo every mutation introduced by prior slices.
- Test cross-layer passage and layer creation history.
- Test deletion where the entity no longer exists and must use stored bounds.
- Confirm visible feedback occurs even when no camera movement is required.

## Slice 11: Autosave, durable recovery, and global status

**Outcome:** Authors never manage a map-specific Save button and do not lose work.

Tasks:

- Add one document-level dirty/save service for map and sidebar edits.
- Debounce and coalesce database writes.
- Commit continuous gestures once at completion.
- Add revision or optimistic-concurrency identifiers.
- Add a durable local pending-operation queue.
- Flush on relevant lifecycle transitions.
- Add application-header Saved/Saving/Offline/Error states.
- Make Ctrl/Cmd+S force a flush.
- Add conditional before-unload protection only when no durable recovery exists.
- Add periodic server revisions for longer-term recovery.
- Ensure undo/redo results autosave normally without clearing history.

Verification:

- Simulate slow, failed, offline, conflicted, and recovered saves.
- Close or reload during pending edits and confirm recovery.
- Confirm high-frequency pan and pointer movement do not cause world database calls.
- Confirm camera metadata and world data persist through their separate channels.

## Slice 12: Presentation sizing and final system polish

**Outcome:** Dense and expressive maps remain readable without implying arbitrary physical scale.

Tasks:

- Add Compact, Standard, and Wide room presentation sizes to placement metadata.
- Update node anchors, shared stems, previews, Focus, Frame, and bounds calculations.
- Audit status wording, generated layer names, tooltip language, and context-menu grouping.
- Audit min/max zoom interaction sizes and high-density shared nodes.
- Add performance profiling for large room, passage, and layer counts.
- Add accessibility audits for focus order, contrast, reduced motion, and screen-reader labels.
- Document deferred free-resize requirements without implementing arbitrary handles.

Verification:

- Test mixed room sizes across all layers and previews.
- Test very large and very sparse worlds.
- Run complete keyboard-only authoring and navigation passes.
- Perform final browser visual QA at representative editor dimensions and themes.

## Slice 13: Universal anchored and expanded entity picker

**Outcome:** Authors can quickly select references from large mixed catalogs without native selects, deep category trees, or a separate navigation page.

Tasks:

- Define shared entity references, normalized picker records, and adapter registration.
- Implement the anchored popup with heading, search, contextual scopes, concise result rows, group headings, and Browse All.
- Implement the expanded overlay as a larger presentation of the same active picker state.
- Preserve query, filters, highlighted row, pending values, and scroll position while expanding and contracting.
- Add single-select, nullable clearing, and explicit multi-select commit behavior.
- Add compatibility filtering derived from editor-field metadata.
- Add exact, prefix, alias, context, recent, tag, ID, and fuzzy ranking.
- Add room grouping and ranking by current/visible/connected/adjacent layer context.
- Add `lucide-react` entity and action icons with custom tooltips.
- Add keyboard navigation, focus management, outside-click dismissal, Escape cancellation, and viewport-edge placement.
- Add virtualization and a normalized search index for large result sets.
- Add optional compatible entity creation without silently changing map placement.
- Route mapped-room selections through the shared forced-jump API where the caller requests navigation.
- Replace existing native or bespoke entity selectors incrementally through adapter-backed compatibility.

Verification:

- Test fixed-type and mixed-type fields with duplicate names.
- Test catalogs with tens, hundreds, and thousands of entities.
- Test anchored placement near every editor viewport edge.
- Test expanding and contracting without losing pending state.
- Test mouse, keyboard-only, screen-reader, and reduced-width use.
- Test single, nullable, and multi-selection commit/cancel behavior.
- Verify incompatible entities never appear and creation produces only allowed types.
- Verify result rows remain concise and metadata does not leak into the small popup.
- Browser-test integration in map, sidebar, and at least one non-map editor context.

## Slice 14: Friendly universal-editor inspector presentation

**Outcome:** The room inspector makes common editing immediate, summarizes secondary state, and retains the universal editor's schema-driven foundation.

Tasks:

- Add explicit inspector/document/embedded shell presentation metadata.
- Add primary, secondary, and advanced field priorities.
- Add hidden, tooltip, and visible help policies without removing schema descriptions.
- Remove the duplicate `RoomEditor` entity header and let the universal editor render one sticky identity header.
- Add the compact entity overflow menu and move Delete into it.
- Render Name and Description as unboxed primary room fields.
- Replace Presentation with flat Additional Descriptions, Identification, Features, Availability, and Advanced rows.
- Ensure the room inspector has no more than one disclosure level beneath its primary fields.
- Add value-derived section summaries, empty states, counts, and warning indicators.
- Add the Add Feature quick action to the collapsed Features row.
- Add row-style sections with restrained dividers rather than nested card borders.
- Make field search automatic by complexity and remove it from the ordinary room inspector.
- Correct search ranking so direct field matches precede section-description matches.
- Add restrained `lucide-react` section, warning, overflow, and quick-action icons.
- Integrate the room header with the entity picker for switching and optional forced map jumps.
- Preserve disclosure state, validation, linked-entity navigation, readonly/disabled behavior, and theme support.

Verification:

- Compare the room inspector at 220px minimum width, typical sidebar width, and full-width document presentation.
- Confirm Name and Description are visible without scrolling at typical editor height.
- Confirm every secondary room field remains reachable within one disclosure level.
- Test section summaries for empty, populated, warning, and error states.
- Test Add Feature without opening the section first.
- Test entity switching without losing unsaved edits or inspector state.
- Test help as hidden, custom tooltip, and visible text.
- Test field search thresholds and exact field matching.
- Run keyboard-only, screen-reader, light/dark-theme, and browser visual QA.
- Confirm the universal editor still renders non-room schemas in document and embedded contexts.

## Slice 15: Typed answer-driven dialog system

**Outcome:** Confirmations, choices, short forms, and expanded entity selection use one accessible popup system with explicit typed results.

Tasks:

- Build the dialog provider, controller hook, portal, backdrop, and typed result lifecycle.
- Implement one-active-dialog enforcement, replacement, queueing, and invoking-focus restoration.
- Add compact, standard, and large responsive size policies.
- Add accessible title/description wiring, focus trapping, Escape handling, and reduced-motion behavior.
- Implement compact confirmation with default focus on Cancel for destructive actions.
- Implement explicit two-to-five-option choice dialogs.
- Implement small form dialogs with inline validation and dirty-state behavior.
- Move the expanded entity picker onto the large dialog presentation while preserving anchored-picker state.
- Add asynchronous submission progress, error retention, and double-submit protection.
- Add derived deletion-consequence summaries for rooms, passages, layers, and other world entities.
- Route consequential deletes through confirmation and simple undoable deletes through immediate status plus Undo.
- Close active tooltips, context menus, and anchored popovers before opening a dialog.
- Add global information/error dialog support for the rare cases requiring acknowledgement.
- Add shared Lucide icon, tone, footer-action, and sticky-header/footer presentation.

Verification:

- Test submitted and every cancellation reason for each dialog type.
- Test focus entry, trapping, restoration, keyboard submission, and Escape.
- Test destructive confirmation default focus and backdrop cancellation.
- Test narrow-screen sheet behavior and large expanded-picker behavior.
- Test failed and successful asynchronous submissions without duplicate actions.
- Test anchored-to-expanded picker transfer and cancellation without committing.
- Test dialog replacement and queued global errors without nested focus traps.
- Test deletion summaries against entities with no, few, and many dependencies.
- Run screen-reader, reduced-motion, keyboard-only, and browser visual QA.

## Slice 16: Persistent command-line game preview

**Outcome:** Authors can explore the current world in a durable play session without editor selection unexpectedly resetting their state.

Tasks:

- Move preview state ownership above selection-driven room rendering so ordinary selection cannot remount the player.
- Define preview session and persisted preview session models with engine and world revision compatibility.
- Replace Sync Room with current-room status, Start Here, Restart, and More actions.
- Add explicit Start Here, Restart from session start, Restart from world start, and Move Preview Here semantics.
- Add optional Follow Selected Room as a per-author preference defaulting Off.
- Remove command-input mount autofocus and add accessible labeling and placeholder.
- Keep the preview session alive across editor tabs, Layout mode, selection changes, and panel collapse.
- Add a separate preview-player room marker without changing editor selection or camera.
- Wire current-room and transcript references through explicit forced-jump commands.
- Hot-apply ordinary in-memory world edits and identify initial-state changes requiring Restart.
- Reconcile deleted rooms, passages, inventory, and flags without crashing.
- Add toolbar priority states for errors, restart-needed, follow mode, differing selection, and normal play.
- Improve transcript role styling, clickable references, and editor/system messages.
- Implement bottom-aware auto-scroll and New Output behavior.
- Add state inspection through the shared popup/dialog system.
- Add clear/copy transcript and clear session actions.
- Add lightweight contextual command suggestions without replacing command-line interaction.
- Persist full preview state, command draft/history, panel height, collapse state, and preferences per author/project.
- Flush persistence on project exit and page lifecycle transitions through the durable local queue.
- Restore sessions on project reopen and reconcile engine/world revision changes.

Verification:

- Explore several rooms, select and edit unrelated entities, and confirm session state remains intact.
- Test Start, Restart, Move, Follow Selection, Reveal, Collapse, and Clear actions.
- Test live descriptions and passage edits without resets.
- Test initial-state edits and visible Restart-required status.
- Test deleted current rooms, inventory, flags, and destinations.
- Test transcript scrolling while reading old output and receiving new output.
- Test command focus, history, suggestions, accessibility, and map-shortcut isolation.
- Exit and reopen a project and confirm complete preview restoration.
- Reopen after compatible and incompatible world/engine revisions.
- Test offline exit, durable local recovery, and later synchronization.
- Confirm preview state remains personal workspace data and never changes shared world content.

## Deferred decisions

These do not block the slices above:

- Whether free room resizing is valuable beyond Compact/Standard/Wide.
- Exact Up/Down and In/Out rail illustration after visual prototyping.
- Whether forced-jump camera history receives visible Back/Forward controls.
- Whether focused cross-layer rails become clickable filters.
- How conditional runtime destination variants are authored outside the map editor.
- Whether personal camera state can optionally be promoted to a shared project presentation view.
