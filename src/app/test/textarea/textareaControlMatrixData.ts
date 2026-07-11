import type {TextareaControlMetadata} from "../../../components/universal-editor/TextareaEditor";
import type {
	EditorControlAppearance,
	EditorControlTheme,
} from "../../../types/universalEditorTypes";
import type {ControlMatrixVariant} from "../ControlMatrix";

type TextareaSetup = {
	id: string;
	value: string;
	error?: string;
	warnings?: string[];
	disabled?: boolean;
	readonly?: boolean;
	metadata: Omit<TextareaControlMetadata, "type" | "appearance">;
};

const THEME_TEST_THEMES: EditorControlTheme[] = [
	"auto",
	"plain",
	"parchment",
	"blueprint",
	"terminal",
	"mothmark",
];

const TEXTAREA_SETUPS = {
	basic: {
		id: "basic",
		value: "The room smells faintly of rain, dust, and cooling iron.",
		metadata: {
			title: "Room Description",
			description: "Long-form prose shown when the player enters the room.",
			placeholder: "Describe the room...",
			required: true,
			features: {
				minRows: 4,
				maxRows: 8,
			},
		},
	},
	noHeader: {
		id: "no-header",
		value: "A compact note without label chrome.",
		metadata: {
			placeholder: "No title or description",
			features: {
				minRows: 3,
			},
		},
	},
	error: {
		id: "error",
		value: "",
		error: "Description is required before this room can be published.",
		metadata: {
			title: "Errored Textarea",
			description: "Used to test validation styling.",
			placeholder: "Missing prose",
			required: true,
			features: {
				minRows: 3,
			},
		},
	},
	warning: {
		id: "warning",
		value: "A very short room.",
		warnings: ["This description is valid, but it may be too thin for player-facing prose."],
		metadata: {
			title: "Warning Textarea",
			description: "Used to test warning styling.",
			features: {
				minRows: 3,
			},
		},
	},
	disabled: {
		id: "disabled",
		value: "Locked transcript excerpt.",
		disabled: true,
		metadata: {
			title: "Disabled Textarea",
			description: "Parent props disable this field.",
		},
	},
	readonly: {
		id: "readonly",
		value: "Read-only generated summary.",
		readonly: true,
		metadata: {
			title: "Readonly Textarea",
			description: "Parent props mark this field readonly.",
		},
	},
	actions: {
		id: "actions",
		value: "Copy or clear this draft message.",
		metadata: {
			title: "Textarea Actions",
			description: "Tests copy, clear, select-on-focus, and vertical resize.",
			features: {
				copyButton: true,
				clearButton: true,
				selectOnFocus: true,
				resize: "vertical",
				minRows: 3,
			},
		},
	},
	monospace: {
		id: "monospace",
		value: "if player.has('lantern'):\n  reveal('ink-door')",
		metadata: {
			title: "Monospace Textarea",
			description: "Tests monospace notes and fixed resize behavior.",
			features: {
				monospace: true,
				resize: "none",
				minRows: 4,
			},
		},
	},
	trim: {
		id: "trim",
		value: "Trailing spaces are trimmed on edit.",
		metadata: {
			title: "Trim Transform",
			description: "Uses textarea trim transform metadata.",
			transform: "trim",
			features: {
				minRows: 3,
			},
		},
	},
} satisfies Record<string, TextareaSetup>;

function makeTextareaVariant({
	id,
	description,
	appearance,
	setup,
	themes,
}: {
	id: string;
	description: string;
	appearance: Pick<EditorControlAppearance, "tone" | "chrome" | "size">;
	setup: TextareaSetup;
	themes?: EditorControlTheme[];
}): ControlMatrixVariant<string, TextareaControlMetadata> {
	return {
		id,
		description,
		value: setup.value,
		error: setup.error,
		warnings: setup.warnings,
		disabled: setup.disabled,
		readonly: setup.readonly,
		appearance,
		themes,
		metadata: {
			...setup.metadata,
			type: "textarea",
		},
	};
}

export const textareaControlMatrixVariants: Array<
	ControlMatrixVariant<string, TextareaControlMetadata>
> = [
	makeTextareaVariant({
		id: "theme-default-field-md-basic",
		description: "Theme test. Renders the baseline textarea with each explicit theme.",
		appearance: {
			tone: "default",
			chrome: "field",
			size: "md",
		},
		setup: TEXTAREA_SETUPS.basic,
		themes: THEME_TEST_THEMES,
	}),
	...(["default", "quiet", "terminal", "paper", "panel"] as const).map((tone) =>
		makeTextareaVariant({
			id: `${tone}-field-md-basic`,
			description: `${tone} tone textarea using auto theme across parent surfaces.`,
			appearance: {
				tone,
				chrome: "field",
				size: "md",
			},
			setup: TEXTAREA_SETUPS.basic,
		}),
	),
	...(["card", "inline", "compact", "bare"] as const).map((chrome) =>
		makeTextareaVariant({
			id: `default-${chrome}-md-basic`,
			description: `${chrome} chrome textarea using auto theme.`,
			appearance: {
				tone: "default",
				chrome,
				size: "md",
			},
			setup: TEXTAREA_SETUPS.basic,
		}),
	),
	...(["sm", "lg"] as const).map((size) =>
		makeTextareaVariant({
			id: `default-field-${size}-basic`,
			description: `${size} size textarea using auto theme.`,
			appearance: {
				tone: "default",
				chrome: "field",
				size,
			},
			setup: TEXTAREA_SETUPS.basic,
		}),
	),
	...[
		TEXTAREA_SETUPS.noHeader,
		TEXTAREA_SETUPS.error,
		TEXTAREA_SETUPS.warning,
		TEXTAREA_SETUPS.disabled,
		TEXTAREA_SETUPS.readonly,
		TEXTAREA_SETUPS.actions,
		TEXTAREA_SETUPS.monospace,
		TEXTAREA_SETUPS.trim,
	].map((setup) =>
		makeTextareaVariant({
			id: `default-field-md-${setup.id}`,
			description: `${setup.id} textarea variant using auto theme.`,
			appearance: {
				tone: "default",
				chrome: "field",
				size: "md",
			},
			setup,
		}),
	),
];
