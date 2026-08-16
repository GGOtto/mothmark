# Item suggester

The item suggester is deterministic, AI-free, and split into two author-facing modes.

## Alias mode

Alias mode proposes player wording from the item name, existing aliases, and WordNet 3.1. It may
offer corpus-attested direct synonyms or a useful head word from a longer name, but it does not turn broader
classification terms into player aliases. Before display, candidates
are normalized and checked against every other item's name and aliases. Head-word collisions are
also indexed, so an `Apple` alias is not offered when another item is named `Green Apple`.

Ordinary authored phrases also yield their trailing object phrases, up to three words. For example,
`The old grandfather clock` yields `grandfather clock` and `clock`; a longer ornamental name does
not produce every possible word combination. Compound-object recognition applies to the last word,
so `The enormous striped watermelon` can also yield `melon`.

Recognizable closed-compound heads already present in the matched item-taxonomy category, such as
`melon` in `watermelon`, are eligible too. The suggester does not contain curated synonym pairs or
item-name conditionals. When every useful candidate is already understood or collides, the empty
state explains which case occurred.

Aliases remain ordinary authored strings. A suggestion changes nothing until the author chooses
**Add**.

## Tag mode

Tag mode proposes semantic connections rather than unrestricted vocabulary. A WordNet concept is
eligible only when it belongs to the resolved item's taxonomy branch or is already used by an item,
command, condition, effect, event, or behavior requirement in the current world. Vocabulary from an
unrelated taxonomy branch cannot corroborate a suggestion. Equivalent WordNet spellings share one
concept and collapse to the taxonomy's canonical tag.

Real item capabilities are represented by their schemas. For example, an apple's fruit and food
concepts can support a `takeable` recommendation. Accepting that recommendation adds a complete
Takeable behavior with schema defaults; it does not add a decorative text tag that only looks like a
capability. Each recommendation explains both its general effect and the concrete world records it
would connect to. Capability changes also carry an explicit warning and use **Enable** instead of
**Add**.

Canonical capability tags and behaviors are one authoring state shown in two places. Enabling a
behavior exposes its tag in Details; entering that exact tag creates the behavior with schema
defaults; removing either removes the other. Canonical capability tags are not duplicated in the
stored freeform tag list. Classification tags such as `food` can support a recommendation but never
enable a behavior by themselves.

## Data and execution boundaries

- The browser sends only the item's bounded name, aliases, tags, and resolved icon category to the
  authenticated editor endpoint.
- The server reads the WordNet noun index and noun data supplied by `wordnet-db`. The index, record
  reads, and completed lookups are cached for the server process.
- Word sense ranking uses authored tags and the maintained icon category as context. The browser
  then grounds results in that category's lineage and combines direct name terms and lineage terms
  with schema discovery metadata for behavior recommendations. Equal inputs and vocabulary versions
  always produce equal output.
- The browser combines lexical candidates with a world tag graph. This keeps private world
  connections out of the lexical request.
- Collision and connection indexes are built when the panel opens, not while a closed editor renders
  or on every keystroke. The current item is excluded from the connection index.
- While the panel remains open, a short debounce reruns the bounded lexical request whenever the
  item name, aliases, effective tags, or behaviors change. Stale requests are cancelled and stale
  results are not shown.

## Shared editing control

The dedicated item page and every schema-driven alias/tag list use `TokenListEditor`. The shared
control owns chip layout, keyboard entry, comma handling, duplicate prevention, removal, suggestion
buttons, readonly state, and narrow-width behavior. Domain-specific suggesters supply candidates and
approval actions without creating a second list editor.
