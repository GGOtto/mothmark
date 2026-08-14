# Mothmark design system

Mothmark uses a quiet archival-workbench visual language: warm paper and ink work surfaces inside a
compact, neutral application shell. The interface should feel deliberate and tool-like without
becoming severe, decorative, or theatrical.

This document is the source of truth for production colors and their roles. The canonical CSS
tokens live in `src/app/globals.css`.

## Theme palette

### Dark

| Token                     | Value     | Role                                   |
| ------------------------- | --------- | -------------------------------------- |
| `--color-canvas`          | `#11100e` | Page canvas                            |
| `--color-workspace`       | `#151411` | Editor workspace                       |
| `--color-surface`         | `#1b1915` | Panels and neutral navigation          |
| `--color-surface-raised`  | `#24211c` | Inputs, popovers, and raised controls  |
| `--color-surface-strong`  | `#2e2a23` | Hover and pressed surfaces             |
| `--color-border`          | `#3a352c` | Normal divisions                       |
| `--color-border-strong`   | `#746a58` | Emphasized boundaries                  |
| `--color-control-border`  | `#746a58` | Required control boundaries            |
| `--color-text`            | `#f0e9da` | Primary text                           |
| `--color-text-muted`      | `#b6ac99` | Supporting text                        |
| `--color-text-faint`      | `#8c8272` | IDs and passive metadata               |
| `--color-frame`           | `#090909` | Header and activity rail               |
| `--color-frame-raised`    | `#161616` | Controls inside the frame              |
| `--color-frame-strong`    | `#242424` | Frame hover and pressed states         |
| `--color-frame-border`    | `#414141` | Frame divisions                        |
| `--color-frame-text`      | `#f7f7f5` | Primary frame text                     |
| `--color-frame-muted`     | `#c5c5c1` | Supporting frame text                  |
| `--color-action`          | `#8fb8ce` | Primary actions and active navigation  |
| `--color-action-hover`    | `#a5cade` | Primary-action hover                   |
| `--color-action-contrast` | `#10202a` | Text on action-colored surfaces        |
| `--color-focus`           | `#c7a96a` | Keyboard focus and rare brand emphasis |

### Light

| Token                     | Value     | Role                                   |
| ------------------------- | --------- | -------------------------------------- |
| `--color-canvas`          | `#e8dfd0` | Page canvas                            |
| `--color-workspace`       | `#d8cdbc` | Editor workspace                       |
| `--color-surface`         | `#f6eee0` | Panels and neutral navigation          |
| `--color-surface-raised`  | `#fffaf0` | Inputs, popovers, and raised controls  |
| `--color-surface-strong`  | `#e1d4c1` | Hover and pressed surfaces             |
| `--color-border`          | `#b7a992` | Normal divisions                       |
| `--color-border-strong`   | `#766a58` | Emphasized boundaries                  |
| `--color-control-border`  | `#968671` | Required control boundaries            |
| `--color-text`            | `#211e19` | Primary text                           |
| `--color-text-muted`      | `#5c5347` | Supporting text                        |
| `--color-text-faint`      | `#756a5a` | IDs and passive metadata               |
| `--color-frame`           | `#ede4d5` | Header and activity rail               |
| `--color-frame-raised`    | `#f6eee0` | Controls inside the frame              |
| `--color-frame-strong`    | `#ddd0bd` | Frame hover and pressed states         |
| `--color-frame-border`    | `#b7a992` | Frame divisions                        |
| `--color-frame-text`      | `#211e19` | Primary frame text                     |
| `--color-frame-muted`     | `#62594d` | Supporting frame text                  |
| `--color-action`          | `#285a75` | Primary actions and active navigation  |
| `--color-action-hover`    | `#1f4961` | Primary-action hover                   |
| `--color-action-contrast` | `#fff9ee` | Text on action-colored surfaces        |
| `--color-focus`           | `#80601f` | Keyboard focus and rare brand emphasis |

Normal and muted text pairs meet WCAG AA contrast in both themes. Do not lower their contrast with
opacity in production components.

## Semantic colors

| Role        | Dark             | Light            |
| ----------- | ---------------- | ---------------- |
| Success     | `#75b894`        | `#2f7250`        |
| Warning     | `#d7ad62`        | `#7d5b17`        |
| Danger      | `#e07b6c`        | `#a33b30`        |
| Information | `--color-action` | `--color-action` |

Blue means interactive. Brass means focus or rare identity emphasis. Status colors communicate
status only. Do not introduce a second primary-action color.

### Command block colors

Command summaries and compact builder blocks use a small, consistent type palette. Apply these
colors to text, icons, and subtle borders rather than filling the complete control.

| Block type           | Token                       | Dark              | Light             |
| -------------------- | --------------------------- | ----------------- | ----------------- |
| Phrase and relation  | `--color-command-structure` | `--color-warning` | `--color-warning` |
| Target               | `--color-command-target`    | `--color-danger`  | `--color-danger`  |
| Number and direction | `--color-command-number`    | `--color-action`  | `--color-action`  |
| Choice and boolean   | `--color-command-choice`    | `--color-success` | `--color-success` |
| Text                 | `--color-command-text`      | `#a99ac4`         | `#665782`         |

## Surface hierarchy

Use the smallest surface change that communicates hierarchy:

1. Canvas
2. Workspace
3. Surface
4. Raised control or floating surface
5. Strong hover or pressed surface

The 48px header and activity rail use the same neutral frame family. This gives global navigation
and editor modes one coherent shell without drawing a saturated band around the work. Preserve the
rail's established button geometry, compact label typography, and label-reveal interaction; color
alone communicates the active state through its small blue indicator and icon. The right property
inspector, toolbars, forms, and dialogs use the ordinary surface family.

## Focused document workspaces

The item page establishes Mothmark's focused document-workspace pattern. Apply this pattern to other
important entity editors when authors need sustained room to work on one object. It is a compact
workbench, not a dashboard, settings card, or enlarged property inspector.

Use a purpose-built document workspace when all of the following are true:

- the object is a primary authoring destination rather than a secondary property;
- its fields form a small number of stable author tasks that deserve explicit grouping;
- desktop and phone layouts materially improve when the form is composed by hand; and
- specialized work can be handed to an existing focused workspace instead of embedded recursively.

Continue using the schema-driven universal editor for generic coverage, rapidly changing schemas,
administrative inspection, and secondary surfaces where a custom composition would only restyle the
same field sequence. A purpose-built form must still use the production schemas for validation,
defaults, and data shapes. Do not create a second business-model catalog in the view.

### Workspace anatomy

| Region           | Purpose                                                                      | Visual treatment                                                              |
| ---------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Context bar      | Back navigation, 32px entity mark, title, compact state, and primary actions | One 54px neutral row with a bottom rule; no page introduction above it        |
| Task tabs        | Switch between distinct author intents                                       | One 40–42px row; neutral inactive tabs and one action-blue selected underline |
| Document body    | Holds the active task only                                                   | Uses the full remaining canvas and is the only vertical scroller              |
| Optional utility | Play, preview, or another separate mode                                      | Collapsed or absent by default; opened explicitly from the context bar        |

The context bar and tabs are pinned together. Scrolling content must never carry them away. Avoid a
second title bar, repeated breadcrumb, descriptive page banner, or permanently reserved utility strip
when the context bar already provides the same control.

The context bar is deliberately dense:

- keep the entity mark at 32px and use it as identification, not decoration;
- keep the title on one line at approximately 17px on desktop and 15px on phones;
- place location, state, or type beside or immediately beneath the title in 11–12px muted text;
- expose one frequent action, such as Play, directly;
- show the sole destructive action as a labeled danger button when it fits; use overflow only when
  several genuinely secondary actions need it; and
- truncate metadata before truncating the entity name.

### Tabs and information architecture

Tabs represent author tasks, not schema nesting. Each tab should answer one clear question—for
example, what the object is, what it can do, where it begins, or what custom logic refers to it.

- Keep one tab row at every supported width. Do not wrap tabs or replace them with a dropdown.
- Use short visible labels on phones while preserving the full accessible name.
- Show one task panel at a time. Do not repeat the entity header within each panel.
- Use correct `tablist`, `tab`, and `tabpanel` semantics and support Left, Right, Home, and End keys.
- Use action blue, surface change, and an underline together for selection. Never rely on a faint
  text-color change alone.
- Keep inactive tab text at normal-text contrast: at least 4.5:1 in both themes.

### Desktop composition

Use the available canvas. Do not center the document in a generic narrow card.

- Arrange compatible tasks into two intentional columns when the container is wider than 720px.
- Use unequal columns when one task contains long text and the other contains compact identity
  fields; equal-width columns are not a default.
- Separate columns with 24px spacing and, when useful, one passive vertical rule.
- Keep sections continuous on the canvas. Do not wrap each section or field in its own card.
- Constrain width only for genuinely short tasks such as placement or a command-reference list.

### Phone composition

At 720px and below, stack columns in reading order and replace the vertical division with one
horizontal rule. At 520px and below, use the compact context bar, four equal tab columns, and roughly
13–14px document padding.

The focused document owns the phone viewport. Hide redundant global navigation and do not reserve a
collapsed bottom utility region. An explicit context-bar action may open that utility temporarily;
closing it returns the full canvas to editing. Forms must not introduce horizontal scrolling, and
multi-column field groups must collapse to one column unless every control remains comfortably usable.

### Form language

The form should read as a document with controls embedded in it.

- Use a 17px sentence-case section heading and a small 4px × 18px identity marker. Brass may mark
  identity; action blue may mark player-facing text or the primary task. These are small cues, not
  colored panels or repeated edge rails.
- Use 12px semibold labels above 40px controls. Textareas begin around 82px high and remain vertically
  resizable.
- Use one visible `--color-control-border` around inputs and `--color-surface-raised` inside them.
  Focus changes the border to action blue and adds a clear focus outline.
- Keep aliases, tags, and other short repeatable values inside a single wrapping field. Individual
  values may use restrained outlines or subtle 8–12% token tints; never turn the form into a field of
  colorful pills.
- Present simple booleans as aligned labeled toggles. Present repeated state such as flags as compact
  ruled rows rather than cards.
- Present a small set of mutually compatible capabilities as selectable tiles, then reveal the
  selected capability's settings in restrained disclosures below. A tile describes and selects; it
  is not a decorative summary card.
- Collapse internal identifiers and rarely changed details behind a disclosure. Keep common authored
  text visible.
- Summarize complex condition and effect groups in compact ruled rows with an Add or Edit action.
  Open the dedicated Logic workspace for the actual edit instead of nesting a second editor in the
  document.
- Keep short help behind an accessible information control. A floating explanation on desktop should
  become inline content on phones.

### Color and theme behavior

Focused workspaces use only semantic tokens. The light and dark themes share identical geometry,
spacing, typography, and meaning.

- Neutral surface differences establish the shell, tab rail, body, and controls.
- Action blue identifies interaction and active navigation.
- Brass identifies focus and occasional authored identity.
- Danger color appears only on destructive actions and their confirmations.
- Small translucent mixes may tint selection or tags, but large regions stay neutral.
- Do not add gradients, glow, ornamental textures, or broad monochrome color washes.

Check normal text, muted metadata, inactive tabs, input borders, selected controls, and keyboard focus
independently in both themes. A readable dark theme is not evidence that light mode is readable.

### Adoption checklist

Before applying this pattern to another editor, verify that:

- the selector and document remain separate destinations with stable URL context;
- the context bar replaces redundant page chrome instead of adding another layer;
- every task tab is reachable without scrolling horizontally at 390px;
- only the document body scrolls;
- the primary fields are visible without opening cards or nested accordions;
- advanced work has an explicit focused destination and a reliable return path;
- the utility region consumes no phone space until opened;
- labels, focus, selection, and boundaries are visible in light and dark mode; and
- the layout has been inspected around 1280 × 720, 720px container width, and 390 × 844.

The current reference implementation is `src/components/studio/ItemWorkspace.tsx`,
`src/components/studio/ItemWorkspaceForm.tsx`, and `src/components/studio/ItemWorkspace.scss`. Treat
the visual roles and responsive behavior as the contract; do not reuse item-specific class names for
unrelated entities. When a second document workspace adopts the pattern, extract only the genuinely
shared shell, tab, section-heading, and control primitives. Keep each entity's task composition local.

## Map palette

The map remains a distinct authored canvas and currently uses the warm light drafting-paper palette
in both application themes. Keep the charcoal dark palette defined for possible future use, but do
not select it from the application theme. Geometry and color meanings stay stable; floating map
controls continue to follow the application surface tokens.

| Map role                | Dark                | Light               |
| ----------------------- | ------------------- | ------------------- |
| Canvas                  | `#25272c`           | `#a79c86`           |
| Grid                    | warm white at `10%` | ink violet at `16%` |
| Connection              | `#8a8392`           | `#514959`           |
| Room                    | `#3b3b40`           | `#eee3ca`           |
| Room hover              | `#47484f`           | `#faf0d8`           |
| Room selected           | `#274b43`           | `#c9e4d8`           |
| Room border             | `#8d8795`           | `#5d5564`           |
| Room text               | `#f2eadb`           | `#28222d`           |
| Node                    | `#eee3cc`           | `#fff8e8`           |
| Selection accent        | `#69c2a6`           | `#287f6a`           |
| Strong selection accent | `#9bdcc7`           | `#185847`           |

Floating map controls are application tools and use the current semantic application tokens.

## Player terminal

The embedded player is a real command-line surface, not another form panel. It follows the theme
but keeps its own terminal surface family. Its identity comes from monospace output, a visible
prompt, dense uninterrupted text flow, and a quiet terminal toolbar—not from forcing a black box
into light mode. Do not replace output with cards or chat bubbles.

| Terminal role | Dark      | Light     |
| ------------- | --------- | --------- |
| Canvas        | `#0f0e0c` | `#f3eee5` |
| Raised        | `#191713` | `#e5ddd1` |
| Border        | `#746a58` | `#887968` |
| Text          | `#ede5d7` | `#202622` |
| Muted         | `#a69c8b` | `#5c675f` |
| Prompt        | `#d2aa63` | `#765719` |
| Danger        | `#ef8377` | `#9f3934` |

## Component rules

- Use a 4px radius for controls, 6px for panels and popovers, and 8px for dialogs.
- Prefer one border around a control. Avoid attached boxes inside boxes.
- Use `--color-border` for passive divisions and `--color-control-border` where a boundary is needed
  to identify or operate a control. The latter maintains at least 3:1 contrast against its control
  surface.
- Use neutral surface changes for hover, action blue for selection, and brass for keyboard focus.
- Use shadows only for floating popovers and dialogs. Do not add glow effects.
- Use sentence case. Uppercase is reserved for the compact Mothmark wordmark and rare status marks.
- Establish hierarchy with spacing, tone, and weight before increasing font size.
- Use the `4 / 8 / 12 / 16 / 24 / 32` spacing rhythm.
- Entity colors are data markers. Restrict them to icons, small markers, badge outlines, and subtle
  selection tints.

## Allowed palette exceptions

Hard-coded component colors are allowed only for:

- the theme-specific authored map palettes in `Map.scss`;
- the ordered entity marker palette in `entityPickerColors.ts`;
- deliberately bounded theme previews such as parchment, blueprint, and terminal controls.

Everything else must use semantic tokens. The legacy `--chrome-*`, `--panel-*`, and `--field-*`
variables are compatibility aliases during migration and should not be extended with new roles.

## Light and dark behavior

Theme switching changes application surfaces and the authored map treatment, not geometry or
semantic meaning. The shell, map, and player each use a coordinated light or dark surface family.
The same action, status, selection, and focus roles must remain recognizable in both themes. Never
implement light mode as a CSS filter or a simple inversion.

## Pattern references

- [Carbon UI shell](https://carbondesignsystem.com/components/UI-shell-header/style/) for a compact,
  theme-aware shell, sentence-case labels, subtle divisions, and explicit hover, focus, and selected
  states.
- [Visual Studio Code theme colors](https://code.visualstudio.com/api/references/theme-color) for
  treating the activity rail, sidebars, editor canvas, and panel as distinct semantic workbench
  roles inside one theme.
- [Material color roles](https://developer.android.com/design/ui/wear/guides/styles/color/roles-tokens)
  for mapping components to a small set of neutral surface and foreground pairs.
- [WCAG non-text contrast](https://w3c.github.io/wcag/understanding/non-text-contrast) for the 3:1
  minimum used for necessary control and state boundaries. Normal-size text targets at least 4.5:1.
