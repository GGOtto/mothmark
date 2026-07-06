# Mothmark — Brand, Design, and Product Vibe

## Purpose of this document

This document gives future agents and contributors a shared design target for Mothmark.

Mothmark is not just a name swap from Mapwright. The name changed the center of gravity of the project. Future work should treat Mothmark as a quiet, tactile, night-archive authoring tool for text adventures, not as a generic SaaS app, AI writing app, or shiny dashboard.

Use this document when making decisions about UI, copy, layout, colors, component style, naming, and product feel.

## Research-backed design policy

This section exists to block generic generated design. Future contributors should treat it as an operating policy, not mood-board material.

Reference these sources when making design decisions:

- [USWDS design principles](https://designsystem.digital.gov/design-principles/) for real user needs, trust, accessibility, and continuity.
- [USWDS color guidance](https://designsystem.digital.gov/design-tokens/color/overview/) for limiting color families, starting from function, and avoiding color-only meaning.
- [USWDS button guidance](https://designsystem.digital.gov/components/button/) for keeping actions clear, short, verb-led, and limited in number.
- [GOV.UK service design guidance](https://www.gov.uk/service-manual/design/making-your-service-look-like-govuk) for reusing tested patterns and requiring research evidence before inventing new ones.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) for accessibility baseline decisions, especially contrast, focus, readable structure, and operable controls.
- [Carbon content guidance](https://carbondesignsystem.com/guidelines/content/overview/) for product copy that is clear, consistent, and easy to translate.
- [Carbon accessibility guidance](https://carbondesignsystem.com/guidelines/accessibility/overview/) and [Fluent accessibility guidance](https://fluent2.microsoft.design/accessibility) for low cognitive load, keyboard use, logical order, and meaningful text.
- [Library of Congress map collections](https://www.loc.gov/maps/collections/) for real map, survey, military, railroad, and exploration references rather than invented parchment fantasy.
- [British Library digitised manuscripts and archives](https://www.bl.uk/collection) for restrained manuscript material references: ink, rubrics, marginalia, vellum, annotation, and aging.
- [Aseprite](https://www.aseprite.org/) for compact creative-tool density: palettes, layers, frames, and work-object-first interface structure.
- [Lucide](https://lucide.dev/) is the current icon source through `lucide-react`. Use icons as labels for known actions, not as brand decoration.
- [Game-icons.net](https://game-icons.net/) only for small adventure/object symbols when a generic UI icon cannot describe the concept clearly. Keep usage sparse.

Practical interpretation for Mothmark:

- Start with the author's actual task: making rooms, connecting exits, testing commands, and clearing warnings.
- Earn trust by showing state plainly: selected room, checkpoint, warning count, broken exits, and command output.
- Keep the interface continuous: use the same room, exit, checkpoint, warning, and command language across pages.
- Make primary actions concrete verbs: `Open map`, `Run command`, `Save checkpoint`, `Add east room`.
- Prefer visible work objects over sales copy: maps, room fields, warning rows, transcripts, and checkpoint history.
- Do not invent a new component pattern if a plain button, link, label, table-like row, tab, or input will do.
- Use atmosphere only after function is clear. Texture cannot compensate for unclear hierarchy.
- Treat accessibility as part of the visual style: visible focus, readable contrast, logical source order, labeled inputs, no color-only status.

### Design review gate

Before accepting a page, answer these questions:

- Can a returning author identify the current game, selected room, warning state, and next useful action within a few seconds?
- Does the page contain a real product surface, or is it mostly promotional scaffolding?
- Are the controls named after the work they perform?
- Could the page still be understood if color were unavailable?
- Does every decorative detail reinforce the map, room, command, checkpoint, or warning workflow?
- Is any copy vague enough that it could appear on an AI writing app, SaaS dashboard, or template landing page?
- Are headings, labels, and source order useful to someone navigating by keyboard or screen reader?
- Are there too many competing buttons or equal-weight calls to action?

If a page fails any of these checks, simplify it toward the authoring workflow before adding polish.

## Core idea

Mothmark is a tool for building text adventures that should feel like:

- an adventurer's poorly drawn map
- a rogue's sketchbook
- a burnt scrap clutched in a skeleton's hand
- a torn map with a key bundled inside
- a field note found under a floorboard
- a small mark in the margin that only matters later
- the promise of treasure, danger, and wrong turns
- a quiet workbench for rooms, exits, notes, commands, secrets, and tests

The product is practical, but the atmosphere should feel like a found artifact.

The guiding feeling is not "fantasy theme park." It is "old evidence of an adventure."

## Product summary

Mothmark is an authoring tool for parser-style and room-based text adventures.

The user is not simply creating content. They are arranging rooms, testing commands, hiding keys, checking exits, naming checkpoints, and building a little world that can be explored.

The current repo already has the beginnings of this workbench:

- a Next app with `/`, `/editor`, `/starter`, and `/api/health`
- a map-first editor shell with left navigation, central workspace, right inspector, and bottom command line
- draggable room cards on a gridded canvas
- compass-style exits and curved connectors
- creating new rooms by dragging or clicking room-side connection handles
- selecting rooms and connections
- editing room name, room ID, room description, existing room features, aliases, and listed state
- warning when the selected room ID is duplicated
- editing a selected connection pathway and deleting connections
- a command/player surface that can sync to the selected room
- parser commands for look, movement, examine, take, use, put, help, and aliases
- Zod world schemas for rooms, descriptions, room features, flags, conditions, connections, directions, and pathways
- starter JSON generation from the current world schema

The current repo does not yet have persistent project storage, checkpoint UI, a full issues panel, room creation from the inspector, feature creation from the UI, object resolution for command targets, published playthroughs, player automaps, or fully wired world/logic/settings tabs. Do not write product copy or docs as though those pieces already exist.

The interface should grow toward:

- stronger room-map editing
- compass exits with clearer state
- room descriptions and feature editing
- command testing and live preview
- draft versions and named checkpoints
- validation warnings
- notes attached to rooms
- broken-exit detection
- orphaned-room detection
- missing-description detection
- dead-end detection
- eventually, player-facing automaps and published playthroughs

The editor should feel like a tool, not a landing page. When reality and ambition differ, name the ambition as future work.

## Name

The product name is:

```txt
Mothmark
```

Primary domain:

```txt
mothmark.app
```

`.com` is unavailable, but `.app` fits because the product is a web application people open and use.

### Why the name works

Mothmark suggests:

- old paper
- small hidden marks
- moth-eaten maps
- fragile records
- night, dust, and lamplight
- a secret sign left behind
- damage that becomes meaning
- an artifact that has survived something
- a mark that is practical, not ornamental

The name has logo potential, but the logo should not be generated casually. The logo is intentionally protected from generic AI output.

### Name rules

Do:

- write it as `Mothmark`
- use it as a product name, not a studio name
- let the name imply texture and mystery
- keep the wordmark quiet and restrained

Do not:

- write it as `MothMark` unless referring to unrelated external entities
- make it cute
- turn it into a mascot brand
- overuse moth imagery
- make it look like a bug app
- make it sound like a generic AI writing tool

## Brand position

Mothmark should feel like:

- a careful tool
- an old map table
- a parser-game workbench
- a notebook for rooms and doors
- a place where small details matter
- slightly eerie, but not horror
- literary, but not precious
- practical, but not sterile

It should not feel like:

- a generic SaaS dashboard
- a startup landing page
- an AI content generator
- a cheerful fantasy game site
- a lore wiki
- a full RPG engine
- a mascot-driven brand
- a modern flowchart tool with a fantasy skin

## Visual direction

Use a quiet, tactile, night-archive style.

The interface should feel like a modern editor opened over an old research table:
dark enough for long writing sessions, specific enough to evoke maps and
manuscripts, and practical enough that the author never feels trapped in a
theme. The key shift is away from "parchment UI" and toward "archive desk":
blackened ink, oxidized copper, indigo wash, red-lead warning marks, cream
paper, stamped labels, and visible drafting lines.

Mothmark should not look old because the UI is fake-medieval. It should look
old because its work objects resemble real artifacts: map labels, survey lines,
rubric marks, index cards, room records, command transcripts, and field notes.

Good references:

- old field notes
- torn adventure maps
- ink grids
- moth-eaten paper
- charcoal marks
- oxidized copper and verdigris
- indigo wash and blue-black ink
- red-lead rubric marks
- worn cream stock
- clipped index labels
- dim lamplight
- dungeon-room diagrams
- hand-annotated margins
- practical fantasy inventory screens
- parser adventure transcripts
- old notebooks and marginalia
- folded paper, worn labels, stamped symbols
- compact pixel/art tools where palettes, layers, coordinates, and timelines are visible work objects

Avoid:

- glossy SaaS gradients
- glassmorphism
- generic AI-app purple/blue
- cheerful cartoon fantasy
- over-rendered parchment backgrounds
- fake medieval UI
- sepia filters over everything
- huge marketing hero sections
- cute bug mascots
- overusing moth imagery
- anything that looks generated
- fake leather textures
- novelty fonts
- excessive glow effects
- "magical productivity app" energy

The vibe should be restrained, not theatrical.

## Anti-slop rule

Mothmark should never look like a generic AI-generated SaaS page.

Avoid these common AI-slop patterns:

- giant centered hero headline with vague copy
- purple/blue gradients
- abstract glowing blobs
- glass cards floating over a gradient
- pill buttons everywhere
- meaningless feature cards
- fake testimonials
- generic dashboard screenshots
- over-smooth icons
- "unleash your creativity" language
- "revolutionize your workflow" language
- decorative UI that does not help the author build

Mothmark should look like someone built it for a specific job.

### AI-look tripwires

Reject or revise a design when you see:

- a hero section larger than the actual editor surface
- a value proposition that could fit any creativity tool
- repeated feature cards without corresponding authoring controls
- ornamental screenshots that do not show rooms, exits, commands, or warnings
- glowing gradients, glass panels, or floating blobs used to create excitement
- status badges that are decorative instead of operational
- big empty whitespace that makes the tool look unfinished rather than calm
- fake content such as testimonials, logos, stats, or made-up social proof
- unexplained icons or symbols that require guessing
- labels that sound branded when a plain product noun is clearer

## Color palette

Do not derive new implementation work from the old palette. The Mothmark color
system is now **night archive with artifact accents**:

- Near-black and green-black grounds for the working surface.
- Cream stock for readable text and selected paper-like objects.
- Verdigris as the primary interactive accent because it suggests aged copper,
  map pins, and constructive editing without becoming fantasy gold.
- Indigo for preview, floor/layer, and transcript-adjacent states.
- Ochre for saved/checkpoint and focus emphasis.
- Red lead / madder for validation warnings and destructive states.

The palette is intentionally multi-material. It should not collapse into
"brown app," "blue app," or "gold fantasy app."

### Current CSS alignment

The current UI is partly aligned but not finished:

- The map canvas already uses a paper-toned surface, drafting grid, hard-edged room cards, and ink-like connector lines. Preserve that work-object-first feeling.
- The right inspector already uses cream paper inputs, compact uppercase labels, visible focus rings, and warning text. Preserve the practicality.
- The editor shell, placeholder panels, command line, and homepage still lean on generic `#111`, `#161616`, bright white, centered cards, and broad shadows. Future styling passes should replace those with the semantic tokens below.
- Selected connections currently use bright red. Change future selected-exit styling to verdigris; reserve red lead or madder for warnings, broken exits, and destructive actions.
- The left rail active marker currently uses white. Prefer verdigris for active tool/navigation state, with ochre reserved for keyboard focus or checkpoint emphasis.
- Rounded placeholder cards should be treated as temporary scaffolding. Keep repeated cards compact and useful, and avoid turning page sections into floating SaaS panels.

Do not make a large restyle unless the user asks for implementation work. For
ordinary feature changes, move touched components toward the palette below
without churning unrelated CSS.

Core swatches:

```txt
Night ink         #11130f
Archive board     #1b1a16
Charcoal panel    #24221d
Lifted panel      #2c2922
Rule line         #3a352b
Draft grid        #312d26
Dry ink           #766e5f
Field note        #b8ad97
Cream stock       #f2e5c8
Quiet paper       #d8c6a3
Verdigris         #70a58d
Deep verdigris    #3f6f60
Indigo wash       #7f91bf
Deep indigo       #4d5e86
Ochre mark        #c8a962
Red lead          #d36d3f
Madder seal       #9e3f33
```

### Color usage

Use:

- `Night ink` as the app background and `Archive board` / `Charcoal panel` for panels.
- `Cream stock` for primary text on dark surfaces.
- `Field note` for secondary text that still needs to pass normal-text contrast.
- `Dry ink` only for disabled or nonessential metadata, never body copy.
- `Verdigris` for primary creation actions, selected nodes, active exits, and positive "connected" states.
- `Indigo wash` for preview, player view, floor/layer controls, and transcript-related affordances.
- `Ochre mark` for focus rings, saved checkpoints, pins, and small emphasis marks.
- `Red lead` for warnings that require author attention.
- `Madder seal` for destructive or blocked actions.
- `Quiet paper` for selected room cards or editable paper-like surfaces when a light inset is useful.
- `Rule line` and `Draft grid` for map structure. These should be visible but never compete with room labels.

Do not use:

- neutral Tailwind gray as the dominant palette
- bright white text on black everywhere
- saturated blue as the primary brand color
- purple AI-app gradients
- large areas of ochre, gold, red, or parchment
- monochrome sepia surfaces
- high-contrast red warnings unless absolutely necessary
- green as the only state signal
- color without text, icon shape, or position as a backup signal

### Contrast notes

The dark-mode defaults were checked against WCAG-style contrast ratios for
normal text:

```txt
Cream stock on Night ink     14.96:1
Field note on Night ink       8.42:1
Verdigris on Night ink        6.63:1
Ochre mark on Night ink       8.28:1
Red lead on Night ink         5.36:1
Indigo wash on Night ink      5.97:1
```

Still verify final CSS combinations after implementation. Thin borders, small
labels, disabled states, translucent overlays, gradients, and textured
backgrounds can all reduce practical readability even when base swatches pass.

### Suggested semantic tokens

```ts
const colors = {
  bg: "#11130f",
  bgRaised: "#1b1a16",
  panel: "#24221d",
  panelRaised: "#2c2922",
  border: "#3a352b",
  grid: "#312d26",
  text: "#f2e5c8",
  textMuted: "#b8ad97",
  textFaint: "#766e5f",
  paper: "#d8c6a3",
  accent: "#70a58d",
  accentDeep: "#3f6f60",
  preview: "#7f91bf",
  previewDeep: "#4d5e86",
  focus: "#c8a962",
  warning: "#d36d3f",
  danger: "#9e3f33",
};
```

Suggested semantic mapping:

```ts
const semanticColors = {
  appBackground: colors.bg,
  workspaceBackground: colors.bgRaised,
  inspectorBackground: colors.panel,
  selectedRoomBackground: colors.paper,
  selectedRoomText: colors.bg,
  roomBorder: colors.border,
  mapGrid: colors.grid,
  primaryAction: colors.accent,
  primaryActionHover: "#86b9a2",
  activeExit: colors.accent,
  previewState: colors.preview,
  checkpointState: colors.focus,
  warningState: colors.warning,
  destructiveState: colors.danger,
  focusRing: colors.focus,
};
```

### Texture and material

Texture should be structural, not decorative.

Use:

- 1px drafting grids and rule lines
- slightly uneven but CSS-native borders
- small stamped labels for metadata
- paper insets only for selected room cards, note fields, and export/read views
- light grain only if it is subtle enough that small text remains crisp
- shadows only to separate overlapping inspector/map layers

Avoid:

- full-screen parchment backgrounds
- bitmap paper texture behind dense text
- burned edges
- curled corners
- heavy vignette
- fantasy leather, metal, gem, or candle UI
- texture that makes disabled, warning, or focus states harder to read

## Typography

Use simple, readable typography.

Preferred style:

- sans-serif for main readable UI
- monospace for labels, room IDs, coordinates, command input, shortcuts, diagnostics, and system metadata

Text should feel precise and tool-like.

Good examples:

```txt
ROOM 001
sealed-vault
go east
draft checkpoint
orphaned room
missing exit target
unreachable room
no command output yet
```

Avoid:

- decorative fantasy fonts
- fake medieval lettering
- script fonts
- fonts that make the app feel like a novelty game menu

## Wordmark guidance

The logo is out of scope unless explicitly requested.

For now, use a text-only wordmark.

```tsx
<span className="font-mono text-xs uppercase tracking-[0.24em]">Mothmark</span>
```

Other acceptable temporary wordmark treatments:

```tsx
<span className="font-mono text-sm tracking-[0.18em] text-[#f2e5c8] uppercase">Mothmark</span>
```

```tsx
<span className="font-serif text-base tracking-wide text-[#f2e5c8]">Mothmark</span>
```

Only use the serif version if the surrounding UI remains practical and restrained.

## Logo guidance

Agents should not design the final logo unless explicitly asked.

Current logo rule:

```txt
Use text-only wordmark placeholders.
No generated moth icons.
No mascot.
No clip art.
No AI-logo look.
```

Possible future logo directions, for human exploration only:

- a mark that could be a moth, inkblot, or map symbol
- a tiny cartographic mark with wing-like geometry
- a damaged paper glyph
- a stamped symbol in the corner of a map
- an "M" that feels marked, not illustrated
- a moth-like negative space hidden in a fold or crease
- a map symbol that only later reads as a moth

The logo should be a mark, not a picture of a moth.

A good Mothmark logo should feel like something stamped into the corner of a found map.

## Layout principles

Mothmark should feel like a workbench.

Editor layouts should prioritize:

- map canvas
- room details
- live preview
- validation and notes
- quick actions
- command input
- clear state

Preferred surfaces:

- bordered panels
- flat blocks
- subtle shadows only when useful
- visible grid
- minimal rounded corners
- restrained hover states
- clear selected states

Avoid:

- floating glass cards
- pill-button overload
- giant empty landing pages
- decorative UI that competes with the map
- generic dashboard templates
- bubbly cards
- excessive whitespace that makes the tool feel empty

The UI should be calm but not sparse. It should feel useful.

## Component style

### Panels

Panels should look like dark paper or inked boards.

Use:

- dark warm fill
- thin brown border
- compact headings
- small metadata labels
- restrained padding

Avoid:

- bright cards
- heavy drop shadows
- glass blur
- rounded 3xl SaaS panels

### Buttons

Primary creation buttons should use verdigris.

Secondary buttons should be dark with a border.

Checkpoint/save emphasis can use ochre, but only when the action is about
preserving state.

Danger buttons should be madder red-brown, not bright red.

Button copy should be specific:

Good:

```txt
Create room
Add east exit
Run command
Save checkpoint
Open preview
```

Bad:

```txt
Get started
Unlock creativity
Continue your journey
Make magic
```

### Inputs

Inputs should feel like command lines, notes fields, or map labels.

Use monospace for command input.

Good placeholder examples:

```txt
go east
look
take key
sealed-vault
A narrow passage turns sharply north.
```

### Badges and labels

Use tiny uppercase labels sparingly.

Examples:

```txt
DRAFT
ROOM
EXIT
WARNING
CHECKPOINT
LIVE PREVIEW
```

### Icons

Icons are allowed, but they should behave like tool glyphs and map marks, not
illustrations.

Use:

- common UI icons from `lucide-react` when they map to familiar controls like save, play, warning, settings, search, close, plus, arrow, undo, redo, and external link
- icon-plus-text buttons for primary commands unless the icon is universally understood in context
- sparse adventure/object symbols from a source such as Game-icons.net only when the symbol clarifies a text-adventure concept better than a generic UI icon
- consistent stroke weight, size, and color tokens
- tooltips or visible labels for icon-only controls

Avoid:

- moth icons as decoration
- ornate fantasy icons
- mixed icon packs in the same toolbar
- icon-only commands that require guessing
- decorative icons inside every card or heading
- using icons as a substitute for clear room, exit, warning, or command copy

## Map canvas

The map canvas is the heart of the product.

It should feel like an annotated draft map, not a polished game board.

Room nodes can feel like:

- small paper cards
- pinned labels
- inked boxes
- map annotations
- workbench objects

Exits should be clear but not flashy.

Good visual language:

- faint square grid
- room cards with hard borders
- verdigris selected outline
- thin connector lines
- compass labels
- small warning marks
- readable room names
- clean sketchbook energy

Do not make the canvas look like:

- a modern flowchart SaaS tool
- a neon graph editor
- a colorful mind map
- a tactical RPG map
- a fantasy board game

Current map behavior to protect:

- Room cards can be selected and dragged.
- New rooms and exits can be created from existing room connection handles.
- Existing connectors can be selected and edited.
- The map uses an SVG layer for connections over a gridded room workspace.
- The selected room drives the inspector and can sync the preview to that room.

Current map behavior to improve when touched:

- Make selected room and selected connection states verdigris instead of muted tan or bright red.
- Add non-color state cues where practical, such as line weight, corner marks, labels, or warning symbols.
- Keep room nodes compact and fixed-size so dragging and selection do not resize the map.
- Use clear empty/invalid states for missing connection endpoints instead of silently hiding important authoring problems.

### Room node states

Suggested states:

```txt
Default room: dark panel, thin border
Selected room: verdigris border or corner mark
Unreachable room: muted/faded opacity plus warning label
Room with issue: small red-lead warning mark
Start room: subtle ochre origin mark
Preview/current room: indigo live marker
```

### Exit connectors

Suggested style:

```txt
Valid exit: thin faded-ink line
Selected exit: verdigris line
Broken exit: dashed red-lead line
One-way exit: small directional tick
Locked/conditional exit: tiny notch or ward mark
```

## Live preview

The live preview should feel like testing the adventure, not chatting with an AI.

Use parser-like language.

Good preview structure:

```txt
> look
You are standing in a low stone room. Dust gathers along the east wall.

Exits: east

> go east
The passage narrows. Something glints under the ash.
```

The command prompt should be visually distinct and probably monospace.

Avoid making it feel like a chatbot.

Current preview behavior:

- The bottom command line embeds the game player.
- It syncs to the selected room with `Sync Room` and on selected-room changes.
- It supports command history and parser output.
- Movement follows current connections and pathway direction.
- Feature/object commands currently return generic responses instead of resolving real features.

Treat feature/object command resolution as future engine work unless the task
explicitly asks for it. Copy should not imply that inventory, item pickup, or
feature-specific interactions are finished.

## Copy style

Copy should be short, concrete, and slightly mysterious when appropriate.

Good:

```txt
Draw the map. Test the room. Keep writing.
A room-and-command editor for text adventures.
The door does not open yet.
No exit leads east.
This room is unreachable.
The east exit has no target.
No command output yet.
Save this checkpoint before changing the map.
```

Avoid:

```txt
Unleash your creativity with AI-powered storytelling workflows.
Revolutionize your narrative design pipeline.
Build immersive experiences faster than ever.
Generate rich interactive worlds in seconds.
Empower your imagination.
```

No startup fog machine.

### Tone

The tone should be:

- quiet
- useful
- direct
- slightly literary
- not cute
- not grandiose
- not faux-medieval

## Landing page direction

The homepage should not feel like a generic marketing page.

It should feel like opening the cover of a tool.

The current homepage is a temporary centered card that points to `/editor`.
That is acceptable as scaffolding, but it should not become the product's
lasting first impression.

Preferred structure:

- small wordmark
- concise product description
- real preview of the current map/editor surface, not abstract feature cards
- one primary action
- maybe one secondary technical link such as starter JSON or docs

Avoid:

- giant centered hero with vague inspirational copy
- gradients
- abstract blobs
- fake testimonials
- "AI-powered" positioning
- large icon grids
- overexplaining the whole vision

Current placeholder homepage mood:

```txt
Mothmark
A room-and-command editor for text adventures.

Draw the map. Test the room. Keep writing.
```

This is better than trying to explain the whole product in one slogan.

If the homepage remains a placeholder, keep it honest and small. Do not add
fake product breadth, fake user proof, or claims about publishing/checkpoints
until those features are real.

## App shell direction

The current app shell includes:

- left icon rail with Map, World, Logic, Issues, World Settings, and Settings
- central workspace with the map as the only fully implemented tab
- placeholder workspaces for non-map tabs
- resizable right inspector for selected rooms/connections
- bottom resizable command/player panel

A mature Mothmark app shell might include:

- top-left text wordmark
- small project/game switcher
- map canvas as the main area
- left or right panel for selected room
- bottom or side live preview
- compact status strip for validation warnings

The app should feel like a practical editor used by someone making a game, not like a website trying to sell itself.

Until the non-map tabs are wired, keep their copy plain and status-like. Good
placeholder copy tells the author what will belong there without pretending the
editor is complete.

## Navigation naming

Prefer concrete labels:

```txt
Map
World
Logic
Issues
World Settings
Settings
Starter World
Preview
Checkpoints
Notes
```

Avoid vague labels:

```txt
Dashboard
Experience
Studio
Magic
Create
Journey
```

`Studio` can be used only if it clearly refers to a workspace, but the product should not become "Mothmark Studio" by default.

## Product language

Use these terms consistently:

```txt
Game
Room
Exit
Connection
Pathway
Command
Preview
Checkpoint
Draft
Map
Note
Warning
Publish
```

Possible future terms:

```txt
Automap
Playthrough
Transcript
Inventory
Object
Flag
Condition
```

Avoid overbranding normal concepts. A room should be called a room, not a "mothcell" or something cursed.

## Error and warning language

Warnings should be practical and specific.

Good:

```txt
This room has no description.
This exit has no target.
This room cannot be reached from the start room.
Two rooms use the same slug.
The command returned no output.
```

Mothmark can be atmospheric, but diagnostics should not be cryptic.

Bad:

```txt
The map spirits are confused.
A shadow blocks this path.
Oopsie, something went wrong!
```

## Empty states

Empty states can carry some flavor, but should still explain the action.

Good:

```txt
No rooms yet.
Create the first room to start the map.
```

```txt
No preview output yet.
Run a command to test this room.
```

```txt
No checkpoints yet.
Save one before making a risky change.
```

Avoid vague motivational copy.

## Iconography

Use icons sparingly.

Good icon directions:

- simple compass arrows
- small warning triangles
- thin door marks
- tiny document/note icons
- branch/connector symbols
- terminal prompt symbol
- save/checkpoint glyphs
- floor/layer glyphs

Avoid:

- cute moth icons
- fantasy weapon icons everywhere
- overly detailed illustrated icons
- random magic sparkles
- AI sparkle icons

## Motion and interaction

Motion should be subtle and functional.

Good:

- selected room outline appears cleanly
- connector line highlights on hover
- panel opens quickly
- preview output scrolls naturally
- validation warning pulses once or appears quietly

Avoid:

- bouncy animations
- dramatic page transitions
- floating particles
- glowing magical effects
- animated moths unless explicitly designed later

## Texture guidance

Texture should be implied more than rendered.

Use:

- subtle borders
- low-contrast grid
- muted colors
- restrained typography
- occasional worn-paper language

Avoid:

- heavy parchment background images
- fake stains everywhere
- noisy paper overlays that hurt readability
- skeuomorphic leather/map UI
- making every panel look burnt

The product should be usable first. Atmosphere is seasoning.

## Accessibility

Do not sacrifice readability for vibe.

Maintain:

- strong enough text contrast
- clear focus states
- keyboard navigation
- visible selected states
- readable command output
- non-color-only warnings where possible

Atmospheric UI still needs to be usable.

## Tailwind implementation hints

Avoid default gray-heavy Tailwind styling.

Good base classes might use arbitrary colors:

```tsx
className = "min-h-screen bg-[#11130f] text-[#f2e5c8]";
```

Panel:

```tsx
className = "border border-[#3a352b] bg-[#24221d]";
```

Muted text:

```tsx
className = "text-[#b8ad97]";
```

Accent:

```tsx
className = "text-[#70a58d]";
```

Primary button:

```tsx
className = "border border-[#70a58d] bg-[#70a58d] text-[#11130f] hover:bg-[#86b9a2]";
```

Secondary button:

```tsx
className = "border border-[#3a352b] bg-[#1b1a16] text-[#f2e5c8] hover:border-[#70a58d]";
```

Grid background idea:

```tsx
style={{
  backgroundImage:
    "linear-gradient(#312d26 1px, transparent 1px), linear-gradient(90deg, #312d26 1px, transparent 1px)",
  backgroundSize: "32px 32px",
}}
```

Use these as direction, not permanent design law.

## File and repo naming

The repo and project should use:

```txt
mothmark
```

Visible product strings should use:

```txt
Mothmark
```

Old references to `Mapwright` should be replaced unless they are in historical notes.

## Domain structure

Primary domain:

```txt
mothmark.app
```

Potential future structure:

```txt
mothmark.app           main app / landing
app.mothmark.app       optional authenticated app
docs.mothmark.app      documentation
play.mothmark.app      published games / player-facing experiences
```

For now, keep it simple. `mothmark.app` can point to the main app or landing page.

## Things agents must not do

Do not:

- invent a logo
- generate moth mascot art
- use generic moth clip art
- make the UI glossy
- make the UI look like a generic AI app
- add purple-blue gradients
- use fake medieval fonts
- call ordinary features by overly branded names
- make diagnostics cryptic
- overdo parchment textures
- turn the product into a game instead of an editor
- introduce AI positioning unless explicitly requested
- change the vibe toward cheerful fantasy
- overuse "journey," "magic," "unlock," or "unleash"

## Things agents should do

Do:

- keep the app practical
- keep the mood tactile and quiet
- use night-archive colors
- use cream-stock text
- use verdigris for creation and selection
- use ochre sparingly for focus and checkpoint emphasis
- use monospace for commands and metadata
- make the map canvas central
- keep copy concrete
- preserve the authoring-tool identity
- make warnings clear
- treat the logo as sacred ground
- prefer workbench over showcase

## Design north star

Mothmark should feel like a careful tool made for people who love old adventure games, maps, secrets, rooms, and commands.

It should feel practical enough to build with.

It should feel strange enough to remember.

The ideal reaction is not:

```txt
Wow, what a slick SaaS landing page.
```

The ideal reaction is:

```txt
This feels like where I would make a strange little adventure.
```
