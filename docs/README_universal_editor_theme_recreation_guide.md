# Universal Editor Theme Recreation Guide

This document describes the visual theme system for the Universal Editor and how to recreate each theme consistently.

The goal is to avoid scattered styling props and make every visual decision predictable. The editor should use one shared appearance model everywhere.

---

## 1. Core Appearance Model

The Universal Editor uses five visual axes:

```ts
export type EditorControlAppearance = {
  theme?: EditorControlTheme;
  scheme?: EditorControlScheme;
  tone?: EditorControlTone;
  chrome?: EditorControlChrome;
  size?: EditorControlSize;
};
```

These axes mean different things and should not be mixed together.

| Axis     | Meaning                                | Examples                                         |
| -------- | -------------------------------------- | ------------------------------------------------ |
| `theme`  | Visual identity / design language      | `mothmark`, `parchment`, `blueprint`             |
| `scheme` | Light or dark version of that identity | `light`, `dark`, `auto`                          |
| `tone`   | Control mood/emphasis                  | `default`, `quiet`, `terminal`, `paper`, `panel` |
| `chrome` | Control shell/framing/layout           | `field`, `card`, `inline`, `compact`, `bare`     |
| `size`   | Control scale                          | `sm`, `md`, `lg`                                 |

Recommended types:

```ts
export type EditorControlTheme =
  "auto" | "mothmark" | "parchment" | "blueprint" | "terminal" | "plain";

export type EditorControlScheme = "auto" | "light" | "dark";

export type EditorControlTone = "default" | "quiet" | "terminal" | "paper" | "panel";

export type EditorControlChrome = "field" | "card" | "inline" | "compact" | "bare";

export type EditorControlSize = "sm" | "md" | "lg";
```

---

## 2. Where Appearance Lives

Appearance should not be scattered across loose fields like `context.theme`, `metadata.tone`, or `metadata.size`.

Use this instead:

```ts
context.appearance;
metadata.appearance;
```

### `context.appearance`

`context.appearance` is the inherited/default appearance for the editor region.

Use it for things that are true of the area where the control is rendered:

```ts
const context = {
  appearance: {
    theme: "mothmark",
    scheme: "dark",
    size: "md",
  },
  mode: "edit",
  getValue,
  setValue,
};
```

Good uses:

- The whole editor uses the Mothmark theme.
- A preview panel uses a dark scheme.
- A dense sidebar uses small controls by default.
- A technical/debug area uses terminal styling by default.

Do not put field-specific labels, transforms, placeholder text, copy buttons, or validation behavior in context.

### `metadata.appearance`

`metadata.appearance` is the per-control override.

Use it when a specific field needs a different presentation:

```ts
const metadata = {
  type: "input",
  title: "Command Alias",
  description: "Short alternate phrase the player can type.",
  placeholder: "look",
  appearance: {
    tone: "terminal",
    chrome: "card",
    size: "sm",
  },
};
```

Good uses:

- A single field should be compact.
- A command field should use `tone: "terminal"`.
- A grouped field should use `chrome: "card"`.
- A dense row should use `chrome: "inline"`.

### Merge order

Resolved appearance should follow this order:

```txt
default appearance < context.appearance < metadata.appearance
```

Recommended default:

```ts
export const DEFAULT_EDITOR_CONTROL_APPEARANCE = {
  theme: "auto",
  scheme: "auto",
  tone: "default",
  chrome: "field",
  size: "md",
};
```

Recommended resolver:

```ts
export function resolveEditorControlAppearance(
  contextAppearance?: EditorControlAppearance,
  metadataAppearance?: EditorControlAppearance,
): ResolvedEditorControlAppearance {
  return {
    ...DEFAULT_EDITOR_CONTROL_APPEARANCE,
    ...contextAppearance,
    ...metadataAppearance,
  };
}
```

---

## 3. Context vs Metadata

### Context

Context describes the environment around the control.

Use context for:

- inherited/default appearance
- editor mode: `create`, `edit`, or `preview`
- reading and writing values by path
- validation services
- entity/flag registries
- editor-level defaults

Example:

```ts
const context = {
  appearance: {
    theme: "mothmark",
    scheme: "dark",
  },
  mode: "edit",
  getValue,
  setValue,
  validatePath,
  registerEntityPicker,
  registerFlagPicker,
};
```

### Metadata

Metadata describes the specific control.

Use metadata for:

- control type
- title and description
- placeholder
- required/disabled/readonly/hidden
- control-specific appearance overrides
- control-specific behavior/features
- control-specific validation hints like `minLength`, `maxLength`, `pattern`
- text transforms like `slug`, `id`, `lowercase`, `uppercase`

Example:

```ts
const metadata = {
  type: "input",
  title: "Room ID",
  description: "Unique room identifier.",
  placeholder: "forest-clearing",
  required: true,
  transform: "id",
  appearance: {
    tone: "default",
    chrome: "field",
    size: "md",
  },
  features: {
    copyButton: true,
    clearButton: true,
    selectOnFocus: true,
  },
};
```

---

## 4. Text Field Features

Appearance controls how a text field looks. Features control how it behaves.

Text field features should live in:

```ts
metadata.features;
```

Recommended feature shape:

```ts
export type TextFieldFeatures = {
  copyButton?: boolean;
  clearButton?: boolean;
  prefix?: string;
  suffix?: string;
  selectOnFocus?: boolean;
};
```

Example:

```ts
const metadata = {
  type: "input",
  title: "Item ID",
  placeholder: "lantern",
  transform: "id",
  features: {
    prefix: "item/",
    suffix: ".json",
    copyButton: true,
    clearButton: true,
    selectOnFocus: true,
  },
};
```

Use features for behavior and small embedded UI around the input. Do not use `tone`, `chrome`, or `theme` to imply behavior.

---

## 5. CSS Class Naming Standard

Use prefixed class names for every visual axis.

Correct:

```scss
.universalField--theme-mothmark {
}
.universalField--scheme-dark {
}
.universalField--tone-terminal {
}
.universalField--chrome-card {
}
.universalField--size-md {
}
```

Avoid ambiguous classes:

```scss
.universalField--terminal {
}
.universalField--card {
}
.universalField--md {
}
```

Why: `terminal` could be a theme or a tone. `card` could be a surface or chrome. Prefixes prevent ambiguity.

---

## 6. Theme Tokens

Each theme should set the same CSS variables.

Recommended token set:

```scss
.universalField {
  --field-font-family: inherit;

  --field-text: currentColor;
  --field-muted: color-mix(in srgb, currentColor 58%, transparent);
  --field-soft: color-mix(in srgb, currentColor 38%, transparent);

  --field-border: color-mix(in srgb, currentColor 20%, transparent);
  --field-border-strong: color-mix(in srgb, currentColor 34%, transparent);

  --field-bg: transparent;
  --field-bg-raised: color-mix(in srgb, currentColor 4%, transparent);
  --field-bg-strong: color-mix(in srgb, currentColor 7%, transparent);

  --field-danger: #c84f45;
  --field-danger-bg: color-mix(in srgb, #c84f45 10%, transparent);

  --field-warning: #a77825;
  --field-warning-bg: color-mix(in srgb, #a77825 10%, transparent);

  --field-radius: 0;
  --field-gap: 8px;
  --field-padding: 0;
}
```

Every theme/scheme pair should define:

- `--field-text`
- `--field-muted`
- `--field-soft`
- `--field-border`
- `--field-border-strong`
- `--field-bg`
- `--field-bg-raised`
- `--field-bg-strong`
- `--field-danger`
- `--field-danger-bg`
- `--field-warning`
- `--field-warning-bg`

Terminal should also set:

- `--field-font-family`

---

## 7. Theme: Auto

### Purpose

`auto` inherits from the parent surface as much as possible.

It should not force a design identity. It should blend into whatever surface it is placed inside.

### Best used for

- embedded controls
- unknown parent surfaces
- reusable editor controls
- testing inheritance

### Visual behavior

Auto should use:

```scss
.universalField--theme-auto {
  --field-text: currentColor;
  --field-muted: color-mix(in srgb, currentColor 58%, transparent);
  --field-soft: color-mix(in srgb, currentColor 38%, transparent);

  --field-border: color-mix(in srgb, currentColor 20%, transparent);
  --field-border-strong: color-mix(in srgb, currentColor 34%, transparent);

  --field-bg: transparent;
  --field-bg-raised: color-mix(in srgb, currentColor 4%, transparent);
  --field-bg-strong: color-mix(in srgb, currentColor 7%, transparent);
}
```

### Light/dark scheme

`scheme: "auto"` should not override the browser or parent surface.

```scss
.universalField--scheme-auto {
  color-scheme: normal;
}
```

Use this theme to verify that parent cards control the overall feel.

---

## 8. Theme: Plain

### Purpose

Plain is neutral, practical, and baseline-friendly. It should feel like a normal app form.

### Best used for

- fallback UI
- admin-like forms
- accessibility comparisons
- testing layouts without brand styling

### Light scheme

```scss
.universalField--theme-plain.universalField--scheme-light,
.universalField--theme-plain.universalField--scheme-auto {
  --field-text: #18181b;
  --field-muted: rgba(24, 24, 27, 0.62);
  --field-soft: rgba(24, 24, 27, 0.38);

  --field-border: rgba(24, 24, 27, 0.18);
  --field-border-strong: rgba(24, 24, 27, 0.34);

  --field-bg: #ffffff;
  --field-bg-raised: #f4f4f5;
  --field-bg-strong: #e4e4e7;

  --field-danger: #b42318;
  --field-danger-bg: rgba(180, 35, 24, 0.08);

  --field-warning: #92400e;
  --field-warning-bg: rgba(146, 64, 14, 0.08);
}
```

### Dark scheme

```scss
.universalField--theme-plain.universalField--scheme-dark {
  --field-text: #f4f4f5;
  --field-muted: rgba(244, 244, 245, 0.62);
  --field-soft: rgba(244, 244, 245, 0.38);

  --field-border: rgba(244, 244, 245, 0.2);
  --field-border-strong: rgba(244, 244, 245, 0.38);

  --field-bg: #18181b;
  --field-bg-raised: #27272a;
  --field-bg-strong: #3f3f46;

  --field-danger: #fca5a5;
  --field-danger-bg: rgba(252, 165, 165, 0.1);

  --field-warning: #facc15;
  --field-warning-bg: rgba(250, 204, 21, 0.1);
}
```

---

## 9. Theme: Parchment

### Purpose

Parchment is warm, readable, and authoring-focused. It should feel like notes, drafts, and worldbuilding pages.

### Best used for

- narrative descriptions
- long text editing
- story/world notes
- authoring panels

### Light scheme

```scss
.universalField--theme-parchment.universalField--scheme-light,
.universalField--theme-parchment.universalField--scheme-auto {
  --field-text: #2d2418;
  --field-muted: rgba(45, 36, 24, 0.62);
  --field-soft: rgba(45, 36, 24, 0.38);

  --field-border: rgba(111, 82, 43, 0.28);
  --field-border-strong: rgba(111, 82, 43, 0.48);

  --field-bg: #f6eddc;
  --field-bg-raised: #ead9ba;
  --field-bg-strong: #dfc89d;

  --field-danger: #9f2f22;
  --field-danger-bg: rgba(159, 47, 34, 0.09);

  --field-warning: #8a5a11;
  --field-warning-bg: rgba(138, 90, 17, 0.1);
}
```

### Dark scheme

```scss
.universalField--theme-parchment.universalField--scheme-dark {
  --field-text: #f5ead3;
  --field-muted: rgba(245, 234, 211, 0.62);
  --field-soft: rgba(245, 234, 211, 0.38);

  --field-border: rgba(213, 186, 138, 0.32);
  --field-border-strong: rgba(213, 186, 138, 0.54);

  --field-bg: #21180f;
  --field-bg-raised: #2d2114;
  --field-bg-strong: #3b2a18;

  --field-danger: #f2a091;
  --field-danger-bg: rgba(242, 160, 145, 0.1);

  --field-warning: #e5bd6b;
  --field-warning-bg: rgba(229, 189, 107, 0.1);
}
```

---

## 10. Theme: Blueprint

### Purpose

Blueprint is technical and structured. It should feel like planning tools, schema inspection, maps, and logic editing.

### Best used for

- condition builders
- schema editors
- map/graph tooling
- connection editors
- command logic

### Light scheme

```scss
.universalField--theme-blueprint.universalField--scheme-light,
.universalField--theme-blueprint.universalField--scheme-auto {
  --field-text: #172536;
  --field-muted: rgba(23, 37, 54, 0.62);
  --field-soft: rgba(23, 37, 54, 0.38);

  --field-border: rgba(36, 84, 124, 0.28);
  --field-border-strong: rgba(36, 84, 124, 0.5);

  --field-bg: #eef5fb;
  --field-bg-raised: #dbe9f5;
  --field-bg-strong: #c5d9eb;

  --field-danger: #b42318;
  --field-danger-bg: rgba(180, 35, 24, 0.08);

  --field-warning: #8a5a11;
  --field-warning-bg: rgba(138, 90, 17, 0.08);
}
```

### Dark scheme

```scss
.universalField--theme-blueprint.universalField--scheme-dark {
  --field-text: #e6f0fa;
  --field-muted: rgba(230, 240, 250, 0.62);
  --field-soft: rgba(230, 240, 250, 0.38);

  --field-border: rgba(107, 153, 194, 0.36);
  --field-border-strong: rgba(107, 153, 194, 0.62);

  --field-bg: #1d3147;
  --field-bg-raised: #253f5d;
  --field-bg-strong: #2f5178;

  --field-danger: #fca5a5;
  --field-danger-bg: rgba(252, 165, 165, 0.1);

  --field-warning: #fde68a;
  --field-warning-bg: rgba(253, 230, 138, 0.1);
}
```

---

## 11. Theme: Terminal

### Purpose

Terminal is command/debug-oriented. It should feel technical and utilitarian without becoming novelty UI.

### Best used for

- command line
- code preview
- debug logs
- effect previews
- author-defined command testing

### Font

Terminal should set a monospace font:

```scss
--field-font-family:
  ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
```

### Light scheme

```scss
.universalField--theme-terminal.universalField--scheme-light,
.universalField--theme-terminal.universalField--scheme-auto {
  --field-font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New",
    monospace;

  --field-text: #162316;
  --field-muted: rgba(22, 35, 22, 0.62);
  --field-soft: rgba(22, 35, 22, 0.38);

  --field-border: rgba(43, 94, 45, 0.32);
  --field-border-strong: rgba(43, 94, 45, 0.58);

  --field-bg: #f2f7ef;
  --field-bg-raised: #e2eedc;
  --field-bg-strong: #cfe1c8;

  --field-danger: #9f2f22;
  --field-danger-bg: rgba(159, 47, 34, 0.09);

  --field-warning: #7c5d12;
  --field-warning-bg: rgba(124, 93, 18, 0.1);
}
```

### Dark scheme

```scss
.universalField--theme-terminal.universalField--scheme-dark {
  --field-font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New",
    monospace;

  --field-text: #d9f2d0;
  --field-muted: rgba(217, 242, 208, 0.62);
  --field-soft: rgba(217, 242, 208, 0.38);

  --field-border: rgba(80, 145, 84, 0.42);
  --field-border-strong: rgba(103, 185, 107, 0.68);

  --field-bg: #0f1710;
  --field-bg-raised: #162517;
  --field-bg-strong: #1d331f;

  --field-danger: #fca5a5;
  --field-danger-bg: rgba(252, 165, 165, 0.1);

  --field-warning: #facc15;
  --field-warning-bg: rgba(250, 204, 21, 0.1);
}
```

---

## 12. Theme: Mothmark

### Purpose

Mothmark is the native app identity. It should be warm, dim, practical, and recognizable without being loud.

### Best used for

- primary editor UI
- app panels
- preview tools
- default Mothmark experience

### Light scheme

```scss
.universalField--theme-mothmark.universalField--scheme-light,
.universalField--theme-mothmark.universalField--scheme-auto {
  --field-text: #221b12;
  --field-muted: rgba(34, 27, 18, 0.62);
  --field-soft: rgba(34, 27, 18, 0.38);

  --field-border: rgba(133, 92, 42, 0.36);
  --field-border-strong: rgba(133, 92, 42, 0.58);

  --field-bg: #efe4cf;
  --field-bg-raised: #e3cfaa;
  --field-bg-strong: #d6b987;

  --field-danger: #9f2f22;
  --field-danger-bg: rgba(159, 47, 34, 0.09);

  --field-warning: #7c5516;
  --field-warning-bg: rgba(124, 85, 22, 0.1);
}
```

### Dark scheme

```scss
.universalField--theme-mothmark.universalField--scheme-dark {
  --field-text: #f4ecd8;
  --field-muted: rgba(244, 236, 216, 0.62);
  --field-soft: rgba(244, 236, 216, 0.38);

  --field-border: rgba(166, 123, 69, 0.42);
  --field-border-strong: rgba(203, 158, 91, 0.64);

  --field-bg: #12100d;
  --field-bg-raised: #1f1a13;
  --field-bg-strong: #2f2518;

  --field-danger: #f29b8f;
  --field-danger-bg: rgba(242, 155, 143, 0.1);

  --field-warning: #d7ad62;
  --field-warning-bg: rgba(215, 173, 98, 0.1);
}
```

---

## 13. Tone Definitions

Tones modify the mood of a control inside a theme.

### `default`

The normal control presentation.

```scss
.universalField--tone-default {
}
```

### `quiet`

Lower visual emphasis. Border and muted text should recede.

```scss
.universalField--tone-quiet {
  --field-muted: color-mix(in srgb, var(--field-text) 48%, transparent);
  --field-border: color-mix(in srgb, var(--field-text) 14%, transparent);
  --field-border-strong: color-mix(in srgb, var(--field-text) 26%, transparent);
}
```

### `terminal`

Technical mood. Pairs well with command-like fields.

```scss
.universalField--tone-terminal {
  letter-spacing: 0.01em;
}
```

### `paper`

Writing-focused mood. Should feel softer and calmer.

```scss
.universalField--tone-paper {
  --field-bg-raised: color-mix(in srgb, var(--field-bg) 82%, white 18%);
}
```

### `panel`

Panel/sidebar mood. Controls should sit more firmly inside dense surfaces.

```scss
.universalField--tone-panel {
  --field-bg: var(--field-bg-raised);
}
```

---

## 14. Chrome Definitions

Chrome controls the shell/framing around a control.

### `field`

Default field layout. No extra shell padding.

```scss
.universalField--chrome-field {
  --field-padding: 0;
}
```

### `card`

Raised/grouped shell.

```scss
.universalField--chrome-card {
  --field-padding: 10px;
  border: 1px solid var(--field-border);
  background: var(--field-bg-raised);
}
```

### `inline`

Two-column label/control layout for property panels.

```scss
.universalField--chrome-inline {
  display: grid;
  grid-template-columns: minmax(96px, 32%) minmax(0, 1fr);
  align-items: start;
  column-gap: 10px;
  row-gap: 4px;
}
```

### `compact`

Reduced spacing.

```scss
.universalField--chrome-compact {
  --field-gap: 4px;
  --field-padding: 0;
}
```

### `bare`

Minimal embedded layout. Hides helper/error/warning text and avoids framing.

```scss
.universalField--chrome-bare {
  --field-gap: 2px;
  --field-padding: 0;
}
```

---

## 15. Size Definitions

Sizes change spacing and input scale.

```scss
.universalField--size-sm {
  --field-gap: 5px;
}

.universalField--size-md {
  --field-gap: 8px;
}

.universalField--size-lg {
  --field-gap: 10px;
}
```

Inputs should also adjust padding and font size:

```scss
.universalField--size-sm .textField__input {
  font-size: 12px;
  padding: 5px 7px;
}

.universalField--size-md .textField__input {
  font-size: 13px;
  padding: 8px 10px;
}

.universalField--size-lg .textField__input {
  font-size: 15px;
  padding: 11px 12px;
}
```

---

## 16. Test Matrix Guidelines

The `/test` page should make it easy to inspect appearance behavior.

Recommended structure:

```txt
Each row = one control variant + one theme
Each row includes:
  - human-readable description
  - JSON for the variant
  - ten cards showing the same control across parent surfaces
```

Parent surfaces should include light and dark examples:

```ts
const PARENT_SURFACES = [
  {id: "plain-light-flat", theme: "plain", scheme: "light", surface: "flat"},
  {id: "parchment-light-flat", theme: "parchment", scheme: "light", surface: "flat"},
  {id: "blueprint-light-flat", theme: "blueprint", scheme: "light", surface: "flat"},
  {id: "terminal-light-flat", theme: "terminal", scheme: "light", surface: "flat"},
  {id: "mothmark-light-flat", theme: "mothmark", scheme: "light", surface: "flat"},

  {id: "plain-dark-card", theme: "plain", scheme: "dark", surface: "card"},
  {id: "parchment-dark-card", theme: "parchment", scheme: "dark", surface: "card"},
  {id: "blueprint-dark-card", theme: "blueprint", scheme: "dark", surface: "card"},
  {id: "terminal-dark-card", theme: "terminal", scheme: "dark", surface: "card"},
  {id: "mothmark-dark-card", theme: "mothmark", scheme: "dark", surface: "card"},
];
```

The rendered control should receive:

```ts
context: {
  ...baseContext,
  appearance: {
    theme: example.themeVariant.id,
    scheme: example.parentSurface.scheme,
  },
}
```

The parent card itself should set `color-scheme` and background/text colors so `theme: "auto"` can prove that it inherits correctly.

---

## 17. Example Variant JSON

A row in the test matrix should expose both a description and the exact JSON for the variant:

```json
{
  "id": "default-field-md-copy-and-clear",
  "value": "editable-room-id",
  "context": {
    "appearance": {
      "theme": "mothmark",
      "scheme": "from parent surface"
    },
    "mode": "edit"
  },
  "props": {
    "error": null,
    "warnings": null,
    "disabled": null,
    "readonly": null,
    "autoFocus": null
  },
  "metadata": {
    "type": "input",
    "title": "Copy and Clear",
    "description": "Tests multiple action buttons.",
    "placeholder": "editable-room-id",
    "transform": "id",
    "features": {
      "copyButton": true,
      "clearButton": true,
      "selectOnFocus": true
    },
    "appearance": {
      "tone": "default",
      "chrome": "field",
      "size": "md"
    }
  }
}
```

---

## 18. Recreation Checklist

To recreate the theme system:

1. Define `EditorControlAppearance`.
2. Put inherited/default appearance in `context.appearance`.
3. Put per-control appearance overrides in `metadata.appearance`.
4. Put text-field behavior in `metadata.features`.
5. Resolve appearance with `defaults < context < metadata`.
6. Make `FieldShell` output prefixed classes for each visual axis.
7. Make themes set only CSS variables.
8. Make tone/chrome/size modify those variables or layout.
9. Use `theme: "auto"` to test parent-surface inheritance.
10. Keep parent surfaces separate from control themes in the test matrix.
