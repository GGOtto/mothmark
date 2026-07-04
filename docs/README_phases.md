# Build Plan: Step-by-Step

_Every step below should be small enough to finish and check off in a
sitting. Treat this as a backlog, not a rigid script — reorder within a
phase as needed, but try not to jump ahead a phase, since later steps
generally lean on earlier ones (the canvas needs `Game`/`GameVersion`
endpoints before it has anything to save to, the automap needs
`PlayThrough` before it has anything to reveal)._

## Assumed stack (adjust freely — this just makes the steps concrete)

- **Framework**: Next.js (App Router), TypeScript throughout. Since
  backend and frontend now live in one codebase, the shared engine
  package idea gets even simpler than originally planned — it doesn't
  need to be a separately published package, just an internal module
  (e.g. `lib/engine/`) imported by both Route Handlers/Server Actions
  and client components. One codebase, one deploy.
- **"Backend" below means**: Route Handlers and/or Server Actions plus
  the data layer — not a separate service. Kept as its own section in
  this doc because it's a distinct _concern_ (data, validation,
  authorization), even though it's not a distinct _deployment_ anymore.
- **"Website" below means**: pages, layouts, and client components —
  everything a browser actually renders and interacts with.
- **Database**: PostgreSQL via Neon (serverless, scale-to-zero — see
  Packages & Tools below for why), with Drizzle ORM for schema and
  queries.
- **Auth**: Better Auth as the default pick, Auth.js as the established
  fallback. Not Lucia — it was deprecated by its own maintainer in 2025
  and shouldn't be picked up fresh from an older tutorial.
- **Hosting**: Cloudflare Workers via the `@opennextjs/cloudflare`
  adapter — see Packages & Tools for why this is worth the slightly
  less turnkey setup compared to Vercel.
- **Data fetching**: Server Components and Server Actions for most
  reads/writes; a thin client-side layer (e.g. React Query) only where
  something genuinely needs client-side caching or optimistic updates —
  the map canvas being the clearest case, since it needs to feel instant
  on every click and drag.
- **The map canvas itself**: a custom client component (SVG or Canvas),
  not a generic graph library — the elastic-reflow and compass-grid
  behavior is specific enough that fighting a general-purpose graph
  library would likely cost more than building it directly. Supporting
  libraries for specific canvas behaviors are listed below.

## Packages & tools

_Grouped by concern. None of these are mandatory — they're here because
each one removes a chunk of undifferentiated work (auth, drag-and-drop,
diffing, rate limiting) that has nothing to do with what makes this
product distinct, so there's little reason to build it by hand._

**Hosting & cost control**

- `@opennextjs/cloudflare` — the current, actively-developed way to run
  a real Next.js app (Server Actions, Route Handlers, the Node.js
  runtime, not just Edge) on Cloudflare Workers. Cloudflare's usage-based
  pricing (pay for requests and CPU time) tends to stay far cheaper than
  Vercel's function-invocation-plus-bandwidth billing once there's real
  traffic — worth the marginally less turnkey setup for a project this
  cost-conscious. Vercel remains the simpler zero-config option if
  getting to a first deploy fast matters more than long-run cost early
  on.
- **Neon** for Postgres — scale-to-zero means paying close to nothing
  while a database sits idle, and instant copy-on-write branching makes
  a full per-preview-environment database realistic without extra cost.
  **Supabase** is the alternative worth a look if the bundled auth,
  file storage, and realtime end up being worth its flatter ~$25/month
  once there's steady traffic — it trades database-layer flexibility
  for a lot of built-in surface area.
- **Cloudflare R2** for any object storage down the line (game
  exports, future images) — S3-compatible API, no egress fees, which is
  where "cheap" storage elsewhere quietly stops being cheap.
- **Cloudflare Turnstile** — a free CAPTCHA alternative for the
  sign-up flow, worth wiring in early rather than after the first spam
  wave.

**Database & validation**

- **Drizzle ORM** (+ Drizzle Kit for migrations) — a fraction of
  Prisma's bundle size with no code-generation step, which matters
  concretely on Cloudflare Workers given the free tier's 3 MB (gzipped)
  bundle-size cap. Prisma remains a fine alternative if its schema
  tooling and Prisma Studio are worth more than the smallest possible
  bundle.
- **Zod** — schema validation for Server Action inputs and for the
  `world_data`/action-argument validation logic itself; the de facto
  standard across the Next.js ecosystem, so it also pairs cleanly with
  most of the other libraries here.
- **fast-json-patch** (or `microdiff`) — computing the structural diffs
  between two `GameVersion`s for the version-history/diff viewer.

**Map canvas & interaction (Website)**

- **dnd-kit** — drag-and-drop for repositioning rooms and for dragging
  template tiles onto the grid; accessible out of the box, which a
  hand-rolled drag implementation usually isn't without real effort.
- **react-zoom-pan-pinch** — pan/zoom/minimap behavior for Phase 2's
  large-world handling, instead of building pointer-math from scratch.
- **Motion** (the library formerly named Framer Motion — same API,
  now imported from `motion/react`) — for the room shrink/grow
  transitions, the fog-of-war reveal, and the achievement/notification
  "pop" moments. This is the concrete implementation of "should feel
  exciting" from the creator-morale section, not just a nice-to-have.
- **CodeMirror 6** — an embeddable code editor for the raw DSL view,
  rather than a plain `<textarea>`; supports a custom syntax highlight
  mode for the bracket-style syntax.

**UI components & design system**

- **Tailwind CSS** + **shadcn/ui** (Radix-based, copy-in components,
  not a runtime dependency) — a fast way to turn the Phase 0 design
  tokens into real, accessible components (forms, dialogs, dropdowns)
  without hand-building each one.
- **lucide-react** — icon set that pairs with shadcn by default.

**Background jobs & scheduling**

- **Inngest** or **Trigger.dev** — for the digest-notification compile
  job and any periodic recalculation, without standing up separate
  worker infrastructure; both have usable free tiers and hook directly
  into Next.js Route Handlers. **Cloudflare Cron Triggers** is the
  alternative if everything's already consolidated on Cloudflare and
  one less vendor is worth more than either tool's nicer job-authoring
  experience.

**Rate limiting, caching & the momentum calculation**

- **Upstash Redis** — serverless, pay-per-request, with a real free
  tier. A natural fit for both API rate limiting and for the rolling
  recent-view counters that drive the notification-tier logic in the
  spec's creator-morale section — sliding-window counters are exactly
  what Redis is built for.
- **Upstash Ratelimit** — a small helper library on top of that,
  specifically for endpoint rate limiting (auth routes especially).

**Email**

- **Resend** — a modern email API with a generous free tier and good
  Next.js-specific docs, for verification, password reset, and later
  the digest-notification emails.
- **React Email** — write those templates as React components instead
  of hand-rolled HTML strings.

**Testing & reliability**

- **Vitest** — unit tests.
- **Playwright** — end-to-end tests; worth having specifically because
  the map canvas is interaction-heavy (clicks, drags, reflows) in ways
  that are hard to trust from unit tests alone.
- **Sentry** — production error monitoring with an official Next.js
  SDK; free tier is generally enough at MVP scale.

**Docs content (Phase 2)**

- Next.js's built-in **MDX** support (or `react-markdown` if something
  lighter-weight is preferred) for writing and rendering the searchable
  docs/reference panel content, rather than inventing a custom format
  for it.

**Cost-consciousness, overall**: most of the above has a free tier
that's genuinely usable at MVP scale — Neon, Upstash, Resend, Sentry,
and Cloudflare Workers itself all offer enough for free to run the
whole stack at close to $0/month until there's real traffic, at which
point cost scales roughly with usage rather than jumping to a fixed
monthly floor.

---

## Phase 0 — Foundations

### Backend

- [ ] Initialize the Next.js project (App Router, TypeScript, ESLint).
- [ ] Stand up a local Postgres instance (docker-compose for dev), plus
      a Neon project for staging/preview branches.
- [ ] Install Drizzle ORM + Drizzle Kit and connect them to the
      database.
- [ ] Add environment/config loading (.env, typed config object).
- [ ] Add a health-check Route Handler (`/api/health`).
- [ ] Set up Vitest and write one trivial passing test.
- [ ] Set up CI to run lint + tests on push.
- [ ] Add basic structured logging for server-side code.
- [ ] Add Sentry for server- and client-side error monitoring.
- [ ] Deploy the bare app to Cloudflare Workers via
      `@opennextjs/cloudflare` — one deploy, since the API and the UI
      ship together.

### Website

- [ ] Set up the base App Router structure (root layout, a placeholder
      home route).
- [ ] Set up Tailwind CSS and install shadcn/ui as the component base.
- [ ] Build a bare app shell: top bar, main content area, using the
      shadcn primitives rather than hand-rolled markup.
- [ ] Decide the concrete data-fetching split — which reads/writes go
      through Server Components/Server Actions directly, and where the
      client-side layer (React Query or similar) is actually needed.
- [ ] Wire the home route to call the health-check endpoint as a smoke
      test.
- [ ] Confirm the staging deploy serves both the UI and the API routes
      correctly.

### Design

- [ ] Settle the product's basic visual identity: name treatment,
      color palette, typeface(s).
- [ ] Turn that into a small design-token set (colors, spacing scale,
      type scale) the frontend can consume directly as variables.
- [ ] Low-fidelity wireframe of the app shell's major regions — map
      canvas area, inspector panel, top bar, nothing pixel-level yet.
- [ ] Rough out the visual language for the map itself early, since
      it's the flagship element: room-card shape, exit-line style,
      compass-arrow affordance, selected vs. unselected states.

---

## Phase 1 — MVP

### Backend

- [ ] Write migrations for `User`, `Game`, `GameVersion`,
      `PlayThrough` (per the spec's data model).
- [ ] Implement sign-up / log-in / session handling with Better Auth
      (or Auth.js — see Packages & Tools).
- [ ] Set up Resend + React Email for verification and password-reset
      emails.
- [ ] Implement `Game` CRUD: create, list-mine, get-one, rename.
- [ ] Implement `GameVersion` save (autosave draft) and named
      checkpoints (create, list, restore).
- [ ] Define Zod schemas for `world_data` and action arguments; port
      the engine's world validation (orphan rooms, bad exits, malformed
      actions) into the shared TS package using them.
- [ ] Wire `GameVersion` save to run that validation and return errors
      keyed by room id.
- [ ] Port the engine's action-execution logic (`perform_action` and
      friends) into the shared TS package.
- [ ] Implement `PlayThrough` endpoints: start, save state, load state.
- [ ] Add `Game.status` (draft/pending_review/approved/rejected) and a
      submit-for-review endpoint.
- [ ] Add admin-only endpoints: list pending games, open any game
      regardless of status, approve/reject with a `review_note`.
- [ ] Enforce the owner-or-admin visibility rule on non-approved games.
- [ ] Write the JSON ⇄ bracket-syntax serializer/parser as a shared TS
      module (compile-time only — the runtime engine never touches it).
- [ ] Add Upstash Redis + Upstash Ratelimit on auth endpoints.

### Website

- [ ] Build sign-up / log-in pages.
- [ ] Build the "My Games" dashboard (list, create new, open existing).
- [ ] Render a single room node on the map canvas — no interactivity
      yet, just proving the canvas can draw a room from `world_data`.
- [ ] Add compass-arrow hit targets around a selected room; wire one
      direction (e.g. east) end-to-end: click → API call → new room +
      exit created → canvas re-renders.
- [ ] Extend that to all eight directions plus up/down (floors come in
      Phase 2, but the exit itself can exist without a floor switcher
      yet).
- [ ] Implement the elastic-reflow layout logic client-side (shift
      neighboring rooms on conflict) and persist resulting positions.
- [ ] Add drag-to-reposition on room nodes (dnd-kit), persisting the
      new position.
- [ ] Build the room inspector panel (name, description, items, NPCs,
      on-enter actions) wired to load/save the selected room.
- [ ] Build the raw code-view toggle using CodeMirror 6 with a custom
      syntax-highlight mode for the DSL; parse edits back to JSON on
      save.
- [ ] Wire debounced autosave and a manual "save checkpoint" action.
- [ ] Build the live preview pane: load the shared engine package,
      run the current draft, render room text, accept typed commands.
- [ ] Surface validation errors from the backend as flags directly on
      the relevant map nodes.
- [ ] Add the "submit for review" button and a status indicator on the
      game dashboard.
- [ ] Build a minimal admin screen: list pending games, open one
      read-only in the player pane, approve/reject with a note.
- [ ] Seed one example world (e.g. the sealed-vault sample) as a
      forkable starting point for new accounts.

### Design

- [ ] High-fidelity design for the room-node card (name, description
      preview, compass-arrow targets), using the Phase 0 tokens.
- [ ] Design the inspector panel layout and its form fields.
- [ ] Design the code-view toggle, including a simple syntax-highlight
      theme for the DSL.
- [ ] Design the live-preview/player pane (text styling, input field) —
      should feel like a text adventure, not a generic terminal.
- [ ] Design the "My Games" dashboard, including a calm, non-judgmental
      treatment of the draft/pending/approved/rejected status states.
- [ ] Design the minimal admin review screen.
- [ ] Run an internal playtest of the full loop — create a game, build
      three rooms, preview it, submit it — before starting Phase 2, to
      catch friction while it's still cheap to fix.

---

## Phase 2 — Depth

### Backend

- [ ] Add floor-aware helpers (e.g. list distinct floors for a game)
      if the flat `Room.floor` field needs any server-side rollup.
- [ ] Extend exit data/validation to accept and tolerate an
      "intentionally inconsistent" flag rather than erroring on it.
- [ ] Implement a structural diff endpoint between two `GameVersion`s
      (fast-json-patch or microdiff).
- [ ] Extend checkpoint restore into a full version-history endpoint
      (list + diff + restore).

### Website

- [ ] Build the floor switcher and the secondary floor-overview panel.
- [ ] Add the UI affordance to mark an exit as intentionally
      inconsistent, and render it with the distinct low-key connector
      style.
- [ ] Implement the shrink-then-scroll room-sizing behavior as room
      count grows, animated with Motion rather than snapping instantly.
- [ ] Add pan, zoom, and a minimap (react-zoom-pan-pinch) once
      scrolling is active.
- [ ] Build the player-facing automap (fog-of-war), reusing the map
      component but rendering only visited rooms/exits from
      `PlayThrough.state`, with a Motion-driven reveal transition.
- [ ] Build draggable template tiles (locked door, one-time flavor
      text, NPC hint, win room) using dnd-kit, dropping a pre-filled
      snippet onto an empty adjacent cell.
- [ ] Build the searchable docs panel (MDX content), with tooltips on
      action names linked to it.
- [ ] Build a guided first-time tutorial flow.
- [ ] Build the version-history UI (checkpoint list, a diff view built
      on the fast-json-patch output, restore button).

### Design

- [ ] Design the floor-overview panel — secondary, not attention-
      grabbing.
- [ ] Design the non-Euclidean connector style (distinct, but subtle).
- [ ] Design the room-card size states (large/medium/small) and the
      transition point into scroll mode.
- [ ] Design pan/zoom controls and the minimap.
- [ ] Design the player-facing automap look, distinct from the
      author-facing map since the audience and purpose differ.
- [ ] Design the template-tile visuals and their "draggable" affordance.
- [ ] Design the docs panel and tooltip styling.
- [ ] Design the guided tutorial's overlay/step-indicator visuals.
- [ ] Design the version-history/diff viewer.

---

## Phase 3 — Publishing & Community

### Backend

- [ ] Write migrations for `Like`, `Follow`, `Notification`,
      `Achievement`, `AchievementUnlock`.
- [ ] Implement like/unlike and follow/unfollow endpoints.
- [ ] Implement the recent-momentum calculation (rolling window,
      per-game) in Upstash Redis, since sliding-window counters are
      exactly what it's built for.
- [ ] Implement notification generation: individual on low momentum,
      queued for digest above threshold, plus milestone pings.
- [ ] Implement a scheduled job (Inngest or Trigger.dev) to compile and
      send digests.
- [ ] Implement achievement-trigger logic on like/follow/playthrough
      events.
- [ ] Implement the discovery-page query: popularity-weighted with
      randomness mixed in, no raw counts exposed via the API to anyone
      but the owning creator.
- [ ] Add a `Collaborator` table (game_id, user_id, role) and extend
      authorization checks for shared editing.
- [ ] Implement a fork endpoint (copy a `GameVersion` into a new
      `Game`, owned by the forker, status reset to draft).
- [ ] Add paginated admin queue endpoints, with review notes able to
      reference a specific room id.

### Website

- [ ] Build the public gallery/browse page — no visible counts,
      popularity-influenced-but-randomized ordering.
- [ ] Build the public game page (like button, follow button, no
      counts shown anywhere).
- [ ] Build the creator's private stats view (their own view/like/
      follow history, including "how far players got" detail).
- [ ] Build the notification center (individual entries + digest
      entries, visually distinct).
- [ ] Build the achievements UI for both players and creators, with a
      Motion-driven unlock moment.
- [ ] Build the "fork this game" flow, including any "forked from"
      attribution.
- [ ] Build collaborator management (invite, remove, roles).
- [ ] Build the full admin review queue UI, with rejection notes
      anchored to a room on the map view.
- [ ] Add Playwright coverage for the core loops (build → preview →
      submit → review → publish → like/follow) now that they all exist
      end to end.

### Design

- [ ] Design the gallery/browse page (cards, filters, no numeric
      badges anywhere).
- [ ] Design like/follow button states as small satisfying micro-
      interactions rather than visible counters.
- [ ] Design the notification center, tuned for "exciting, not
      overwhelming."
- [ ] Design achievement badges — resolve the public-vs-private
      question from the spec before finalizing whether these appear on
      a profile.
- [ ] Design the private stats view with the same generous framing as
      the notifications, not a raw analytics dashboard.
- [ ] Design the fork flow and its attribution treatment.
- [ ] Design the collaborator management UI.
- [ ] Design the admin queue UI with map-anchored notes.

---

## After Phase 3

Everything above gets the product to feature-complete against the
current spec. Anything past this — real-time collaboration, the exact
tuning of momentum windows and discovery randomness, whichever open
questions from the spec doc get resolved along the way — is worth
another pass at this same level of granularity once there's a working
product to learn from, rather than planned further in the abstract now.
