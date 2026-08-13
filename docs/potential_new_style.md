# Potential new visual style

Status: exploratory visual direction. This document records design decisions and promising mockups;
it does not authorize or specify implementation.

Last reviewed: 2026-08-09.

## The central idea

Mothmark should feel like a quiet archive workbench for building and entering interactive worlds.
The website is the application: authoring, browsing, and play should appear as real product surfaces,
not as promotional illustrations for software that exists somewhere else.

The strongest expression of this direction is the homepage mockup's map-and-player workspace. It
combines a charcoal drafting map, restrained room geometry, a compact authoring frame, and the
monospace player terminal in one continuous web surface. It immediately communicates the relationship
between building a world and playing it without adding a marketing diagram or explanatory feature
cards.

![Potential home style](mockups/home.png)

## Visual character

The style is dark, warm, and tool-like without becoming severe or theatrical:

- a deep charcoal-brown canvas rather than pure black;
- warm off-white text and muted archival metadata;
- thin warm-neutral divisions and control borders;
- pale action blue used only for interactive controls and selected navigation;
- brass reserved for focus, drafting geometry, official editorial identity, and other rare emphasis;
- flat semantic surfaces with hierarchy created through tone, rules, and spacing;
- compact editorial typography with sentence-case labels; and
- generous open canvas around purposeful content rather than a collection of enclosing cards.

This direction is an extension of `docs/design-system.md`, not a replacement palette. The mockups use
the existing dark semantic roles as their visual basis: canvas `#11100e`, frame `#171612`, surface
`#1b1915`, raised controls `#24211c`, primary text `#f0e9da`, muted text `#b6ac99`, action blue
`#8fb8ce`, and focus brass `#c7a96a`.

## The map as product identity

The authored map should carry much of Mothmark's visual identity because it is both real product UI
and a recognizable representation of a world.

In the homepage treatment:

- the map resembles a charcoal drafting board with a subtle measured grid;
- room nodes use warm, fine geometry instead of colorful dashboard blocks;
- connections remain quiet enough that the authored structure is legible at a glance;
- selection and focus can use the existing semantic map accents;
- the editor frame stays compact, with small mode controls and factual status;
- the terminal remains a dense, uninterrupted monospace surface; and
- map and terminal appear side by side so creation and play read as one system.

This map treatment must remain real enough to set accurate expectations. Homepage and explanatory
previews may simplify labels or use explicit editorial stubs, but should not invent world lore,
capabilities, or generated-sounding example prose.

## Application shell

Use one compact, neutral shell family across public pages, account entry, libraries, and the editor:

- approximately 48px tall;
- small `MOTHMARK` wordmark at the left;
- only the destinations relevant to the current context;
- compact action controls at the right;
- a subtle bottom division rather than a saturated frame; and
- theme-aware surfaces that preserve the same geometry in light mode.

Page-specific titles and tools should be split from global navigation. A slim local header may pin
the title and primary action above independently scrolling content. Search should not automatically
become a wide persistent field: on the published catalog it is a small magnifying-glass button that
opens a focused dropdown.

## Page canvas and hierarchy

The default composition is a broad page canvas, not a narrow centered card.

- Keep short forms at a readable control width without wrapping them in a generic card.
- Keep long prose at a readable line length while allowing its page shell to use the viewport.
- Use subtle horizontal rules and column alignment before introducing another panel.
- Use substantial content-led cards for actual worlds, not for every explanation or setting.
- Keep all primary destinations and actions at the top of a page; the page itself may continue to
  scroll.
- When a collection grows, pin its compact title and controls and scroll the collection beneath.

## World presentation

Private worlds and published worlds have related but different visual jobs.

### Private library

The private library is a restrained working scrapbook. A world appears as a folio of its authored
map layers rather than a single arbitrary thumbnail. Up to three map sheets overlap in the resting
state; the starting layer is in front and the remaining count is factual. Hover or keyboard focus
may spread the sheets slightly and reveal layer names.

![World library style](mockups/world-library.png)

The metaphor comes from the real map material and movement. Do not add fake tape, stains, stickers,
handwritten fonts, large random rotations, or other literal scrapbook decoration.

### Published catalog

The public catalog is the primary route into play. It distinguishes administrator-promoted
`Official worlds` from `Community worlds`, gives every world an immediate Play action, and relies on
author-supplied catalog fields rather than map spoilers or filler descriptions.

![Published-world catalog style](mockups/published-worlds.png)

Official status uses a small brass editorial mark, not a promotional ribbon or recommendation score.
World covers may express individual identity, but the surrounding catalog remains calm and
consistent.

## Item presentation

Items use a two-surface flow: a full-workspace object selector followed by a dedicated, vertically
flowing item page. The selector should borrow the tactile act of pulling a tag from an archive rack,
but item names remain horizontal and consistently visible. The item page is an authoring document,
not a right-inspector form or a grid of settings cards.

Mothmark does not require or infer bespoke item illustrations. Instead, a maintained library of 20
flat, stylized category SVGs may be selected from author-supplied tags. The agreed subjects are
Generic, Structure, Door, Furniture, Container, Mechanism, Tool, Key, Weapon, Wearable, Light,
Document, Food, Nature, Remains, Art, Relic, Treasure, Music, and Magic. Generic is the fallback.
Exact tag mappings and conflict behavior are recorded in
`docs/constrained-card-page-audit.md`.

The category marks should feel drawn and graphic rather than metallic, realistic, or like RPG
inventory art. They communicate broad author-chosen presentation only; item names remain the primary
identity and the marks never affect gameplay targeting.

![Flat horizontal item tags](mockups/items-flat-tag-svgs-v7.png)

![Color-block item charms](mockups/items-color-block-charms-v7.png)

## Account and form surfaces

Account information should read like a clear ownership ledger: who holds the worlds, under what
conditions, and which operations are available. Record fields, data actions, and account deletion
are separated with alignment and rules rather than equal dashboard cards.

![Account style](mockups/account.png)

Account-entry forms are an intentional compact-width exception. They sit directly on the open
canvas beneath a dedicated account bar. The most useful alternate path is visible in that bar; on
Sign in, `Create an account` is a prominent compact action rather than a quiet text link.

![Sign-in style](mockups/sign-in.png)

![Registration style](mockups/register.png)

Do not add an illustration panel, feature list, testimonial, security slogan, or other content merely
to occupy the remaining canvas.

## Motion

Motion should make the interface feel responsive and tactile without becoming a spectacle:

- use short transitions, generally around 150–250ms;
- move selected surfaces only a few pixels;
- use layer spreading and shared-surface expansion only when they explain structure;
- never autoplay card stacks, catalog carousels, or decorative ambient animation;
- keep motion behavior equivalent for pointer and keyboard interaction; and
- provide a stable reduced-motion state.

## Copy and content

Visual polish must not conceal missing product content.

- Keep unresolved homepage and catalog language as explicit editorial stubs.
- Use real maintained worlds and factual metadata in product examples.
- Do not invent lore, testimonials, statistics, usage claims, or decorative descriptions.
- Do not add headings merely to make a layout appear more complete.
- Let maps, terminals, world covers, and authored content communicate the product wherever possible.

## What this style avoids

- generic AI-generated dashboards;
- narrow cards floating in otherwise unused canvases;
- gradients, glow, glass effects, and saturated application frames;
- excessive pills, badges, and colored edge rails;
- repeated uppercase eyebrow labels;
- oversized marketing heroes and ornamental slogans;
- feature-card trios, testimonials, and fake statistics;
- literal scrapbook decoration;
- decorative animation that competes with authoring or play; and
- fabricated product or world copy.

## Mockup set

- [Home](mockups/home.png)
- [World library](mockups/world-library.png)
- [Account](mockups/account.png)
- [Published worlds](mockups/published-worlds.png)
- [Sign in](mockups/sign-in.png)
- [Registration](mockups/register.png)
- Rejected Items exploration: [word shelves](mockups/items-word-shelves-v4.png)
- Rejected Items exploration: [name field](mockups/items-name-field-v4.png)
- Rejected item-page exploration: [single authoring document](mockups/item-document-v3.png)
- Rejected Items exploration: [procedural Mothmark tokens](mockups/items-mothmark-tokens-v5.png)
- Retained interaction reference: [archive tag rack](mockups/items-archive-tag-rack-v5.png)
- Items candidate: [object flip-file](mockups/items-flip-file-v5.png)
- Item-page candidate: [Mothmark authoring document](mockups/item-mothmark-document-v4.png)
- Items candidate: [flat horizontal tags with category SVGs](mockups/items-flat-tag-svgs-v7.png)
- Items candidate: [color-block category charms](mockups/items-color-block-charms-v7.png)
- Item category marks: [all retained categories](mockups/item-category-marks-v1.svg)

The mockups are design references, not pixel specifications. Responsive behavior, light-theme
equivalence, accessible focus treatment, reduced motion, and real content states still require
dedicated design and browser review before implementation.
