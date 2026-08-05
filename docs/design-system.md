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
| `--color-frame`           | `#171612` | Header and activity rail               |
| `--color-frame-raised`    | `#211f1a` | Controls inside the frame              |
| `--color-frame-strong`    | `#2b2821` | Frame hover and pressed states         |
| `--color-frame-border`    | `#383329` | Frame divisions                        |
| `--color-frame-text`      | `#f0e9da` | Primary frame text                     |
| `--color-frame-muted`     | `#b6ac99` | Supporting frame text                  |
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

## Map palette

The map changes with the application theme, but remains a distinct authored canvas in both. It is
not a recolored app panel: the light map resembles warm drafting paper and the dark map resembles a
charcoal drafting board. Geometry and color meanings stay stable across themes.

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
