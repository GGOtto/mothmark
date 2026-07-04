# Sprint Plan: Always-Shippable

_This resequences the exact same backlog from `build_steps.md` — no
new work, no dropped work — into vertical slices instead of horizontal
phases. The difference: `build_steps.md` builds all the backend, then
all the frontend, then all the design for a phase before that phase is
usable. Here, every single sprint ends with something a real person can
actually log into and use. If work stopped permanently after any sprint
below, what exists is a genuinely functional (if incomplete) product,
not a pile of half-wired endpoints and unstyled screens._

_The package/tool choices from `build_steps.md`'s "Packages & Tools"
section are unchanged and not repeated here — this doc is purely about
sequencing._

_Sprint length isn't specified — use whatever cadence your team
already works in. The one rule worth protecting if you reorder or split
anything: don't ship half of a slice. A sprint that adds a database
table with no endpoint, or an endpoint with no UI, breaks the "still
usable if stalled" property this whole plan exists to guarantee._

---

## Sprint 1 — Two rooms and a login

The walking skeleton. Heavier than later sprints because it's carrying
all the one-time setup work — every following sprint benefits from
this being done once, here.

**Backend**

- [ ] Initialize the Next.js project, Postgres (local + Neon), Drizzle,
      env config, health check, Vitest, CI, logging, Sentry.
- [ ] Deploy to Cloudflare Workers via `@opennextjs/cloudflare`.
- [ ] Migrations for `User`, `Game`, `GameVersion`.
- [ ] Auth (Better Auth) — password-based is enough for now; email
      verification can wait (Sprint 3).
- [ ] Minimal `Game` CRUD: create, get-one.
- [ ] Minimal `GameVersion` save (current draft only — named
      checkpoints come in Sprint 2).
- [ ] Port the engine's `perform_action` logic into the shared TS
      module, with just enough validation to run a couple of rooms
      safely (the full validation pass is Sprint 2).

**Website**

- [ ] App Router structure, Tailwind + shadcn/ui, bare app shell.
- [ ] Sign-up / log-in pages.
- [ ] "My Games" list (create new, open existing).
- [ ] Map canvas rendering a single room; one compass direction (say,
      east) wired fully end-to-end: click → new room + exit created →
      canvas re-renders.
- [ ] Live preview pane: type commands, see the engine respond.
- [ ] Seed one example world (the sealed-vault sample) so a brand-new
      account isn't staring at an empty screen.

**Design**

- [ ] Visual identity and a first pass at design tokens.
- [ ] Rough (not final) room-card and player-pane styling — coherent
      enough to use, not yet polished.

**Still works if we stop here:** someone can make an account, build a
two-room game by clicking one arrow, play it by typing commands, and
it's live on the internet. Small, but completely real.

---

## Sprint 2 — A map you can actually build with

**Backend**

- [ ] Zod schemas for `world_data` and action arguments; full world
      validation (orphans, bad exits, malformed actions).
- [ ] Wire that validation into `GameVersion` save, errors keyed by
      room id.
- [ ] JSON ⇄ bracket-syntax serializer/parser (compile-time only).

**Website**

- [ ] Extend compass-arrow placement to all eight directions plus
      up/down.
- [ ] Elastic-reflow layout logic (shift neighboring rooms on
      conflict).
- [ ] Drag-to-reposition on room nodes (dnd-kit).
- [ ] Room inspector panel (name, description, items, NPCs, on-enter
      actions).
- [ ] Raw code-view toggle (CodeMirror 6, custom DSL highlight mode).
- [ ] Debounced autosave, plus named checkpoint save/restore.
- [ ] Validation errors surfaced as flags directly on map nodes.

**Design**

- [ ] Full room-node card design (replacing Sprint 1's rough version).
- [ ] Inspector panel layout.
- [ ] Code-view syntax-highlight theme.

**Still works if we stop here:** a creator can build a real,
non-trivial game — items, NPCs, branching actions, a full map they can
freely rearrange — drop into raw syntax if they want to, get real
validation feedback, and trust that their work is actually saved. This
is already a genuinely useful personal tool.

---

## Sprint 3 — Submit it somewhere that matters

**Backend**

- [ ] `Game.status` (draft/pending_review/approved/rejected) and a
      submit-for-review endpoint.
- [ ] Admin-only endpoints: list pending, open any game regardless of
      status, approve/reject with a `review_note`.
- [ ] Owner-or-admin visibility enforcement on non-approved games.
- [ ] Resend + React Email for verification/password-reset — worth
      having before anyone outside the team is trusted with an account.
- [ ] Upstash Redis + Ratelimit on auth endpoints.

**Website**

- [ ] "Submit for review" button and a status indicator on the "My
      Games" dashboard.
- [ ] Minimal admin screen: list pending, open one read-only in the
      player pane, approve/reject with a note.

**Design**

- [ ] Calm, non-judgmental visual treatment for the draft/pending/
      approved/rejected states — this is the first place the
      creator-morale principle from the spec actually shows up.
- [ ] Minimal admin screen layout.
- [ ] Playtest the full loop end to end: create → build → preview →
      submit → review.

**Still works if we stop here:** the entire authoring-and-review
lifecycle from the spec is real. A creator can go from a blank page to
a submitted game and get an actual decision back — the product's core
promise (review before anything goes public) is fully functional, even
though only the admin can see anything that isn't yet approved.

---

## Sprint 4 — Worlds that scale and stack

**Backend**

- [ ] Floor-aware helpers (list distinct floors for a game).
- [ ] Extend exit validation to tolerate an "intentionally
      inconsistent" flag rather than erroring on it.

**Website**

- [ ] Floor switcher plus the secondary (not-in-your-face) floor
      overview panel.
- [ ] UI to mark an exit as intentionally inconsistent, rendered with
      the distinct low-key connector style.
- [ ] Shrink-then-scroll room sizing as room count grows, animated
      with Motion.
- [ ] Pan, zoom, and a minimap (react-zoom-pan-pinch).

**Design**

- [ ] Floor-overview panel design.
- [ ] Non-Euclidean connector style.
- [ ] Room-card size-state design and the scroll-mode transition.
- [ ] Pan/zoom/minimap design.

**Still works if we stop here:** everything from Sprint 3 still works
exactly as before — this sprint only removes ceilings (world size,
floors, deliberately weird geometry) rather than changing anything
that already existed.

---

## Sprint 5 — Teach yourself, never lose work

**Backend**

- [ ] Structural diff endpoint between two `GameVersion`s
      (fast-json-patch / microdiff).
- [ ] Extend checkpoint restore into a full version-history endpoint
      (list + diff + restore).

**Website**

- [ ] Draggable template tiles (locked door, one-time flavor text, NPC
      hint, win room) via dnd-kit.
- [ ] Searchable docs panel (MDX content) with tooltips on action
      names.
- [ ] Guided first-time tutorial.
- [ ] Version-history UI (checkpoint list, diff view, restore button).

**Design**

- [ ] Template-tile visuals and their drag affordance.
- [ ] Docs panel and tooltip styling.
- [ ] Tutorial overlay/step-indicator visuals.
- [ ] Version-history/diff viewer design.

**Still works if we stop here:** this closes out the full authoring
depth from the spec. A new creator can now be taught the format inline
instead of guessing at syntax, lean on templates instead of blank
rooms, and never worry about losing earlier work.

---

## Sprint 6 — Other people can finally play

This is the real inflection point: everything before this sprint could,
technically, be a single-admin personal tool. This is where it becomes
an actual multi-user platform.

**Backend**

- [ ] Migration + endpoints for `PlayThrough` (start, save state, load
      state) — the first point where it's genuinely needed, since a
      stranger's progress now has to persist across visits.
- [ ] Discovery/gallery query — recency and randomness for now; gets
      upgraded to real popularity-weighting in Sprint 8 once likes
      exist to weight by.

**Website**

- [ ] Public gallery/browse page.
- [ ] Public game page, playable by anyone (no counts to show yet
      anyway, so nothing to hide).
- [ ] Player-facing automap (fog-of-war), Motion-driven reveal,
      reusing the map component but showing only visited rooms.

**Design**

- [ ] Gallery/browse page design.
- [ ] Public game page design.
- [ ] Player-facing automap look, distinct from the author-facing map.

**Still works if we stop here:** anyone can browse the gallery and play
an approved game, with a live automap filling in as they explore. The
product now has two real audiences (creators and players), not one.

---

## Sprint 7 — Someone out there is paying attention

**Backend**

- [ ] Migrations for `Like`, `Follow`, `Notification`.
- [ ] Like/unlike and follow/unfollow endpoints.
- [ ] Notification generation — individual, per-event, for now (the
      momentum-based tapering from the spec arrives in Sprint 8).

**Website**

- [ ] Like and follow buttons on the public game page.
- [ ] Notification center (individual entries only, for now).
- [ ] Creator's private stats view (their own view/like/follow
      history, including "how far players got").

**Design**

- [ ] Like/follow button states as small, satisfying micro-
      interactions, not visible counters.
- [ ] Notification center design.
- [ ] Private stats view, framed generously rather than as a raw
      analytics dashboard.

**Still works if we stop here:** the core "small creators feel special"
mechanic from the spec is live. A creator gets real, specific feedback
— not just a number — the moment someone plays, likes, or follows.

---

## Sprint 8 — The system gets smarter about attention

**Backend**

- [ ] Migrations for `Achievement`, `AchievementUnlock`.
- [ ] Recent-momentum calculation in Upstash Redis (rolling window,
      per game).
- [ ] Upgrade notification generation to taper via momentum — individual
      pings at low momentum, queued digests above threshold, milestone
      pings throughout.
- [ ] Scheduled digest job (Inngest or Trigger.dev).
- [ ] Achievement-trigger logic on like/follow/playthrough events.
- [ ] Upgrade the discovery query to genuinely popularity-weight (with
      randomness still mixed in), now that real like/view data exists.

**Website**

- [ ] Digest entries in the notification center, alongside individual
      entries.
- [ ] Achievements UI for both players and creators, with a
      Motion-driven unlock moment.

**Design**

- [ ] Digest-entry visual treatment (distinct from individual entries).
- [ ] Achievement badge design — resolve the public-vs-private display
      question from the spec before finalizing whether these appear on
      a profile.

**Still works if we stop here:** the full creator-morale system from
the spec is complete — momentum-aware notifications, achievements, and
real popularity-aware (but still subtle) discovery.

---

## Sprint 9 — Build together, remix freely

**Backend**

- [ ] `Collaborator` table (game_id, user_id, role) and authorization
      extension for shared editing.
- [ ] Fork endpoint (copy a `GameVersion` into a new `Game`, owned by
      the forker, status reset to draft).

**Website**

- [ ] Collaborator management UI (invite, remove, roles).
- [ ] "Fork this game" flow, with "forked from" attribution.

**Design**

- [ ] Collaborator management UI design.
- [ ] Fork flow and attribution treatment.

**Still works if we stop here:** multi-author editing and remixing now
exist, completing the full community feature set from the spec.

---

## Sprint 10 — Harden

No new user-facing capability in this one on purpose — it exists to
protect everything already shipped rather than add to it, which makes
it a reasonable place to pause indefinitely if needed.

**Backend**

- [ ] Paginate the admin queue endpoints.
- [ ] Extend review notes to anchor to a specific room id, and update
      the admin queue UI to point at that room on the map view.

**Website**

- [ ] Playwright coverage across every core loop: build → preview →
      submit → review → publish → discover → like/follow → fork.

**Design**

- [ ] No new design work expected — the admin queue's map-anchored
      notes reuse Sprint 3's existing screen design.

**Still works if we stop here:** same product as Sprint 9, just with
confidence it keeps working as more people actually use it.

---

## How this maps back to `build_steps.md`

Nothing here is new work — Sprints 1–3 cover the old Phase 1 (MVP),
Sprints 4–5 cover Phase 2 (Depth), and Sprints 6–9 cover Phase 3
(Publishing & Community), just re-cut so each sprint is a complete
vertical slice instead of a horizontal layer. A few items moved sprints
specifically to avoid building something before it's needed — most
notably, `PlayThrough` waits until Sprint 6, when a stranger's play
state first actually needs to persist, rather than being built in
Sprint 1 speculatively.
