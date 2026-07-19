# Alias Suggestion System Spec

## Purpose

Authors need to create aliases for commands, items, NPCs, room features, surfaces, containers, exits, and topics. Good aliases make the text parser feel forgiving without requiring authors to think of every wording a player might try.

This system suggests aliases without using generative AI. It uses deterministic rules, curated project dictionaries, lexical databases, optional npm libraries, and editor feedback loops.

The output should feel like helpful autocomplete, not magic. Authors remain in control: suggestions are proposed, scored, grouped, previewed, and manually accepted.

---

## Goals

1. Suggest useful aliases while authors create commands and entities.
2. Avoid generative AI entirely.
3. Keep suggestions explainable and deterministic.
4. Support command verbs, item aliases, NPC aliases, room feature aliases, topic aliases, and connector phrases.
5. Use world context so suggestions are relevant to the current entity.
6. Prevent parser conflicts before they become bugs.
7. Make accepted aliases reusable as project-level authoring knowledge.
8. Support external lexical tools or npm packages where useful.
9. Keep runtime command parsing simple and fast.

---

## Non-Goals

This system should not:

- Generate prose.
- Invent story-specific lore.
- Guess hidden meanings from long descriptions.
- Automatically add aliases without author approval.
- Require an internet connection at runtime.
- Replace the parser or command matching system.
- Use LLMs, hosted AI APIs, embeddings, or generative text models.

---

## Existing Parser Assumptions

The current command design already expects:

- Command aliases.
- Multi-word aliases.
- Connectors like `on`, `with`, `to`, `in`, and `into`.
- Longest-first alias matching.
- Optional leading article stripping.
- Target resolution against world entities.
- Resolvable entity types such as item, feature, container, surface, NPC, room, exit, topic, and direction.

This spec builds on that model.

---

## Core Concept

Alias suggestions should come from several deterministic sources:

```md
Input:

- Entity type: command, item, NPC, room feature, topic, exit, container, surface
- Entity name: apple, rat, old wooden table, bronze key
- Optional tags: fruit, food, animal, small, hostile, surface, container
- Optional description text
- Current room/world context
- Existing aliases across the world

Suggestion sources:

- Built-in verb dictionaries
- Built-in noun dictionaries
- Entity type templates
- WordNet-style synonym lookup
- Inflection/pluralization rules
- Project-level accepted alias history
- Author-defined synonym groups
- Optional package-based tokenization and part-of-speech tagging

Output:

- Suggested aliases
- Score
- Reason
- Source
- Conflict warnings
- Parser preview
```

The system should never say only "here are synonyms." It should say why each suggestion exists and whether it is safe.

---

## Suggested Architecture

```md
Author types or edits entity/command
|
v
Normalize input
|
v
Extract candidate terms
|
v
Generate candidates from deterministic sources
|
v
Filter unsafe or irrelevant suggestions
|
v
Score and group suggestions
|
v
Detect conflicts against current parser index
|
v
Show suggestions in editor UI
|
v
Author accepts, rejects, or saves custom synonym
|
v
Persist aliases into world JSON
```

---

## Data Model Additions

### Entity Alias Metadata

Aliases can remain simple strings in the world JSON, but the editor may store metadata for accepted suggestions.

```ts
type EntityAlias = {
  value: string;
  source?: AliasSuggestionSource;
  acceptedAt?: string;
  authorEdited?: boolean;
};
```

If runtime simplicity matters, export only the string list:

```ts
aliases: string[];
```

The editor can keep metadata in a separate authoring-only field:

```ts
authoring?: {
  aliases?: EntityAlias[];
};
```

### Suggestion Result

```ts
type AliasSuggestion = {
  value: string;
  normalizedValue: string;
  score: number;
  entityType: AliasEntityType;
  source: AliasSuggestionSource;
  reason: string;
  warnings: AliasSuggestionWarning[];
};
```

### Entity Types

```ts
type AliasEntityType =
  "commandVerb" | "item" | "npc" | "room" | "feature" | "container" | "surface" | "exit" | "topic";
```

### Suggestion Sources

```ts
type AliasSuggestionSource =
  | "exact-name"
  | "manual-project-dictionary"
  | "built-in-command-verb-set"
  | "built-in-entity-template"
  | "wordnet-synonym"
  | "wordnet-hypernym"
  | "wordnet-hyponym"
  | "pluralization"
  | "singularization"
  | "description-token"
  | "tag-derived"
  | "accepted-alias-history"
  | "author-custom-synonym-group";
```

### Warnings

```ts
type AliasSuggestionWarning =
  | "matches-existing-entity"
  | "matches-existing-command"
  | "too-generic"
  | "too-long"
  | "stopword-only"
  | "ambiguous-in-current-room"
  | "ambiguous-worldwide"
  | "reserved-word"
  | "connector-word"
  | "direction-word"
  | "low-confidence";
```

---

## Runtime vs Editor Responsibility

### Runtime Parser

The runtime parser should only need:

- Command aliases.
- Entity aliases.
- Connector aliases.
- Scope/visibility rules.
- Conflict handling.

It should not run WordNet, NLP, or package-heavy analysis during normal play.

### Editor Suggestion Engine

The editor can do heavier work:

- Suggest aliases.
- Run conflict checks.
- Explain suggestion reasons.
- Preview parser matches.
- Cache results.
- Maintain project dictionaries.

This keeps the player experience fast and predictable.

---

## Suggestion Categories

# 1. Command Verb Alias Suggestions

Command verbs need aliases like:

```md
put -> place, set, lay, drop, position
examine -> look at, inspect, check, study, view
use -> apply, operate, activate, try
speak -> talk to, ask, tell, say to
attack -> hit, strike, fight, kick, punch
open -> unlock? no, only if object state supports it
```

Command verb suggestions should come mostly from curated dictionaries, not broad synonym lookup. General synonym databases can be noisy for verbs.

## Built-In Verb Groups

Create a deterministic `commandVerbGroups.ts` file.

```ts
export const COMMAND_VERB_GROUPS = {
  put: ["put", "place", "set", "lay", "position", "drop"],
  take: ["take", "get", "grab", "pick up", "collect"],
  examine: ["examine", "look at", "inspect", "check", "study", "view"],
  use: ["use", "apply", "operate", "activate", "try"],
  give: ["give", "hand", "offer", "present"],
  speak: ["talk to", "speak to", "ask", "tell", "say to"],
  open: ["open", "unseal", "unlatch"],
  close: ["close", "shut"],
  unlock: ["unlock", "unfasten"],
  lock: ["lock", "secure"],
  eat: ["eat", "consume", "bite", "taste"],
  drink: ["drink", "sip", "taste"],
  wear: ["wear", "put on", "equip", "don"],
  remove: ["remove", "take off", "unequip"],
  push: ["push", "press", "shove"],
  pull: ["pull", "tug", "drag"],
  break: ["break", "smash", "crack", "shatter"],
  repair: ["repair", "fix", "mend"],
  light: ["light", "ignite", "kindle"],
  extinguish: ["extinguish", "put out", "douse"],
  read: ["read", "study", "skim"],
  search: ["search", "look through", "rummage", "inspect"],
};
```

## Command Alias Rules

When the author enters:

```md
Command pattern: put apple on table
```

The editor should parse:

```md
verb: put
object: apple
target: table
connector: on
```

Then suggest aliases for the verb slot:

```md
place apple on table
set apple on table
lay apple on table
drop apple on table
position apple on table
```

If the command has object and target slots, the UI should also offer abstract pattern aliases:

```md
put [item] on [surface]
place [item] on [surface]
set [item] on [surface]
```

This allows authors to define reusable command patterns instead of only exact phrases.

---

# 2. Item Alias Suggestions

Item aliases should combine:

- Exact name.
- Singular/plural forms.
- Adjective-stripped forms.
- Description nouns.
- Tags.
- Curated type dictionary.
- WordNet noun synonyms and hypernyms.
- Author-approved project vocabulary.

## Example: Apple

Input:

```md
Entity type: item
Name: apple
Tags: fruit, food
Description: A shiny red apple with a small brown stem.
```

Suggested aliases:

```md
apple
red apple
shiny apple
fruit
food
snack
piece of fruit
```

Lower-confidence suggestions:

```md
produce
pome
```

Rejected by default:

```md
company
computer
mac
```

Reason: WordNet and dictionaries may include alternate senses of `apple`. The system should prefer the sense that matches item tags and description. For interactive fiction, `fruit` is useful. `company` is probably not.

## Item Template Examples

### Fruit/Food

```md
apple -> fruit, food, snack, red apple, shiny apple
bread -> bread, loaf, food, slice, stale bread
cheese -> cheese, food, wedge, dairy
meat -> meat, food, ration
```

### Keys

```md
bronze key -> key, bronze key, small key, old key
rusty key -> key, rusty key, iron key
silver key -> key, silver key
```

Avoid suggesting only `key` if multiple visible keys exist in the same room unless the alias is marked ambiguous.

### Containers

```md
wooden chest -> chest, box, wooden box, container
leather bag -> bag, pouch, satchel
jar -> jar, container, vessel
```

### Tools

```md
hammer -> hammer, tool, mallet
knife -> knife, blade, tool
rope -> rope, cord, line
lantern -> lantern, lamp, light
```

---

# 3. NPC Alias Suggestions

NPC aliases should be more careful than item aliases. An NPC alias can affect dialogue, combat, following, and quest behavior.

## Example: Rat

Input:

```md
Entity type: npc
Name: rat
Tags: animal, rodent, small
Description: A nervous gray rat with twitching whiskers.
```

Suggested aliases:

```md
rat
rodent
gray rat
small rat
creature
animal
vermin
```

Contextual or low-confidence suggestions:

```md
mouse
beast
critter
```

`mouse` should be marked as low confidence because it is related, but not the same creature. It may be useful in a forgiving parser, but only if the author approves it.

## NPC Type Dictionary

```ts
export const NPC_ALIAS_GROUPS = {
  rat: ["rat", "rodent", "vermin", "creature", "animal"],
  mouse: ["mouse", "rodent", "creature", "animal"],
  guard: ["guard", "watchman", "sentinel", "soldier"],
  merchant: ["merchant", "shopkeeper", "trader", "vendor"],
  dog: ["dog", "hound", "animal", "creature"],
  cat: ["cat", "feline", "animal", "creature"],
};
```

## Named NPCs

For named NPCs, prefer:

```md
Name: Captain Mara
Suggested aliases:

- mara
- captain
- captain mara
- officer
```

But mark `captain` as ambiguous if multiple captains exist.

---

# 4. Feature, Surface, and Container Alias Suggestions

Room features often matter as command targets:

```md
table, altar, fireplace, mirror, door, window, shelf, cabinet
```

Surfaces and containers need special aliases because commands like `put apple on table` depend on target type.

## Surface Examples

```md
old wooden table -> table, wooden table, old table, surface
stone altar -> altar, stone altar, slab, surface
workbench -> bench, workbench, table, surface
shelf -> shelf, ledge, surface
```

## Container Examples

```md
wooden chest -> chest, box, wooden chest, container
iron cage -> cage, iron cage, enclosure
cabinet -> cabinet, cupboard, container
jar -> jar, vessel, container
```

Do not suggest `surface` or `container` to players by default unless the game’s writing style supports generic noun commands. These may be editor-facing tags more than player-facing aliases.

---

# 5. Connector Alias Suggestions

Connector phrases are small but important.

```md
on -> onto, on top of, upon
in -> into, inside, inside of, within
under -> underneath, beneath, below
behind -> in back of, beyond
with -> using, by using
at -> toward, to
from -> out of, off, off of
```

Connector aliases should be stored separately from command aliases.

```ts
type ConnectorAliasGroup = {
  canonical: string;
  aliases: string[];
};
```

Example:

```ts
{
  canonical: "on",
  aliases: ["on", "onto", "on top of", "upon"]
}
```

---

# 6. Topic Alias Suggestions

Topics are used for dialogue commands:

```md
ask guard about key
ask merchant about rats
tell witch about mirror
```

Topic aliases should be curated and context-aware.

```md
Topic: rats in the cellar
Suggested aliases:

- rats
- rat problem
- cellar rats
- infestation
- vermin
```

Topic aliases should not automatically become NPC aliases. `rats` as a topic and `rat` as an NPC should be separate but related.

---

## Candidate Generation Pipeline

# Step 1. Normalize Text

Normalize all candidates before scoring:

```md
- lowercase
- trim whitespace
- collapse repeated spaces
- strip punctuation except apostrophes where needed
- remove leading articles for comparison: a, an, the
- normalize quotes
- optionally normalize accents
```

Example:

```md
"The Old Wooden Table" -> "old wooden table"
```

# Step 2. Tokenize Name

For entity names:

```md
old wooden table -> [old, wooden, table]
red apple -> [red, apple]
Captain Mara -> [captain, mara]
```

Identify:

```md
head noun: table, apple, mara
modifiers: old, wooden, red, captain
```

This can be done with simple rules first:

- Last token is usually the head noun.
- For named NPCs, capitalized words may be names or titles.
- Known titles like captain, doctor, king, queen, guard, merchant can be role nouns.

Optional NLP can improve this later.

# Step 3. Generate Base Forms

Always include:

```md
full name
head noun
modifier + head noun combinations
singular form
plural form, if useful
```

Example:

```md
old wooden table
wooden table
old table
table
tables
```

Plural forms should usually be low priority for singular objects, but useful for groups:

```md
rats -> rat
rat swarm -> rats, swarm, rodents
```

# Step 4. Apply Entity Type Templates

If an item has tags:

```md
tags: fruit, food
```

Add aliases from matching template dictionaries:

```md
fruit -> fruit, produce, food, snack
```

If an NPC has tags:

```md
tags: animal, rodent
```

Add:

```md
animal, creature, rodent, vermin
```

# Step 5. Query Lexical Sources

Optional lexical source lookup:

- WordNet synonyms for nouns and verbs.
- Hypernyms for broader terms like `fruit`, `rodent`, `animal`.
- Hyponyms only when the author asks for broader expansion; otherwise they can be too specific.

WordNet is useful because it groups nouns, verbs, adjectives, and adverbs into synonym sets and links them by semantic relationships. It is deterministic and downloadable, which fits the no-generative-AI requirement.

# Step 6. Filter Candidates

Remove candidates that are:

```md
- empty
- one-character, unless intentionally allowed
- pure stopwords
- connector-only words
- direction-only words
- reserved parser words
- exact duplicates
- profanity, if the project enables a safety filter
- aliases already rejected by the author
```

# Step 7. Detect Conflicts

Build an alias index for current world scope:

```ts
type AliasIndexEntry = {
  alias: string;
  normalizedAlias: string;
  entityId: string;
  entityType: AliasEntityType;
  roomId?: string;
  visibleWhen?: unknown;
};
```

Warn when a suggestion:

- Matches another visible entity in the same room.
- Matches a command alias.
- Matches a connector.
- Matches a direction.
- Matches multiple entities globally.
- Would change parser behavior because of longest-first matching.

# Step 8. Score Candidates

Suggested score ranges:

```md
95-100: exact, author-approved, or curated high-confidence alias
85-94: strong template/tag match
70-84: useful lexical synonym or hypernym
50-69: plausible but broad or context-sensitive
30-49: weak related term, hidden by default
0-29: reject
```

## Example Scoring

For `apple` item:

```md
apple: 100, exact name
red apple: 96, description/name-derived
fruit: 92, tag-derived
food: 88, tag-derived
snack: 76, template-derived
produce: 65, broad hypernym
company: 0, rejected wrong sense
mac: 0, rejected wrong sense
```

For `rat` NPC:

```md
rat: 100, exact name
rodent: 93, tag-derived / hypernym
vermin: 86, curated NPC group
animal: 82, tag-derived broad type
creature: 78, broad NPC fallback
mouse: 58, related but not equivalent
```

---

## UI Design

# Command Editor Suggestions

When author types:

```md
put apple on table
```

Show sections:

```md
Verb aliases

- place apple on table
- set apple on table
- lay apple on table
- drop apple on table

Connector aliases

- put apple onto table
- put apple on top of table

Pattern aliases

- put [item] on [surface]
- place [item] on [surface]
```

Each suggestion should have:

```md
[Accept] [Reject] [Edit]
Score
Reason
Warning badge, if needed
```

# Entity Editor Suggestions

For item `apple`:

```md
Strong suggestions

- apple
- red apple
- fruit
- food

Maybe useful

- snack
- produce

Rejected / hidden

- company
- mac
```

# Conflict Preview

When hovering over an alias:

```md
Typing "take fruit" would resolve to item: apple in Kitchen.
No conflicts in this room.
```

Or:

```md
Warning: "key" also matches item: rusty key and item: silver key in this room.
Player may be asked to clarify.
```

---

## Author Feedback Loop

The system should learn from author choices without AI.

When an author accepts:

```md
apple -> fruit
rat -> rodent
```

Store in project dictionary:

```ts
type ProjectAliasMemory = {
  canonical: string;
  aliases: string[];
  entityType?: AliasEntityType;
  tags?: string[];
};
```

When an author rejects:

```md
apple -> company
rat -> mouse
```

Store in a reject list so it does not keep coming back.

```ts
type RejectedAlias = {
  canonical: string;
  alias: string;
  entityType?: AliasEntityType;
  reason?: string;
};
```

This is not machine learning. It is deterministic author preference storage.

---

## Recommended npm Packages and Tools

Use packages only in the editor/build tooling unless runtime bundle size is acceptable.

| Tool         | Use                                                | Notes                                                                                     |
| ------------ | -------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `wordnet`    | Local WordNet lookup                               | Good for nouns and hypernyms; requires sense filtering.                                   |
| `wordnet-db` | WordNet database files                             | Useful with WordNet-based packages.                                                       |
| `natural`    | Tokenization, stemming, phonetics, WordNet support | Broad NLP toolkit; WordNet integration should be treated carefully before production use. |
| `compromise` | Lightweight NLP and token tagging                  | Useful for tokenization, noun/verb detection, and extracting terms from descriptions.     |
| `pluralize`  | Singular/plural aliases                            | Very practical for entity forms.                                                          |
| `inflection` | More string inflection helpers                     | Useful if you want broader casing/plural/singular transformations.                        |
| `stopword`   | Stopword filtering                                 | Useful for cleaning description-derived candidates.                                       |

Princeton WordNet is a large lexical database that groups words into synonym sets and connects related concepts, which makes it suitable for deterministic alias expansion. The `natural` package includes tokenization, stemming, phonetics, string distance, and WordNet-related facilities. `compromise` is a lightweight JavaScript NLP package. `pluralize` and `inflection` cover singular/plural and other string transformations.

---

## Recommended Dependency Strategy

Start simple:

```md
Phase 1:

- Built-in verb groups
- Built-in entity alias templates
- pluralize or inflection
- conflict detection
- author accept/reject flow
```

Then add lexical lookup:

```md
Phase 2:

- WordNet lookup
- tag-based sense filtering
- description-token extraction
- project dictionary learning
```

Then add optional NLP:

```md
Phase 3:

- compromise for term extraction
- stopword for description cleanup
- better noun phrase extraction
```

Avoid adding everything at once. A curated dictionary plus conflict detection will probably solve most author pain with less weirdness.

---

## Sense Filtering

Lexical databases can produce bad aliases when a word has multiple meanings.

Example:

```md
apple -> fruit, food, company, computer
```

The system should choose sense candidates based on:

```md
- entity type
- tags
- description words
- room context
- author dictionary
- existing accepted aliases
```

For `apple` with tags `fruit` and `food`, keep:

```md
fruit
food
produce
```

Reject or hide:

```md
company
computer
mac
```

For `rat` with tags `animal` and `rodent`, keep:

```md
rodent
animal
vermin
creature
```

Mark as maybe:

```md
mouse
```

Reject:

```md
snitch
traitor
```

Unless the author explicitly tags the NPC as a slang/insult usage.

---

## Conflict Detection Rules

# Same-Room Entity Conflict

If two visible entities in the same room share an alias, warn strongly.

```md
Kitchen:

- apple aliases: fruit, apple
- pear aliases: fruit, pear

Warning:
"fruit" matches apple and pear in Kitchen.
```

# Global Entity Conflict

If the alias conflicts globally but not in the same room, warn lightly.

```md
"key" is used by three items in different rooms.
This is okay if they are never visible together.
```

# Command Conflict

If an item alias equals a command alias:

```md
Item alias: look
Command alias: look
```

Reject by default.

# Connector Conflict

If an alias equals a connector:

```md
Alias: on
Connector: on
```

Reject by default.

# Direction Conflict

If an alias equals a direction:

```md
Alias: north
Direction: north
```

Reject by default unless entity type is an exit/room and explicitly allowed.

---

## Parser Preview Tool

The editor should include a parser preview panel.

Example:

```md
Test input: put fruit on table

Parsed:
verb: put
object text: fruit
connector: on
target text: table

Resolved:
object: apple
target: old wooden table

Warnings:
none
```

Conflict example:

```md
Test input: take key

Resolved candidates:

- rusty key
- silver key

Result:
ambiguous target
```

This preview should use the same matching logic as the game runtime.

---

## Example Workflows

# Example 1. Command Alias Suggestions

Author creates:

```md
Command: put apple on table
```

System identifies:

```md
verb: put
object: apple
target: table
connector: on
```

Suggested command aliases:

```md
place apple on table
set apple on table
lay apple on table
drop apple on table
put apple onto table
place apple onto table
set apple on top of table
```

Suggested reusable patterns:

```md
put [item] on [surface]
place [item] on [surface]
set [item] on [surface]
drop [item] on [surface]
```

Potential effects this enables:

```md
- remove apple from inventory
- place apple on table
- set flag table.hasApple = true
- schedule ratsArrive in 3 turns
```

# Example 2. Apple Item Alias Suggestions

Input:

```md
Item: apple
Tags: fruit, food
Description: A shiny red apple with a small brown stem.
```

Suggestions:

| Alias          | Score | Reason                           |
| -------------- | ----: | -------------------------------- |
| apple          |   100 | Exact item name.                 |
| red apple      |    96 | Description/name-derived phrase. |
| shiny apple    |    92 | Description-derived phrase.      |
| fruit          |    92 | Tag-derived category.            |
| food           |    88 | Tag-derived category.            |
| snack          |    76 | Food template.                   |
| piece of fruit |    74 | Fruit template.                  |
| produce        |    65 | Broad lexical category.          |

Hidden/rejected:

| Alias   | Reason                                    |
| ------- | ----------------------------------------- |
| company | Wrong WordNet sense for tagged food item. |
| mac     | Wrong sense and likely parser noise.      |

# Example 3. Rat NPC Alias Suggestions

Input:

```md
NPC: rat
Tags: animal, rodent, small
Description: A nervous gray rat with twitching whiskers.
```

Suggestions:

| Alias     | Score | Reason                                                        |
| --------- | ----: | ------------------------------------------------------------- |
| rat       |   100 | Exact NPC name.                                               |
| gray rat  |    94 | Description-derived phrase.                                   |
| small rat |    90 | Tag/description-derived phrase.                               |
| rodent    |    93 | Tag-derived category.                                         |
| vermin    |    86 | Curated NPC alias group.                                      |
| animal    |    82 | Broad tag-derived category.                                   |
| creature  |    78 | Broad NPC fallback.                                           |
| mouse     |    58 | Related animal, but not equivalent. Author approval required. |

# Example 4. Table Surface Alias Suggestions

Input:

```md
Feature: old wooden table
Tags: surface, furniture
Description: A scarred wooden table with one uneven leg.
```

Suggestions:

| Alias            | Score | Reason                                                  |
| ---------------- | ----: | ------------------------------------------------------- |
| old wooden table |   100 | Exact feature name.                                     |
| wooden table     |    96 | Modifier + head noun.                                   |
| old table        |    92 | Modifier + head noun.                                   |
| table            |    95 | Head noun.                                              |
| surface          |    68 | Surface tag; maybe too generic for player-facing alias. |
| furniture        |    62 | Broad category.                                         |

---

## Author-Defined Synonym Groups

Authors should be able to define project-specific synonym groups from the UI.

```md
Group: Moth-Marked Objects
Canonical: mothmark
Aliases:

- moth mark
- moth-mark
- wing mark
- pale sigil
```

Then the system can suggest these aliases when future objects share the same tag:

```md
tags: mothmarked
```

This is especially useful for setting-specific vocabulary that WordNet will not know.

---

## World JSON Export Shape

Runtime-friendly world data:

```ts
type WorldEntity = {
  id: string;
  name: string;
  aliases?: string[];
  tags?: string[];
};
```

Authoring metadata:

```ts
type WorldEntityAuthoring = {
  aliasSuggestions?: {
    accepted?: EntityAlias[];
    rejected?: RejectedAlias[];
  };
};
```

Command example:

```ts
type AuthoredCommand = {
  id: string;
  name: string;
  aliases: string[];
  patterns: CommandPattern[];
  conditions: CommandCondition[];
  effects: CommandEffect[];
};
```

Command alias output:

```json
{
  "id": "putAppleOnTable",
  "name": "Put Apple On Table",
  "aliases": [
    "put apple on table",
    "place apple on table",
    "set apple on table",
    "lay apple on table"
  ]
}
```

Entity alias output:

```json
{
  "id": "apple",
  "name": "apple",
  "aliases": ["red apple", "fruit", "food", "shiny apple"],
  "tags": ["fruit", "food"]
}
```

---

## Implementation Plan

# Phase 1. Deterministic MVP

Build:

```md
- Alias suggestion service
- Built-in command verb groups
- Built-in entity templates
- Plural/singular generation
- Alias normalization
- Conflict detection
- Editor suggestion UI
- Parser preview panel
- Accept/reject persistence
```

This phase should require no external lexical database.

# Phase 2. Lexical Expansion

Add:

```md
- WordNet-backed synonym lookup
- WordNet hypernym lookup
- Tag-based sense filtering
- Hidden low-confidence suggestions
- Project-level synonym groups
```

# Phase 3. Description-Aware Suggestions

Add:

```md
- Token extraction from descriptions
- Noun phrase extraction
- Stopword filtering
- Better adjective/head noun combinations
```

# Phase 4. Quality Tools

Add:

```md
- World alias audit
- Ambiguity heatmap by room
- Duplicate alias report
- Parser regression examples
- Suggested aliases for every entity missing aliases
```

---

## Testing Requirements

# Unit Tests

Test:

```md
- normalization
- article stripping
- singular/plural generation
- command verb group suggestions
- item template suggestions
- NPC template suggestions
- duplicate removal
- reserved word filtering
- conflict detection
- score ordering
```

# Parser Integration Tests

Test:

```md
put apple on table
place fruit on table
set red apple onto old table
look at rodent
examine gray rat
take key, with multiple visible keys
```

# Snapshot Tests

Snapshot suggestion outputs for common entities:

```md
apple
rat
old wooden table
bronze key
locked door
merchant
```

# Authoring Regression Tests

When a suggestion is rejected, ensure it does not return later for the same entity unless the author clears rejected suggestions.

---

## Risks and Mitigations

| Risk                                   | Mitigation                                                       |
| -------------------------------------- | ---------------------------------------------------------------- |
| WordNet suggests wrong senses          | Require tags, score by context, hide low-confidence suggestions. |
| Too many suggestions overwhelm authors | Group into Strong, Maybe, Hidden. Show only top 5-8 by default.  |
| Aliases create parser ambiguity        | Conflict detection and parser preview before accepting.          |
| Runtime bundle gets heavy              | Keep NLP/WordNet in editor tooling only. Export plain aliases.   |
| Authors over-accept generic aliases    | Warn on broad words like `thing`, `object`, `creature`, `item`.  |
| Multi-word aliases behave unexpectedly | Reuse longest-first parser tests and preview exact matching.     |

---

## Recommended Defaults

Use these defaults for the first version:

```md
Max visible suggestions per section: 8
Minimum visible score: 70
Minimum hidden score: 50
Reject below: 50
Require confirmation for conflicts: yes
Auto-add exact name: yes
Auto-add plural/singular: no, suggest only
Auto-add WordNet aliases: no, suggest only
Allow author custom aliases: yes
Allow author custom synonym groups: yes
```

---

## Design Recommendation

The best first version is not a giant synonym machine. It is:

```md
curated command verb groups

- curated entity templates
- plural/singular forms
- author-defined synonym groups
- conflict detection
- parser preview
```

That gives authors most of the value while keeping the system predictable. WordNet and NLP packages should be added after the core UI proves useful.

---

## Source Notes

- WordNet is a deterministic lexical database of English that groups nouns, verbs, adjectives, and adverbs into synonym sets and links concepts through semantic relationships.
- `natural` is a Node NLP toolkit with tokenization, stemming, phonetics, string distance, and WordNet-related features.
- `compromise` is a lightweight JavaScript NLP library that can help extract and tag terms from names and descriptions.
- `pluralize` and `inflection` provide singular/plural and broader word inflection utilities.
- `stopword` provides stopword removal lists that can help clean description-derived candidates.
