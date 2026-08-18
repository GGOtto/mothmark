# Third-party lexical data

Mothmark's item suggester uses two server-only lexical resources. Neither resource is sent to the
browser, and production requests do not call either source over the network.

## English Wiktionary alias snapshot

`src/features/item-suggestions/generated/wiktionaryAliases.json` is adapted from English
Wiktionary. English Wiktionary text is available under the Creative Commons
Attribution-ShareAlike 4.0 International license and the GNU Free Documentation License; Mothmark
uses it under CC BY-SA 4.0.

- Source: https://en.wiktionary.org/
- Copyright: English Wiktionary contributors
- License: https://creativecommons.org/licenses/by-sa/4.0/
- Source revisions: recorded per queried term in the generated file
- Changes: English noun relations are extracted, normalized, filtered for unsafe senses, grounded
  in Mothmark's maintained item taxonomy, deduplicated, and reduced to a compact alias index. No
  definitions, quotations, or examples are redistributed.

The generated alias snapshot is distributed under CC BY-SA 4.0. Run `pnpm lexicon:update` to create
a reviewed new snapshot. Normal builds use the committed snapshot and make no live Wiktionary
requests.

## Princeton WordNet

The server reads the noun data supplied by the pinned `wordnet-db` package. WordNet supplies noun
senses, synonym sets, and semantic parent relationships used by the existing tag suggester. See the
WordNet license distributed with `wordnet-db` for its terms and attribution.
