import type {EffectListControlMetadata} from "../../../components/universal-editor/EffectListEditor";
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

type EffectSetup = {
	id: string;
	value: Record<string, unknown>[];
	error?: string;
	readonly?: boolean;
	metadata: Omit<EffectListControlMetadata, "type" | "appearance">;
};

const SETUPS = {
	basic: {
		id: "basic",
		value: [
			{type: "message", messageType: "show", text: "The door opens."},
			{type: "flag", operation: "set", flag: "foyer.doorUnlocked", value: true},
		],
		metadata: {
			title: "Command Effects",
			description: "Runs in order after a command resolves.",
			features: {
				reorderable: true,
				duplicateable: true,
				removable: true,
				effectTypeOptionSource: "schema.effect.types",
				operationOptionSourcesByType: {
					flag: "schema.effect.flagOperations",
					counter: "schema.effect.counterOperations",
				},
			},
		},
	},
	collapsible: {
		id: "collapsible",
		value: [{type: "counter", operation: "increase", counter: "turns", amount: 1}],
		metadata: {
			title: "Collapsible Effects",
			features: {
				collapsibleItems: true,
				effectTypeOptionSource: "schema.effect.types",
				operationOptionSourcesByType: {
					counter: "schema.effect.counterOperations",
				},
			},
		},
	},
	restricted: {
		id: "restricted",
		value: [{type: "flow", operation: "stop-processing"}],
		metadata: {
			title: "Restricted Effects",
			features: {
				allowedEffectTypes: ["message", "flow"],
				effectTypeOptionSource: "schema.effect.types",
			},
		},
	},
	listDriven: {
		id: "list-driven",
		value: [
			{type: "counter", operation: "increase", counter: "turns", amount: 1},
			{type: "item-location", operation: "move-to-room", itemId: "brass-key", roomId: "library"},
		],
		metadata: {
			title: "World Data Lists",
			description: "Effect type and action lists are supplied by named option lists.",
			features: {
				effectTypeOptionSource: "schema.effect.types",
				operationOptionSourcesByType: {
					counter: "schema.effect.counterOperations",
				},
				showGeneratedSummary: true,
			},
		},
	},
	error: {
		id: "error",
		value: [{type: "flag", operation: "set", flag: "", value: true}],
		error: "Flag id is required.",
		metadata: {
			title: "Errored Effects",
			features: {
				removable: true,
				effectTypeOptionSource: "schema.effect.types",
				operationOptionSourcesByType: {flag: "schema.effect.flagOperations"},
			},
		},
	},
} satisfies Record<string, EffectSetup>;

function makeVariant(
	id: string,
	description: string,
	appearance: Pick<EditorControlAppearance, "tone" | "chrome" | "size">,
	setup: EffectSetup,
	themes?: EditorControlTheme[],
): ControlMatrixVariant<Record<string, unknown>[], EffectListControlMetadata> {
	return {
		id,
		description,
		value: setup.value,
		error: setup.error,
		readonly: setup.readonly,
		appearance,
		themes,
		metadata: {...setup.metadata, type: "effect-list"},
	};
}

export const effectListControlMatrixVariants = [
	makeVariant(
		"theme-default-field-md-basic",
		"Theme test for effect list.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.basic,
		THEME_TEST_THEMES,
	),
	makeVariant(
		"default-field-md-basic",
		"Baseline ordered effect list.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.basic,
	),
	makeVariant(
		"default-card-md-collapsible",
		"Collapsible effect item.",
		{tone: "default", chrome: "card", size: "md"},
		SETUPS.collapsible,
	),
	makeVariant(
		"panel-field-sm-restricted",
		"Restricted effect types.",
		{tone: "panel", chrome: "field", size: "sm"},
		SETUPS.restricted,
	),
	makeVariant(
		"default-field-md-list-driven",
		"List-sourced effect types and operations.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.listDriven,
	),
	makeVariant(
		"default-field-md-error",
		"Error state effect list.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.error,
	),
];
