import type {NumberControlMetadata} from "../../../components/editor/universal/NumberFieldEditor";
import type {
	EditorControlAppearance,
	EditorControlTheme,
} from "../../../types/universalEditorTypes";
import type {ControlMatrixVariant} from "../ControlMatrix";

type NumberSetup = {
	id: string;
	value: number;
	error?: string;
	warnings?: string[];
	disabled?: boolean;
	readonly?: boolean;
	metadata: Omit<NumberControlMetadata, "type" | "appearance">;
};

const THEME_TEST_THEMES: EditorControlTheme[] = [
	"auto",
	"plain",
	"parchment",
	"blueprint",
	"terminal",
	"mothmark",
];

const NUMBER_SETUPS = {
	basic: {
		id: "basic",
		value: 12,
		metadata: {
			title: "X Coordinate",
			description: "Numeric position used by the map editor.",
			placeholder: "0",
			min: -100,
			max: 100,
			step: 1,
			required: true,
		},
	},
	noHeader: {
		id: "no-header",
		value: 3,
		metadata: {
			placeholder: "No title or description",
			min: 0,
			max: 10,
		},
	},
	error: {
		id: "error",
		value: 999,
		error: "Value must be inside the room grid.",
		metadata: {
			title: "Errored Number",
			description: "Used to test validation styling.",
			min: 0,
			max: 100,
		},
	},
	warning: {
		id: "warning",
		value: 85,
		warnings: ["Large values are valid, but they can make room layouts harder to scan."],
		metadata: {
			title: "Warning Number",
			description: "Used to test warning styling.",
			min: 0,
			max: 100,
		},
	},
	disabled: {
		id: "disabled",
		value: 7,
		disabled: true,
		metadata: {
			title: "Disabled Number",
			description: "Parent props disable this field.",
		},
	},
	readonly: {
		id: "readonly",
		value: 24,
		readonly: true,
		metadata: {
			title: "Readonly Number",
			description: "Parent props mark this field readonly.",
		},
	},
	unit: {
		id: "unit",
		value: 6,
		metadata: {
			title: "Cooldown",
			description: "Tests unit rendering.",
			min: 0,
			step: 1,
			features: {
				unit: "turns",
			},
		},
	},
	affixes: {
		id: "affixes",
		value: 42,
		metadata: {
			title: "Weighted Chance",
			description: "Tests prefix, suffix, and clear action.",
			min: 0,
			max: 100,
			step: 1,
			features: {
				prefix: "~",
				suffix: "%",
				clearButton: true,
			},
		},
	},
	slider: {
		id: "slider",
		value: 35,
		metadata: {
			title: "Volume",
			description: "Tests the optional range slider.",
			min: 0,
			max: 100,
			step: 5,
			features: {
				slider: true,
				unit: "%",
				clampOnBlur: true,
			},
		},
	},
} satisfies Record<string, NumberSetup>;

function makeNumberVariant({
	id,
	description,
	appearance,
	setup,
	themes,
}: {
	id: string;
	description: string;
	appearance: Pick<EditorControlAppearance, "tone" | "chrome" | "size">;
	setup: NumberSetup;
	themes?: EditorControlTheme[];
}): ControlMatrixVariant<number, NumberControlMetadata> {
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
			type: "number",
		},
	};
}

export const numberControlMatrixVariants: Array<
	ControlMatrixVariant<number, NumberControlMetadata>
> = [
	makeNumberVariant({
		id: "theme-default-field-md-basic",
		description: "Theme test. Renders the baseline number field with each explicit theme.",
		appearance: {
			tone: "default",
			chrome: "field",
			size: "md",
		},
		setup: NUMBER_SETUPS.basic,
		themes: THEME_TEST_THEMES,
	}),
	...(["default", "quiet", "terminal", "paper", "panel"] as const).map((tone) =>
		makeNumberVariant({
			id: `${tone}-field-md-basic`,
			description: `${tone} tone number field using auto theme across parent surfaces.`,
			appearance: {
				tone,
				chrome: "field",
				size: "md",
			},
			setup: NUMBER_SETUPS.basic,
		}),
	),
	...(["card", "inline", "compact", "bare"] as const).map((chrome) =>
		makeNumberVariant({
			id: `default-${chrome}-md-basic`,
			description: `${chrome} chrome number field using auto theme.`,
			appearance: {
				tone: "default",
				chrome,
				size: "md",
			},
			setup: NUMBER_SETUPS.basic,
		}),
	),
	...(["sm", "lg"] as const).map((size) =>
		makeNumberVariant({
			id: `default-field-${size}-basic`,
			description: `${size} size number field using auto theme.`,
			appearance: {
				tone: "default",
				chrome: "field",
				size,
			},
			setup: NUMBER_SETUPS.basic,
		}),
	),
	...[
		NUMBER_SETUPS.noHeader,
		NUMBER_SETUPS.error,
		NUMBER_SETUPS.warning,
		NUMBER_SETUPS.disabled,
		NUMBER_SETUPS.readonly,
		NUMBER_SETUPS.unit,
		NUMBER_SETUPS.affixes,
		NUMBER_SETUPS.slider,
	].map((setup) =>
		makeNumberVariant({
			id: `default-field-md-${setup.id}`,
			description: `${setup.id} number variant using auto theme.`,
			appearance: {
				tone: "default",
				chrome: "field",
				size: "md",
			},
			setup,
		}),
	),
];
