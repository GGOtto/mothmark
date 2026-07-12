# Map Authoring, Layers, and Navigation Design

## Status

This document consolidates the agreed design for Mothmark's map authoring experience. It covers map interaction, passages, layers, camera behavior, previews, saving, undo/redo, context menus, tooltips, keyboard navigation, and an implementation roadmap.

The design favors a small number of consistent mechanics:

- Clicking establishes intent.
- Dragging moves rooms or pans the camera; passage nodes are not dragged.
- Every passage node uses the same creation and connection workflow.
- Layers feel like a continuous physical stack.
- The map is an unbounded authoring canvas, not a board with a canonical center.
- World changes autosave globally; map camera state saves separately and automatically.

## 1. Product goals

The map editor should let an author:

- Create a sprawling world without fighting a fixed viewport.
- Create rooms and passages with very few steps.
- Use the same passage mechanics for cardinal, diagonal, Up, Down, In, and Out directions.
- Connect rooms on the same layer or across layers without a special cross-layer connection tool.
- Understand one-way, two-way, and unavailable passages visually.
- Browse a layered world as a physical stack without heavy 3D effects.
- Return to the exact camera and zoom where they stopped working.
- Follow the graph as a player would and have the camera preserve spatial continuity.
- Trust autosave, undo, and redo without needing a map-specific Save button.

## 2. Design principles

### 2.1 One passage workflow

All nodes behave the same. Layer changes are allowed during an active connection draft; they are not a different connection mechanic.

### 2.2 Direction and anchor are distinct

A direction is gameplay semantics: what a player types and where travel leads. An anchor is the node's visual position on a room card. Defaults tie them together, but the world model must not conflate them.

### 2.3 The canvas is unbounded

Authors may pan indefinitely and branch outward. Nothing automatically returns the map to an origin or center.

### 2.4 Status is explicit

The toolbar's right side explains the current operation. Custom tooltips, visible pathway treatments, selection highlights, and undo feedback prevent quiet or mysterious changes.

### 2.5 Editing and workspace state are separate

Rooms, passages, layer structure, and shared map placement belong to the project. Per-author camera positions and preview cameras are editor workspace state.

## 3. Terminology

- **Room:** A gameplay location.
- **Passage:** A connection between two room endpoints.
- **Node:** A visual passage anchor on a room card.
- **Anchor:** A node's visual placement, such as north or up.
- **Direction:** The semantic travel command, such as north, up, or in.
- **Pathway:** The allowed travel state: two-way, forward, backward, or no-way.
- **Layer:** A shared map plane at an integer vertical level.
- **Connection draft:** The state after choosing a source node and before completing or cancelling a passage.
- **Working view:** The automatically persisted camera and zoom for one layer.
- **Forced jump:** Explicit navigation to a referenced room or passage endpoint.

## 4. Main map toolbar

The left side contains stable map tools:

```text
[Edit] [Pan] [Focus] | 100%
```

- **Edit:** Select rooms and passages, move rooms, add rooms, and create passages.
- **Pan:** Drag anywhere to pan. Wheel or trackpad scroll continues to zoom.
- **Focus:** Center the selected room and set zoom to exactly 100%. Disabled when no room is selected.
- **Zoom percentage:** Status only; it is not a set of zoom buttons.

There is no Add Room button. Clicking blank map space in Edit mode creates a room.

The right side is contextual status, not another tool cluster:

```text
Ground · 12 rooms
Connecting from Gate ↑ · Choose a destination node or position
Connecting from Gate ↑ · Choose the return node on Room 12
Upper 2 · Layer 3 of 5
Saving is shown globally, not here
```

The current layer name in status is clickable for inline editing. Enter commits; Escape cancels. The structural layer indicator remains visible even when a custom name exists.

## 5. Edit and Pan behavior

### 5.1 Edit mode

- Click a room to select it.
- Drag a room to reposition it.
- Click a passage to select it.
- Click blank space to create and select a room at that world position.
- Click a free or occupied node to begin a connection draft when its outgoing capacity allows the desired pathway.
- Wheel or trackpad scroll zooms around the author's pointer.
- Holding Space temporarily enables Pan behavior.

### 5.2 Pan mode

- Drag anywhere to pan.
- Wheel or trackpad scroll zooms around the pointer.
- Arrow keys or WASD pan the viewport while the canvas is focused.
- Pan remains named **Pan** because it does not perform broader semantic navigation by itself.

### 5.3 Passage-node dragging

Passage-node dragging is removed. Clicking is the only passage-authoring gesture.

This prevents conflicts among:

- Dragging a node to connect an existing room.
- Dragging a node to create a new room.
- Dragging an endpoint to reposition it.
- Dragging the map or a room.

## 6. Room creation and passage creation

### 6.1 Creating an unconnected room

In Edit mode, clicking any blank visible map position creates and selects a room there. This works at every pan and zoom, including visible space outside the map's original viewport.

### 6.2 Connecting existing rooms

1. Click the source node.
2. The node becomes armed and the toolbar shows the connection draft.
3. Change layers if desired; the draft persists.
4. Click a destination node.
5. Choose or confirm a valid pathway if more than one is available.
6. Create and select the passage.

### 6.3 Creating and connecting a new room

1. Click the source node.
2. Click blank space on the current or another layer.
3. Create and select a room at that position.
4. Highlight the new room's available nodes.
5. Ask the author to click the return node.
6. Choose or confirm a valid pathway.
7. Create and select the passage.

If the connection draft is cancelled after the room was created, the room remains. Room creation was an intentional click; only the unfinished passage is cancelled.

### 6.4 Cancelling

- Escape cancels the draft.
- Clicking the armed source again cancels it.
- Switching tools cancels it after a visible status update.
- Switching layers or entering Layout mode does not cancel it.

## 7. Nodes, anchors, and directions

### 7.1 Visual anchors

Cardinal and diagonal nodes remain around the room perimeter. Special nodes use distinct fixed rails:

- Up and Down form a small vertical rail outside the right side.
- In and Out form a depth rail outside the left side.
- Icons make special nodes understandable independently of their position.

The exact special-node illustration should be validated visually, but their interaction is identical to every other node.

### 7.2 Default direction binding

Each anchor has a default semantic direction:

- North anchor → North direction
- Up anchor → Up direction
- In anchor → In direction

Changing an anchor offers to update the direction. Changing a direction does not silently relocate its anchor.

### 7.3 Proposed endpoint model

```ts
type PassageEndpoint = {
  roomId: RoomId;
  anchor: Anchor;
  direction: Direction;
};

type Passage = {
  id: PassageId;
  from: PassageEndpoint;
  to: PassageEndpoint;
  pathway: "two-way" | "forward" | "backward" | "no-way";
};
```

This replaces the current implicit use of `direction` and `returnDirection` as both semantic direction and visual anchor.

## 8. Passage capacity and world validation

The node rule is:

> A node may participate in multiple passages, but it may provide only one outgoing route.

Incoming and no-way passages may share the node. A subtle busy indicator shows that the node already has an outgoing route without making it appear disabled.

For a passage from endpoint A to endpoint B:

| Pathway  | Endpoint A            | Endpoint B            |
| -------- | --------------------- | --------------------- |
| Two-way  | Outgoing and incoming | Outgoing and incoming |
| Forward  | Outgoing              | Incoming              |
| Backward | Incoming              | Outgoing              |
| No-way   | Neither               | Neither               |

The world also enforces:

> A room may have at most one active outgoing route for each semantic direction.

Players expect a travel command to resolve to one destination. If conditions or flags change that destination, model it as one logical direction with conditional destination behavior rather than multiple simultaneously active outgoing directions. The map displays the authored result but is not responsible for runtime state resolution.

When creating or changing a passage, invalid pathway options are disabled with a concrete explanation. If only one option is valid, it may be chosen automatically and announced in status.

## 9. Node and passage appearance

### 9.1 Zoom-responsive nodes and glyphs

Nodes and pathway glyphs counter-scale most of the map zoom. Their visible screen size changes only slightly:

| Map zoom | Approximate visible node/glyph size |
| -------- | ----------------------------------- |
| Minimum  | 85–90%                              |
| 100%     | 100%                                |
| Maximum  | 108–112%                            |

The invisible hit target remains approximately 24×24 screen pixels throughout the zoom range. Connection click targets also retain a stable screen width.

### 9.2 Node state

- Empty ring: no outgoing route.
- Small filled center or wedge: busy; an outgoing route already exists.
- Accent outline: selected or armed.
- Subtle pulse: valid destination during a connection draft.
- Count badge: shown only on pointer hover or keyboard focus when multiple passages use the node.

The busy indicator uses a neutral or accent color, never a warning color, lock, slash, or disabled opacity.

The hover/focus tooltip may say:

```text
North node
4 passages · 1 outgoing · 3 incoming
```

Clicking a node with multiple existing passages opens a compact chooser when the editor is not currently creating a new passage.

### 9.3 Pathway line treatment and glyphs

Keep the existing solid/half-dashed visual treatment and add an interactive midpoint glyph:

| Pathway  | Line treatment                            | Glyph |
| -------- | ----------------------------------------- | ----- |
| Two-way  | Fully solid                               | ↔     |
| Forward  | Solid permitted half, dashed return half  | →     |
| Backward | Dashed outward half, solid permitted half | ←     |
| No-way   | Fully dashed                              | ×     |

The glyph is quiet but always visible, becomes a clear button on hover, and uses the map accent when selected. Clicking it opens a four-option pathway popover. The same choices appear in the passage context menu and inspector.

When several passages share a node, use a short shared stem and deterministic fanning after roughly 8–12 pixels. Hovered and selected passages render above the others.

## 10. Layers and layer naming

### 10.1 Shared layer structure

Layers are continuous integer levels with no missing levels:

- Starting layer: `0`
- Above: positive internal levels
- Below: negative internal levels

Negative values are not used as primary UI labels.

Default display names:

| Internal level | Default name | Compact indicator |
| -------------: | ------------ | ----------------- |
|              0 | Ground       | 0                 |
|              1 | Upper 1      | ↑1                |
|              2 | Upper 2      | ↑2                |
|             -1 | Lower 1      | ↓1                |
|             -2 | Lower 2      | ↓2                |

Custom names accompany the structural indicator:

```text
↑2 · Observatory
↑1 · Gallery
0 · Courtyard
↓1 · Crypt
```

Removing a custom name restores its generated name.

### 10.2 Proposed shared map data

Layers and room placement are shared project map data, not personal editor metadata:

```ts
type WorldMap = {
  layers: MapLayer[];
  placements: RoomPlacement[];
};

type MapLayer = {
  id: LayerId;
  level: number;
  name?: string;
};

type RoomPlacement = {
  roomId: RoomId;
  layerId: LayerId;
  position: Point;
  size?: "compact" | "standard" | "wide";
};
```

Passages do not store a layer. Their endpoint rooms determine whether they cross layers.

## 11. Floating layer control

A compact three-button control floats in the map's bottom-right corner. Focus/Frame padding prevents rooms from being hidden beneath it.

```text
┌─────┐
│  ↑  │  Existing layer above
├─────┤
│  0  │  Layout mode / current structural level
├─────┤
│  ↓  │  Existing layer below
└─────┘
```

If an adjacent layer does not exist, its arrow becomes Plus:

```text
┌─────┐
│  +  │  Add Upper 1
├─────┤
│  0  │  View layouts · Ground
├─────┤
│  +  │  Add Lower 1
└─────┘
```

Clicking Plus creates the adjacent layer, switches to it, and offers inline name editing. Scrolling never creates a layer.

### 11.1 Hover and wheel navigation

When hovered, the control may expand left to reveal the adjacent layer name. Wheel up and down switch layers after deliberate, stepped thresholds. The target label appears temporarily:

```text
↑2 · Observatory
```

Map zoom is suppressed only while the pointer is over this control. Each accepted wheel step switches immediately. Trackpad noise is absorbed by a threshold and a brief cooldown.

All tooltips are custom Mothmark tooltips; native browser `title` tooltips are not used.

## 12. Camera model

### 12.1 Unbounded map

- Pan is not clamped to room bounds.
- The grid remains anchored to world coordinates.
- Zoom is centered on the author's pointer.
- No automatic action pulls the map toward an origin.

### 12.2 Per-layer working view

Each author automatically persists a camera per layer, including zoom:

```ts
type LayerCamera = {
  center: Point;
  zoom: number;
};
```

Persist after pan/zoom settles and when switching layers, entering Layout mode, leaving the map tab, hiding the page, or closing the project. Restoring a layer restores this exact camera.

This state is personal editor workspace metadata. It is not gameplay world data.

There is no visible Save View, Checkpoint, Home View, or Return to Last View action.

### 12.3 Focus and frame actions

- **Focus selected room:** center the selected room and set zoom to exactly 100%.
- **Frame all rooms:** fit the current layer's rooms with comfortable padding. This lives in the blank-map context menu rather than the main toolbar.

### 12.4 Camera navigation history

Forced jumps record a short camera history so a later Back action can return to the previous location. Ordinary pan and zoom do not enter world undo history.

## 13. Layout mode and the layer stack

Clicking the middle floating button replaces the editable map with a scrollable architectural stack of layer previews.

### 13.1 Visual model

- Plates remain parallel; there is no rotation or dramatic perspective.
- The focused plate is 100% scale and sharp.
- Higher plates move upward, grow roughly 3–4% per visible step, and progressively blur.
- Lower plates move downward, shrink roughly 3–4% per visible step, and progressively blur.
- Scale caps near 110–112%; preview blur caps near 2px.
- Only the map preview blurs. Layer name, structural indicator, counts, plate edge, and controls remain crisp.
- Approximately five to seven plates remain meaningfully visible.
- Focus transitions take roughly 160–200 ms with a simple ease-out and no bounce.

This suggests a real vertical world without turning the editor into a heavy 3D scene.

### 13.2 Navigation

- Wheel/trackpad scroll moves focus through the stack and snaps to a plate.
- Click a plate to focus it.
- Click the focused plate again or press Enter to open it.
- Escape returns to the previously open map layer.
- The floating Up/Down buttons change focused plates.
- Plus creates a layer adjacent to the focused plate.
- An active connection draft survives Layout mode and layer selection.

### 13.3 Previews

Each preview initially uses the layer's persisted working camera and zoom. It renders:

- Simplified room boxes
- Same-layer passages
- Selected or referenced room highlight
- No authoring nodes or editing handles
- No dense room text at small sizes

Inspectable previews may be panned. Pinch or modifier-wheel zooms the preview; ordinary wheel remains available to scroll the stack or containing editor. Preview camera changes are local and do not overwrite the main layer working view.

Clicking a room or passage in an inspectable preview performs a forced jump in the main map editor.

### 13.4 Cross-layer information

Do not show every cross-layer line or rely on ambiguous `↑ 4 / ↓ 2` totals.

For the focused plate only:

- Draw one thin aggregated rail from the focused plate toward each destination layer.
- Put the passage count on that rail.
- Display an explicit destination list beside or beneath the focused plate.

```text
Other-layer passages

Upper 1 · Gallery          3
Upper 3 · Observatory      1
Lower 1 · Crypt            2
```

Only passages involving the focused layer appear. Changing focus replaces the rails and list. Individual room-to-room cross-layer lines are never drawn through the full stack.

## 14. Reusable interactive previews

Implement previews as a reusable read-only map surface:

```tsx
<MapPreview interaction="static" />
<MapPreview interaction="inspect" />
```

Inspectable previews support:

- Drag to pan
- Pinch or modifier-wheel to zoom
- Click room to request a forced jump
- Click passage to inspect or jump to an endpoint

They never support room movement, room creation, node editing, or pathway editing. This component may later appear in search results, issue views, story tools, or other editor tabs.

## 15. Selection, reveal, and forced jumps

Treat selection and camera movement as distinct operations:

```ts
select(entity);
reveal(entity);
jumpTo(entity);
```

- **Select:** Update selection and inspector without moving the camera.
- **Reveal:** Pan only enough to bring the entity into a safe viewport region.
- **Jump:** Intentionally navigate, record camera history, and select the entity.

Forced jumps are used by preview clicks, search results, issue references, passage destinations, right-click navigation, layer references, and graph keyboard traversal.

When following a passage, put the destination room at the same screen coordinate previously occupied by the source room. Clamp that coordinate into a comfortable safe region if necessary. This preserves spatial continuity and avoids repeatedly centering the map.

## 16. Keyboard navigation

Keyboard actions operate only when the map canvas has focus and no form control, menu, or dialog is active.

### 16.1 Player-path traversal in Edit mode

```text
Q  W  E      NW  N  NE
A     D       W      E
Z  X  C      SW  S  SE
```

| Semantic direction | Key              |
| ------------------ | ---------------- |
| North              | W or Up Arrow    |
| Northeast          | E                |
| East               | D or Right Arrow |
| Southeast          | C                |
| South              | X or Down Arrow  |
| Southwest          | Z                |
| West               | A or Left Arrow  |
| Northwest          | Q                |
| Up                 | R                |
| Down               | F                |
| In                 | I                |
| Out                | O                |

Page Up/Page Down, Enter, Backspace, and Delete are not used for passage navigation because of their browser and editing meanings.

Traversal respects pathway direction and follows semantic direction rather than visual anchor. On success:

1. Briefly highlight the passage.
2. Change layers if necessary.
3. Preserve the source room's screen coordinate.
4. Select the destination room.
5. Update the inspector.

### 16.2 Other keyboard contexts

- V: Edit mode
- H: Pan mode
- Hold Space: temporary Pan
- L: toggle Layout mode
- Escape: cancel draft or close overlay
- Delete: delete selected entity after confirmation rules
- Alt+Arrow: nudge selected room
- Shift+Alt+Arrow: larger nudge
- Pan mode arrows/WASD: pan viewport
- Layout mode Up/Down or W/X: change focused layer
- Shift+F10: open the custom context menu
- Ctrl/Cmd+Z: undo
- Ctrl+Y or Ctrl/Cmd+Shift+Z: redo

Tooltips teach relevant shortcuts. Tool shortcuts never fire while typing in a field.

## 17. Context menus

Right-click overrides the browser menu throughout map and Layout views.

### 17.1 Blank map

```text
Add room here
Paste
Frame all rooms
View layouts
```

### 17.2 Room

```text
Edit room
Rename
Center in view
Duplicate
Set as starting room
Delete room
```

### 17.3 Free node

```text
Start passage
```

### 17.4 Occupied node

```text
Start passage
Passages…
Go to destination…
Change pathway…
Disconnect…
```

The exact options account for multiple incoming passages and at most one outgoing route.

### 17.5 Passage

```text
Edit passage
Go to source
Go to destination
Pathway…
Disconnect
```

### 17.6 Layer plate

```text
Open layer
Rename layer
Add layer above
Add layer below
Delete layer
```

Initially, only empty outermost layers may be deleted so structural levels do not unexpectedly renumber.

### 17.7 Menu behavior

Build one reusable custom menu with:

- Pointer-relative placement
- Viewport-edge collision handling
- Arrow-key navigation
- Enter activation
- Escape and outside-click dismissal
- Separators, disabled states, shortcut labels, and at most one submenu level
- Selection of the relevant map entity before the menu appears

## 18. Custom tooltips

Build one reusable tooltip primitive. Do not use native `title` attributes.

Requirements:

- Pointer hover and keyboard focus
- Approximately 350 ms opening delay
- Immediate dismissal after leaving
- `aria-describedby`
- Portal rendering to avoid clipping
- Top, bottom, left, and right placement with edge collision handling
- Plain description and optional separately aligned shortcut text
- Reusable by toolbar, layer control, nodes, pathway glyphs, previews, and sidebars

Context menus and tooltips may share positioning utilities but remain separate components.

## 19. Autosave and global world persistence

The editor uses document-level autosave. There is no map-specific Save button.

### 19.1 Save pipeline

1. Apply every edit to in-memory world state immediately.
2. Record one undo transaction per completed author action.
3. Debounce database persistence approximately 750–1,500 ms after the last edit.
4. Coalesce related rapid changes.
5. Flush on editor-tab change, project change, page visibility loss, and project exit.
6. Queue failed saves durably and retry.

Continuous gestures update locally while active and commit once on completion. Do not call the database for each pointer movement.

### 19.2 Global status

Show save state in the application header because it applies to map and sidebar edits alike:

```text
Saved
Saving…
Offline · Changes stored locally
Couldn’t save · Retry
```

Ctrl/Cmd+S forces an immediate flush but does not require a permanent Save button.

Use a browser exit warning only when changes are unsynced, the final save cannot complete, and the changes are not safely stored in the durable local queue.

Periodic server revisions provide recovery beyond the active undo history.

## 20. Undo and redo

Autosave never clears undo history. Undo and redo create ordinary world states that autosave normally.

Every transaction records presentation metadata:

```ts
type UndoPresentation = {
  layerIds: LayerId[];
  entityIds: EntityId[];
  beforeBounds?: Bounds;
  afterBounds?: Bounds;
  label: string;
};
```

Undo and redo are never quiet:

1. Apply the change.
2. Switch to the affected layer if necessary.
3. Reveal the affected entity or stored location.
4. Preserve zoom unless the changed bounds cannot fit.
5. Briefly highlight, pulse, or show a fading removal marker.
6. Show status such as `Undid room move`.

If an entity is already visible, camera movement may be unnecessary, but visible highlight and status are still required. Widely separated changes prioritize the transaction's primary entity instead of zooming excessively far out.

Native text undo operates while a text field is actively being edited. Committing the field creates one world-level undo transaction.

Camera movement itself does not enter world undo history.

## 21. Room sizing

Do not initially add unrestricted resize handles. Room boxes represent graph locations, not literal floor-plan area, and arbitrary size could imply gameplay scale.

Support discrete map presentation sizes when needed:

- Compact
- Standard
- Wide

Size belongs to shared room placement metadata. If free resizing is later justified, it must snap to grid, use selected-only handles, enforce bounds, keep anchors normalized to edges, provide Reset Size, and commit as one undo transaction.

## 22. Accessibility and interaction safeguards

- All node, glyph, toolbar, layer, context-menu, and preview actions are keyboard reachable.
- Visible focus treatments are never removed.
- Hit targets remain usable at minimum zoom.
- Color is never the only pathway or node-state indicator.
- Motion respects reduced-motion preferences.
- Tooltips supplement rather than replace visible status.
- Drafts, menus, and modes always have an Escape path.
- Destructive context-menu actions follow the editor's confirmation and undo policy.

## 23. Universal entity picker

Large worlds cannot rely on native select controls or unstructured collection lists. Use one homegrown entity picker for rooms, passages, NPCs, items, flags, commands, layers, and other references.

The picker has two presentations of the same popup:

- **Anchored popup:** A compact menu-like popup attached to the invoking field.
- **Expanded popup:** A larger modal-style popup over the editor, not a new browser window, route, or editor page.

Expanding preserves search text, active scopes, highlighted result, scroll position, and pending selection.

### 23.1 Anchored popup

The small picker is optimized for the likely choice and contains only:

1. A type-specific heading, such as `Choose a room`.
2. An immediately focused search field.
3. Up to three compact contextual scopes, such as `This layer`, `Recent`, and `All rooms`.
4. Approximately six to eight visible result rows.
5. Useful group headings, such as layer names.
6. A keyboard hint and `Browse all` action.

Example:

```text
┌────────────────────────────────────┐
│ ⌖ Choose a room                 ×  │
│ [ Search rooms…                  ] │
│ [This layer] [Recent] [All rooms] │
│                                    │
│ Ground                          2  │
│ ⌖ Gate                             │
│ ⌖ North Gate                       │
│                                    │
│ Upper 1 · Gallery               2  │
│ ⌖ Gallery Gate                     │
│ ⌖ Moon Gate                        │
│                                    │
│ ↑↓ Navigate · Enter Select  Browse │
└────────────────────────────────────┘
```

When the compatible type is already known, result rows show only the type icon and entity name. Do not repeat `Room`, `Room`, `Room` on every row.

The anchored popup omits:

- IDs
- Descriptions
- Preview panes
- Persistent category sidebars
- Tags and metadata
- Parent breadcrumbs
- Repeated type labels

Layer or category group headings remain when they materially disambiguate results.

### 23.2 Expanded popup

`Browse all` enlarges the same picker into a centered overlay. The expanded picker adds capacity, not a different workflow:

- More visible results
- Type filters when several types are compatible
- Short type labels for mixed results
- Additional category or scope filters as compact chips
- Multi-select controls when required

Mixed results remain concise:

```text
⌖ Gate                         Room
♙ Gatekeeper                    NPC
⚑ Gate Open                    Flag
```

Descriptions, IDs, aliases, and other metadata do not appear by default. If duplicate names cannot otherwise be distinguished, add the smallest useful qualifier, such as a layer name or parent entity.

Do not add a permanent preview pane merely because the popup has more room. A focused-result preview may be considered later when the selection genuinely benefits from visual inspection.

### 23.3 Search and ranking

Search may match name, alias, tag, ID, type, layer name, and relevant parent names, but results display only the minimum identity required.

Rank results by:

1. Exact name
2. Name prefix
3. Alias
4. Current context
5. Recently selected or edited
6. Tag
7. ID
8. Fuzzy match

Context affects ranking and suggested scopes; it never removes otherwise compatible results from `All`.

For room selection, prefer current layer, currently visible rooms, connected rooms, adjacent layers, recent rooms, and then the remaining catalog.

### 23.4 Types, categories, and compatibility

- **Type:** Room, passage, NPC, item, flag, command, or layer.
- **Category:** A meaningful subtype or authored grouping.
- **Context:** Current layer, current room, recent, visible, or connected.
- **Compatibility:** Types the invoking field is allowed to reference.

If a field accepts one type, strip the picker down to that type. If it accepts several types, show compact type chips in expanded mode and short type labels in result rows.

Never display incompatible entities that cannot be selected.

### 23.5 Icons

Use `lucide-react` consistently:

| Entity or action | Suggested icon                         |
| ---------------- | -------------------------------------- |
| Room             | `MapPin` or the established room glyph |
| Passage          | `Route`                                |
| NPC              | `UserRound`                            |
| Item             | `Package`                              |
| Flag             | `Flag`                                 |
| Layer            | `Layers`                               |
| Command          | `ScrollText`                           |
| Search           | `Search`                               |
| Recent           | `Clock3`                               |
| Browse all       | `Maximize2`                            |
| Selected         | `Check`                                |

Icons identify type; names identify entities. Use color for interaction state—selected, invalid, or unavailable—not as decoration for every type.

### 23.6 Popup interaction

- Open anchored to the invoking field or control.
- Focus search immediately.
- Flip above or sideways when the preferred side lacks room.
- Keep the popup inside the editor viewport.
- Escape closes without changing the committed value.
- Outside click closes.
- Up/Down moves through results.
- Enter selects.
- Tab moves through search, scopes, results, and footer without forcing traversal through every scope first.
- A single-select choice commits and closes.
- A multi-select picker remains open until explicitly committed.
- Custom tooltips explain icon-only controls; native `title` tooltips are not used.

### 23.7 Single and multi-select

Single select commits immediately. Clear is available only for nullable fields.

For multi-select:

- Click or Space toggles the focused result.
- Pending selections are visibly distinguished from already committed values.
- Ctrl/Cmd+Enter commits and closes.
- The primary action states the result, such as `Add 4 items`, rather than saying only `Done`.
- Long selected-value fields show a small number of chips followed by `+N more`.

### 23.8 Creation and map integration

When the invoking field permits creation, show one compatible action such as:

```text
+ Create room “Moonlit Gallery”
```

Creation selects the new entity and opens it for editing when appropriate. Creating a room from a general reference picker does not silently place it on the map. An unplaced room offers explicit `Place on current layer` or `Open editor` actions.

Selecting a mapped room from global search, issues, story tools, or an expanded picker may request a forced jump using the shared selection/reveal/jump APIs.

### 23.9 Data and performance

Normalize selectable entities through adapters rather than teaching the picker every schema:

```ts
type EntityReference = {
  type: EntityType;
  id: string;
};

type EntityPickerRecord = {
  ref: EntityReference;
  name: string;
  aliases: string[];
  tags: string[];
  category?: string;
  parent?: EntityReference;
  layerId?: LayerId;
  searchableText: string;
};
```

For large worlds:

- Maintain a normalized search index as world data changes.
- Virtualize long expanded result lists.
- Avoid rendering hidden previews or metadata.
- Keep ordering stable as queries refine.
- Update records incrementally where practical.

The governing rule is:

> The anchored popup optimizes for the likely choice; the expanded popup provides the complete compatible catalog without becoming a separate workflow.

## 24. Universal editor inspector experience

The existing universal editor has a strong technical foundation:

- Schema-derived controls and metadata
- Sections and nested subgroups
- Persistent disclosure state
- Field search
- Specialized description, condition, link, tag, alias, and entity controls
- World registries and linked-entity navigation
- Validation warnings and errors
- Delete, readonly, disabled, theme, and density support

Preserve this infrastructure. The primary problem is that the narrow inspector exposes too much schema and layout machinery at once.

### 24.1 Current room-inspector friction

In the current room example, the entity is introduced repeatedly through:

1. `Selected Room`
2. The selected room name
3. A second `Room` heading
4. The room-type description
5. Another root field-shell title and description
6. Field search
7. The Presentation section title and description

The content then nests several disclosure levels:

```text
Room
└── Presentation
    ├── Name
    ├── Description
    ├── Description Variants
    ├── Short Description
    └── Identification
        ├── Aliases
        └── Tags
```

Features and Availability add further section cards. This is structurally accurate but slow to scan and overly box-heavy in a narrow sidebar.

### 24.2 Proposed room inspector

Use a single sticky entity header and place the highest-frequency fields directly beneath it:

```text
┌──────────────────────────────────────┐
│ ⌖ Gate                         ···   │
│ Room · Ground                       │
├──────────────────────────────────────┤
│ Name                                 │
│ [ Gate                             ] │
│                                      │
│ Description                          │
│ [ A bent gate leans in the dark…   ] │
│ [                                  ] │
│                                      │
│ ▸ Additional descriptions        1   │
│ ▸ Identification        3 aliases    │
│ ▸ Features                    None    │
│ ▸ Availability              Always    │
│ ▸ Advanced                            │
└──────────────────────────────────────┘
```

Name and main Description remain immediately editable. Everything else is at most one disclosure level deep.

### 24.3 Entity header

The universal editor owns one compact sticky header:

```text
⌖ Gate                         ···
Room · Ground
```

Remove the separate `Selected Room / Gate` wrapper header from `RoomEditor`.

The overflow menu contains secondary entity actions:

```text
Rename
Duplicate
Center on map
Copy ID
Delete
```

Delete should not be one of the most visually prominent inspector controls. It remains available through the overflow menu, map context menu, keyboard behavior, and undo.

The header may later use the universal entity picker to switch rooms and perform a forced map jump without closing the inspector.

### 24.4 Room sections

#### Additional descriptions

Contains:

- Description variants
- Short description

Collapsed summaries communicate actual state:

```text
Additional descriptions · None
Additional descriptions · Short description only
Additional descriptions · 2 variants
```

#### Identification

Contains Aliases and Tags.

```text
Identification · None
Identification · 3 aliases · 2 tags
```

#### Features

```text
Features · None                          +
Features · 4                             +
```

The Plus quick action creates a feature without requiring the section to be opened first.

#### Availability

```text
Availability · Always
Availability · 2 conditions
Availability · 2 conditions             ⚠
```

Validation state appears in the summary.

#### Advanced

Contains infrequently edited or technical fields:

- Room ID
- Shared map-placement metadata, if exposed
- Other implementation-facing properties

Room position is normally edited through the map rather than raw X/Y inputs.

### 24.5 Section summaries

Collapsed sections must describe the current value rather than repeat generic explanatory copy. Summaries make the closed inspector an overview of the selected entity.

Good summaries include counts, configured state, empty state, and warnings. Avoid generic summaries such as `Interactive features located in this room` when `4 features` is available.

### 24.6 Help-text policy

Schema descriptions remain valuable for documentation and tooltips, but they should not automatically become visible paragraphs.

Use three levels:

1. **Hidden:** The label and control are self-explanatory.
2. **Tooltip:** Helpful explanation that is not continuously required.
3. **Visible:** Consequences, unusual formats, or behavior the author must understand before editing.

Examples:

- Name: hidden
- Description: hidden or communicated through placeholder
- Tags: tooltip
- Active When: visible because it changes room accessibility
- Room ID: tooltip plus inline validation when necessary

Ease of use takes priority over mystical or fantasy presentation. Mothmark's character should come from typography, color, icons, and restrained detail rather than ornamental labels around ordinary controls.

### 24.7 Field search

Do not permanently show Search Fields for ordinary inspectors with a small number of fields.

- Show Find Setting only after a configurable complexity threshold.
- Make it an icon or command rather than a permanent labeled field in narrow inspectors.
- Match individual field names before matching entire section descriptions.
- Expand a complete section only when its title directly matches the query.
- Preserve full search and outline navigation in wide document editors.

The room example does not need permanent field search.

### 24.8 Borders and visual hierarchy

Avoid the current boxes-inside-boxes effect. Use borders primarily for:

- Inputs
- The sticky entity header
- Major section dividers
- Selection and validation states

Section rows may use simple dividers. Expanded content sits directly beneath its row without another full card boundary. Nested controls should not reproduce the entire surrounding section chrome.

### 24.9 Lucide icons

Use icons sparingly to reinforce hierarchy:

| Purpose                 | Suggested icon                        |
| ----------------------- | ------------------------------------- |
| Room header             | `MapPin`                              |
| Additional descriptions | `Text`                                |
| Identification          | `Tags`                                |
| Features                | `Puzzle` or established feature glyph |
| Availability            | `ListChecks` or `ShieldCheck`         |
| Advanced                | `Settings2`                           |
| Entity actions          | `Ellipsis`                            |
| Quick creation          | `Plus`                                |
| Warning                 | `AlertTriangle`                       |
| Find setting            | `Search`                              |

Icons support labels rather than replacing essential text.

### 24.10 Inspector and document presentations

The same schema needs different presentations depending on context.

#### Inspector

- Narrow and selection-driven
- Common fields first
- One disclosure level
- Compact value summaries
- Minimal visible help
- Sticky entity identity
- Section quick actions
- No permanent field search for simple entities

#### Document editor

- Wider workspace
- Complete hierarchy
- Field search and outline navigation
- More visible descriptions
- Advanced fields easier to browse
- More room for linked editors and complex collections

Do not force a narrow inspector and a full schema document to use the same hierarchy and density.

### 24.11 Proposed presentation metadata

Add explicit presentation policy rather than deriving all UI directly from schema descriptions:

```ts
type EditorFieldPresentation = {
  priority?: "primary" | "secondary" | "advanced";
  help?: "hidden" | "tooltip" | "visible";
  summary?: EditorSummary;
  section?: string;
  quickAction?: EditorQuickAction;
};

type ObjectEditorPresentation = {
  shell?: "inspector" | "document" | "embedded";
  searchable?: "auto" | boolean;
  sectionStyle?: "rows" | "cards";
  primaryFields?: string[];
};
```

The room inspector uses:

```ts
{
  shell: "inspector",
  searchable: "auto",
  sectionStyle: "rows",
  primaryFields: ["name", "description"]
}
```

This is a presentation layer over the existing schema-driven control system, not a replacement for it.

## 25. Answer-driven popup and dialog system

Build one homegrown dialog system for popups that require an explicit answer. Delete confirmation and the expanded entity picker are two presentations of the same modal foundation.

Keep surface roles distinct:

- **Tooltip:** Explains a control or compact state.
- **Context menu:** Offers immediate commands for a target.
- **Popover:** Provides a small anchored interaction, such as pathway selection.
- **Dialog:** Interrupts the workflow because the editor needs an answer before continuing.

### 25.1 Dialog anatomy

```text
┌────────────────────────────────────────────┐
│ Icon  Delete Gate?                      ×  │
│       This action can be undone.           │
├────────────────────────────────────────────┤
│ Gate has 3 passages and 2 features.        │
│ Deleting it will also remove its passages. │
├────────────────────────────────────────────┤
│                     [Cancel] [Delete room] │
└────────────────────────────────────────────┘
```

Every dialog has:

1. Header with optional icon, title, concise explanation, and Close.
2. Body containing consequences, choices, fields, or picker content.
3. Footer containing explicit answers.

Do not use vague labels such as `OK` when an action label is possible. Prefer `Delete room`, `Choose room`, `Add 4 items`, `Replace passage`, or `Keep editing`.

### 25.2 Typed answers

Dialogs return typed results instead of requiring every caller to coordinate open state and callbacks. Do not return a bare boolean because it loses cancellation context.

```ts
type DialogResult<T> =
  | {
      status: "submitted";
      value: T;
    }
  | {
      status: "cancelled";
      reason: "button" | "escape" | "outside" | "replaced";
    };
```

Conceptual usage:

```ts
const result = await dialogs.open({
  kind: "confirm",
  title: "Delete Gate?",
  confirmLabel: "Delete room",
  tone: "danger",
});
```

### 25.3 Confirmation dialogs

Confirmation answers a yes/no-style question:

```ts
type ConfirmDialogRequest = {
  kind: "confirm";
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
};
```

Use it for consequential deletion, disconnection, layer removal, draft abandonment, and replacement of an outgoing passage.

### 25.4 Choice dialogs

Use a choice dialog for two to five meaningful answers:

```text
Gate North already has an outgoing passage.

○ Make the new passage incoming
○ Replace the outgoing passage
○ Create it as no-way

[Cancel] [Continue]
```

When the choices are the purpose of the dialog, do not hide them inside a native select.

### 25.5 Prompt and form dialogs

Collect a small amount of information:

```text
Name this layer

[ Observatory                         ]

Structural position: Upper 2

[Cancel] [Create layer]
```

Form dialogs use inline validation and remain open after validation or submission failure.

### 25.6 Expanded entity picker

The expanded entity picker is a large answer-driven dialog:

```ts
DialogResult<EntityReference>;
DialogResult<EntityReference[]>;
```

Before it opens, the anchored picker closes and transfers its query, scopes, highlighted result, scroll position, and pending selection. Cancelling the expanded dialog returns control to the invoking field without committing accidental changes.

### 25.7 Information dialogs

Use information-only dialogs sparingly and only when acknowledgement is required:

```text
This world could not be saved.

Your changes remain stored on this device.

[Try again] [Keep working]
```

Ordinary status belongs in global status or non-modal notifications.

### 25.8 Deletion policy

Not every deletion requires a confirmation dialog. Confirm when deletion:

- Removes dependent entities
- Removes several passages
- Deletes a populated layer
- Cannot be completely restored
- Has consequences that are not obvious from the selected item

A simple, fully undoable deletion may happen immediately with visible Undo feedback.

Confirmation content derives consequences from current world data:

```text
Delete Gate?

This room has:
• 3 passages
• 2 features
• The world's starting-room designation

Deleting Gate will also remove its passages.
Its features will be deleted with the room.

[Cancel] [Delete room]
```

Avoid generic `Are you sure?` dialogs that provide no useful information. Typing the entity name is reserved for unusually destructive or irreversible actions, such as deleting an entire world.

After confirmation, close the dialog, apply one undo transaction, autosave normally, show visible deletion status, and offer Undo.

### 25.9 Dialog sizes

Use three standard sizes:

- **Compact:** Confirmation and short choice, approximately 360–440px.
- **Standard:** Small forms and involved choices, approximately 480–600px.
- **Large:** Expanded entity picker and complex editors, approximately 680–900px.

On narrow screens, all sizes become a nearly full-width sheet with safe margins. The body scrolls within a viewport maximum while header and footer remain visible. Avoid arbitrary per-dialog widths.

### 25.10 Focus and keyboard behavior

When a dialog opens:

- Move focus into it.
- Focus the first meaningful input for forms and pickers.
- Default destructive confirmations to Cancel rather than Delete.
- Trap Tab and Shift+Tab inside.
- Restore focus to the invoking control after close.
- Escape cancels unless an asynchronous submission is actively committing.
- Enter submits only when unambiguous.
- Keep entity-picker arrow behavior scoped to results.

Use correct semantics:

```html
role="dialog" aria-modal="true" aria-labelledby="..." aria-describedby="..."
```

### 25.11 Outside-click behavior

- Expanded picker: outside click cancels.
- Simple form: outside click cancels when there is no dirty local state.
- Destructive confirmation: outside click cancels.
- Active asynchronous submission: outside click does nothing.
- Complex dirty form: keep the workflow in the same dialog rather than stacking another modal when possible.

A backdrop click always cancels; it never confirms.

### 25.12 Asynchronous answers

While an answer is submitting:

- Disable repeat submission.
- Show progress inside the primary action.
- Keep Cancel available only when cancellation is safe.
- Keep the dialog open after errors.
- Put errors near the relevant field or above the footer.
- Never silently discard the entered answer.

World edits should normally update local state optimistically and autosave outside the dialog. Wait for backend work only when the answer cannot safely be accepted optimistically.

### 25.13 Dialog stacking

- Only one modal dialog is active.
- Opening an expanded picker closes its anchored popover first.
- A multi-step dialog replaces its body or request while retaining one backdrop.
- Confirmation inside a larger workflow becomes an inline step when practical.
- Unexpected global dialogs queue until the active dialog closes.
- Tooltips and context menus close when a dialog opens.

Avoid focus traps inside focus traps.

### 25.14 Visual style

Dialogs use clean product UI:

- Neutral surface
- Clear title
- Restrained border and shadow
- Short descriptions
- Lucide icon when it improves recognition
- Strong but not theatrical destructive treatment
- Mothmark typography and color without ornamental fantasy framing

Suggested icons:

| Purpose       | Lucide icon             |
| ------------- | ----------------------- |
| Delete        | `Trash2`                |
| Warning       | `TriangleAlert`         |
| Entity picker | Entity icon or `Search` |
| Choice        | `ListChecks`            |
| Layer naming  | `Layers`                |
| Save error    | `CloudAlert`            |
| Close         | `X`                     |

### 25.15 Proposed API

```ts
type DialogRequest<T> =
  ConfirmDialogRequest | ChoiceDialogRequest<T> | FormDialogRequest<T> | EntityPickerDialogRequest;

type DialogController = {
  open<T>(request: DialogRequest<T>): Promise<DialogResult<T>>;
  cancel(reason?: DialogCancelReason): void;
  replace<T>(request: DialogRequest<T>): Promise<DialogResult<T>>;
};
```

React callers use one shared hook:

```ts
const dialogs = useDialogs();

async function deleteRoom(room: Room) {
  const result = await dialogs.confirm({
    title: `Delete ${room.name}?`,
    description: buildDeletionSummary(room),
    confirmLabel: "Delete room",
    tone: "danger",
  });

  if (result.status !== "submitted") return;
  deleteRoomTransaction(room.id);
}
```

The governing rule is:

> Use a dialog when the editor genuinely needs an answer before it can continue; use lighter surfaces for explanation and immediate commands.

## 26. Command-line game preview

The game preview is an independent author-controlled play session running against the current in-memory world. It is not a mirror of editor selection.

### 26.1 Current behavior and problems

The existing preview:

- Uses a resizable panel beneath the map.
- Shows a toolbar containing only `Sync Room`.
- Maintains current room, flags, inventory, transcript, command history, and input.
- Remounts the entire player whenever selected room changes.
- Clears transcript, flags, inventory, history, and input when remounted.
- Can fall back to the world start when selection changes from a room to another entity.
- Uses live world data for subsequent commands and refreshes the latest room output.
- Autofocuses the command input.

`Sync Room` is misleading because it starts a clean session rather than synchronizing one room. Automatic input focus also steals keyboard intent from map and editor shortcuts.

### 26.2 Preview session model

```ts
type PreviewSession = {
  id: string;
  startRoomId: RoomId;
  currentRoomId: RoomId;
  flags: Record<string, boolean>;
  inventory: ItemId[];
  transcript: GameMessage[];
  commandHistory: string[];
  commandDraft: string;
  worldRevisionAtStart: string;
};
```

The author can explore naturally, accumulate state, edit the world without losing the session, deliberately restart, and deliberately begin or move the preview from an editor-selected room.

### 26.3 Default synchronization rule

Editor selection does not change or reset the preview.

Preserve the preview during:

- Room, passage, or other entity selection
- Map and layer navigation
- Inspector editing
- Editor-tab changes
- Layout mode
- Ordinary world edits

Force a reset only when:

- The author explicitly starts or restarts a session
- The project changes
- The current preview room is deleted and cannot be reconciled
- An engine or schema change makes persisted state incompatible

Every forced reset is visible in toolbar status or transcript.

### 26.4 Preview toolbar

Replace the empty Sync Room strip with session status and explicit actions:

```text
Game preview · Hall             Gate selected   [Start here] [↻] [•••]
```

When selection matches or no room is selected:

```text
Game preview · Hall                              [Restart] [•••]
```

The current preview room is always visible. Contextual selected-room status appears only when it differs.

Toolbar status priority:

1. Preview error or invalid current room
2. Restart required for initial-state changes
3. Follow Selection enabled
4. Selected room differs and Start Here is available
5. Normal current preview room

Do not fill the toolbar with many persistent badges.

### 26.5 Start, restart, and move

#### Start here

- Creates a clean preview session at the selected room.
- Clears flags, inventory, transcript, command history, and draft.
- Makes the selected room the session start.
- Uses an answer-driven confirmation only when meaningful state would be lost.

#### Restart

- Creates a clean session at the existing preview session's start room.
- Does not automatically use the world's configured start room.

#### Restart from world start

- Creates a clean session at the world's configured start room.
- Lives in the More menu.

#### Move preview here

- Teleports the current preview player to the selected room.
- Preserves flags, inventory, transcript, history, and session start.
- Appends a visible system message: `Preview moved to Gate by the editor.`
- Lives in the More menu and room context menu.

### 26.6 Optional Follow Selection

The current rapid-proofreading behavior remains available as an explicit personal preference:

```text
Follow selected room
Starts a clean preview whenever room selection changes.
```

Default is Off. Only room selection affects it; selecting passages or other entities does nothing. The toolbar clearly displays `Following selection` while enabled.

Enabling it may ask once before discarding a meaningful current session. It does not confirm every subsequent selection.

### 26.7 Preview-to-editor relationship

Preview movement does not automatically change editor selection or pan the map.

Show a separate preview-player marker on the map:

- Appears on the preview's current room
- Is visually distinct from selection
- Moves when the preview player travels
- Does not select, reveal, or pan automatically

Clicking the current room name in the preview toolbar performs an explicit forced jump without changing preview state. The room context menu includes `Start preview here` and `Move preview here`.

Synchronization remains directional and explicit:

- Editor → Preview: Start, Move, or optional Follow Selection
- Preview → Editor: marker, current-room link, or explicit Reveal on Map

### 26.8 Live world edits and reconciliation

The preview uses the current unsaved in-memory world rather than waiting for database persistence.

Apply most changes live:

- Room and feature text
- Passage visibility and pathway status
- Commands
- NPC text
- Conditional behavior

When current-room output refreshes from an edit, use a subtle visible highlight or toolbar status rather than a transcript entry for every keystroke.

Changes to initial-state data do not silently reset the session:

- Initial inventory
- Default flags
- Starting room
- Initial object state
- Initial NPC state

Show `Initial state changed · Restart to apply` and mark Restart neutrally.

Structural reconciliation examples:

- Current room deleted: pause and request a valid destination or restart.
- Inventory item deleted: remove safely with visible status.
- Passage deleted: use the new world immediately for later traversal.
- Flag definition removed: reconcile and report it in state inspection.
- Destination room deleted: show world validation rather than crashing.

### 26.9 More menu

```text
Restart from [session start]
Restart from world start
Move preview to selected room
Follow selected room
Inspect preview state
Clear transcript
Copy transcript
Collapse preview
Clear session
```

`Clear transcript` preserves location, flags, inventory, and session start. `Clear session` deletes persisted play state and begins a new clean session according to the chosen start policy.

### 26.10 Preview state inspector

Open through the standard dialog or popup system:

```text
Preview state

Current room       Hall
Started at         Gate
Turns              8

Inventory
• Brass key
• Torn note

Flags
✓ gate-open
✓ rune-examined
○ guard-distracted
```

The first version is read-only. Later testing controls may toggle flags, inventory, or object state. Manual mutations always append a system transcript message so the test remains understandable.

### 26.11 Transcript presentation

Keep the command-line identity while distinguishing output roles:

```text
HALL

A low hall smells of dust and rain…

> examine map

The map is scratched into the wall.

[editor] gate-open changed to true

> east

The eastern passage is locked.
```

- Room names receive a modest heading treatment.
- Commands retain `>`.
- System/editor messages are quiet and labeled.
- Errors are direct and readable.
- Preserve authored whitespace.
- Room and entity references may be clickable forced-jump targets.
- Copy Transcript lives in More.

### 26.12 Transcript scrolling

- Auto-scroll only when already near the bottom.
- Preserve position when the author has scrolled upward.
- Show `New output ↓` when messages arrive offscreen.
- Clicking it returns to the bottom.
- New and restarted sessions begin at the bottom.

### 26.13 Command input

- Remove mount-time autofocus.
- Focus after explicit preview click, Start, Restart, or a preview shortcut.
- Add accessible label `Game preview command`.
- Add quiet placeholder `Type a command…`.
- Preserve Up/Down history behavior.
- Ctrl+L clears visible transcript without resetting state.
- `help` remains the command reference.

Lightweight suggestions may show available commands, visible entities, inventory, and valid semantic directions. Tab completes a suggestion. Up/Down navigates suggestions while open and history while closed.

### 26.14 Panel state

Persist per author and project:

- Open or collapsed state
- Panel height
- Follow Selection preference
- Full preview session

Collapsed state retains a narrow toolbar:

```text
Game preview · Hall                         [Expand]
```

The session continues to exist while collapsed.

### 26.15 Project-exit persistence

Preview sessions survive project exit and resume when that project is reopened. Store them as project-scoped, per-author workspace data rather than shared world data.

```ts
type PersistedPreviewSession = {
  projectId: ProjectId;
  engineVersion: string;
  worldRevision: string;
  startRoomId: RoomId;
  currentRoomId: RoomId;
  flags: Record<string, boolean>;
  inventory: ItemId[];
  transcript: GameMessage[];
  commandHistory: string[];
  commandDraft: string;
  followSelection: boolean;
  panelHeight: number;
  collapsed: boolean;
  updatedAt: string;
};
```

Save automatically:

- After commands
- After preview state changes
- After Start, Move, or Restart
- After preview preference changes
- After resize or collapse
- When changing editor tabs
- When exiting the project
- When the page becomes hidden
- Periodically while dirty

Use the durable local queue used by world autosave. Exiting flushes the session, but there is no Preview Save button.

On reopen:

- Restore room, flags, inventory, transcript, history, draft, panel state, and preferences.
- Add quiet `Resumed preview session` status.
- Leave command input unfocused.
- Compare saved engine version and world revision with the current project.

If the world changed, reconcile safely and show `World changed since this preview was last used`. If the current room was deleted, use a recovery dialog. If engine state is incompatible, preserve the old transcript for reference but require a new session.

The governing rule is:

> The preview is the author's persistent play session, not a mirror of editor selection. Synchronization occurs only through explicit actions or an explicitly enabled follow mode.

---

# Horizontal Slice Implementation Plan

Each slice delivers a coherent user-facing improvement across data, interaction, visuals, persistence, and tests. Avoid landing isolated infrastructure that cannot be exercised in the editor.

## Slice 1: Unified click-based map authoring

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

## Slice 2: Pathway-aware capacity and fast pathway editing

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
