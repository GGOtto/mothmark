import type {MultiSelectControlMetadata} from "../../../components/universal-editor/MultiSelectEditor";
import type {
	EditorControlAppearance,
	EditorControlTheme,
} from "../../../types/universalEditorTypes";
import type {ControlMatrixVariant} from "../ControlMatrix";

type MultiSelectSetup = {
	id: string;
	value: string[];
	error?: string;
	warnings?: string[];
	disabled?: boolean;
	readonly?: boolean;
	metadata: Omit<MultiSelectControlMetadata, "type" | "appearance">;
};

const THEME_TEST_THEMES: EditorControlTheme[] = [
	"auto",
	"plain",
	"parchment",
	"blueprint",
	"terminal",
	"mothmark",
];

const COMMAND_OPTIONS = [
	{label: "Look", value: "look", description: "Inspect the current room."},
	{label: "Take", value: "take", description: "Pick up a nearby item."},
	{label: "Use", value: "use", description: "Apply an item or command target."},
	{label: "Talk", value: "talk", description: "Open character dialogue."},
	{label: "Debug", value: "debug", description: "Developer-only command.", disabled: true},
];

const MULTI_SELECT_SETUPS = {
	basic: {
		id: "basic",
		value: ["look", "use"],
		metadata: {
			title: "Allowed Commands",
			description: "Multiple choices from a known option list.",
			features: {
				options: COMMAND_OPTIONS,
				clearButton: true,
			},
		},
	},
	noHeader: {
		id: "no-header",
		value: ["take"],
		metadata: {
			features: {
				options: COMMAND_OPTIONS,
			},
		},
	},
	error: {
		id: "error",
		value: [],
		error: "Select at least one command.",
		metadata: {
			title: "Errored Multi-Select",
			description: "Used to test validation styling.",
			required: true,
			features: {
				options: COMMAND_OPTIONS,
			},
		},
	},
	warning: {
		id: "warning",
		value: ["look", "talk"],
		warnings: ["Dialogue commands are valid here, but no character is assigned yet."],
		metadata: {
			title: "Warning Multi-Select",
			description: "Used to test warning styling.",
			features: {
				options: COMMAND_OPTIONS,
			},
		},
	},
	disabled: {
		id: "disabled",
		value: ["look", "take"],
		disabled: true,
		metadata: {
			title: "Disabled Multi-Select",
			description: "Parent props disable this field.",
			features: {
				options: COMMAND_OPTIONS,
				clearButton: true,
			},
		},
	},
	readonly: {
		id: "readonly",
		value: ["look"],
		readonly: true,
		metadata: {
			title: "Readonly Multi-Select",
			description: "Parent props mark this field readonly.",
			features: {
				options: COMMAND_OPTIONS,
			},
		},
	},
	maxSelected: {
		id: "max-selected",
		value: ["look", "take"],
		metadata: {
			title: "Max Selected",
			description: "Tests maxSelected disabling for unselected options.",
			features: {
				options: COMMAND_OPTIONS,
				maxSelected: 2,
				clearButton: true,
			},
		},
	},
} satisfies Record<string, MultiSelectSetup>;

function makeMultiSelectVariant({
	id,
	description,
	appearance,
	setup,
	themes,
}: {
	id: string;
	description: string;
	appearance: Pick<EditorControlAppearance, "tone" | "chrome" | "size">;
	setup: MultiSelectSetup;
	themes?: EditorControlTheme[];
}): ControlMatrixVariant<string[], MultiSelectControlMetadata> {
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
			type: "multi-select",
		},
	};
}

export const multiSelectControlMatrixVariants: Array<
	ControlMatrixVariant<string[], MultiSelectControlMetadata>
> = [
	makeMultiSelectVariant({
		id: "theme-default-field-md-basic",
		description: "Theme test. Renders the baseline multi-select with each explicit theme.",
		appearance: {
			tone: "default",
			chrome: "field",
			size: "md",
		},
		setup: MULTI_SELECT_SETUPS.basic,
		themes: THEME_TEST_THEMES,
	}),
	...(["default", "quiet", "terminal", "paper", "panel"] as const).map((tone) =>
		makeMultiSelectVariant({
			id: `${tone}-field-md-basic`,
			description: `${tone} tone multi-select using auto theme across parent surfaces.`,
			appearance: {
				tone,
				chrome: "field",
				size: "md",
			},
			setup: MULTI_SELECT_SETUPS.basic,
		}),
	),
	...(["card", "inline", "compact", "bare"] as const).map((chrome) =>
		makeMultiSelectVariant({
			id: `default-${chrome}-md-basic`,
			description: `${chrome} chrome multi-select using auto theme.`,
			appearance: {
				tone: "default",
				chrome,
				size: "md",
			},
			setup: MULTI_SELECT_SETUPS.basic,
		}),
	),
	...(["sm", "lg"] as const).map((size) =>
		makeMultiSelectVariant({
			id: `default-field-${size}-basic`,
			description: `${size} size multi-select using auto theme.`,
			appearance: {
				tone: "default",
				chrome: "field",
				size,
			},
			setup: MULTI_SELECT_SETUPS.basic,
		}),
	),
	...[
		MULTI_SELECT_SETUPS.noHeader,
		MULTI_SELECT_SETUPS.error,
		MULTI_SELECT_SETUPS.warning,
		MULTI_SELECT_SETUPS.disabled,
		MULTI_SELECT_SETUPS.readonly,
		MULTI_SELECT_SETUPS.maxSelected,
	].map((setup) =>
		makeMultiSelectVariant({
			id: `default-field-md-${setup.id}`,
			description: `${setup.id} multi-select variant using auto theme.`,
			appearance: {
				tone: "default",
				chrome: "field",
				size: "md",
			},
			setup,
		}),
	),
];
