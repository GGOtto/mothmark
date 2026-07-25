import type {ConditionBuilderControlMetadata} from "../../../components/universal-editor/ConditionBuilderEditor";
import type {
	EditorControlAppearance,
	EditorControlTheme,
} from "../../../types/universalEditorTypes";
import type {ControlMatrixVariant} from "../ControlMatrix";
import {toID} from "../../../utils/idUtils";

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
			features: {
				allowNestedGroups: true,
				conditionTypeOptionSource: "schema.condition.types",
				groupOperatorOptionSource: "schema.condition.groupOperators",
				comparisonOperatorOptionSource: "schema.condition.comparisonOperators",
				operatorOptionSourcesByType: {
					flag: "schema.condition.flagOperations",
					counter: "schema.condition.counterOperations",
					"current-room": "schema.condition.currentRoomOperations",
				},
			},
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
			features: {
				allowNestedGroups: true,
				compact: false,
				conditionTypeOptionSource: "schema.condition.types",
				groupOperatorOptionSource: "schema.condition.groupOperators",
				comparisonOperatorOptionSource: "schema.condition.comparisonOperators",
				operatorOptionSourcesByType: {
					flag: "schema.condition.flagOperations",
					counter: "schema.condition.counterOperations",
					"current-room": "schema.condition.currentRoomOperations",
				},
			},
		},
	},
	restricted: {
		id: "restricted",
		value: {type: "current-room", operation: "is", roomId: toID("room", "foyer")},
		metadata: {
			title: "Restricted Types",
			features: {
				allowedConditionTypes: ["current-room", "inventory"],
				compact: true,
				conditionTypeOptionSource: "schema.condition.types",
				operatorOptionSourcesByType: {
					"current-room": "schema.condition.currentRoomOperations",
				},
			},
		},
	},
	listDriven: {
		id: "list-driven",
		value: {type: "counter", operation: "compare", counter: "turns", operator: "gte", value: 2},
		metadata: {
			title: "World Data Lists",
			description: "Condition and operator choices are supplied by named option lists.",
			features: {
				conditionTypeOptionSource: "schema.condition.types",
				groupOperatorOptionSource: "schema.condition.groupOperators",
				comparisonOperatorOptionSource: "schema.condition.comparisonOperators",
				operatorOptionSourcesByType: {
					counter: "schema.condition.counterOperations",
				},
				showGeneratedSummary: true,
			},
		},
	},
	error: {
		id: "error",
		value: {type: "flag", operation: "equals", flag: "", value: true},
		error: "Flag id is required.",
		metadata: {
			title: "Errored Condition",
			features: {
				allowNestedGroups: true,
				conditionTypeOptionSource: "schema.condition.types",
				operatorOptionSourcesByType: {flag: "schema.condition.flagOperations"},
			},
		},
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
		"default-field-md-list-driven",
		"List-sourced condition types and operators.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.listDriven,
	),
	makeVariant(
		"default-field-md-error",
		"Error state condition builder.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.error,
	),
];
