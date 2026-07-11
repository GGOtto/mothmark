import type {SelectControlMetadata} from "../../../components/universal-editor/SelectEditor";
import type {
	EditorControlAppearance,
	EditorControlTheme,
} from "../../../types/universalEditorTypes";
import type {ControlMatrixVariant} from "../ControlMatrix";

type SelectSetup = {
	id: string;
	value: string;
	error?: string;
	warnings?: string[];
	disabled?: boolean;
	readonly?: boolean;
	metadata: Omit<SelectControlMetadata, "type" | "appearance">;
};

const THEME_TEST_THEMES: EditorControlTheme[] = [
	"auto",
	"plain",
	"parchment",
	"blueprint",
	"terminal",
	"mothmark",
];

const DIRECTION_OPTIONS = [
	{label: "North", value: "north", description: "Moves toward the upper edge of the map."},
	{label: "East", value: "east", description: "Moves toward the right edge of the map."},
	{label: "South", value: "south", description: "Moves toward the lower edge of the map."},
	{label: "West", value: "west", description: "Moves toward the left edge of the map."},
	{label: "Secret", value: "secret", description: "Reserved for hidden exits.", disabled: true},
];

const SELECT_SETUPS = {
	basic: {
		id: "basic",
		value: "north",
		metadata: {
			title: "Exit Direction",
			description: "Single choice from known enum-like values.",
			required: true,
			features: {
				options: DIRECTION_OPTIONS,
				placeholder: "Choose direction",
			},
		},
	},
	noHeader: {
		id: "no-header",
		value: "east",
		metadata: {
			features: {
				options: DIRECTION_OPTIONS,
			},
		},
	},
	placeholder: {
		id: "placeholder",
		value: "",
		metadata: {
			title: "Placeholder Select",
			description: "Tests empty placeholder rendering.",
			features: {
				options: DIRECTION_OPTIONS,
				placeholder: "Choose an exit",
			},
		},
	},
	error: {
		id: "error",
		value: "",
		error: "A direction is required.",
		metadata: {
			title: "Errored Select",
			description: "Used to test validation styling.",
			required: true,
			features: {
				options: DIRECTION_OPTIONS,
				placeholder: "Choose direction",
			},
		},
	},
	warning: {
		id: "warning",
		value: "south",
		warnings: ["This direction is valid, but there is no matching room yet."],
		metadata: {
			title: "Warning Select",
			description: "Used to test warning styling.",
			features: {
				options: DIRECTION_OPTIONS,
			},
		},
	},
	disabled: {
		id: "disabled",
		value: "west",
		disabled: true,
		metadata: {
			title: "Disabled Select",
			description: "Parent props disable this field.",
			features: {
				options: DIRECTION_OPTIONS,
			},
		},
	},
	readonly: {
		id: "readonly",
		value: "north",
		readonly: true,
		metadata: {
			title: "Readonly Select",
			description: "Parent props mark this field readonly.",
			features: {
				options: DIRECTION_OPTIONS,
			},
		},
	},
} satisfies Record<string, SelectSetup>;

function makeSelectVariant({
	id,
	description,
	appearance,
	setup,
	themes,
}: {
	id: string;
	description: string;
	appearance: Pick<EditorControlAppearance, "tone" | "chrome" | "size">;
	setup: SelectSetup;
	themes?: EditorControlTheme[];
}): ControlMatrixVariant<string, SelectControlMetadata> {
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
			type: "select",
		},
	};
}

export const selectControlMatrixVariants: Array<
	ControlMatrixVariant<string, SelectControlMetadata>
> = [
	makeSelectVariant({
		id: "theme-default-field-md-basic",
		description: "Theme test. Renders the baseline select with each explicit theme.",
		appearance: {
			tone: "default",
			chrome: "field",
			size: "md",
		},
		setup: SELECT_SETUPS.basic,
		themes: THEME_TEST_THEMES,
	}),
	...(["default", "quiet", "terminal", "paper", "panel"] as const).map((tone) =>
		makeSelectVariant({
			id: `${tone}-field-md-basic`,
			description: `${tone} tone select using auto theme across parent surfaces.`,
			appearance: {
				tone,
				chrome: "field",
				size: "md",
			},
			setup: SELECT_SETUPS.basic,
		}),
	),
	...(["card", "inline", "compact", "bare"] as const).map((chrome) =>
		makeSelectVariant({
			id: `default-${chrome}-md-basic`,
			description: `${chrome} chrome select using auto theme.`,
			appearance: {
				tone: "default",
				chrome,
				size: "md",
			},
			setup: SELECT_SETUPS.basic,
		}),
	),
	...(["sm", "lg"] as const).map((size) =>
		makeSelectVariant({
			id: `default-field-${size}-basic`,
			description: `${size} size select using auto theme.`,
			appearance: {
				tone: "default",
				chrome: "field",
				size,
			},
			setup: SELECT_SETUPS.basic,
		}),
	),
	...[
		SELECT_SETUPS.noHeader,
		SELECT_SETUPS.placeholder,
		SELECT_SETUPS.error,
		SELECT_SETUPS.warning,
		SELECT_SETUPS.disabled,
		SELECT_SETUPS.readonly,
	].map((setup) =>
		makeSelectVariant({
			id: `default-field-md-${setup.id}`,
			description: `${setup.id} select variant using auto theme.`,
			appearance: {
				tone: "default",
				chrome: "field",
				size: "md",
			},
			setup,
		}),
	),
];
