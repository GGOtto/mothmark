# Spec Plan: Map-First Text Adventure Studio

*The dynamic map isn't a visualization bolted onto the editor anymore —
it's the primary way a game gets built. This doc folds the save/edit/run
plan, the admin review workflow, and the Quest positioning into one spec
organized around that idea. No AI anywhere in this.*

## 1. The core idea

Every version of this plan so far treated the map as a nice-to-have: a
node graph next to a text or form editor, generated from whatever the
author had already written. That's backwards for an engine whose exits
are genuine compass directions instead of freeform links — we can do
better than "visualize the data after the fact."

Instead: **the map is the canvas.** An author starts with one room on an
empty grid. To grow the world, they click a compass arrow on the edge of
an existing room — say, east — and a new room appears in that cell,
already connected. The exit, the reverse exit, and the room record all
get created together, from one gesture, on the same view the author is
looking at the whole time. The room's name, description, items, and
actions get filled in through a panel that opens right there, without
ever leaving the map.

This is the flagship idea for the whole product, not a Phase 2 polish
item. It changes what the editor *is*: not a text editor with a map
feature, but a map with a text editor folded into each node.

## 2. What this looks like to build

**Placing rooms.** Each room gets placed in the direction clicked —
strict adjacency by default. The grid itself isn't fixed, though: if a
new room needs space that's already spoken for, the map reflows around
it — shifting or spacing out nearby rooms — rather than blocking the
action outright. An author can also drag any room to a new spot at any
time; nothing about a room's position is meant to be permanent, and the
layout keeps adjusting to fit whatever gets added next, whether that
adjustment happens automatically or by hand. Custom, non-compass exits
(`jump`, `shout`, whatever an author invents) don't have inherent
geometry, so they aren't placed on the grid — they show up as a labeled
dashed connector drawn between whichever two rooms they link, wherever
those rooms happen to sit.

**Room sizing scales with the world.** A brand-new game with two or
three rooms shows large, spacious room cards — there's room to spare,
so it shouldn't look sparse. As more rooms get added, cards shrink to
keep a meaningful chunk of the map visible without constant panning.
Past a certain density, shrinking stops being useful and the canvas
switches to scrolling instead of continuing to compress — the same
big-to-small-to-scroll curve keeps a two-room starter game and a
two-hundred-room dungeon both feeling like they're sized appropriately
for what they actually are.

**Editing a room.** Selecting a node opens an inspector panel alongside
the map — name, description, items, NPCs, on-enter actions. This is the
structured/form editor from the original plan, just repositioned as a
detail view for whatever's selected on the map rather than a standalone
screen. A raw code view of the same room is still available as an
escape hatch for anyone who'd rather type our bracket-style syntax
directly; both views are just two different faces on the same
underlying JSON record (see Section 4) — the map's job is to give that
record a location, not to replace either editing surface.

**Floors.** Up and down exits don't fit a single 2D grid, so vertical
movement gets its own layer switcher — think of it as floors in a
building. A `u`/`d` exit connects a room on one floor to a room on
another; the map shows a small stairs marker on both ends and jumps the
view when clicked. There's a floor overview — some way to see how many
floors exist and roughly how they stack — but it lives in a secondary
panel rather than sitting on the main canvas by default, so a
single-floor game never has to think about it at all.

**Live updates.** There's no "generate map" step. Every room or exit
added, removed, or renamed reflects on the canvas the moment it happens,
because the canvas *is* the underlying structure, not a report on it.
That's what makes it dynamic rather than a static diagram.

**Validation, in place.** Orphaned rooms, dead ends, and exits pointing
nowhere show up as visual flags directly on the map — a highlighted
border, a warning icon on the node — instead of a separate error list
the author has to cross-reference back to a room by ID. If something's
wrong, it's wrong exactly where it visually lives.

**Templates, in place.** The "insert a locked door puzzle" idea from the
original plan becomes: drag a template onto an empty adjacent cell
instead of pasting a text snippet. The template still expands into the
same fixed action-language primitives underneath (`set_exit_req`,
`clear_exit_req`, and so on); the map just gives it a place to land.

**Player-facing automap.** The same rendering component, reused for
players rather than authors: it starts blank and fills in room by room
as the player actually moves through the game, fog-of-war style. It
never shows a room the player hasn't visited. This is a direct payoff of
the exploration identity the engine already had — worth calling out as
the single most visible way this product doesn't feel like Quest or
Twine to a *player*, not just an author.

## 3. Handling the awkward cases

- **Rooms with no natural location.** A title screen, a credits room, a
  room only ever reached by a scripted `goto` rather than a walked exit
  — these shouldn't be forced onto the grid. The map needs a "floating"
  area off to the side for nodes like this, excluded from the spatial
  layout entirely.
- **Grid conflicts.** Since the grid reflows rather than blocking
  placement (Section 2), the common case of "that direction is a little
  crowded" resolves itself by shifting nearby rooms to make space. The
  one case that's still a genuine conflict is trying to point one exit
  at two different destinations at once — that has to be a hard stop,
  since it's contradictory data, not a layout problem.
- **Deliberately impossible geometry.** Non-Euclidean layouts — walk
  north, west, south, east and you're somewhere new — are a genre
  tradition, not a bug, and nothing about allowing them should read as
  an error state. Connections that don't form consistent geometry get a
  distinct, low-key connector style — a different line treatment on
  just that one exit, not a warning badge on the room — enough to
  communicate "this one doesn't behave like the others" without
  cluttering the map or implying something's wrong. The player-facing
  automap doesn't need this treatment at all — it just draws what the
  player actually experienced, room by room, and a duplicate-looking
  node from a non-Euclidean twist is a fair and honestly kind of
  delightful outcome.
- **Large worlds.** Handled by the shrink-then-scroll behavior in
  Section 2 — cards shrink to a point, then the canvas scrolls instead
  of compressing further. Pan and a minimap are still worth having once
  scrolling is the norm, so a very large world doesn't turn into blind
  panning in search of one room.

## 4. Storage format: JSON is the save file, our syntax is just a view

One more piece worth locking in: **JSON is the canonical, stored, saved
format for a world.** Not the bracket syntax from the original engine,
not anything the map or form editor happen to show — `world_data` in
every `GameVersion` is JSON, full stop. Everything else — the map, the
inspector panel, the bracket-style code view — is a *representation* of
that JSON, generated from it and compiled back into it. None of them are
the source of truth themselves.

Concretely:

- **The map writes JSON directly.** Clicking a compass arrow to add a
  room isn't "generate some text, then parse it" — it's a direct
  mutation of the room list in `world_data`. No text round-trip involved
  for map-driven edits at all.
- **Our bracket-style syntax becomes an authoring convenience, not a
  file format.** It exists purely so the code-view escape hatch has
  something pleasant to show and type — a serializer turns JSON into
  that syntax for display, and a parser turns edited syntax back into
  JSON on save. It's regenerated from JSON every time it's shown, so it
  never has to be backward-compatible with itself; only the JSON schema
  does. If we improve the syntax later — better formatting, clearer
  action names, whatever — old saved games are unaffected, because they
  were never stored in that syntax to begin with. That also means the
  syntax itself isn't obligated to stay identical to the original
  `engine.py` bracket format — nothing about a given room's syntax is
  preserved verbatim between edits, so it's free to be redesigned into
  something more readable whenever that makes sense, with no migration
  story needed for existing games.
- **The runtime engine only ever executes against JSON.** The JS-ported
  engine loads `world_data` directly; it has no reason to know the
  bracket syntax exists at all. That syntax is purely an editing-time
  concern.
- **Version diffing is structural, not textual**, which is what makes
  the "real version history" differentiator from the positioning doc
  actually work well: diffing two JSON room objects field-by-field is
  meaningful in a way that diffing two versions of hand-typed bracket
  text isn't.
- **Export gets two honest options**: raw `world_data` JSON for
  backup/programmatic use, or the human-readable syntax rendering for
  someone who just wants to read or share a game's design outside the
  platform.

The schema itself, carried over from the original plan with explicit
position added to `Room` — this is the one real structural change the
map-first approach required:

```
User        { id, name, role (player | author | admin), ... }
Game        { id, owner_id, title, status (draft | pending_review |
              approved | rejected), review_note, current_version_id }
GameVersion { id, game_id, world_data (JSON), created_at, note }
PlayThrough { id, game_id, player_id, state (JSON), updated_at }

Room (within world_data)
  { id, x, y, floor, name, description, exits, actions, items, npcs,
    unpositioned: bool }
```

`unpositioned` covers the floating-room case from Section 3. Non-compass
exits still live in `exits` exactly as before; they just don't
influence `x`, `y`, or `floor`.

`GameVersion` already gives real revision history — this was called out
as a differentiator against Quest's overwrite-only publishing, and it
carries over unchanged. A version diff now also means being able to
show *layout* changes (a room moved, a floor added) alongside content
changes, which is a natural extension once positions are part of the
stored data.

## 5. What else carries over unchanged

- **Save**: autosave plus named checkpoints, player progress tracked
  separately from the game definition via `PlayThrough`.
- **Run**: a JS port of the engine as the canonical runtime, so the
  in-editor preview and the published player are the same code, and
  moves don't require a server round trip.
- **The closed action language**: still the whole safety story. No
  scripting escape hatch, no arbitrary code or HTML/JS in a published
  game — the guarantee that made the admin-review promise meaningful in
  the first place, and it's untouched by anything in this doc.
- **Admin review & oversight**: the same state machine (`draft →
  pending_review → approved/rejected`), the admin's unconditional
  visibility into every saved game regardless of status, and a
  structured review note — now something that can point at a specific
  room *on the map* rather than just a written comment, which is a nice
  small upgrade the map gives this feature for free.
- **No AI, anywhere in the product.**

## 6. Creator morale: designed for small creators first

The gallery and social features from the earlier positioning doc were
left deliberately vague — "forking," "ratings/comments" — because the
actual design goal here is more specific than "add social features."
Given we can't out-scale Quest's built-in audience on day one, the
honest value we can offer instead is that showing up with three plays
here should feel *better* than showing up with three plays anywhere
else. Every mechanic below serves one goal: a creator with one player
should feel just as good about their game as a creator with a thousand.

**Every view is an event, while a game is small.** A new `PlayThrough`
already represents exactly what "a view" is — someone opened the game
and started playing — so nothing new needs tracking just to detect one.
While a game's total interaction count is low, each new `PlayThrough`
fires an individual notification to the creator instead of getting
silently logged. And because `PlayThrough.state` already carries the
player's current room and visited-room list, the notification can say
something real: which room they reached, how much of the map they
uncovered, where they got stuck — not just "someone viewed your game."
This is a direct payoff of the map-first data model again: the creator
could see their own map with one player's fog-of-war overlaid on it,
which is a genuinely unique artifact this feature could produce.

**Likes and follows feed the same loop.** A like is a simple per-player
toggle on a game; a follow is a per-creator subscription, notifying the
creator on both, and — as a secondary benefit — letting a player hear
about a creator's next game without needing to remember to check back.
Both count toward the same interaction total as views for the purpose
of the next point.

**Notifications scale with recent momentum, not lifetime totals.** The
number that matters is something like a creator's highest view count
over a recent rolling window, not a running lifetime total — so a game
that was popular last month but has gone quiet lately throttles back
*up* toward individual per-view notifications rather than staying stuck
in digest mode just because it once crossed some threshold. Momentum
earns the batching, not history. Even at the most personal tier, there's
still some rate-limiting so a sudden burst of views doesn't turn into a
burst of pings — the goal is that getting one notification always feels
exciting, never that getting several in a row feels like noise. The
exact window length and rate cap are tuning questions (see open
questions), but the shape is: recent activity decides the tier, and the
tier decides how much room there is for a single event to feel special.

**No public numbers, anywhere — not views, not likes, not followers.**
A visible "3 views" sitting next to someone else's "40,000" is a worse
experience than no number at all, and it's the single most common
demoralizing thing about posting something small on an existing
platform. Counts still get tracked; they're just never rendered outside
the owning creator's own view of their own game.

**Popularity still shapes discovery — quietly.** Hiding counts doesn't
mean popularity has no effect on what a player sees; it means
popularity isn't *announced*. A few games can surface as suggestions
without ever being labeled "trending" or "most played" — just presented
as recommendations. A dedicated discovery page can lean on popularity
as one real input while mixing in enough randomness that a smaller game
has a genuine, regular chance of landing there too, rather than the same
handful of games always occupying the same slots.

**A private stats view is still worth having.** Hiding numbers publicly
doesn't mean hiding them from the creator — someone should be able to
look back at their own game's history whenever they want, not just
catch it in the moment a notification fires. That view is for the
creator's eyes only, framed the same generous way the notifications
are, not as a dashboard of raw analytics.

**Achievements give both sides something to chase.** Separate from the
notification system, players and creators each have their own
achievement track, and likes/follows feed both: a player earns progress
for the likes and follows they *give* (liking games, following
creators, finishing a certain number of games), and a creator earns
progress for the likes and follows they *receive* (a first like, a
first follower, a first returning player, round-number milestones from
there). It's a second, slower-burn reward loop alongside the immediate
notification one — less about a single moment and more about a sense of
accumulating history with the platform.

A small data model addition covers all of this:

```
Like              { id, game_id, player_id, created_at }
Follow            { id, follower_id, creator_id, created_at }
Notification      { id, recipient_id, type (view | like | follow |
                    milestone | digest), payload (game_id, room_id
                    reached, etc.), created_at, read_at }
Achievement       { id, key, name, description, side (player | creator) }
AchievementUnlock { id, user_id, achievement_id, unlocked_at }
```
No separate `View` table needed — a view *is* a new `PlayThrough`, and
its existing `state` field is already the source for "how far they
got."

## 7. Where this leaves the Quest comparison

The earlier positioning doc argued a compass-accurate map was one of
several advantages over Quest. This spec promotes it to the reason the
product exists: Quest's connections are freeform labeled links between
objects, so it has no spatial data to visualize even if it wanted to,
and nothing in Twine's or Inform's model is spatial either. Building
*by* placing rooms on a grid — not just looking at a graph of what's
already written — isn't something any of them offer, because it isn't
something any of their underlying data supports. Every other
differentiator from that doc (safe action language, real versioning,
cross-platform editing, transparent review, a narrower audience) still
stands and still matters; this is just the one that's now front and
center.

## 8. Revised phasing

**Phase 1 — MVP**
The map-first canvas *is* the editor from day one — single floor,
strict-by-default adjacency with the grid reflowing to fit new rooms,
manual drag-to-reposition, inspector panel for room detail, raw code
view as an escape hatch. JS-ported engine for live preview and player
runs. Save plus basic named checkpoints. Submit-for-review with visible
status. The closed action language as a stated guarantee. Floors, the
non-Euclidean connector treatment, and shrink-then-scroll room sizing
are real scope, not this pass — see Phase 2.

**Phase 2 — Depth**
Floors/layers for up/down exits with the secondary floor-overview
panel, the low-key connector treatment for intentionally inconsistent
geometry, shrink-then-scroll room sizing plus pan/zoom/minimap once
scrolling kicks in, player-facing fog-of-war automap, templates as
droppable map tiles, validation surfaced as on-map flags, docs panel,
guided tutorial.

**Phase 3 — Publishing & community**
Resolve the niche question from the positioning doc (classroom/small-
group vs. general public gallery), transparent review queue with
map-anchored rejection notes, version diffing that includes layout
changes, asynchronous multi-author editing of one map, forking. Also
where the creator-morale mechanics land: per-view notifications with
map-progress detail that scale with recent momentum rather than
lifetime totals, likes/follows, achievements for both players and
creators, and a discovery page that leans on popularity without ever
stating it outright.

## 9. Open questions

- Should a view notification name the player ("Jordan reached the
  vault") or stay anonymous ("someone reached the vault")? Naming them
  is more personal but is itself a design decision about the *player's*
  privacy, not just the creator's dopamine.
- What's the actual rolling-window length for "recent momentum" (last
  7 days? 30?), what's the rate-limit cap on individual notifications,
  and is the window computed per game or across a creator's whole
  account? A creator with five small games probably shouldn't have one
  quiet game treated as "high momentum" just because another one of
  theirs is popular right now.
- If an author manually drags a room to override the automatic layout,
  and a later edit would otherwise want to reflow that same area, which
  wins? The manual placement should probably be sticky, but that needs
  an actual rule, not just an assumption.
- What's the real density threshold where shrinking stops helping and
  scrolling takes over, and does it change once floors exist? A
  usability question to answer once there's something to click through,
  not a guess to lock in now.
- How much randomness is enough on the discovery page for a smaller
  game to have a real, regular shot at appearing — and is that ratio
  something we'll want to tune after watching real usage rather than
  fixing up front?
- Should achievements be visible on a public profile, or kept private
  the same way raw counts are? A visible badge shelf risks becoming its
  own quiet leaderboard — which is exactly the comparison the rest of
  Section 6 is designed to avoid.

## 10. Bottom line

Every mechanic from the earlier plans is still here — save, run, the
closed action language, admin review, the Quest positioning — none of
it got thrown out. What changed is what the author's hands are actually
doing: instead of writing a room and then seeing it appear on a map,
they place a room on a map and the writing happens inside it. That's a
small reversal on paper and a genuinely different feel to build with,
and it's the one thing on this whole list that the competition's data
model can't quietly copy, because their exits were never geography to
begin with.