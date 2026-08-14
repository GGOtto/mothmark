# Item icon matching resolver

The corroborating item-icon resolver is implemented in [`src/itemIcons`](../src/itemIcons). It is
used by the item selector and dedicated item workspace while remaining isolated from React and the
persisted Item schema.

## Boundary

The public entry point accepts a narrow value:

```ts
type ItemIconInput = {
  name?: string | null;
  aliases?: readonly string[] | null;
  tags?: readonly string[] | null;
  iconCategory?: string | null;
};
```

`iconCategory` is the preferred future manual override. A valid `icon:<category>` tag remains a
compatibility override. Invalid and conflicting overrides are reported as warnings; an invalid
override does not prevent automatic matching.

The result contains:

- the selected one of 100 category IDs;
- whether it was an override, corroborated match, single-field match, or Generic fallback;
- at most one evidence record from each of Name, Aliases, and Tags;
- ordered alternative candidates for inspection;
- invalid or conflicting override warnings.

The automatic result is derived rather than persisted. A future icon chooser should store only a
deliberate manual override.

## Evidence model

Name, Aliases, and Tags are three independent evidence fields. A category receives at most one unit
of support from each field, even if an alias or tag is repeated many times. The values inside one
field are evidence, not votes.

For example:

```text
Name:    rope toy
Aliases: toy, rope
Tags:    toy
```

Toy and game is supported by all three fields. Rope is supported by Name and Aliases. Toy and game
wins three fields to two.

Terms have three roles:

- Identity terms name a physical object, such as `cleaver`, `spellbook`, or `rope toy`.
- Category terms name a legitimate broad family, such as `weapon` or `illumination`.
- Descriptor terms, such as `royal`, `precious`, or `magical`, may corroborate an existing candidate
  but never create one.

Known behavior and state tags such as `takeable`, `openable`, `surface`, and `goal-item` are removed
before matching. They do not select or corroborate an icon.

## Category relationships

Specific categories declare one or more parents. Parent evidence can corroborate a child only after
a direct child term has discovered that candidate. Parent evidence cannot invent a child.

Examples:

- `spellbook` discovers Spellbook; `book` and `magic` in other fields corroborate it.
- `knife` discovers Knife; `weapon` in another field corroborates it.
- `coin` discovers Coin; `treasure` in another field corroborates it.
- `book` and `magic` without a Spellbook term do not produce Spellbook.

Spellbook has both Book and Magic as parents. Egg and nest has both Food and Fauna as parents.

## Candidate ordering

After a valid override check, candidates are ordered by:

1. Number of independent supporting fields.
2. Longest matched whole phrase.
3. Combined directness and term-role strength.
4. Strongest contributing source, with Name before Aliases before Tags.
5. Number of fields containing direct rather than inherited evidence.
6. Child over parent when the tied categories are related.
7. Stable order in the 100-category catalog.

The resolver normalizes case, accents, punctuation, spaces, underscores, and hyphens. It matches
whole words and phrases only. `bookend` does not match `book`; `morning-star` matches `morning star`.

## Folded vocabulary

Removed standalone categories remain available as terms on the surviving category:

- Polearm terms select Weapon.
- Candle terms select Light.
- Scroll terms select Document.
- Corpse terms select Remains.
- Relic, idol, and ritual terms select Shrine and altar.
- Gem terms select Treasure.
- Rune terms select Magic.

## Test contract

[`resolveItemIcon.test.ts`](../src/itemIcons/resolveItemIcon.test.ts) covers:

- corroboration across every combination of Name, Aliases, and Tags;
- repeated and reordered aliases and tags;
- child and multi-parent corroboration;
- descriptor and behavior suppression;
- valid, invalid, empty, repeated, and conflicting overrides;
- whole-phrase normalization and substring rejection;
- folded vocabulary and deliberately ambiguous object phrases;
- automatic reachability of every non-Generic category from every evidence field;
- the one-evidence-record-per-field invariant;
- exactly 100 unique category IDs, valid parents, no parent cycles, and no duplicate or empty terms
  within a category.

The production item surfaces use this resolver through the shared `ItemIcon` component. Changes to
the vocabulary or ranking should retain the resolver, component, and browser coverage described
above.
