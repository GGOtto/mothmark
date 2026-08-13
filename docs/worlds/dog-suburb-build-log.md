# Dog suburb build log

This is the running record for **Dog Days Are Never Over**. It separates finished world content from editor or engine improvements that should be considered while we upload, play-test, and revise the world in Mothmark.

## Current world

**Status:** Complete JSON draft, schema-validated, route-tested, and browser-tested

The world is uploaded in Mothmark under the private editor slug `dog-days-are-never-over-2`. A browser prose and interface audit was completed on August 13, 2026. The private draft now has unpublished changes relative to public Release 1.

- 9 rooms arranged as a connected suburban loop.
- 9 two-way connections, so every destination has more than one practical route home.
- 42 items, including scenery, toys, food, containers, surfaces, water, five object-based animals, and five goal bones.
- 49 commands with 64 patterns. Thirty-five core commands appear in Help; secondary body-language and utility commands remain usable without overwhelming the initial list.
- 13 events: initial inventory setup, four hidden-bone discoveries, six object-specific reactions, one recurring ambience event, and victory.
- Carrying capacity is 2 size units: exactly one small item in the current engine. The player must return or drop an item before taking another.

## Map

The playable loop is:

`Backyard → Side Yard → Front Porch → Maple Street → Pocket Park → Community Garden → Service Alley → Side Yard`

Maple Street also leads north to the Cul-de-sac, and Pocket Park leads east to the Creek Path. The loop keeps the world easy to learn while letting the player choose short or scenic routes home.

Rooms:

1. **Backyard** — home base, bone basket, water, bed, tennis ball.
2. **Side Yard** — hedge, hose, gate, rope toy.
3. **Front Porch** — welcome mat puzzle, parcel, hidden treat, squeaky bone.
4. **Maple Street** — hydrant, delivery van, storm drain, moving paper bag.
5. **Cul-de-sac** — neighbor beagle, sprinkler, chalk, excellent stick.
6. **Pocket Park** — squirrel, oak, bench, grass, red rubber bone.
7. **Creek Path** — creek, driftwood, reeds, duck, blue nylon bone.
8. **Community Garden** — diggable soil, compost, tomatoes, rabbit, rawhide bone.
9. **Service Alley** — trash can, crate, cat, oily puddle, old white bone.

## Goal and victory

Five favorite bones are missing. The player wins by recovering all five and putting them inside the backyard bone basket:

- **Squeaky bone:** examine, search, or nudge the welcome mat on the Front Porch.
- **Old white bone:** open the tilted trash can in the Service Alley.
- **Red rubber bone:** chase the squirrel in the Pocket Park.
- **Blue nylon bone:** examine, search, or nudge the driftwood on the Creek Path.
- **Striped rawhide bone:** dig in the soft soil at the Community Garden.

The global `goal`, `bones`, `progress`, `what should I do`, and similar phrases restate the objective. Victory is automatic after the fifth bone enters the basket, and exploration can continue afterward.

## Commands and natural language

The world keeps the full basic adventure vocabulary and adds reusable dog actions. Common commands include travel, look, exits, take, drop, examine, open, close, use, put inside, put on, inventory, sniff, bark, wag, lick, nudge, paw, chew, dig, chase, play, drink, roll, mark, eat, give, sit, lie down, listen, and goal.

Secondary commands such as face, lock, unlock, targeted use, wait, nap, howl, growl, whine, jump, shake off, stretch, self-scratch, and poop are available but hidden from the initial Help response.

Natural alternatives were deliberately expanded. Examples:

- `take`, `get`, `pick up`, `grab`, `carry`, `pick`, `snatch`
- `examine`, `inspect`, `look at`, `check`, `study`, `search`, `investigate`
- `drink water`, `drink from bowl`, `lap water`, `lap from sprinkler`, `slurp creek`
- `dig soil`, `dig in dirt`, `dig at ground`, `excavate soft patch`
- `play with ball`, `play ball`, `fetch ball`, `toss rope`, `shake toy`
- `paw at mat`, `paw mat`, `scratch at soil`, `scrape ground`
- `put bone in basket`, `stash bone inside basket`, `return bone to basket`
- `chase`, `pursue`, `run after`, `follow`, `go after`

Rooms and items also carry practical aliases: `yard`, `home`, `porch`, `road`, `park`, `stream`, `garden`, `alley`, plus object forms such as `doormat`, `fireplug`, `beagle`, `tree rat`, `bunny`, `trash`, and descriptive bone names.

## Living-world moments

- Every five turns, one of six neutral neighborhood sounds or smells appears.
- Barking at the neighbor beagle earns an enthusiastic answer.
- Drinking from the sprinkler gets the dog soaked.
- Marking the hydrant updates the neighborhood scent record.
- Chasing the duck produces a technically successful three-foot retreat.
- Chasing the alley cat produces a very temporary victory.
- Rolling in the oily puddle grants a regrettable rainbow sheen.
- The parcel can be opened to reach a hidden dog biscuit.
- Toys, animals, water, ground, landmarks, and odorous scenery respond through the shared dog commands even when they do not have a unique event.

Animals remain objects for now. Their moments are short, physical, and self-contained; none pretend to provide NPC navigation, conversation, inventories, or independent goals.

## Play-test record

The local engine loaded the finished file through the current `WorldSchema` and completed a 61-turn route that:

- used natural aliases such as `lap water`, `wallow in puddle`, `woof at beagle`, `slurp sprinkler`, `go after duck`, and `stash ... in basket`;
- triggered all four hidden-bone discoveries;
- exercised the object-specific neighborhood reactions;
- carried each bone home one at a time;
- placed all five bones inside the basket; and
- reached the authored win state with the intended victory message.

The JSON builder was also run twice with an identical file digest to confirm it does not accumulate duplicate patterns.

### Browser UI audit, August 13, 2026

The uploaded draft, map, all nine room forms, the item workspace, event workspace, public catalog card, public player, editor player, World settings, and Debug destination were inspected in the in-app browser.

The production player now has a visible **Send command** button. It submitted reliably in both the public player and private editor preview, stayed disabled for empty input, and returned focus to the prompt after every turn.

A clean public Release 1 playthrough recovered and returned all five bones. It also exercised the one-item carrying limit, drop-and-swap behavior, the porch mat, trash can, squirrel, driftwood, garden soil, beagle, sprinkler, duck, cat, puddle, hydrant, goal, inventory, and post-victory exploration. Random neighborhood ambience continued to appear and replay deterministically.

Two reasonable player phrases exposed draft-content gaps. `dig in soft soil` now works through a new `soft soil` alias. The goal text tells the player to examine the basket, so examining it now lists its current contents or says `It is empty.` Both changes were made in the private draft, replayed in the editor, and mirrored to the JSON. They remain unpublished relative to public Release 1.

The release-summary field was prepared with: “You are a dog. Five bones are missing from your basket. Find them around the neighborhood and carry them home one at a time.” **Publish update was not pressed.** Public Release 1 still uses its prior summary and prior saved revision.

## Completed content corrections

### Indent room item listings

**Status:** Deployed and verified in the public player

Every visible item line now begins with one space beneath the room description. Multi-line and conditional item-listing text receives the same indentation. This keeps the room prose visually separate without adding an extra blank paragraph to the terminal flow.

### Concise room output

Every listed object has a short room-listing sentence. Full sensory detail is reserved for examination, preventing the opening Backyard description from becoming a wall of item text.

### Natural dog-action prose

Reusable item responses now insert and capitalize definite articles around interpolated item names where needed.

### Help length

The most useful 35 commands remain visible. Fourteen specialized or expressive commands remain recognized but are hidden from the first Help list. Visible sit, lie-down, and listen entries now have distinct descriptions.

### Drink and other missing forms

Drink accepts both prepositional and direct forms, including `lap` and `slurp`. Dig, play, roll, paw, bark-at, take, drop, examine, chase, eat, chew, sniff, give, and basket-return phrasing were also broadened.

### Remove repeated AI-writing cadence

**Status:** Done in the browser draft and mirrored to the JSON

The prose was reviewed against Wikipedia's current “Signs of AI writing” advice page, used as a descriptive checklist rather than a detector. The relevant patterns were stock promotional language, superficial significance claims, dense AI-associated vocabulary, negative parallelisms, repeated three-part constructions, forced synonym variation, and formulaic em-dash punchlines.

All nine room descriptions were rewritten around concrete sights, smells, directions, and animal behavior. The opening now begins with dry grass, the empty basket, the five missing bones, and the open gate instead of an abstract three-adjective phrase.

Eleven high-repetition examination descriptions were also rewritten: thick hedge, rope toy, storm drain, paper bag, neighbor dog, park squirrel, creek reeds, duck, garden soil, compost bin, and alley cat. The new lines use details such as a caught sparrow feather, a wet rope knot, leaves under a grate, a torn bag bottom, a tapping collar tag, moving squirrel paws, a dropping frog, and a cat's braced hind paw.

Other three-part descriptions were kept when they conveyed a useful clue, a distinctly dog-shaped observation, or necessary directions. The aim was to remove patterned sameness, not ban every list or joke.

## Editor and engine improvements

### Add an explicit Send command control

**Area:** Embedded and published player terminal

**Status:** Deployed and verified in the embedded and public players

Both player surfaces previously exposed only the Game command textbox and history arrows. In the earlier in-app browser audit, the field accepted and displayed text but simulated Return did not submit a turn. With no visible Send button, there was no second accessible path to continue the playthrough.

A clearly named **Send command** button now lives inside the terminal form. It is disabled for an empty, busy, or unavailable prompt, uses the established terminal colors, grows to a 40px touch target on small/coarse-pointer layouts, and returns focus to the command field after submission. Ordinary Enter submission remains supported.

### Defer autosave validation while an effect is incomplete

**Area:** Effect-group editor and background saving

While adding the basket's list-contents effect, background saving reported a visible schema error during the brief interval after choosing the effect type but before choosing its required item. The world saved normally once the picker was completed, but the intermediate failure looks like lost work.

Defer autosave until the focused effect has its required fields, or present incomplete editor state as neutral work-in-progress rather than a save failure.

### Expose message fields in list effects

**Area:** Effect-group editor

The list-contents effect showed the default `It is empty.` text in its summary, but the text was not exposed as an editable field in the effect form. The default works for the basket, but authors should be able to tailor empty inventory and container messages without editing JSON.

### Make random messages replayable

**Area:** Engine persistence and retained playthroughs

**Status:** Deployed with persisted-schema migrations v10 and v11

Random message effects now consume the player's saved random state instead of ambient process randomness. Retained turns therefore replay to the same transcript during release validation. Production migration and exhaustive retained-content replay passed before deployment.

### Make effect messages visibly editable

**Area:** Effect-group editor

Opening the victory effect shows its Win message as a styled paragraph rather than an editable control. Choosing Change and reusing the already-selected Award a win behavior silently resets the custom message to `You won!`; there is still no visible message field. Cancelling the effect-group edit correctly restored the original message.

Render message configuration as a labeled textbox or message editor with clear edit affordance. Changing to the same behavior should preserve compatible fields, and replacing an effect should warn before discarding authored values.

### Hide the unfinished Debug destination

**Area:** Editor navigation

Debug is exposed in production navigation but currently says the area “will become the issues editor” and contains no diagnostics. Hide it until it provides a schema-backed task, in line with the existing rule against production placeholder pages.

### Author initial carrying capacity directly

**Area:** Engine and world settings

There is no authored initial-player carrying-capacity field. The current workaround is a disposable priority event that runs after the first submitted turn. This technically lets the first action occur before the limit initializes.

Add an initial player-state setting or a true before-first-turn startup event phase.

### Add inventory-only command targeting

**Area:** Command editor and parser

Target blocks can search visible, reachable, current-room, known, or any entities, but cannot target only carried items. The generic Give command must target reachable takeable items and then separately test whether the selected item is carried.

Add an `inventory` target source so Give, Wear, Offer, and similar commands can resolve inventory objects directly and report clearer errors.

### Support natural noun phrases in interpolated messages

**Area:** Command variables and messages

Target interpolation exposes an item name but not a natural noun phrase with an article. Generic responses need hand-authored determiner workarounds.

Consider projections for definite and indefinite noun phrases, or an item-level article setting.

### Make room-listing fallback safer

**Area:** Item editor and player presentation

When List in room is enabled and its text is blank, Mothmark falls back to the complete examination text. Large imported scenes can therefore produce overwhelming transcripts.

Consider an editor warning, concise automatic fallback, or preview of the resulting room transcript.

### Clarify hidden flag versus hidden location

**Area:** Item editor, effects, and authoring guidance

The Reveal effect clears an item's hidden flag but does not move an item whose location is itself `hidden`. A bone authored with both mechanisms became revealed but still unreachable. The working design leaves a discoverable item in its actual room and uses only the hidden flag.

Make these two mechanisms visually and conceptually distinct, document which effects change each one, and warn when Reveal is attached to an item that will remain in a hidden location.

### Make condition inversion explicit

**Area:** Condition editor and schema feedback

The Player has won condition is positive-only; an extra `value: false` field is discarded rather than turning it into has not won. Authors must wrap the positive condition in a `none` group when they need its inverse.

Offer an explicit inverse control where supported and surface ignored or unsupported condition fields during import. For this world, the victory event is disposable, so the redundant not-yet-won guard was removed.

### Improve object-animal support

**Area:** NPC engine

Animal-items can hold flags, appear or disappear, and react through commands and events. They cannot independently navigate, converse, carry inventories, follow the player, or pursue goals. NPC support should eventually replace object-specific reaction events for sustained animal behavior.

### Make multi-tab conflict recovery explicit

**Area:** Editor saving and conflict handling

Editing the same world in two browser tabs prevents a stale tab from overwriting the newer version, but the stale tab says Reload before saving again while offering only Retry.

Add a clear **Reload latest and discard local changes** action, explain what will be discarded, and disable Retry when it cannot resolve a version conflict. Until then, use one authoring tab at a time.

## Resolved design decisions

- The suburb has nine rooms: large enough for variety, small enough to learn quickly.
- There are five visually and verbally distinct bones.
- Winning does not end exploration.
- The dog's behavior is player-directed: the same world supports polite investigation and chaotic dog choices.

## Next phase

1. Publish the prepared release summary, prose revisions, `soft soil` alias, and basket-contents effect when the private draft is ready to replace public Release 1.
2. Make the `goal` response acknowledge victory after all five bones are returned; the current public command continues to state the unfinished objective after winning.
3. Keep trying reasonable phrasing outside the scripted route and treat parser errors as defects when the player's intent is clear.
4. Revisit the victory, sprinkler, and puddle event prose after the effect message editor is usable; do not replace the working effects through the current reset-prone control.
5. Record every content fix and reusable editor or engine improvement in this file as we work.
