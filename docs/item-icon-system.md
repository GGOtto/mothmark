# Item icon system

Mothmark uses a maintained set of 100 Hugeicons marks for item identity.

## Sources of truth

- [`src/itemIcons/itemIconCatalog.ts`](../src/itemIcons/itemIconCatalog.ts) defines the category
  hierarchy and the name, alias, and tag vocabulary.
- [`src/itemIcons/resolveItemIcon.ts`](../src/itemIcons/resolveItemIcon.ts) resolves an item from that
  vocabulary.
- [`src/itemIcons/itemIconLibrary.ts`](../src/itemIcons/itemIconLibrary.ts) maps every category to one
  official Hugeicons mark.
- [`src/itemIcons/ItemIcon.tsx`](../src/itemIcons/ItemIcon.tsx) is the shared renderer.
- [`/test/item-icons`](../src/app/test/item-icons/page.tsx) shows all official marks at 64px and 128px
  and provides at least three swappable library choices for each category.

## Visual contract

- Use Hugeicons Stroke Rounded marks at a `0.75` stroke width.
- Render the same vector geometry at 32px, 64px, and 128px. Do not add or remove detail by size.
- Inherit the surrounding semantic text color. Do not maintain light and dark artwork copies.
- Keep item names visible and accessible; the icon is a reusable category cue, not authored item
  imagery.
- Prefer adventurous, physical object symbols where the library provides them, without ornamental
  RPG framing or realistic material rendering.

## Selection contract

An explicit `icon:<category>` tag is a compatibility override. Automatic selection treats Name,
Aliases, and Tags as three independent evidence fields. Each field contributes at most one support
unit to a candidate, so repeated aliases or tags cannot overwhelm corroboration from the other
fields.

Specific physical identities discover specific categories. Broad parent terms may corroborate a
specific category after it has been discovered, but cannot invent one. Descriptive words can only
corroborate. Behavior and state tags such as `takeable`, `openable`, `surface`, and `goal-item` do
not participate. Unmatched items use Generic.

The detailed ranking rules and examples are in
[`item-icon-matching-resolver.md`](./item-icon-matching-resolver.md).

## Folded vocabulary

Categories that lacked a distinct library mark were folded into a stronger surviving category:

- polearm → Weapon
- candle → Light
- scroll → Document
- corpse → Remains
- relic, idol, and ritual implement → Shrine and altar
- gem → Treasure
- rune → Magic

Their terms remain recognized by the resolver. The freed positions are occupied by Knife, Chain and
link, Explosive, Fishing tool, Regalia, Egg and nest, Bell and chime, Flag and sign, and Thread and
sewing, keeping the catalog at 100 distinct official marks.

## Production integration

The item selector and dedicated item workspace both call `resolveItemIcon(item)` and render the
result with `ItemIcon`. The resolver remains separate from React and from the persisted item schema,
so automatic selections stay derived and deterministic. A future explicit chooser should persist
only a deliberate override.

## Coverage

Resolver tests cover field corroboration, hierarchy, folded vocabulary, normalization, invalid and
conflicting overrides, and automatic reachability of all categories. Component tests verify that the
item selector and workspace render the resolved official library marks. Browser coverage checks the
primary icon sizes and the full 100-mark review gallery.
