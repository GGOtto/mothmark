import type {ToggleControlMetadata} from "../../../components/universal-editor/ToggleEditor";
import type {
	EditorControlAppearance,
	EditorControlTheme,
} from "../../../types/universalEditorTypes";
import type {ControlMatrixVariant} from "../ControlMatrix";

type ToggleSetup = {
	id: string;
	value: boolean;
	error?: string;
	warnings?: string[];
	disabled?: boolean;
	readonly?: boolean;
	metadata: Omit<ToggleControlMetadata, "type" | "appearance">;
};

const THEME_TEST_THEMES: EditorControlTheme[] = [
	"auto",
	"plain",
	"parchment",
	"blueprint",
	"terminal",
	"mothmark",
];

const TOGGLE_SETUPS = {
	basic: {
		id: "basic",
		value: true,
		metadata: {
			title: "Starts Active",
			description: "Boolean flag used by commands and world state.",
			features: {
				labels: {
					on: "Active",
					off: "Inactive",
				},
			},
		},
	},
	noHeader: {
		id: "no-header",
		value: false,
		metadata: {
			features: {
				labels: {
					on: "On",
					off: "Off",
				},
			},
		},
	},
	error: {
		id: "error",
		value: false,
		error: "This command must be enabled before publishing.",
		metadata: {
			title: "Errored Toggle",
			description: "Used to test validation styling.",
			required: true,
		},
	},
	warning: {
		id: "warning",
		value: true,
		warnings: ["This value is valid, but it may expose an unfinished room."],
		metadata: {
			title: "Warning Toggle",
			description: "Used to test warning styling.",
		},
	},
	disabled: {
		id: "disabled",
		value: true,
		disabled: true,
		metadata: {
			title: "Disabled Toggle",
			description: "Parent props disable this field.",
		},
	},
	readonly: {
		id: "readonly",
		value: false,
		readonly: true,
		metadata: {
			title: "Readonly Toggle",
			description: "Parent props mark this field readonly.",
		},
	},
	checkbox: {
		id: "checkbox",
		value: true,
		metadata: {
			title: "Checkbox Display",
			description: "Tests checkbox rendering.",
			features: {
				display: "checkbox",
				labels: {
					on: "Required",
					off: "Optional",
				},
			},
		},
	},
	button: {
		id: "button",
		value: false,
		metadata: {
			title: "Button Display",
			description: "Tests button rendering.",
			features: {
				display: "button",
				labels: {
					on: "Unlocked",
					off: "Locked",
				},
			},
		},
	},
} satisfies Record<string, ToggleSetup>;

function makeToggleVariant({
	id,
	description,
	appearance,
	setup,
	themes,
}: {
	id: string;
	description: string;
	appearance: Pick<EditorControlAppearance, "tone" | "chrome" | "size">;
	setup: ToggleSetup;
	themes?: EditorControlTheme[];
}): ControlMatrixVariant<boolean, ToggleControlMetadata> {
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
			type: "toggle",
		},
	};
}

export const toggleControlMatrixVariants: Array<
	ControlMatrixVariant<boolean, ToggleControlMetadata>
> = [
	makeToggleVariant({
		id: "theme-default-field-md-basic",
		description: "Theme test. Renders the baseline toggle with each explicit theme.",
		appearance: {
			tone: "default",
			chrome: "field",
			size: "md",
		},
		setup: TOGGLE_SETUPS.basic,
		themes: THEME_TEST_THEMES,
	}),
	...(["default", "quiet", "terminal", "paper", "panel"] as const).map((tone) =>
		makeToggleVariant({
			id: `${tone}-field-md-basic`,
			description: `${tone} tone toggle using auto theme across parent surfaces.`,
			appearance: {
				tone,
				chrome: "field",
				size: "md",
			},
			setup: TOGGLE_SETUPS.basic,
		}),
	),
	...(["card", "inline", "compact", "bare"] as const).map((chrome) =>
		makeToggleVariant({
			id: `default-${chrome}-md-basic`,
			description: `${chrome} chrome toggle using auto theme.`,
			appearance: {
				tone: "default",
				chrome,
				size: "md",
			},
			setup: TOGGLE_SETUPS.basic,
		}),
	),
	...(["sm", "lg"] as const).map((size) =>
		makeToggleVariant({
			id: `default-field-${size}-basic`,
			description: `${size} size toggle using auto theme.`,
			appearance: {
				tone: "default",
				chrome: "field",
				size,
			},
			setup: TOGGLE_SETUPS.basic,
		}),
	),
	...[
		TOGGLE_SETUPS.noHeader,
		TOGGLE_SETUPS.error,
		TOGGLE_SETUPS.warning,
		TOGGLE_SETUPS.disabled,
		TOGGLE_SETUPS.readonly,
		TOGGLE_SETUPS.checkbox,
		TOGGLE_SETUPS.button,
	].map((setup) =>
		makeToggleVariant({
			id: `default-field-md-${setup.id}`,
			description: `${setup.id} toggle variant using auto theme.`,
			appearance: {
				tone: "default",
				chrome: "field",
				size: "md",
			},
			setup,
		}),
	),
];
