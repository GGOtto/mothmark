# Mothmark product task plan

Status: active implementation backlog.

Last updated: 2026-08-11.

This replaces the old page-by-page constrained-layout audit. The plan is organized around user
tasks and product outcomes so that each checkbox can be implemented, reviewed, tested, and closed
without depending on an informal page-wide overhaul.

## How to maintain this plan

- A top-level checkbox is the source of truth. Check it only after every acceptance criterion for
  that task is complete.
- If part of a task lands, leave the task unchecked and add a dated `Progress` note describing the
  completed slice.
- Add newly discovered work to the current milestone or the earliest sensible workstream. Do not
  hide it in a completion note.
- If scope changes, update the task before implementation so the plan continues to describe the
  shipped product.
- When a task changes a persisted world, game-state, or message schema, follow
  `SCHEMA_COMPATIBILITY_README.md`, run `pnpm storage:contract`, and add a numbered migration when
  the change is breaking.
- Every engine behavior needs focused coverage and a companion `*.player.test.ts` test through
  `resolveTurn`.
- Every app-facing task must be checked at desktop and mobile sizes. Route, dialog, and multi-step
  workflow changes require focused Playwright coverage.

## Shared definition of done

Unless a task says otherwise, it is complete only when:

- loading, empty, success, error, permission-denied, and destructive-confirmation states are useful;
- keyboard navigation, focus return, screen-reader names, and reduced-motion behavior work;
- the normal desktop layout and mobile layout work without horizontal overflow;
- controls use the semantic design tokens and Mothmark's restrained archive-workbench language;
- successful empty HTTP responses are accepted and malformed or empty error responses produce a
  stable application error;
- focused tests, relevant player-path or browser tests, and `pnpm ts-check` pass; and
- the checkbox and any affected dependency notes in this document are updated.

## Product decisions used by this plan

- `/worlds` is the private author library and must support publishing without requiring a trip into
  the editor.
- `/play` is the complete public catalog. Home shows official worlds only.
- Public worlds have an explicit administrator-controlled `Official` or `Community` designation.
- Publication artwork is author-supplied or assembled from bounded author choices. Mothmark never
  infers or generates a world's art from its content.
- Item tags may drive presentation and command recommendations, but adding a tag must not silently
  change runtime behavior. Authors explicitly add suggested commands.
- “List exists” in the request is treated as `list exits`: a command that lists exits visible to the
  player. If a distinct `exists` command was intended, add it as a separate task.
- Resetting a playthrough means creating a new playthrough record. The previous record remains
  available to administrators, and the new record records what it restarted from.
- Privacy and starter JSON should not remain filler product pages. Necessary privacy information
  belongs at the relevant account action; raw starter JSON belongs in developer documentation.

## Completed foundation work

These checkboxes cover only the landed slice. Follow-up behavior is deliberately tracked in separate
remaining tasks.

- [x] **C01 — Refresh the global application shell.** The compact site header, navigation, account
      menu, notification entry point, feedback entry point, and theme control have been redesigned.
- [x] **C02 — Redesign the Home page structure.** Home now uses the full canvas, presents build and
      play paths, shows published-world content, and includes getting-started areas. Official-only
      filtering and real tutorials remain in later tasks.
- [x] **C03 — Redesign the private world library.** `/worlds` now has a pinned working header,
      responsive world folios, active/trash views, and improved create and world-action flows.
- [x] **C04 — Redesign Account and add public profiles.** `/account` now uses the broad account-ledger
      layout, exposes editable public-profile fields, and public profiles exist at
      `/users/[username]`. Avatars, social counts, subscriptions, notification preferences, and theme
      syncing remain separate tasks.
- [x] **C05 — Deliver feedback.** The feedback dialog posts to a validated, rate-limited API and
      delivers configured feedback email with stable error handling.
- [x] **C06 — Refresh the footer layout.** The footer has the compact visual treatment. Its remaining
      destinations and subscription behavior are tracked below.

## Current priority — phone play and feature demonstration

The plan is ordered around the near-term product goal: people should be able to open and play a
world comfortably on their phones, try the commands that come naturally to a new player, and see a
stable, understandable authoring experience demonstrated afterward.

The table below is the implementation order. The workstream sections later in the document contain
the full task definitions but do not imply a different sequence.

| Priority | Task | Why it is ordered here                                                                                   |
| -------- | ---- | -------------------------------------------------------------------------------------------------------- |
| 1        | R01  | The hosted player, transcript, prompt, and software-keyboard behavior are the center of phone play.      |
| 2        | G02  | New players will immediately look for Help and a way to list available exits.                            |
| 3        | G01  | Players will naturally try `forward`, `straight`, `left`, `right`, and `face`.                           |
| 4        | R02  | Guests need a reliable way to restart without corrupting or overwriting the previous playthrough.        |
| 5        | F03  | Shared responsive shells and the mobile editor frame make every page ready for phone-specific work.      |
| 6        | F02  | Mobile-safe dialogs, menus, and popups support the rest of phone play and mobile authoring.              |
| 7        | F01  | Smooth saving makes the authoring demonstration safe and keeps publication on the correct revision.      |
| 8        | F04  | Refresh and navigation must preserve the demonstrated editor view and selection.                         |
| 9        | E03  | Explicit Add room mode removes a surprising map interaction that is likely to appear during the demo.    |
| 10       | E02  | Layers should be understandable and visually finished when the Map workspace is shown.                   |
| 11       | E01  | The broader Map layout can then reclaim space and choose the correct terminal/inspector arrangement.     |
| 12       | E04  | Audit the remaining editors before polishing individual complex workflows.                               |
| 13       | E05  | Finish the Items surface, alias suggestions, and tag suggestions before adding command recommendations.  |
| 14       | Q01  | Run the complete guest phone-play audit after the item-page overhaul requested for the demonstration.    |
| 15       | G03  | Add item command templates once the dedicated item page provides their durable authoring surface.        |
| 16       | E06  | Conditions and effects need a clear chooser/editor for the authoring demonstration.                      |
| 17       | E07  | Complex AND/OR/NOT and multi-effect builders follow once ordinary conditions/effects work well.          |
| 18       | G04  | Deterministic random conditions add a strong visible feature without making playthroughs untestable.     |
| 19       | G05  | NPCs are the next major playable feature after commands, conditions, effects, and randomness are stable. |
| 20       | E09  | Logic should open directly into the working authoring subsection and preserve its context.               |
| 21       | P01  | Publication presentation/readiness provides the data needed by publishing and public discovery.          |
| 22       | P02  | World settings should make preparing and publishing the demonstrated world straightforward.              |
| 23       | P03  | Publishing from `/worlds` removes unnecessary navigation during normal authoring.                        |
| 24       | P05  | Administrator Official/Community curation must exist before discovery can depend on it.                  |
| 25       | P04  | Home and `/play` can then show correct Official and Community catalogs on phone and desktop.             |
| 26       | E08  | Editor settings should be added after the layout behaviors they configure are settled.                   |
| 27       | A06  | Anonymous and registered theme/account behavior matters on shared demo devices but is not core play.     |
| 28       | A05  | Profile images improve public identity after the player and publication surfaces are stable.             |
| 29       | A01  | Likes and follows build on finished public publication cards and profiles.                               |
| 30       | A02  | Real notifications depend on likes/follows and Official publication events.                              |
| 31       | A03  | Notification email and the shared Mothmark email template follow durable in-app notifications.           |
| 32       | A04  | Mailing-list subscription is separate from transactional notifications and can follow them.              |
| 33       | A07  | Account-entry layouts finish after their theme, email, and subscription behavior is known.               |
| 34       | T01  | The template domain depends on stable editors, tag commands, likes, and publication conventions.         |
| 35       | T02  | Template creation/application follows the versioned template domain.                                     |
| 36       | T03  | Template discovery and profile presence follow creation, application, and likes.                         |
| 37       | T04  | Issues can then validate real template provenance as well as the rest of the world.                      |
| 38       | R03  | The shared administrator shell/list pattern follows the user-facing demo work.                           |
| 39       | R04  | Administrator user detail builds on the shell, notifications, and playthrough lineage.                   |
| 40       | R05  | Administrator world detail builds on the shell, publication records, and playthrough lineage.            |
| 41       | R06  | Audit becomes useful after the product actions it must investigate exist.                                |
| 42       | R07  | Maintained tutorials/videos should document the settled player and authoring workflows.                  |
| 43       | R08  | Footer destinations and obsolete routes finish after subscription and tutorials have real targets.       |
| 44       | Q02  | The final release/compatibility gate runs after all retained-data and production behavior is settled.    |

---

## Workstream — Reliability and responsive foundations

- [ ] **F01 — Make world saving immediate, quiet, and recoverable.**

  **Outcome:** Authors can edit continuously without thinking about saving, losing work, or choosing
  between a stale local draft and the server copy.

  **Scope and acceptance:**

  - Save edits after a short debounce, serialize overlapping saves, and never let an older response
    replace a newer local revision.
  - Show a restrained `Saving`, `Saved`, or actionable `Save failed` state without success toasts.
  - Keep local recovery drafts until the matching server revision is confirmed. Clear only the
    confirmed draft, not newer unsaved input.
  - On reload, reconnect the author to the same world and editor view, then reconcile local and
    server revisions without silent data loss.
  - Handle offline edits, expired sessions, revision conflicts, closing the tab during a save, and
    malformed/empty error responses.
  - Block publish only while the exact revision being published is not server-confirmed. Explain the
    reason and complete publication automatically only if the author already confirmed that intent.
  - Add repository tests for save ordering and recovery plus a browser workflow covering edit,
    reload, transient failure, recovery, and publish-after-save.

- [ ] **F02 — Create one mobile-safe overlay system.**

  **Outcome:** Dialogs, popovers, menus, pickers, condition/effect editors, and confirmation layers
  are usable on phones instead of being clipped desktop floating panels.

  **Scope and acceptance:**

  - Provide shared dialog, anchored-popover, and mobile-sheet primitives with focus trapping, focus
    return, Escape/backdrop close rules, safe-area padding, and background scroll lock.
  - Flip or constrain anchored layers to the visible viewport. At phone widths, promote complex
    popovers to a bottom sheet or full-screen task surface.
  - Keep primary actions reachable when the keyboard is open and allow long content to scroll inside
    the layer.
  - Migrate all production overlays, including hosted-player controls, world creation/actions, header
    menus, feedback, account actions, entity pickers, command variables, administrator confirmations,
    notifications, profile images, templates, and condition/effect editors.
  - Verify at 320px, 390px, and a short landscape viewport with keyboard-only and touch workflows.

- [x] **F03 — Establish responsive page and workspace shells.**

  **Outcome:** New page work shares predictable pinned headers, scrolling bodies, and mobile
  navigation rather than fixing overflow independently on every route.

  **Scope and acceptance:**

  - Add reusable shells for catalogs, settings documents, dense admin tables, and full-height editor
    workspaces.
  - Keep page title, search, filters, and primary actions outside a growing content body's scroller.
  - Define phone behavior for the global header, editor activity rail, property inspector, terminal,
    and split panes. No essential action may depend on hover.
  - Preserve the activity-rail geometry and label reveal on desktop. On phones, move the editor
    destinations into a compact top navigator that identifies the current destination and exposes
    every destination without hover or horizontal clipping.
  - Give Editor and Play one shared utility region. On desktop it occupies the right side of the
    workspace; on phones it becomes a bottom region with an explicit Editor/Play toggle. Switching
    views preserves the current selection, form state, transcript, and command input.
  - Keep the primary editor workspace visible above the mobile utility region, respect safe areas and
    software keyboards, and never squeeze the desktop activity rail, workspace, inspector, and
    terminal into simultaneous phone-width columns.
  - Add representative browser harness coverage so regressions in sticky regions, safe areas, and
    horizontal overflow fail in one place.

- [ ] **F04 — Preserve editor context across reloads and navigation.**

  **Outcome:** Refreshing the editor does not unexpectedly switch the author back to Map or lose the
  selected entity/task.

  **Scope and acceptance:**

  - Put the current editor view and stable entity selection in the canonical editor URL where
    practical; use owner-scoped persisted view state only for reversible presentation preferences.
  - Refresh, back/forward, and copied URLs restore the same view. Deleted or inaccessible selections
    fall back predictably with an explanation.
  - Swap the world-title dropdown and `Create` dropdown in the editor toolbar while preserving
    accessible reading and tab order.
  - Scroll the inspector to the top only when navigating to another entity or editor view; ordinary
    field edits preserve its position.
  - Add browser coverage for deep links, reload, back/forward, dropdown order, and invalid selection
    recovery.

---

## Workstream — Publishing and public discovery

- [ ] **P01 — Add author-controlled publication presentation.**

  **Outcome:** Authors can decorate the public world card without exposing private map details or
  relying on generated imagery.

  **Depends on:** F01.

  **Scope and acceptance:**

  - Define schema-backed catalog fields for short description, descriptive tags, approximate play
    length, and a bounded cover treatment.
  - Offer deliberate treatments such as a color/pattern combination, maintained frame, and optional
    uploaded cover. Do not infer artwork from title, map, rooms, or prose.
  - Provide live card previews at desktop and mobile sizes with alt text and contrast validation.
  - Store presentation with the publication/release contract so an immutable release remains
    reproducible and older playthrough identity does not change unexpectedly.
  - Surface missing required fields as publication-readiness issues; do not substitute filler like
    `This is a world.`
  - Apply the persisted-schema compatibility process if any world-owned schema is changed.

- [ ] **P02 — Overhaul World settings around preparing and publishing a world.**

  **Outcome:** World settings is a broad, understandable authoring document and publishing is the
  obvious primary task.

  **Depends on:** F01, P01.

  **Scope and acceptance:**

  - Use a pinned local header with world title, save state, publication state, and the most relevant
    publish/update action.
  - Organize continuous sections for Identity, Starting experience, Publication, World data, and
    Danger zone; avoid a narrow centered card or dashboard grid.
  - Publication shows readiness, selected release, public URL, unpublished changes, and explicit
    publish, update, unpublish, and republish actions.
  - Ineligible accounts see the precise requirement and shortest next action.
  - Identity includes real metadata; Starting experience includes starting room, death message,
    initial flags/counters, and player-facing validation. Layers stay in Map.
  - Import/export operations have explicit consequences. Reset is last, confirmed, and may restore
    the maintained starter world.
  - Keep the player terminal independently collapsible so authors can verify starting-state changes.

- [ ] **P03 — Publish directly from the private world library.**

  **Outcome:** An author can publish or update a world from `/worlds` without opening the editor.

  **Depends on:** F01, F02, P01.

  **Scope and acceptance:**

  - Add `Publish`, `Publish update`, `View published world`, and `Manage publication` actions to the
    appropriate world card/menu states.
  - Open a mobile-safe publishing task that shows readiness issues, presentation preview, the exact
    saved revision, and the result of the action.
  - Do not publish an unconfirmed local draft or ambiguous revision. Link to the exact editor field
    when a readiness issue needs authoring work.
  - Refresh the card in place after publishing and show release/status/unpublished-change state
    without reloading the library.
  - Cover first publish, update, suspended publication, anonymous/ineligible account, stale revision,
    failure, and retry in browser tests.

- [ ] **P04 — Separate official and community discovery, and make Home official-only.**

  **Outcome:** Home is a curated entry point while `/play` remains the complete playable catalog.

  **Depends on:** P01, P05.

  **Scope and acceptance:**

  - Add explicit query/API support for `Official` and `Community`; never infer official status from
    likes, recency, ownership, or display order.
  - Home's featured publications request and empty state use official worlds only.
  - `/play` shows Official first with restrained emphasis and Community beneath it. Both use real
    publication cards and immediate Play/Continue/Play again actions.
  - Use a compact search control that searches both groups, keeps context visible, and closes with
    Escape or outside interaction.
  - Cards show author-linked username, summary, presentation, tags, play length when known, release
    date, and like state/count once A01 lands.
  - Do not expose private map-layer previews. Make loading, no-official-worlds, no-community-worlds,
    no-results, and failed-load states distinct.

- [ ] **P05 — Add administrator publication curation.**

  **Outcome:** Administrators can deliberately promote a published world to Official and audit the
  decision.

  **Depends on:** P01.

  **Scope and acceptance:**

  - Add Official/Community state to publication list and detail APIs and views.
  - Search by publication title, slug, owner, and release; filter by visibility and editorial state.
  - Promotion and demotion require confirmation and an administrative reason, and create linked
    audit events.
  - Keep visibility, lifecycle, and editorial status as separate concepts and controls.
  - Publication detail shows author-supplied catalog fields, readiness issues, source world,
    immutable release, public player, and relevant audit history.
  - Use the shared full-workspace admin table/detail patterns described in R03.

---

## Workstream — Accounts, social features, notifications, and email

- [ ] **A01 — Add likes and follows with public profile counts.**

  **Outcome:** Players can like worlds and follow authors, and profiles accurately reflect both.

  **Depends on:** P04.

  **Scope and acceptance:**

  - Model unique user-to-publication likes and user-to-user follows with idempotent create/remove
    operations and database-enforced uniqueness.
  - Prevent self-following. Define whether authors may like their own world and enforce the decision
    consistently; default to disallowing it.
  - Add Like/Unlike to public cards and player identity, and Follow/Unfollow to public profiles.
  - Show follower, following, and received-like counts on profiles; provide paginated lists with
    privacy-safe empty states.
  - Reconcile optimistic UI with API failure and repeated taps. Counts must not drift.
  - Include abuse-rate limits and authorization tests without exposing private account identifiers.

- [ ] **A02 — Build the in-app notification system around initial real events.**

  **Outcome:** The header notification entry shows durable, actionable notifications rather than a
  placeholder.

  **Depends on:** A01, P05.

  **Scope and acceptance:**

  - Create notifications when an administrator first makes a listed release Official, someone
    follows the current user, or someone likes the current user's world. Fan out the official-world
    event to active accounts through bounded background work; do not create another announcement for
    an ordinary release update unless that policy is added deliberately.
  - Make event creation idempotent and aggregate bursts where useful without losing the initiating
    actor or target.
  - Provide unread count, chronological list, mark-one/read-all behavior, pagination, and direct
    navigation to the official world, follower profile, or liked world.
  - Never notify users about their own actions. Deleted/private targets degrade to a neutral record
    without leaking data.
  - Make the notification popover mobile-safe through F02 and provide a full-page fallback if the
    list outgrows a popover.

- [ ] **A03 — Add opt-in email notifications and the official Mothmark email template.**

  **Outcome:** Registered users may receive accessible, consistent email versions of in-app
  notifications; delivery is disabled by default.

  **Depends on:** A02.

  **Scope and acceptance:**

  - Add one disabled-by-default master preference plus per-event preferences for official-world,
    follow, and like notifications.
  - Anonymous accounts cannot enable email delivery until they register an email.
  - Create a shared Mothmark transactional email template with logo/wordmark treatment, readable
    plain-text fallback, semantic colors, a single primary action, reason-for-email copy, and required
    unsubscribe/settings links.
  - Use the template for notification emails and migrate existing verification, recovery, and
    feedback mail where appropriate without changing their security semantics.
  - Queue/retry delivery outside the request path, deduplicate by notification, and record delivery
    state without blocking creation of the in-app notification.
  - Keep provider credentials in the matching Phase environment, including Development.

- [ ] **A04 — Make mailing-list subscription real.**

  **Outcome:** People can deliberately subscribe during registration or later in settings, and the
  footer subscription control works.

  **Scope and acceptance:**

  - Define subscription consent separately from transactional notification preferences.
  - Add an unchecked subscription choice during account creation and an editable account setting.
  - Make the footer form work for signed-out visitors without silently creating an account.
  - Use confirmation/double opt-in if required by the chosen provider and persist consent source and
    timestamp.
  - Support unsubscribe from email and settings, idempotent resubscribe, provider failure, and email
    changes without duplicate contacts.
  - Link to accurate privacy/consent information at the point of signup.

- [ ] **A05 — Add profile-picture upload and lifecycle management.**

  **Outcome:** Registered authors can upload, crop, replace, and remove a profile image that appears
  consistently with their public identity.

  **Scope and acceptance:**

  - Accept a bounded set of image formats and dimensions, validate actual content, strip metadata,
    resize server-side, and reject unsafe or oversized files.
  - Provide crop/preview, deterministic initials fallback, remove/replace, upload progress, and stable
    error states.
  - Store only the asset reference on the profile and clean up superseded unreferenced assets safely.
  - Render the image on profiles, publication cards, follow lists, notifications, and relevant admin
    records with meaningful or empty alt text as appropriate.
  - Do not create image requirements for worlds or items as a side effect of this task.

- [ ] **A06 — Persist theme preferences for registered and anonymous accounts.**

  **Outcome:** Light/dark theme follows a person across refreshes and, for registered users, across
  devices; anonymous users retain control without being pushed into registration.

  **Progress (2026-08-11):** The shell already exposes light/dark control and persists it locally for
  anonymous and signed-in sessions. Account-backed syncing, reconciliation, and anonymous Account
  behavior remain.

  **Scope and acceptance:**

  - Keep the shell theme toggle available before authentication and during anonymous use.
  - Apply the local preference before hydration to prevent a theme flash.
  - Save registered preference to the account and reconcile it predictably with a pre-login local
    preference; account preference wins after sign-in unless the user explicitly changes it.
  - Save anonymous preference with the anonymous account/browser state and preserve it through the
    account-upgrade flow.
  - Allow anonymous users to reach limited Account settings through the account menu/direct URL, but
    do not promote that route in primary navigation.
  - For anonymous accounts, label destructive account deletion as `Reset this account`, explain that
    worlds and identity in this browser will be lost, and require confirmation.

- [ ] **A07 — Finish account-entry and administrator sign-in layouts.**

  **Outcome:** Sign in, registration, recovery, reset, verification, and administrator sign-in are
  focused mobile-friendly tasks rather than generic centered cards.

  **Scope and acceptance:**

  - Reuse a compact account-entry bar with Mothmark home link, theme control, and only the most
    relevant alternate action.
  - Keep forms narrow for readability but place them directly on the canvas without a decorative
    card, repeated eyebrow, full application navigation, or redundant return links.
  - Treat valid, invalid/expired, loading, and successful reset/verification states as separate tasks
    with one correct next action.
  - Keep administrator password and second-factor steps in the same position and visual system,
    without registration or recovery paths.
  - Include the A04 subscription choice on registration only after subscription infrastructure is
    available.

---

## Workstream — Editor shell, map, and authoring layouts

- [ ] **E01 — Overhaul the Map workspace and reclaim map space.**

  **Outcome:** Mapping is the editor's clearest spatial task on desktop and mobile, with testing
  available without permanently consuming vertical map space.

  **Depends on:** F02–F04.

  **Scope and acceptance:**

  - Build on F03's shared right-side Editor/Play region and mobile bottom switcher; do not introduce a
    separate Map-only terminal arrangement.
  - Allow the map workspace and shared utility region to collapse or resize with accessible controls
    and persisted reversible sizes.
  - Keep the authored map on the light map palette in both application themes. Floating controls use
    application surface tokens.
  - Retain pan/zoom, selection, connection editing, layer switching, keyboard access, and reduced
    motion. Avoid a second map navigation system or page-level cards.
  - Validate the design with realistic dense maps and long terminal output, not only the starter
    world.

- [ ] **E02 — Restyle and clarify the Layers workspace on Map.**

  **Outcome:** Authors can understand, select, reorder, add, rename, and remove layers without the
  layer UI feeling like an unfinished utility panel.

  **Depends on:** F02, F04. It does not require the broader E01 layout experiment.

  **Scope and acceptance:**

  - Use clear layer identity, selected state, room count, starting-layer cue, visibility if supported,
    and scoped actions.
  - Keep add/rename/reorder/delete operations discoverable without repeating colored rails or turning
    every layer into a card.
  - Confirm destructive deletion consequences for rooms/connections and move focus to a sensible
    surviving layer.
  - Keep layer controls usable at the 310px inspector minimum and as a mobile sheet/full task.
  - Preserve authored layer geometry and the existing layer preview behavior used by world folios.

- [ ] **E03 — Make room placement an explicit two-step action.**

  **Outcome:** A normal map click selects or pans; it never unexpectedly creates a room.

  **Depends on:** F04. It should land against the current map interaction before E01 changes layout.

  **Scope and acceptance:**

  - Clicking `Add room` enters a clearly announced placement mode; the next valid map click places
    one room and exits the mode.
  - Escape, switching view/layer, or pressing Cancel exits without mutation. Touch users receive the
    same explicit mode and clear cancel action.
  - Show a placement preview and reject invalid coordinates without leaving a partial room.
  - The first room in a blank world becomes its starting room. Subsequent rooms do not change the
    start automatically.
  - Add focused map tests and a browser workflow proving ordinary clicks do not add rooms.

- [ ] **E04 — Audit every entity editor as a complete authoring task.**

  **Outcome:** Room, connection, item, event, command, condition, effect, world, and future NPC
  editors use space, grouping, and actions that make sense for their schema and author workflow.

  **Depends on:** F03, F04.

  **Scope and acceptance:**

  - Inventory every field, action, selector, popup, scroll owner, and dependency; remove stale or
    duplicate controls rather than merely restyling them.
  - Derive controls from schema structure/metadata. Do not create editor-only type catalogs.
  - Group fields by author intent (identity, player-facing text, behavior, placement, logic) with
    continuous sections and restrained separators, not grids of equal cards.
  - Keep save state and primary task controls pinned; keep only the content body scrolling.
  - Show reference impact before destructive changes to shared entities or command blocks.
  - Verify all inspectors at 447px and 310px and all dedicated editors on phone widths.
  - Produce a short checked inventory in this task's Progress note so no editor is implicitly skipped.

- [ ] **E05 — Finish the two-surface Items workflow and working suggestions.**

  **Outcome:** Authors first choose an item from a full-workspace collection, then edit it in a
  dedicated full-workspace item page; aliases and tags are genuinely helpful.

  **Depends on:** E04.

  **Scope and acceptance:**

  - Keep the selector content-led, with horizontal visible names, keyboard navigation, search, Add
    item, compact starting-location context, and the maintained category SVG marks in the appendix.
  - Do not show the map, use an RPG inventory grid, infer item art, or make the right inspector the
    primary editor.
  - The item page uses the whole workspace and groups player-facing text, behavior, commands,
    placement, containment, important tags, and identity.
  - Alias suggestions use the actual item name and existing aliases, are deterministic, avoid
    collisions, and require author acceptance.
  - Tag suggestions come from the supported taxonomy and real schema capabilities, explain what each
    suggestion enables, and require author acceptance.
  - Provide a dedicated Commands section that preserves existing attached commands and can later
    host G03 recommendations; do not add placeholder templates before G03.
  - Handle unplaced items, nested items, similar names, large collections, and no-icon fallback.

- [ ] **E06 — Rebuild condition and effect selection/editing.**

  **Outcome:** Conditions and effects are pleasant, comprehensible authoring tools rather than dense
  or fragile popups.

  **Depends on:** F02, E04.

  **Scope and acceptance:**

  - Organize the chooser by affected domain first: Item, Room, Player, World state, Time/randomness,
    Navigation, and Messaging. `Take` is an Item operation, not a top-level category.
  - Generate available types, operations, fields, labels, descriptions, and defaults from schemas and
    metadata.
  - Support search by author language and schema term, recent choices, keyboard navigation, and a
    concise preview of what will be created.
  - Open editors directly from workspace buttons. On mobile, use a full-screen task with pinned
    Cancel/Save; on desktop, use a properly constrained dialog or side task.
  - Show referenced entities by name while preserving typed IDs internally and target privacy.
  - Show where reusable conditions/effects are used and warn before an edit or delete affects several
    commands/events.

- [ ] **E07 — Make complex condition/effect builders fully functional.**

  **Outcome:** Authors can build nested AND/OR/NOT logic and multi-step effects without corrupting or
  losing branches.

  **Depends on:** E06.

  **Scope and acceptance:**

  - Support add, remove, reorder, duplicate, nest, and change operator for every schema-valid complex
    structure.
  - Keep stable block identity and focus through structural edits; do not use array position as the
    user-visible identity.
  - Validate incomplete branches inline, preserve authored valid siblings, and prevent saving an
    invalid tree while still allowing Cancel.
  - Provide readable summaries and a test/preview surface showing evaluation or effect order against
    a controlled game state.
  - Confirm shared impact where the same reusable object is referenced in multiple places.
  - Add unit coverage for tree operations and player-path coverage for representative nested logic.

- [ ] **E08 — Add real Editor settings.**

  **Outcome:** The Editor settings destination contains a coherent set of workspace preferences, or
  remains hidden until the full task lands.

  **Depends on:** E01, E04.

  **Scope and acceptance:**

  - Include only meaningful preferences such as default editor landing view, terminal position/size,
    map interaction preferences, reduced motion override if appropriate, and confirmation behavior.
  - Persist reversible workspace preferences per account (and locally for anonymous accounts) while
    keeping world-authored data in the world.
  - Provide Reset workspace layout with a preview of what resets; do not mix it with world reset.
  - Do not duplicate global theme controls or add settings for unimplemented behavior.

- [ ] **E09 — Streamline Logic navigation and preserve its working editor patterns.**

  **Outcome:** Entering Logic leads directly to authoring and does not switch through a launcher or
  duplicate collection controls.

  **Depends on:** F04, E06.

  **Scope and acceptance:**

  - Remove the centered Logic overview card launcher. Enter the last-used working subsection, with
    Events as the first-use default.
  - Use one compact pinned subsection switcher. Show Events and Commands now; expose Conditions and
    Effects only when E06 is complete.
  - Keep subsection identity, search, and creation actions outside the scrolling collection/tree.
  - Preserve Events' rail-and-tree layout and sticky branch toolbar.
  - Preserve command selection in the command library and keep behavior/pattern controls pinned above
    the pattern workspace; do not add a second command scroller inside the editor.
  - Preserve repeated command block identity and the existing shared-edit/scope rules across patterns.
  - Restore the same Logic subsection and selected entity across refresh/back/forward through F04.

---

## Workstream — Commands, engine behavior, and NPCs

- [x] **G01 — Add player-relative directions and facing state.**

  **Outcome:** Players may use `forward`, `back`, `left`, and `right` relative to the direction they
  last faced while cardinal/ordinal short commands remain canonical.

  **Scope and acceptance:**

  - Add typed game-state facing with a neutral backward-compatible default of north.
  - Add `face`/`turn <direction>` with the Travel command's optional `to`/`to the` pattern shapes;
    facing does not move the player and accepts absolute or relative compass directions.
  - Resolve `forwards`/`forward`/`straight`/`ahead`, `backwards`/`backward`/`back`, `left`, and
    `right` from current facing inside the generic direction block. Define diagonal rotation
    explicitly and test every supported facing.
  - Let authors disable relative matching on a direction block. Absolute-only blocks outrank otherwise
    equivalent relative-enabled blocks during command selection.
  - Successful compass movement updates facing to that direction. Failed or unresolved movement and
    `look` do not silently change it; `up`, `down`, `in`, and `out` preserve horizontal facing.
  - Preserve `n`, `s`, `e`, `w`, and other existing canonical direction aliases and saved commands.
  - If game-state persistence changes, complete the storage contract/migration work and replay legacy
    playthroughs.

- [x] **G02 — Add `list exits` and discoverable `help`.**

  **Outcome:** Players can ask what exits and commands are currently useful without revealing hidden
  content.

  **Scope and acceptance:**

  - `list exits` reports only exits currently visible/eligible to the player and uses the same target
    privacy boundary as movement.
  - `help` lists built-in commands plus authored commands whose new `showInHelp` toggle is enabled.
    The toggle defaults off for backward compatibility.
  - Help uses player-facing command patterns/descriptions, groups long output readably, and does not
    expose internal IDs, hidden variants, secret targets, or commands whose eligibility would reveal
    world contents.
  - Add the toggle to the command editor and initial-command document/schema loading path.
  - Cover no exits, hidden/conditional exits, ambiguous direction aliases, no opted-in commands, and
    mobile terminal wrapping through `resolveTurn` and hosted-player tests.

- [ ] **G03 — Make the item tag taxonomy useful through command templates.**

  **Outcome:** Every maintained item category has an understandable presentation effect and a useful
  set of optional built-in command templates; no supported tag is inert or magical.

  **Depends on:** G02, E05. Add the attachment/recommendation control to the dedicated item page
  delivered by E05.

  **Scope and acceptance:**

  - Keep category matching deterministic according to the appendix and use it for the maintained SVG
    mark and command-template recommendations.
  - Create complete saved-command documents from reusable conditions/effects for appropriate actions,
    including examples such as `eat <food>`, `drink <drink>`, `read <document>`, `wear <wearable>`,
    `play <music>`, `light <light>`, `open <container/door>`, `unlock <lockable>`, and `use <item>`.
  - Define a reviewed recommendation matrix for every category. A category may recommend a general
    command such as Examine when a more specific action would invent behavior.
  - Tags recommend; authors preview and explicitly attach. Removing a tag does not silently delete a
    customized command.
  - Show attached, available, unavailable, and customized states in the item editor and link to the
    command editor.
  - Load every built-in command from a complete JSON document through `initialCommands.ts`; add any
    missing reusable condition/effect with focused and player-path tests first.

- [ ] **G04 — Add deterministic random conditions.**

  **Outcome:** Authors can express chance-based branches without ad hoc runtime code, unstable
  repeated evaluation, or untestable playthroughs.

  **Depends on:** E06, E07.

  **Scope and acceptance:**

  - Add a schema-driven Random condition supporting a clear percentage/chance input and, only if a
    real author need exists, weighted integer ranges.
  - Validate bounds and show the probability in plain language. Avoid ambiguous inclusive/exclusive
    range wording.
  - Draw randomness from the game/turn random source rather than `Math.random` in the condition.
    Preserve enough seeded/state information for deterministic tests and replay validation.
  - Evaluate one condition occurrence consistently within a resolution pass so UI summaries,
    eligibility checks, and execution cannot reroll the same decision unexpectedly.
  - Define short-circuit behavior inside AND/OR/NOT trees and ensure hidden target eligibility is not
    revealed through repeated probability probing.
  - Add the condition through schema metadata so it appears under Time/randomness in E06, with
    focused boundary tests and player-path coverage for both outcomes.

- [ ] **G05 — Add a runtime-backed NPC model and authoring workflow.**

  **Outcome:** NPCs are real world entities players can perceive and interact with, not a renamed
  Story placeholder.

  **Depends on:** E04, E06, G02.

  **Scope and acceptance:**

  - First define the smallest coherent schema: typed NPC ID, name/aliases, description, starting
    location, visibility, state, dialogue/interaction hooks, and referenced commands/conditions.
  - Define movement and inventory ownership only if included in the first playable slice; do not add
    speculative systems to make the schema look complete.
  - Add a full-workspace NPC selector and dedicated editor derived from the schema, with placement,
    player-facing text, behavior, commands, and identity.
  - Add target resolution that treats absent, hidden, inaccessible, and ineligible NPCs as the same
    unresolved result.
  - Provide at least Examine and Talk interaction through saved commands/conditions/effects and cover
    the complete player path through `resolveTurn`.
  - Complete persisted-schema compatibility, export/import, issue validation, and admin inspection
    work before exposing NPCs in production navigation.

---

## Workstream — Templates and world issues

- [ ] **T01 — Create the reusable template domain.**

  **Outcome:** Items, rooms, and commands can be saved as versioned personal, community, or official
  templates with clear ownership and attribution.

  **Depends on:** A01, E04, G03.

  **Scope and acceptance:**

  - Define template kind, owner, visibility, official status, version, source schema version,
    author-supplied title/summary/tags/presentation, field placeholders, and immutable published
    snapshot.
  - Keep template IDs typed and distinct from the IDs of entities created from them.
  - Define what references are embedded, parameterized, or rejected so applying a template never
    creates dangling IDs or copies private world content accidentally.
  - Support draft, publish/update, unpublish, duplicate/fork, and delete lifecycles with attribution.
  - Reuse likes for published templates while keeping world likes and template likes distinguishable.
  - Add official promotion/demotion with admin reason and audit events.

- [ ] **T02 — Build template creation and application into editors.**

  **Outcome:** An author can save a useful item, room, or command as a template and apply one without
  leaving the relevant authoring task.

  **Depends on:** T01.

  **Scope and acceptance:**

  - Add `Save as template` with field selection, placeholders/defaults, dependency preview,
    attribution, presentation preview, and publication readiness.
  - Add `Start from template` to new item, room, and command flows with Official, Community, and Mine
    filters, search, preview, like count, and author identity.
  - Applying creates fresh typed IDs, resolves references deliberately, records source template and
    version, and leaves the resulting entity fully editable and independent.
  - Make unchanged placeholder/default fields detectable by T04 without treating every intentional
    default as an error.
  - Cover schema-version incompatibility, missing dependency, duplicate application, and partial
    customization without data loss.

- [ ] **T03 — Add template discovery and profile presence.**

  **Outcome:** Official and community templates are browseable, and an author's public profile shows
  their published templates and received likes.

  **Depends on:** T01, T02.

  **Scope and acceptance:**

  - Provide browse/search/filter by kind, tag, Official/Community/Mine, author, and compatible schema
    version.
  - Show real author-supplied metadata, version, usage guidance, attribution, like state/count, and a
    direct `Use template` action.
  - Add a Templates section to profiles without exposing private drafts or private source worlds.
  - Give administrators functional curation and inspection views using the shared admin patterns.
  - Avoid popularity rankings presented as quality and avoid decorative marketplace filler.

- [ ] **T04 — Make Issues a live repair queue, including template warnings.**

  **Outcome:** Authors can find and fix real world problems, including fields left unchanged from a
  template.

  **Depends on:** E04, T02.

  **Scope and acceptance:**

  - Replace the placeholder with a full-workspace queue using a pinned header, current error/warning
    counts, severity and entity filters, and a scrolling results body.
  - Aggregate schema validation, dangling/ineligible references, unreachable starting experience,
    invalid command/effect/condition logic, publication readiness, and template unchanged-field
    warnings.
  - Every issue includes severity, plain-language problem, affected entity/field, why it matters, and
    a direct Fix action that opens and focuses the correct editor control.
  - Track template source/version and field provenance narrowly enough to distinguish “unchanged
    placeholder” from “same value entered intentionally”; allow an explicit `Keep this value` action.
  - Validation runs incrementally after edits and can perform a full refresh. Show when the last full
    validation completed.
  - The clean state is factual. Do not use health scores, celebratory filler, or equal-sized issue
    cards.

---

## Workstream — Player, administration, learning, and remaining routes

- [x] **R01 — Make the hosted play page and command line mobile-first.**

  **Outcome:** A player can comfortably read, type, submit, recall, and restart commands on a phone.

  **Dependency note:** Do not wait for F02 or the broader cross-product shell work in F03. Any
  player-specific About/restart sheet needed here should later become an F02 consumer.

  **Scope and acceptance:**

  - Keep the compact world header outside terminal scrolling and keep output as one uninterrupted
    monospace flow.
  - Pin or reliably reveal the prompt above the software keyboard, respect safe areas, and prevent
    browser zoom/viewport jumps during input.
  - Preserve command history, focus, selection, long-word wrapping, live-region behavior, and scroll
    position while new output arrives.
  - Put About, restart, and return-to-catalog actions in a mobile-safe menu/sheet without turning the
    terminal into chat bubbles or cards.
  - Test short/tall phones, landscape, long transcripts, long commands, errors, connection changes,
    and screen-reader command submission.

- [x] **R02 — Make player reset create a new playthrough and expose lineage to administrators.**

  **Outcome:** Restart is understandable to players and auditable from the administrator's point of
  view without rewriting prior history.

  **Depends on:** R01.

  **Scope and acceptance:**

  - Restart closes/abandons the current playthrough and creates a new playthrough from the selected
    current published release and initial state.
  - Record `restartedFromPlaythroughId`, initiating user, reason/source, release transition, and
    timestamp; never mutate the prior transcript into the new run.
  - Player confirmation explains loss of current progress and whether a newer release will be used.
  - Administrator user/world detail shows playthrough state, release, last activity, and restart
    lineage with links to both records and transcripts.
  - Cover restart after unpublish/suspension, newer release, already-finished run, anonymous player,
    repeated request, and failed creation atomically.

- [ ] **R03 — Establish the administrator shell and oversight-list pattern.**

  **Outcome:** Administrator sign-in and list pages are compact, searchable operational workspaces
  instead of constrained cards.

  **Depends on:** F03, A07. Publication-specific controls remain in P05.

  **Scope and acceptance:**

  - Make administrator sign-in reuse A07's compact account-entry shell while preserving the
    provisioned-password and second-factor flow.
  - Keep administrator navigation and local list headers pinned.
  - Give Users, Worlds, and Publications nearly the full available width with sticky headings,
    independently scrolling results, deterministic pagination, and narrow-screen detail rows.
  - Persist search and filters in the URL. Keep readable identity columns visible when horizontal
    scrolling is unavoidable.
  - Users searches email/username and anonymous identifier. Worlds searches title/slug/owner and
    filters lifecycle. Publications uses P05's search and editorial filters.
  - Use restrained semantic status cues rather than pills, cards, decorative animation, or map
    previews in operational tables.

- [ ] **R04 — Rebuild administrator user detail.**

  **Outcome:** An administrator can understand and act on a user record without scanning a long stack
  of repeated cards.

  **Depends on:** R02, R03.

  **Scope and acceptance:**

  - Keep a pinned identity header with back navigation, readable identity, status, and internal ID.
  - Provide anchored Overview, Controls, Worlds, Sessions, Permissions, Notifications, and
    Playthroughs sections.
  - Present account/security metadata as a broad ledger and worlds/sessions/playthroughs as compact
    linked tables.
  - Present permissions as a searchable Effective result/Source/Override comparison table.
  - Keep ordinary limits, suspension with required reason, session revocation, and destructive
    account actions visually and transactionally separate.
  - Show the playthrough restart lineage from R02 and notification/email preference/delivery context
    without granting a hidden impersonation path.

- [ ] **R05 — Rebuild administrator world detail.**

  **Outcome:** An administrator can inspect and manage a world through its real structure before
  resorting to raw JSON.

  **Depends on:** R02, R03.

  **Scope and acceptance:**

  - Keep a pinned identity header with title, lifecycle, owner, revision, private slug, and anchored
    Overview, Controls, Map, Playthroughs, and Document sections.
  - Lead inspection with a read-only version of the real layered map, including layer switching and
    authored geometry but no mutation tools.
  - Put raw JSON in Document with search, copy, download, wrapping, syntax highlighting, and schema
    version; never parse retained JSON directly through only the current world schema.
  - Separate archive, transfer, and permanent deletion by risk and request an administrative reason
    beside the exact sensitive action.
  - Replace transfer UUID input with account search and show the target account's current world count
    and limit before confirmation.
  - Link publication, retained releases, playthroughs/restart lineage, owner, and relevant audit
    history.

- [ ] **R06 — Turn administrator Audit into a queryable investigation log.**

  **Outcome:** Administrators can find and understand changes through readable identities and linked
  records instead of raw UUID and JSON fields.

  **Depends on:** R03.

  **Scope and acceptance:**

  - Provide readable actor search, action selection, target type/search, real date range, active
    filter summary, and URL-persisted filters.
  - Use a full-width table with sticky headings, explicit timezone, deterministic pagination, and
    distinct shown/total matching counts.
  - Link actors and targets to administrator records while retaining internal IDs for inspection.
  - Move detail JSON into an expandable row or side inspector and render changed values as readable
    before/after fields while preserving raw payload access.
  - Support direct filtered links from user, world, publication, social, notification, and template
    administration.
  - Add export only if an actual operational/compliance use is defined; do not add decorative
    analytics.

- [ ] **R07 — Publish real tutorials and videos.**

  **Outcome:** The Home learning area and editor help lead to maintained material rather than disabled
  placeholders.

  **Scope and acceptance:**

  - Define a small initial curriculum: create a room, connect rooms, add/test an item command,
    publish a world, and diagnose an issue.
  - Provide concise text tutorials that use current routes, field names, and commands; pair with
    short captioned/transcribed videos when ready.
  - Link contextual help from the relevant empty state/editor without interrupting work or opening
    surprise media.
  - Track content version/last review and include tutorial checks in feature changes that rename the
    demonstrated UI.
  - Replace or remove every disabled `coming soon` control. Never leave a control that looks
    actionable but cannot act.

- [ ] **R08 — Finish footer destinations and remove obsolete production pages.**

  **Outcome:** Every footer link goes to a useful, maintained destination and no filler route remains
  in production navigation.

  **Depends on:** A04, R07.

  **Scope and acceptance:**

  - Inventory every footer link and implement its real target, remove it, or label an external
    destination accurately. Add an automated broken-internal-link check.
  - Wire Subscribe to A04 and Help/Tutorials to R07.
  - Remove `/starter`; keep blank and maintained starter choices in New world and place raw schema
    examples in developer documentation or development-only tooling.
  - Remove the filler `/privacy` page only after necessary privacy, retention, export, deletion,
    feedback, analytics, email, avatar, and subscription explanations exist at their decision points
    or in an accurate policy required for launch.
  - Preserve redirects for legacy editor UUID and `/editor` routes; do not create parallel editor
    layouts.

---

## Workstream — Cross-product verification

- [ ] **Q01 — Complete the phone-play mobile workflow audit.**

  **Outcome:** The complete first-time player path works on real phones and is demonstrated by
  maintained end-to-end coverage rather than inferred from responsive CSS.

  **Depends on:** R01, G01, G02, G03, R02.

  **Scope and acceptance:**

  - Open a published world anonymously, read the initial output, submit commands with the software
    keyboard, use Help/List exits, move with absolute and relative directions, try representative
    item verbs, reach long/error output, and restart into a separate playthrough.
  - Use at least 320×568, 390×844, and a short landscape viewport, plus real iPhone/Safari and
    Android/Chrome checks when devices are available.
  - Rotate once, background/restore the browser, and verify focus, prompt position, transcript scroll,
    command history, and playthrough state are retained appropriately.
  - Fail on horizontal page overflow, unreachable focused controls, clipped overlays, covered primary
    actions, unexpected page errors, and unexpected console errors.
  - Retain failure traces/screenshots/video and use screenshot assertions only where layout itself is
    the contract.
  - Record any exception as new scoped work; do not close this task with a list of known phone-play
    bugs. Later app-facing tasks still carry their own mobile acceptance through the shared definition
    of done.

- [ ] **Q02 — Run the release and compatibility gate for the completed overhaul.**

  **Outcome:** The combined work is safe for retained data and normal production workflows.

  **Scope and acceptance:**

  - Review all persisted schema snapshots and migrations intentionally; replay every retained world,
    game state, transcript, turn, draft, template, and publication snapshot through the gated release
    workflow.
  - Run focused suites during each task, then `pnpm test:all`, `pnpm ts-check`, and
    `pnpm release:migrate` before promotion.
  - Verify production environment configuration for asset storage, feedback, subscriptions,
    transactional email, notification jobs, and provider callbacks without adding local `.env`
    secrets.
  - Verify authorization/privacy boundaries for publications, profiles, social graphs, notifications,
    templates, playthroughs, admin records, and command target eligibility.
  - Update this plan, deployment documentation, and user-facing help to match the released behavior.

---

## Retained item category contract

This contract survives the old page audit and is the shared input to E05 and G03. It defines
presentation categories and recommendations, not automatic player behavior.

| Category  | Maintained mark              | Recognized ordinary tags                                                                        |
| --------- | ---------------------------- | ----------------------------------------------------------------------------------------------- |
| Generic   | Circle, square, and triangle | `generic`, `misc`, `miscellaneous`, `other`; fallback for unmatched items                       |
| Structure | Block pillar                 | `structure`, `architecture`, `wall`, `pillar`, `column`, `arch`, `bridge`, `platform`, `stairs` |
| Door      | Door                         | `door`, `gate`, `hatch`, `portal`, `portcullis`, `barrier`, `entrance`, `exit`                  |
| Furniture | Chair                        | `furniture`, `chair`, `table`, `desk`, `bed`, `bench`, `shelf`, `cabinet`, `counter`, `rack`    |
| Container | Chest                        | `container`, `chest`, `box`, `crate`, `barrel`, `bag`, `pouch`, `locker`, `vessel`              |
| Mechanism | Gears                        | `mechanism`, `machine`, `device`, `gear`, `lever`, `switch`, `wheel`, `trap`, `clockwork`       |
| Tool      | Crossed pick and hammer      | `tool`, `implement`, `utensil`, `crafting`, `hammer`, `pick`, `shovel`, `rope`, `training`      |
| Key       | Key                          | `key`, `lockpick`, `access`, `pass`, `permit`                                                   |
| Weapon    | Crossed swords               | `weapon`, `sword`, `dagger`, `axe`, `bow`, `spear`, `club`, `firearm`                           |
| Wearable  | Hat                          | `wearable`, `clothing`, `garment`, `armor`, `helmet`, `boots`, `gloves`                         |
| Light     | Lantern                      | `light`, `fire`, `torch`, `lantern`, `lamp`, `candle`, `brazier`                                |
| Document  | Book                         | `document`, `book`, `note`, `letter`, `scroll`, `map`, `journal`, `record`                      |
| Food      | Apple                        | `food`, `drink`, `edible`, `consumable`, `ingredient`, `fruit`, `meal`                          |
| Nature    | Leaf                         | `nature`, `plant`, `flora`, `fungus`, `tree`, `herb`, `flower`, `rock`, `mineral`               |
| Remains   | Skull                        | `remains`, `corpse`, `body`, `bone`, `bones`, `skull`, `skeleton`, `grave`                      |
| Art       | Statue                       | `art`, `statue`, `sculpture`, `painting`, `portrait`, `mural`, `tapestry`, `carving`            |
| Relic     | Reliquary or peaked shrine   | `relic`, `ritual`, `sacred`, `holy`, `shrine`, `altar`, `idol`, `ceremonial`                    |
| Treasure  | Gem                          | `treasure`, `valuable`, `gem`, `coin`, `currency`, `gold`, `jewel`, `precious`                  |
| Music     | Musical note                 | `music`, `musical`, `instrument`, `sound`, `bell`, `horn`, `chime`                              |
| Magic     | Open hand and orb            | `magic`, `magical`, `arcane`, `enchanted`, `spell`, `sorcery`                                   |

Matching rules:

1. An explicit `icon:<category>` tag selects that category.
2. Otherwise, trim and case-normalize tags, then use the first recognized ordinary tag in saved tag
   order.
3. Never inspect name, description, behavior, or other authored content to infer a category.
4. Use Generic when no tag matches.
5. Category marks remain optional, flat, stylized, reusable SVGs. The item name stays visible and
   accessible when a mark is absent or fails.

## Additional tasks added during this reorganization

The original request named features but not all supporting work. This plan adds the following
explicit tasks or requirements so those features can ship safely:

- **F01 save conflict/recovery semantics**, required before one-click publishing can be trustworthy.
- **F02 shared overlay primitives**, so mobile popup fixes do not become dozens of unrelated patches.
- **F03 shared responsive shells** and **Q01 phone-play workflow coverage**.
- **P01 publication presentation schema/readiness**, needed for decorated public cards and immutable
  releases.
- **A01 abuse/idempotency rules**, **A02 notification deduplication**, and **A03 queued email
  delivery**, needed for reliable social notifications.
- **A04 consent provenance and unsubscribe**, required for a real subscription feature.
- **A05 image validation, metadata stripping, and cleanup**, required for safe profile uploads.
- **T01 template versioning, dependency rules, and attribution**, required before community templates
  are shareable.
- **T04 template field provenance**, needed to warn about unchanged placeholder fields without noisy
  false positives.
- **R02 playthrough lineage**, clarifying the administrator point of view for player-initiated reset.
- **Q02 a combined release, authorization, and persisted-data gate** for the cross-cutting overhaul.
