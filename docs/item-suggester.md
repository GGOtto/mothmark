# Item suggester

The item suggester is deterministic, AI-free, and split into two author-facing modes.

## Alias mode

Alias mode proposes player wording from the item name, existing aliases, WordNet 3.1, and a compact
generated snapshot of English Wiktionary noun relationships. It may offer a source-backed direct
synonym, a taxonomy-corroborated generic player noun, or a useful object phrase from a longer name,
but it does not turn broad classification terms into player aliases. Before display, candidates are
normalized and checked against every other item's name and aliases. Head-word collisions are also
indexed, so an `Apple` alias is not offered when another item is named `Green Apple`.

Ordinary authored phrases also yield their trailing object phrases, up to three words. For example,
`The old grandfather clock` yields `grandfather clock` and `clock`; a longer ornamental name does
not produce every possible word combination. In phrases such as `map of the northern coast` and
`rope with an iron hook`, extraction stops at the connector so the subject or attached component is
not mistaken for the item. The resolved taxonomy handles quantity constructions such as `coil of
rope`. Compound-object recognition still allows `The enormous striped watermelon` to yield `melon`.
When a verified alternate noun is available, the same phrase logic may retain a nearby identifying
modifier, so `leather satchel` can also yield `leather bag` and `parchment map` can yield
`parchment chart`. Only taxonomy-corroborated or direct-definition nouns are recombined.
Every accepted noun phrase also contributes its ordinary singular or plural player form, including
irregular pairs such as `knife`/`knives`. Inflection follows the resolved object phrase, so a map of
the coast yields `maps`, never `coasts`. Atomic taxonomy compounds such as `baseball bat` keep their
meaning and are not rewritten into combinations such as `baseball club`.

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

Behavior recommendations can narrow a multi-action capability to the actions supported by the
resolved taxonomy. For example, footwear recommends Wear and Remove rather than also enabling Wield,
while a bell recommends Ring. The recommendation explains the player commands it will enable, and
the author still performs the one explicit Enable action before any behavior changes.

## Data and execution boundaries

- The browser sends only the item's bounded name, aliases, tags, and resolved icon category to the
  authenticated editor endpoint.
- The server reads the WordNet noun index and noun data supplied by `wordnet-db`. The index, record
  reads, and completed lookups are cached for the server process. WordNet continues to own noun
  sense selection and semantic parents for tag suggestions.
- The server also reads the committed Wiktionary alias snapshot. `pnpm lexicon:update` queries the
  maintained item-taxonomy terms, records every source page revision, filters to safe English noun
  relationships, and emits a deterministic versioned index. Production builds and requests never
  call Wiktionary. Attribution and licensing are recorded in `docs/third-party-lexical-data.md` and
  in the generated file itself.
- Explicit Wiktionary synonyms are admitted only through a canonical endpoint in the maintained
  taxonomy. A broader definition reference additionally requires the selected WordNet sense and the
  resolved item-taxonomy branch to corroborate one another. Every edge remains directional.
- WordNet uses the full taxonomy lineage to choose a noun sense. Once a sense is corroborated, all
  of that sense's established spellings remain eligible; when it is not, only spellings explicitly
  present in the branch remain eligible. This preserves useful alternatives while keeping obscure
  alternate senses such as `baseball bat → lumber` out of player wording.
- Concrete nouns from the first two parents of the selected WordNet sense may become aliases after
  an independent taxonomy check. This supplies general player nouns such as `case`, `box`, and
  `lamp`, while a maintained broad-concept block keeps classifications such as `container`,
  `furniture`, and `weapon system` in tag mode.
- Expanded phrase lookup is reserved for aliases. WordNet tag lookup keeps a compact per-authored-
  name budget, so descriptive phrases cannot crowd later authored aliases out of semantic tagging.
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

The generated snapshot is data, not an author-maintained synonym catalog. Do not edit its edges by
hand. Change the general extractor or taxonomy policy, add a regression example, and generate a new
reviewable source-version digest instead.

## Shared editing control

The dedicated item page and every schema-driven alias/tag list use `TokenListEditor`. The shared
control owns chip layout, keyboard entry, comma handling, duplicate prevention, removal, suggestion
buttons, readonly state, and narrow-width behavior. Domain-specific suggesters supply candidates and
approval actions without creating a second list editor.
