import type {
	EditorControlAppearance,
	EditorControlMetadata,
	EditorControlTheme,
} from "../../../types/universalEditorTypes";
import type {ControlMatrixVariant} from "../ControlMatrix";

type TextFieldInputMode = "text" | "search" | "email" | "url" | "tel" | "numeric" | "decimal";

type TextFieldTransform = "none" | "slug" | "id" | "lowercase" | "uppercase";

type TextFieldFeatures = {
	copyButton?: boolean;
	clearButton?: boolean;
	prefix?: string;
	suffix?: string;
	selectOnFocus?: boolean;
};

type TextFieldMatrixMetadata = EditorControlMetadata & {
	type: "input";
	minLength?: number;
	maxLength?: number;
	pattern?: string;
	inputMode?: TextFieldInputMode;
	autoComplete?: string;
	transform?: TextFieldTransform;
	features?: TextFieldFeatures;
};

type TextSetup = {
	id: string;
	value: string;
	error?: string;
	warnings?: string[];
	disabled?: boolean;
	readonly?: boolean;
	autoFocus?: boolean;
	metadata: Omit<TextFieldMatrixMetadata, "type" | "appearance">;
};

const THEME_TEST_THEMES: EditorControlTheme[] = [
	"auto",
	"plain",
	"parchment",
	"blueprint",
	"terminal",
	"mothmark",
];

const TEXT_SETUPS = {
	basic: {
		id: "basic",
		value: "",
		metadata: {
			title: "Room ID",
			description: "Unique identifier used by rooms, connections, and commands.",
			placeholder: "forest-clearing",
			required: true,
			transform: "id",
		},
	},
	noHeader: {
		id: "no-header",
		value: "hidden-label-field",
		metadata: {
			placeholder: "No title or description",
			transform: "id",
		},
	},
	longDescription: {
		id: "long-description",
		value: "",
		metadata: {
			title: "Scene Entry Key",
			description:
				"A longer helper description used to test wrapping, spacing, and compactness in dense editor surfaces.",
			placeholder: "scene-entry-key",
			transform: "id",
		},
	},
	error: {
		id: "error",
		value: "duplicate-room",
		error: "This value is already used.",
		metadata: {
			title: "Errored Input",
			description: "Used to test validation styling.",
			placeholder: "room-id",
			transform: "id",
		},
	},
	warning: {
		id: "warning",
		value: "old-room-name",
		warnings: ["This value is valid, but it looks like an older naming format."],
		metadata: {
			title: "Warning Input",
			description: "Used to test warning styling.",
			placeholder: "room-id",
			transform: "id",
		},
	},
	disabledByProps: {
		id: "disabled-by-props",
		value: "locked-value",
		disabled: true,
		metadata: {
			title: "Disabled by Props",
			description: "Parent props disable this field.",
			placeholder: "Disabled",
		},
	},
	disabledByMetadata: {
		id: "disabled-by-metadata",
		value: "metadata-locked",
		metadata: {
			title: "Disabled by Metadata",
			description: "Metadata disables this field.",
			placeholder: "Disabled by metadata",
			disabled: true,
		},
	},
	readonlyByProps: {
		id: "readonly-by-props",
		value: "read-only-value",
		readonly: true,
		metadata: {
			title: "Readonly by Props",
			description: "Parent props mark this field readonly.",
			placeholder: "Readonly",
		},
	},
	readonlyByMetadata: {
		id: "readonly-by-metadata",
		value: "metadata-readonly",
		metadata: {
			title: "Readonly by Metadata",
			description: "Metadata marks this field readonly.",
			placeholder: "Readonly by metadata",
			readonly: true,
		},
	},
	slug: {
		id: "slug",
		value: "old-tower-door",
		metadata: {
			title: "Slug Transform",
			description: "Lowercases and converts spaces/symbols into hyphens.",
			placeholder: "Old Tower Door",
			transform: "slug",
		},
	},
	lowercase: {
		id: "lowercase",
		value: "shadow_moth",
		metadata: {
			title: "Lowercase Transform",
			description: "Forces all input to lowercase.",
			placeholder: "shadow_moth",
			transform: "lowercase",
		},
	},
	uppercase: {
		id: "uppercase",
		value: "DEBUG_ROOM",
		metadata: {
			title: "Uppercase Transform",
			description: "Forces all input to uppercase.",
			placeholder: "DEBUG_ROOM",
			transform: "uppercase",
		},
	},
	lengthLimited: {
		id: "length-limited",
		value: "abc",
		metadata: {
			title: "Length Limited",
			description: "Minimum 2 characters, maximum 8 characters.",
			placeholder: "2-8 chars",
			minLength: 2,
			maxLength: 8,
		},
	},
	pattern: {
		id: "pattern",
		value: "room_01",
		metadata: {
			title: "Pattern Input",
			description: "Allows lowercase letters, numbers, underscores, and hyphens.",
			placeholder: "room_01",
			pattern: "^[a-z0-9_-]+$",
		},
	},
	email: {
		id: "email",
		value: "",
		metadata: {
			title: "Email Input",
			description: "Uses email input mode and autocomplete.",
			placeholder: "author@example.com",
			inputMode: "email",
			autoComplete: "email",
		},
	},
	url: {
		id: "url",
		value: "",
		metadata: {
			title: "URL Input",
			description: "Uses URL input mode and autocomplete.",
			placeholder: "https://example.com",
			inputMode: "url",
			autoComplete: "url",
		},
	},
	numeric: {
		id: "numeric",
		value: "12",
		metadata: {
			title: "Numeric Input",
			description: "Uses numeric input mode while still storing a string.",
			placeholder: "12",
			inputMode: "numeric",
		},
	},
	prefix: {
		id: "prefix",
		value: "lantern",
		metadata: {
			title: "Prefix Feature",
			description: "Tests prefix rendering.",
			placeholder: "item-id",
			transform: "id",
			features: {
				prefix: "item/",
			},
		},
	},
	suffix: {
		id: "suffix",
		value: "12",
		metadata: {
			title: "Suffix Feature",
			description: "Tests suffix rendering.",
			placeholder: "duration",
			inputMode: "numeric",
			features: {
				suffix: " turns",
			},
		},
	},
	copyButton: {
		id: "copy-button",
		value: "forest-clearing",
		metadata: {
			title: "Copy Button",
			description: "Tests copy behavior.",
			placeholder: "room-id",
			transform: "id",
			features: {
				copyButton: true,
			},
		},
	},
	clearButton: {
		id: "clear-button",
		value: "temporary-value",
		metadata: {
			title: "Clear Button",
			description: "Tests clear behavior.",
			placeholder: "temporary-value",
			features: {
				clearButton: true,
			},
		},
	},
	copyAndClear: {
		id: "copy-and-clear",
		value: "editable-room-id",
		metadata: {
			title: "Copy and Clear",
			description: "Tests multiple action buttons.",
			placeholder: "editable-room-id",
			transform: "id",
			features: {
				copyButton: true,
				clearButton: true,
				selectOnFocus: true,
			},
		},
	},
	prefixSuffixActions: {
		id: "prefix-suffix-actions",
		value: "lantern",
		metadata: {
			title: "Prefix, Suffix, and Actions",
			description: "Tests affixes and buttons together.",
			placeholder: "item-id",
			transform: "id",
			features: {
				prefix: "item/",
				suffix: ".json",
				copyButton: true,
				clearButton: true,
				selectOnFocus: true,
			},
		},
	},
} satisfies Record<string, TextSetup>;

function makeTextVariant({
	id,
	description,
	appearance,
	setup,
	themes,
}: {
	id: string;
	description: string;
	appearance: Pick<EditorControlAppearance, "tone" | "chrome" | "size">;
	setup: TextSetup;
	themes?: EditorControlTheme[];
}): ControlMatrixVariant<string, TextFieldMatrixMetadata> {
	return {
		id,
		description,
		value: setup.value,
		error: setup.error,
		warnings: setup.warnings,
		disabled: setup.disabled,
		readonly: setup.readonly,
		autoFocus: setup.autoFocus,
		appearance,
		themes,
		metadata: {
			...setup.metadata,
			type: "input",
		},
	};
}

export const textControlMatrixVariants: Array<
	ControlMatrixVariant<string, TextFieldMatrixMetadata>
> = [
	makeTextVariant({
		id: "theme-default-field-md-basic",
		description:
			"Theme test. Renders the same baseline field with each explicit theme so theme palettes can be compared directly.",
		appearance: {
			tone: "default",
			chrome: "field",
			size: "md",
		},
		setup: TEXT_SETUPS.basic,
		themes: THEME_TEST_THEMES,
	}),
	makeTextVariant({
		id: "default-field-md-basic",
		description:
			"Baseline input using auto theme, default tone, field chrome, medium size, title, description, placeholder, required state, and ID transform.",
		appearance: {
			tone: "default",
			chrome: "field",
			size: "md",
		},
		setup: TEXT_SETUPS.basic,
	}),
	makeTextVariant({
		id: "quiet-field-md-basic",
		description:
			"Quiet tone input. Uses auto theme so it inherits from each parent surface while testing quieter emphasis.",
		appearance: {
			tone: "quiet",
			chrome: "field",
			size: "md",
		},
		setup: TEXT_SETUPS.basic,
	}),
	makeTextVariant({
		id: "terminal-field-md-basic",
		description:
			"Terminal tone input. Uses auto theme so only the tone behavior changes, not the overall theme identity.",
		appearance: {
			tone: "terminal",
			chrome: "field",
			size: "md",
		},
		setup: TEXT_SETUPS.basic,
	}),
	makeTextVariant({
		id: "paper-field-md-basic",
		description:
			"Paper tone input. Uses auto theme while testing the writing-focused tone treatment.",
		appearance: {
			tone: "paper",
			chrome: "field",
			size: "md",
		},
		setup: TEXT_SETUPS.basic,
	}),
	makeTextVariant({
		id: "panel-field-md-basic",
		description: "Panel tone input. Uses auto theme while testing denser property-panel styling.",
		appearance: {
			tone: "panel",
			chrome: "field",
			size: "md",
		},
		setup: TEXT_SETUPS.basic,
	}),
	makeTextVariant({
		id: "default-card-md-basic",
		description: "Card chrome input. Uses auto theme while testing the raised field shell treatment.",
		appearance: {
			tone: "default",
			chrome: "card",
			size: "md",
		},
		setup: TEXT_SETUPS.basic,
	}),
	makeTextVariant({
		id: "default-inline-md-basic",
		description:
			"Inline chrome input. Uses auto theme while testing horizontal label-control layout.",
		appearance: {
			tone: "default",
			chrome: "inline",
			size: "md",
		},
		setup: TEXT_SETUPS.basic,
	}),
	makeTextVariant({
		id: "default-compact-md-basic",
		description: "Compact chrome input. Uses auto theme while testing tighter spacing.",
		appearance: {
			tone: "default",
			chrome: "compact",
			size: "md",
		},
		setup: TEXT_SETUPS.basic,
	}),
	makeTextVariant({
		id: "default-bare-md-basic",
		description: "Bare chrome input. Uses auto theme while testing a minimal embedded field.",
		appearance: {
			tone: "default",
			chrome: "bare",
			size: "md",
		},
		setup: TEXT_SETUPS.basic,
	}),
	makeTextVariant({
		id: "default-field-sm-basic",
		description: "Small size input. Uses auto theme while testing dense editor readability.",
		appearance: {
			tone: "default",
			chrome: "field",
			size: "sm",
		},
		setup: TEXT_SETUPS.basic,
	}),
	makeTextVariant({
		id: "default-field-lg-basic",
		description: "Large size input. Uses auto theme while testing larger spacing and proportions.",
		appearance: {
			tone: "default",
			chrome: "field",
			size: "lg",
		},
		setup: TEXT_SETUPS.basic,
	}),
	makeTextVariant({
		id: "default-field-md-no-header",
		description:
			"No-header input. Uses auto theme while testing that missing title/description does not reserve empty space.",
		appearance: {
			tone: "default",
			chrome: "field",
			size: "md",
		},
		setup: TEXT_SETUPS.noHeader,
	}),
	makeTextVariant({
		id: "default-field-md-long-description",
		description:
			"Long-description input. Uses auto theme while testing text wrapping and equal-height cards.",
		appearance: {
			tone: "default",
			chrome: "field",
			size: "md",
		},
		setup: TEXT_SETUPS.longDescription,
	}),
	makeTextVariant({
		id: "default-field-md-error",
		description: "Error-state input. Uses auto theme while testing validation styling.",
		appearance: {
			tone: "default",
			chrome: "field",
			size: "md",
		},
		setup: TEXT_SETUPS.error,
	}),
	makeTextVariant({
		id: "default-field-md-warning",
		description: "Warning-state input. Uses auto theme while testing non-blocking warning styling.",
		appearance: {
			tone: "default",
			chrome: "field",
			size: "md",
		},
		setup: TEXT_SETUPS.warning,
	}),
	makeTextVariant({
		id: "default-field-md-disabled-props",
		description:
			"Disabled-by-props input. Uses auto theme while testing prop-based disabled behavior.",
		appearance: {
			tone: "default",
			chrome: "field",
			size: "md",
		},
		setup: TEXT_SETUPS.disabledByProps,
	}),
	makeTextVariant({
		id: "default-field-md-disabled-metadata",
		description:
			"Disabled-by-metadata input. Uses auto theme while testing metadata-based disabled behavior.",
		appearance: {
			tone: "default",
			chrome: "field",
			size: "md",
		},
		setup: TEXT_SETUPS.disabledByMetadata,
	}),
	makeTextVariant({
		id: "default-field-md-readonly-props",
		description:
			"Readonly-by-props input. Uses auto theme while testing prop-based readonly behavior.",
		appearance: {
			tone: "default",
			chrome: "field",
			size: "md",
		},
		setup: TEXT_SETUPS.readonlyByProps,
	}),
	makeTextVariant({
		id: "default-field-md-readonly-metadata",
		description:
			"Readonly-by-metadata input. Uses auto theme while testing metadata-based readonly behavior.",
		appearance: {
			tone: "default",
			chrome: "field",
			size: "md",
		},
		setup: TEXT_SETUPS.readonlyByMetadata,
	}),
	makeTextVariant({
		id: "default-field-md-slug",
		description: "Slug-transform input. Uses auto theme while testing slug normalization.",
		appearance: {
			tone: "default",
			chrome: "field",
			size: "md",
		},
		setup: TEXT_SETUPS.slug,
	}),
	makeTextVariant({
		id: "default-field-md-lowercase",
		description: "Lowercase-transform input. Uses auto theme while testing lowercase normalization.",
		appearance: {
			tone: "default",
			chrome: "field",
			size: "md",
		},
		setup: TEXT_SETUPS.lowercase,
	}),
	makeTextVariant({
		id: "default-field-md-uppercase",
		description: "Uppercase-transform input. Uses auto theme while testing uppercase normalization.",
		appearance: {
			tone: "default",
			chrome: "field",
			size: "md",
		},
		setup: TEXT_SETUPS.uppercase,
	}),
	makeTextVariant({
		id: "default-field-md-length-limited",
		description:
			"Length-limited input. Uses auto theme while testing minLength and maxLength metadata.",
		appearance: {
			tone: "default",
			chrome: "field",
			size: "md",
		},
		setup: TEXT_SETUPS.lengthLimited,
	}),
	makeTextVariant({
		id: "default-field-md-pattern",
		description: "Pattern input. Uses auto theme while testing native pattern metadata.",
		appearance: {
			tone: "default",
			chrome: "field",
			size: "md",
		},
		setup: TEXT_SETUPS.pattern,
	}),
	makeTextVariant({
		id: "default-field-md-email",
		description: "Email input. Uses auto theme while testing email input mode and autocomplete.",
		appearance: {
			tone: "default",
			chrome: "field",
			size: "md",
		},
		setup: TEXT_SETUPS.email,
	}),
	makeTextVariant({
		id: "default-field-md-url",
		description: "URL input. Uses auto theme while testing URL input mode and autocomplete.",
		appearance: {
			tone: "default",
			chrome: "field",
			size: "md",
		},
		setup: TEXT_SETUPS.url,
	}),
	makeTextVariant({
		id: "default-field-md-numeric",
		description:
			"Numeric input. Uses auto theme while testing numeric input mode while preserving string values.",
		appearance: {
			tone: "default",
			chrome: "field",
			size: "md",
		},
		setup: TEXT_SETUPS.numeric,
	}),
	makeTextVariant({
		id: "default-field-md-prefix",
		description:
			"Prefix feature input. Uses auto theme while testing rendered prefix affix behavior.",
		appearance: {
			tone: "default",
			chrome: "field",
			size: "md",
		},
		setup: TEXT_SETUPS.prefix,
	}),
	makeTextVariant({
		id: "default-field-md-suffix",
		description:
			"Suffix feature input. Uses auto theme while testing rendered suffix affix behavior.",
		appearance: {
			tone: "default",
			chrome: "field",
			size: "md",
		},
		setup: TEXT_SETUPS.suffix,
	}),
	makeTextVariant({
		id: "default-field-md-copy-button",
		description: "Copy-button input. Uses auto theme while testing copy action affordance.",
		appearance: {
			tone: "default",
			chrome: "field",
			size: "md",
		},
		setup: TEXT_SETUPS.copyButton,
	}),
	makeTextVariant({
		id: "default-field-md-clear-button",
		description: "Clear-button input. Uses auto theme while testing clear action affordance.",
		appearance: {
			tone: "default",
			chrome: "field",
			size: "md",
		},
		setup: TEXT_SETUPS.clearButton,
	}),
	makeTextVariant({
		id: "default-field-md-copy-and-clear",
		description:
			"Copy-and-clear input. Uses auto theme while testing multiple action buttons and select-on-focus.",
		appearance: {
			tone: "default",
			chrome: "field",
			size: "md",
		},
		setup: TEXT_SETUPS.copyAndClear,
	}),
	makeTextVariant({
		id: "default-field-md-prefix-suffix-actions",
		description:
			"Prefix, suffix, and action buttons. Uses auto theme while testing the most complex text input composition.",
		appearance: {
			tone: "default",
			chrome: "field",
			size: "md",
		},
		setup: TEXT_SETUPS.prefixSuffixActions,
	}),
];
