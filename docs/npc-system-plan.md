# Complete NPC system plan

Status: planned.

Last updated: 2026-08-19.

This plan replaces the former single-task NPC placeholder with horizontal capability slices. Each
slice must carry its capability through authored schemas, mutable runtime state, command resolution,
conditions and effects, the dedicated NPC workspace, persisted-data compatibility, focused tests,
and player-path tests. A slice is not complete when only its schema or editor controls exist.

The goal is not a catalog of gatekeepers, merchants, companions, or enemies. The goal is a small set
of composable systems from which authors can build those characters, as well as animals, crowds,
machines, supernatural beings, and NPCs the product team has not anticipated.

## How to maintain this plan

- The slice checkboxes are the source of truth for NPC implementation. Keep the G05 umbrella in
  `docs/product_tasks.md` unchecked until every required slice here is complete.
- If only part of a slice lands, leave it unchecked and add a dated Progress note describing exactly
  what shipped and what remains.
- Update a slice before implementing newly discovered scope. Do not hide required work in a
  completion note or a later cleanup task.
- Treat every new world, game-state, and message field as persisted schema. Follow
  `SCHEMA_COMPATIBILITY_README.md`, review `storage-contract.snapshot.json`, and add an adjacent
  numbered migration when the change is not backward compatible.
- Build schema-backed test data with `createDefaultFieldObject(schema)` and typed ID utilities. Every
  engine behavior requires focused coverage and a companion `*.player.test.ts` path through
  `resolveTurn`.
- Do not expose the NPC destination in production navigation until the complete authoring, player,
  hosted-play, compatibility, and reference-integrity paths are ready.
- Do not begin N01 or any later NPC slice until E06, E07, and G04 are complete. Planning discussion
  may refine this document, but no NPC implementation or implementation-specific fixture work starts
  before that gate.

## Product contract

### Composition instead of archetypes

NPC identity does not imply speech, possessions, movement, friendliness, combat, or life. Those are
independent capabilities. Standard behavior configurations may make common capabilities easy, but
arbitrary commands, conditions, effects, and events must remain available when a standard behavior
does not fit.

Do not add `merchant`, `guard`, `enemy`, `quest-giver`, or similar archetype types. Do not put
genre-specific universal fields such as `mood`, `trust`, `hostile`, `asleep`, or `dead` on every NPC.
Authors express those concepts through named NPC state, relationships, combat resources, and
authored defeat behavior.

### Engine-owned NPC state

The engine owns only state with stable cross-world semantics:

- typed identity and runtime presentation;
- one authoritative location;
- presence, visibility, and player knowledge;
- NPC-scoped flags, counters, and text values;
- conversation memory required by the conversation system;
- autonomous behavior progress required by movement or schedules;
- possession through authoritative item locations; and
- optional combatant and encounter state when combat is enabled.

`Present`, `visible`, and `known` are distinct:

- A present NPC participates in the world. A removed NPC does not.
- A visible NPC may be perceived and resolved through visible target sources.
- A known NPC may be referenced by author-approved commands that deliberately use the known source,
  even when the NPC is elsewhere or no longer visible.

Absent, removed, hidden, inaccessible, and otherwise ineligible targets must produce the same
unresolved result. Command probing must not reveal secret NPCs, names, locations, topics,
possessions, combatants, or world contents.

### Authored and runtime separation

`NpcSchema` describes the authored definition and its initial state. `NpcStateSchema` is the mutable
playthrough snapshot. Runtime target resolution, conditions, effects, messages, movement,
conversation, and combat use the runtime snapshot as authoritative. The authored world supplies
definitions, reusable behavior documents, topology, and defaults.

Grammatical presentation supports proper names, common or collective references, grammatical
number, and an author-selected pronoun set only where the engine must generate connective text.
Authored listing, examine, speech, action, and defeat text remains authoritative; grammar metadata
must not cause the engine to rewrite it.

Items held by NPCs remain items. Their single authoritative `ItemState.location` identifies the
holder; NPC state must not duplicate an inventory array that can drift out of sync.

### Standard behavior configurations

Standard NPC behaviors are schema-driven authoring conveniences with real runtime semantics. The
initial maintained behavior families are:

- Conversation
- Possessions
- Schedule
- Following
- Combatant

An NPC may have none, some, or all of them. Movement effects can move any present NPC without first
enabling Schedule. Custom commands can target any eligible NPC without first enabling Conversation.
Capability tags, labels, defaults, controls, and discovery phrases come from behavior schema
metadata rather than a parallel editor catalog.

### Continuous text play

NPC interaction and combat remain part of the existing text command and transcript flow. Do not
introduce a mandatory modal dialogue tree or disconnected tactical minigame. The player continues to
enter ordinary commands; NPC speech, reactions, movement, and combat actions appear in the ordered
terminal output.

## Canonical acceptance cast

Maintain one small, schema-backed NPC test world covering the following characters. These are
acceptance scenarios, not built-in templates or archetypes.

| Character                 | What it must prove                                                                 |
| ------------------------- | ---------------------------------------------------------------------------------- |
| Silent animal             | Presence, listing, examination, movement, and no assumed speech                    |
| Informant                 | Conditional conversation, topic discovery, repeat memory, and state effects        |
| Gatekeeper                | Target privacy, item checks, NPC state, and world-changing commands                |
| Patrolling guard          | Deterministic schedules, arrival/departure output, and route constraints           |
| Companion                 | Following, possessions, allied combat, and reactions to player movement            |
| Trader                    | NPC-held items, exchange rules, conditional offers, and no assumed currency system |
| Thief                     | Autonomous item transfer, escape, and hidden/offstage state                        |
| Hidden stranger           | Discovery, reveal effects, and indistinguishable unresolved targeting              |
| Crowd or swarm            | Collective/non-human grammatical presentation and shared targeting                 |
| Two guards called “guard” | Ambiguity resolution using only currently eligible candidates                      |
| Hostile creature          | Encounter entry, actions, statuses, tactics, and authored defeat outcome           |

Every slice should extend this maintained world only when the new detail has a clear player-path
purpose. Promote broadly reused NPC fixtures into `src/engine/testUtils.ts`; keep specialized edge
fixtures small and local.

## Workspace information architecture

The NPC editor is a full-workspace selector followed by a dedicated full-workspace NPC document. It
does not embed the map or make a right inspector the primary editor.

The document has five stable task tabs:

1. **Details** — Identity, grammatical presentation, listing/examine text, presence, visibility, and
   named state.
2. **World** — Placement, movement, schedule, following, possessions, and equipment.
3. **Conversation** — Greeting, topics, responses, conversation memory, and relationships.
4. **Combat** — Combatant setup, resources, actions, defenses, statuses, tactics, and defeat.
5. **Logic** — Related commands, NPC-specific customizations, events, reusable logic, and incoming
   references.

Do not add a second crowded tab row inside these tabs. Each tab uses one section navigator and one
focused editing canvas:

- Desktop uses a compact in-workspace contents rail.
- Narrow layouts use one current-section control that opens the same list in a mobile-safe sheet.
- The content header and task actions remain pinned while only the focused section scrolls.
- The editor URL preserves the selected NPC, top-level tab, and section across refresh, copied links,
  Back, and Forward.
- Inactive optional systems remain discoverable through real enable/configure actions. Do not render
  empty fields or placeholder dashboard cards.
- Conditions and effects open in the focused Logic workspace and return to their originating NPC
  tab and section after Save or Cancel.

The selector follows the content-led entity workflow: visible horizontal names, search, keyboard
navigation, restrained type cues, starting-location context, and no inferred character artwork.

## Turn and action contract

NPC systems share one deterministic turn order. The implementation task must settle the exact
function boundaries, but player-visible ordering is:

1. Parse and resolve the player's command against the state at the beginning of the turn.
2. Apply the command's immediate conditions, effects, messages, and combat action.
3. Commit direct player movement and item transfers.
4. Resolve scheduled NPC movement, following, and other noncombat autonomous reactions in stable
   priority order.
5. If an encounter consumes the turn, resolve each eligible NPC combat action once in deterministic
   order.
6. Resolve duration changes, end-of-turn statuses, and ordinary authored events.
7. Emit messages in the same order as their state changes and save the replay checkpoint.

One player command consumes one combat turn by default. Explicit informational commands may later be
marked free only if they cannot be used to probe hidden state or gain unlimited combat information.
All random selection uses the saved game random source. A single condition occurrence is stable
within one resolution pass.

## Sequence and parallel work

E06, then E07, then G04 form the hard start gate for this plan. They provide the schema-driven Logic
authoring, reliable nested builders, and replay-safe randomness required throughout NPC state,
conversation, schedules, tactics, and combat. N01 starts only after all three roadmap tasks are
checked complete.

The numbered slices express dependency order, not a requirement that every task wait for all earlier
numbers. After N02 establishes the entity boundary, work may proceed in the following lanes where
the repository and release branch can safely absorb parallel changes:

| Stage            | Slices        | Purpose                                                                |
| ---------------- | ------------- | ---------------------------------------------------------------------- |
| Contract         | N01           | Fix semantics and acceptance before persisted structures land          |
| Foundation       | N02           | Establish authored/runtime identity and compatibility                  |
| Core lanes       | N03, N04, N05 | Build the workspace shell, targeting/perception, and Logic primitives  |
| Interaction      | N06           | Connect NPCs to the saved-command system                               |
| Optional systems | N07, N08, N10 | Add conversation, possession, and autonomous movement                  |
| Social model     | N09           | Add relationships/factions on the conversation foundation              |
| Combat model     | N11           | Establish encounter and combatant state after actor/movement semantics |
| Combat mechanics | N12, then N13 | Add actions/resources/defense, followed by statuses/tactics/defeat     |
| Integrity        | N14           | Close references and lifecycle operations across the complete model    |
| Delivery         | N15, then N16 | Complete retained-data surfaces, validate, and expose the destination  |

No lane may expose an incomplete production destination. When parallel work changes the same
persisted schema or shared target/logic unions, integrate it as one reviewed compatibility change
rather than allowing independently generated migrations to race.

## Horizontal slices

- [ ] **N01 — Lock the NPC contracts and canonical test world.**

  **Outcome:** Implementation begins from explicit player-facing semantics rather than reconstructing
  the removed NPC model or inferring intent from dormant UI registries.

  **Depends on:** E06, E07, G04. This is the hard start gate for every NPC slice.

  **Scope and acceptance:**

  - Specify authored/runtime ownership, location, presence, visibility, knowledge, target privacy,
    message ordering, command time, autonomy ordering, and combat ordering as executable examples.
  - Define typed actor references that can address the player or an NPC without weakening existing
    typed entity IDs.
  - Define the neutral no-NPC defaults for worlds and game states.
  - Establish the canonical acceptance cast above using schema-backed construction helpers.
  - Record which concepts are deliberately authored state rather than universal NPC fields.
  - Add contract tests for the invariants that can be expressed before later capability slices.

- [ ] **N02 — Add NPC identity, runtime state, and persistence.**

  **Outcome:** A world can retain NPC definitions and a playthrough can retain their authoritative
  mutable state without yet exposing an unfinished authoring destination.

  **Depends on:** N01.

  **Scope and acceptance:**

  - Add typed NPC definitions with ID, name, aliases, tags, grammatical presentation, listing text,
    examine text, optional conditional presentation, and neutral initial state.
  - Add runtime NPC state with copied target identity/presentation, location, presence, visibility,
    knowledge, and NPC-scoped flags, counters, and text values.
  - Use a location union with an explicit offstage state; do not use a missing room reference as an
    implicit lifecycle state.
  - Initialize NPC state with `createInitialGameState` and reconcile in-memory editor changes without
    blocking Play on server saving.
  - Extend typed ID creation, lookup, rename, comparison, deletion, registry, and reference utilities.
  - Add `npcs: []` and `npcStates: []` through backward-compatible defaults where truthful; otherwise
    add the required adjacent storage migration.
  - Cover world parsing, initial state, retained-state parsing, reconciliation, import/export, and
    exhaustive replay compatibility.

- [ ] **N03 — Build the dedicated NPC selector and document shell.**

  **Outcome:** Authors can create, select, rename, duplicate, navigate, and delete an NPC in the final
  scalable workspace structure before complex systems begin filling it.

  **Depends on:** N02, E04, F04.

  **Scope and acceptance:**

  - Add the selector and dedicated document routes under the stable world editor URL family.
  - Implement Details, World, Conversation, Combat, and Logic tabs with the shared section navigator
    behavior defined above.
  - Make Details fully functional for identity, presentation, lifecycle, and named state, and make
    World Placement functional for the starting location. Optional later systems use real enable
    actions and concise explanations.
  - Keep one labeled Delete action visible and show exact incoming references before mutation.
  - Derive fields, behavior catalogs, defaults, labels, and summaries from schemas and metadata.
  - Preserve selection, tab, section, draft state, scroll, and return context.
  - Verify full desktop, intermediate pane widths, 520×844, phone keyboard, and reduced-motion paths
    with focused component and Playwright tests.
  - Keep the production activity destination hidden until N16.

- [ ] **N04 — Extend entity targeting and perception to NPCs.**

  **Outcome:** Players can perceive and resolve eligible NPCs by ordinary names without learning
  about hidden or inaccessible characters through command probing.

  **Depends on:** N02.

  **Scope and acceptance:**

  - Extend target entity types, references, blocks, command variables, projections, pickers, and
    summaries to NPCs.
  - Define NPC candidates for `visible`, `reachable`, `current-room`, `known`, and `any` sources from
    runtime state.
  - Resolve exact IDs, names, aliases, tags, same-name ambiguity, and extra command aliases only among
    candidates allowed by source and filters.
  - Add NPC room listings and examination through shared presentation and message paths.
  - Support conditional listing/examine text and after-examine effects without exposing hidden state.
  - Add optional structured speaker/actor metadata to messages only if it preserves the uninterrupted
    transcript and backward-compatible text representation.
  - Cover absent, removed, hidden, unknown, remote, ambiguous, renamed, and eligible NPCs through
    focused resolver tests and `resolveTurn`.

- [ ] **N05 — Add complete NPC state conditions and effects.**

  **Outcome:** Authors can query and mutate NPC lifecycle, location, presentation, and arbitrary named
  state with the same reusable Logic tools used by the rest of the engine.

  **Depends on:** N02, E06, E07.

  **Scope and acceptance:**

  - Add conditions for presence, visibility, knowledge, current room, selected room, NPC flags,
    counter comparisons, text comparisons, and prior/selected NPC command targets.
  - Add effects for placement, move to player, offstage movement, add/remove, reveal/hide,
    learn/forget, and named flag/counter/text mutation.
  - Add intentional runtime identity and presentation changes only where conditions, target indexes,
    messages, and replay all use the resulting state consistently.
  - Bind ordinary NPC fields through `commandVariables`; do not create an NPC-only variable resolver.
  - Supply several hidden natural-language situation phrases for every concrete operation and enforce
    metadata completeness.
  - Add NPC as a schema-derived condition/effect domain without parallel picker catalogs.
  - Cover every operation directly and through a complete player command in companion player tests.

- [ ] **N06 — Add standard NPC interaction commands and customization.**

  **Outcome:** NPCs participate in the same saved-command system as items, and authors can customize
  one NPC without introducing action-name branches or mutating shared commands.

  **Depends on:** N04, N05, G03.

  **Scope and acceptance:**

  - Add complete saved command documents for examining and addressing NPCs; add Talk when Conversation
    is enabled and retain explicit fallbacks for ineligible or ambiguous targets.
  - Extend applicable existing standard commands such as Give, Show, Throw at, Use on, or Present so
    their target blocks can resolve NPCs when their effects support it.
  - Keep command behavior composed from reusable conditions and effects loaded through the shared
    initial-command boundary.
  - Let an NPC-specific edit fork the shared command, scope its selected target block to the NPC,
    preserve all other patterns and logic, and retain source/NPC provenance.
  - Name a fork `<original command name> (Customized for <NPC>)`, reopen the existing fork, preserve
    the shared command, and return to the NPC's Logic section after editing.
  - Show exact-NPC restrictions by player-facing name in pattern summaries and target controls.
  - Verify exact-NPC command precedence, shared fallback behavior, and complete authoring workflows.

- [ ] **N07 — Build reusable topics and response-based conversation.**

  **Outcome:** Authors can create short exchanges, deep stateful conversations, discovered topics,
  and non-speaking NPCs without entering a mandatory modal dialogue tree.

  **Depends on:** N05, N06.

  **Scope and acceptance:**

  - Reintroduce typed Topic documents only as part of this conversation model, with names, aliases,
    tags, player knowledge, and privacy-aware target eligibility.
  - Add Conversation behavior containing conditional greetings, topic responses, unknown-topic
    fallback, repeat responses, and after-response effects.
  - Model each response as authored text plus ordinary condition branches and effects. Topic/state
    discovery can create tree-like progression without a second execution language.
  - Add saved Talk and `ask <npc> about <topic>` command documents, including natural relation
    variants and privacy-preserving fallbacks.
  - Track only conversation memory with universal engine semantics, such as met, times addressed, or
    discussed topic IDs; leave mood and trust to named state or relationships.
  - Permit authored NPC-attributed speech outside an active conversation and allow NPC-to-NPC speech.
  - Build the Conversation tab sections for greeting, topics, responses, memory, and relationships;
    complex branch editing opens focused Logic.
  - Cover unknown, hidden, discovered, repeated, unavailable, changing, and same-name topics through
    complete player paths.

- [ ] **N08 — Add NPC possession, equipment, and exchange.**

  **Outcome:** Items have one authoritative owner or location, and players and NPCs can transfer,
  inspect, use, and equip possessions without duplicated inventories.

  **Depends on:** N05, N06, E05B.

  **Scope and acceptance:**

  - Add an NPC-holder variant to authored and runtime item locations using a typed NPC ID.
  - Derive NPC possessions from item states; never store a second NPC inventory list.
  - Add conditions for holding a selected or tag-matched item and effects for player/NPC/NPC item
    transfer.
  - Define visibility of NPC possessions, capacity interactions, nested containers, equipped items,
    unavailable holders, and the disposition of possessions when an NPC leaves or is defeated.
  - Extend Give, Show, Take from, Steal, Equip, and Unequip only through maintained command documents
    and reusable effects where the player behavior is supported.
  - Let item combat behaviors contribute equipment capabilities without copying item configuration
    into NPC state.
  - Build World-tab Possessions and Equipment sections with named item pickers and exact dependency
    reporting.
  - Leave currency, prices, and stock replenishment to a later economy layer unless an authored
    exchange can express the desired trader behavior without them.

- [ ] **N09 — Add relationships and factions without universal disposition fields.**

  **Outcome:** Conversation, autonomous behavior, and combat can reason about allies, opponents, and
  authored social values without labeling every NPC friendly or hostile.

  **Depends on:** N05, N07.

  **Scope and acceptance:**

  - Define typed actor references for player/NPC relationships and typed factions only if several
    NPCs need shared membership behavior that tags cannot safely express.
  - Store directed named relationship flags, counters, and text values rather than fixed trust or
    affection fields.
  - Add relationship and membership conditions/effects with command-variable binding.
  - Define explicit encounter-side allegiance separately from conversational relationship values;
    a high trust counter must not silently change combat targeting.
  - Support player-to-NPC, NPC-to-player, and NPC-to-NPC relationships where authored logic needs
    them.
  - Add Conversation-tab relationship sections and schema-derived summaries without exposing raw
    typed IDs.
  - Cover asymmetric relationships, changes during dialogue, faction changes, and hidden actor
    privacy.

- [ ] **N10 — Add deterministic NPC movement, schedules, and following.**

  **Outcome:** NPCs can remain stationary, move directly, patrol, wander, follow, flee, or react to
  world changes with deterministic and understandable turn behavior.

  **Depends on:** N05, G04.

  **Scope and acceptance:**

  - Add direct, adjacent/path-constrained, toward, and away movement operations where each has clear
    topology and failure semantics.
  - Add Schedule behavior as ordered conditional movement/action rules with stable priority,
    cooldown/wait, one-action-per-phase limits, and explicit fallback.
  - Build schedules on the shared event/condition/effect execution path rather than a disconnected
    scheduler language.
  - Add Following behavior with leader actor, distance/eligibility rules, blocked movement behavior,
    stop conditions, and arrival/departure messages.
  - Add deterministic wandering through the saved random source and prevent re-evaluation from
    rerolling a choice within a turn.
  - Define interactions among simultaneous movement, following chains, cycles, removed NPCs, player
    teleportation, closed routes, combat encounters, and offstage destinations.
  - Build World-tab Placement, Movement, Schedule, and Following sections.
  - Cover a patroller, companion, fleeing thief, random animal, movement conflicts, and complete
    replay determinism through `resolveTurn`.

- [ ] **N11 — Add the shared combat encounter and combatant model.**

  **Outcome:** The player and any combat-enabled NPC can enter, participate in, leave, and resume a
  deterministic text-command encounter without creating a separate tactical game.

  **Depends on:** N04, N05, N09, N10, G04.

  **Scope and acceptance:**

  - Add typed actor references and persisted encounter state containing participants, explicit
    encounter sides, round, action phase, stable action order, and exit state.
  - Add one shared Combatant definition used by player combat settings and the NPC Combatant
    behavior for resources, initiative/order inputs, available combat actions, defenses, tactics,
    and defeat behavior. NPCs without it remain ordinary targetable NPCs.
  - Use one player command as one combat turn by default and define which failed or informational
    commands consume time without enabling unlimited probing.
  - Add conditions/effects to start, join, leave, flee, and end encounters and to query participant,
    side, round, and active-encounter state.
  - Define encounter behavior for movement, following, late arrivals, removed participants, several
    opponents, allies, and simultaneous encounters in different rooms.
  - Do not derive encounter allegiance implicitly from tags, relationship counters, or NPC names.
  - Persist and replay encounter state and messages deterministically.
  - Build the NPC Combat tab's Combatant and Encounter sections and the matching player-combat
    settings in the World workspace; cover single, group, allied, fled, interrupted, and resumed
    encounters through the player path.

- [ ] **N12 — Add reusable combat actions, resources, damage, and defense.**

  **Outcome:** Authors can create ordinary attacks, defenses, healing, special abilities, and
  non-damaging combat maneuvers from reusable schema-driven actions.

  **Depends on:** N08, N11, E06, E07.

  **Scope and acceptance:**

  - Add reusable Combat Action documents with identity, availability, target policy, costs, success
    resolution, ordered effects, messages, cooldown, and optional command association.
  - Let both player command documents and NPC tactics invoke the same action definition.
  - Provide one standard health resource for ordinary defeat semantics plus author-defined named
    resources for stamina, magic, morale, ammunition, or other mechanics.
  - Add damage, healing, resource cost/restore, defense, immunity, resistance, vulnerability, and
    typed damage operations with explicit rounding and bounds.
  - Keep damage types and resource definitions in maintained world data when they require stable
    author-facing names; do not accept arbitrary misspelled strings throughout actions.
  - Define targeting for self, ally, opponent, selected actor, all eligible actors, and bounded random
    eligible actors without crossing room, encounter, or privacy boundaries.
  - Connect equipment contributions through item behavior schemas and runtime equipped state.
  - Build Combat-tab Resources, Actions, and Defenses sections with schema-derived catalogs and
    focused Logic editing.
  - Cover misses, costs, healing, zero/negative bounds, resistances, immunity, equipment, area
    targeting, and deterministic random selection through `resolveTurn`.

- [ ] **N13 — Add statuses, NPC tactics, and authored defeat outcomes.**

  **Outcome:** Combatants can make conditional choices, carry timed effects, and resolve defeat as
  death, surrender, escape, transformation, removal, or any other authored result.

  **Depends on:** N12.

  **Scope and acceptance:**

  - Add reusable Status documents with identity, duration, stacking/replacement rules, conditions,
    modifiers, recurring effects, removal effects, and player-facing application/expiry messages.
  - Add status conditions/effects and resolve durations at one documented point in the combat turn.
  - Add ordered NPC tactic rules selecting available Combat Actions by conditions, explicit
    priorities, and optional deterministic weights.
  - Prevent an opaque aggression or difficulty AI from overriding authored tactics.
  - Add Combatant defeat branches whose ordinary effects may remove, hide, move, disarm, surrender,
    transform, drop possessions, start dialogue, or mark named state.
  - Treat death as one authored outcome with optional standardized presentation, not an unconditional
    field on all NPCs.
  - Define stalemate, no-available-action, mutual defeat, defeated-player, fleeing, and encounter-end
    behavior.
  - Build Combat-tab Statuses, Tactics, and Defeat sections.
  - Cover damage-over-time, control statuses, stacking, tactical priority, weighted choice,
    surrender, fleeing, loot, transformation, player defeat, and replay determinism.

- [ ] **N14 — Complete reference integrity, world issues, and lifecycle operations.**

  **Outcome:** Renaming, duplicating, deleting, importing, or repairing an NPC cannot silently leave
  broken commands, dialogue, ownership, movement, relationships, or combat documents.

  **Depends on:** N07 through N13.

  **Scope and acceptance:**

  - Index every NPC, topic, actor, faction, combat action, status, item-holder, schedule, command,
    condition, effect, event, and encounter reference.
  - Propagate safe typed-ID renames and show exact linked records before destructive changes.
  - Define duplication behavior for local state, exact-target commands, topics, possessions,
    schedules, tactics, and shared reusable documents without accidentally broadening scope.
  - Detect missing rooms/items/NPCs/topics/actions/statuses, invalid holders, impossible equipment,
    movement cycles, following cycles, invalid targets, and unusable combat configurations.
  - Add useful repairs where intent is unambiguous and link every issue to the focused owning section.
  - Build Logic-tab incoming-reference and dependency views from the same shared relationship index.
  - Cache registry and search indexes once per world/visible view and avoid hidden-view eager indexing.
  - Cover large-world performance and every destructive path with focused and browser tests.

- [ ] **N15 — Complete hosted play, publication, administration, and compatibility.**

  **Outcome:** NPC worlds behave identically in embedded Play and hosted play, survive publication and
  retained playthrough replay, and are inspectable without leaking hidden authored content.

  **Depends on:** N14.

  **Scope and acceptance:**

  - Include every NPC-related authored document in import/export, publication snapshots, retained
    drafts/templates, content-size checks, server validation, and storage codecs.
  - Include NPC, topic, possession, schedule, relationship, encounter, action, status, tactic, and
    message state in current playthroughs, turns, transcripts, reset lineage, and replay validation.
  - Add concise administrator playthrough summaries for visible encounter and NPC state while keeping
    authored secrets and personal data appropriately bounded.
  - Reconcile embedded Play against in-memory editor changes without waiting for background saving.
  - Run and review `pnpm storage:contract`; add and test every necessary adjacent migration rather
    than weakening current schemas or retained fixtures.
  - Run exhaustive `pnpm release:migrate` validation against retained drafts, templates,
    publications, playthroughs, transcripts, turns, and commands.
  - Cover hosted mobile terminal wrapping, long dialogue/combat output, reset, replay, and publication
    immutability.

- [ ] **N16 — Validate the complete system and expose NPC authoring.**

  **Outcome:** Authors can build and publish the complete canonical cast, and players can interact
  with it through ordinary commands on desktop and phone before NPC navigation becomes public.

  **Depends on:** N01 through N15.

  **Scope and acceptance:**

  - Build every canonical acceptance character through production authoring controls rather than
    hand-editing JSON fixtures.
  - Play every acceptance path through `resolveTurn`, embedded Play, and hosted Play.
  - Verify target privacy with absent, hidden, inaccessible, remote, same-name, topic, possession,
    and encounter probes.
  - Verify continuous terminal output for room presentation, conversation, movement, combat, status,
    and defeat messages on phone and desktop.
  - Verify every workspace tab and section at full desktop, intermediate canvas widths, 447px and
    310px utility widths where applicable, and 520×844 and smaller phone viewports.
  - Run focused suites, every NPC `*.player.test.ts`, relevant Playwright workflows,
    `pnpm storage:contract`, `pnpm release:migrate`, `pnpm ts-check`, and finally `pnpm test:all`.
  - Review generated storage diffs, player-visible text, accessibility, performance, world issues,
    and retained replay results rather than approving snapshots mechanically.
  - Expose the NPC activity destination only after the release candidate passes this gate.

## Deliberate boundaries

The complete NPC model supplies the foundations below without silently absorbing adjacent product
domains:

- Trading is possible through authored item exchange; a general currency, pricing, and economy
  system remains separate.
- Combat can consume and modify items; crafting, procedural loot generation, and item durability
  remain separate unless implemented as ordinary item behaviors.
- Relationships and topics support quest logic; a reusable Quest domain remains separate.
- NPC movement uses authored map topology; tactical grids, coordinates within a room, and line of
  sight remain outside the text-command combat model.
- Authors may model health, death, sleep, hunger, emotion, reputation, or loyalty, but only concepts
  with universal engine semantics become fixed NPC fields.
- Networked multiplayer, generative dialogue, and nondeterministic external-agent control are not
  part of this plan because they cannot satisfy current replay and authored-content guarantees.

## Complete definition of done

G05 is complete only when all N01–N16 slices are checked and:

- the canonical cast can be authored without raw JSON or hidden test-only controls;
- no standard NPC archetype requires engine branches based on its name, tags, or command names;
- all visible target resolution obeys the privacy boundary;
- all autonomous and combat behavior replays deterministically from retained command history;
- the dedicated workspace remains usable as systems grow and does not fall back to a flat row of
  subsystem tabs or a single enormous form;
- old no-NPC worlds and retained playthroughs continue to parse and replay or are covered by reviewed
  adjacent migrations;
- embedded and hosted players produce the same ordered player-visible results; and
- production navigation exposes no unfinished or placeholder NPC surface.
