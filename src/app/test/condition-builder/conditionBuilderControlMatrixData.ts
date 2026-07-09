import type {ConditionBuilderControlMetadata} from "../../../components/editor/universal/ConditionBuilderEditor";
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

type ConditionSetup = {
	id: string;
	value: Record<string, unknown>;
	error?: string;
	metadata: Omit<ConditionBuilderControlMetadata, "type" | "appearance">;
};

const SETUPS = {
	basic: {
		id: "basic",
		value: {type: "flag", operation: "equals", flag: "foyer.doorUnlocked", value: true},
		metadata: {
			title: "Flag Condition",
			description: "Simple scalar condition editing.",
			features: {allowNestedGroups: true},
		},
	},
	group: {
		id: "group",
		value: {
			type: "group",
			operator: "and",
			conditions: [
				{type: "flag", operation: "equals", flag: "library.lampLit", value: true},
				{type: "counter", operation: "compare", counter: "turns", operator: "gt", value: 3},
			],
		},
		metadata: {
			title: "Condition Group",
			description: "Nested group editing.",
			features: {allowNestedGroups: true, compact: false},
		},
	},
	restricted: {
		id: "restricted",
		value: {type: "current-room", operation: "is", roomId: "foyer"},
		metadata: {
			title: "Restricted Types",
			features: {allowedConditionTypes: ["current-room", "inventory"], compact: true},
		},
	},
	error: {
		id: "error",
		value: {type: "flag", operation: "equals", flag: "", value: true},
		error: "Flag id is required.",
		metadata: {title: "Errored Condition", features: {allowNestedGroups: true}},
	},
} satisfies Record<string, ConditionSetup>;

function makeVariant(
	id: string,
	description: string,
	appearance: Pick<EditorControlAppearance, "tone" | "chrome" | "size">,
	setup: ConditionSetup,
	themes?: EditorControlTheme[],
): ControlMatrixVariant<Record<string, unknown>, ConditionBuilderControlMetadata> {
	return {
		id,
		description,
		value: setup.value,
		error: setup.error,
		appearance,
		themes,
		metadata: {...setup.metadata, type: "condition-builder"},
	};
}

export const conditionBuilderControlMatrixVariants = [
	makeVariant(
		"theme-default-field-md-basic",
		"Theme test for condition builder.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.basic,
		THEME_TEST_THEMES,
	),
	makeVariant(
		"default-field-md-basic",
		"Baseline flag condition.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.basic,
	),
	makeVariant(
		"default-card-md-group",
		"Nested condition group.",
		{tone: "default", chrome: "card", size: "md"},
		SETUPS.group,
	),
	makeVariant(
		"panel-field-sm-restricted",
		"Restricted compact condition builder.",
		{tone: "panel", chrome: "field", size: "sm"},
		SETUPS.restricted,
	),
	makeVariant(
		"default-field-md-error",
		"Error state condition builder.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.error,
	),
];
