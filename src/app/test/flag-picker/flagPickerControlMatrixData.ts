import type {FlagPickerControlMetadata} from "../../../components/universal-editor/FlagPickerEditor";
import type {
	EditorControlAppearance,
	EditorControlTheme,
} from "../../../types/universalEditorTypes";
import type {ControlMatrixVariant} from "../ControlMatrix";

const THEME_TEST_THEMES: EditorControlTheme[] = [
	"auto",
	"plain",
	"parchment",
	"blueprint",
	"terminal",
	"mothmark",
];

type FlagSetup = {
	id: string;
	value: string;
	error?: string;
	readonly?: boolean;
	metadata: Omit<FlagPickerControlMetadata, "type" | "appearance">;
};

const SETUPS = {
	basic: {
		id: "basic",
		value: "foyer.doorUnlocked",
		metadata: {
			title: "Flag",
			description: "Uses the matrix sample flag registry.",
			features: {clearButton: true},
		},
	},
	usage: {
		id: "usage",
		value: "library.lampLit",
		metadata: {
			title: "Usage Counts",
			features: {
				showUsageCount: true,
				options: [
					{
						id: "library.lampLit",
						label: "Lamp lit",
						description: "Boolean flag",
						kind: "boolean",
						usageCount: 3,
					},
					{
						id: "library.visitCount",
						label: "Visit count",
						description: "Number flag",
						kind: "number",
						usageCount: 7,
					},
				],
			},
		},
	},
	create: {
		id: "create",
		value: "new.flag",
		metadata: {title: "Create Flag", features: {allowCreate: true, clearButton: true}},
	},
	error: {
		id: "error",
		value: "",
		error: "Select a flag.",
		metadata: {title: "Errored Flag", features: {clearButton: true}},
	},
	readonly: {
		id: "readonly",
		value: "archive.hasReadLedger",
		readonly: true,
		metadata: {title: "Readonly Flag"},
	},
} satisfies Record<string, FlagSetup>;

function makeVariant(
	id: string,
	description: string,
	appearance: Pick<EditorControlAppearance, "tone" | "chrome" | "size">,
	setup: FlagSetup,
	themes?: EditorControlTheme[],
): ControlMatrixVariant<string, FlagPickerControlMetadata> {
	return {
		id,
		description,
		value: setup.value,
		error: setup.error,
		readonly: setup.readonly,
		appearance,
		themes,
		metadata: {...setup.metadata, type: "flag-picker"},
	};
}

export const flagPickerControlMatrixVariants = [
	makeVariant(
		"theme-default-field-md-basic",
		"Theme test for flag picker.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.basic,
		THEME_TEST_THEMES,
	),
	makeVariant(
		"default-field-md-basic",
		"Baseline flag picker.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.basic,
	),
	makeVariant(
		"default-card-md-usage",
		"Usage count and explicit options.",
		{tone: "default", chrome: "card", size: "md"},
		SETUPS.usage,
	),
	makeVariant(
		"default-field-md-create",
		"Create/unknown flag state.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.create,
	),
	makeVariant(
		"default-field-md-error",
		"Error state flag picker.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.error,
	),
	makeVariant(
		"quiet-bare-sm-readonly",
		"Readonly bare flag picker.",
		{tone: "quiet", chrome: "bare", size: "sm"},
		SETUPS.readonly,
	),
];
