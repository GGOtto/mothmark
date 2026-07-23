import type {EffectListControlMetadata} from "../../../components/universal-editor/EffectListEditor";
import type {
	EditorControlAppearance,
	EditorControlTheme,
} from "../../../types/universalEditorTypes";
import {toID} from "../../../utils/idUtils";
import type {ControlMatrixVariant} from "../ControlMatrix";

const THEME_TEST_THEMES: EditorControlTheme[] = [
	"auto",
	"plain",
	"parchment",
	"blueprint",
	"terminal",
	"mothmark",
];

const FEATURES = {
	reorderable: true,
	duplicateable: true,
	removable: true,
	effectTypeOptionSource: "schema.effect.types",
	operationOptionSourcesByType: {
		message: "schema.effect.message.operations",
		flag: "schema.effect.flagOperations",
		counter: "schema.effect.counterOperations",
		player: "schema.effect.player.operations",
	},
	showGeneratedSummary: true,
};

const CHILD_CONTROLS: EffectListControlMetadata["childControls"] = {
	effectType: {control: "select", title: "Effect type"},
	operator: {control: "select", title: "Action"},
	flag: {title: "Flag"},
	value: {title: "Value"},
	counter: {control: "input", title: "Counter", placeholder: "Counter name"},
	amount: {control: "number", title: "Amount", placeholder: "Enter an amount"},
	message: {
		control: "textarea",
		title: "Message",
		placeholder: "Enter the message shown to the player",
	},
	messages: {control: "string-list", title: "Messages"},
	freezeMessage: {
		control: "input",
		title: "Freeze message",
		placeholder: "Optional message while frozen",
	},
	turns: {
		control: "number",
		title: "Turns",
		description: "Optional. Leave blank to freeze until another effect unfreezes the player.",
		placeholder: "No turn limit",
	},
	customDeathMessage: {
		control: "input",
		title: "Death message",
		placeholder: "Use the default death message",
	},
	roomId: {control: "entity-picker", title: "Room"},
	newRoomId: {control: "entity-picker", title: "New room"},
	featureId: {control: "entity-picker", title: "Feature"},
	variantId: {control: "input", title: "Variant ID", placeholder: "Variant ID"},
	direction: {control: "direction-picker", title: "Direction"},
	tag: {control: "input", title: "Tag", placeholder: "Tag name"},
	effectId: {control: "entity-picker", title: "Saved effect"},
};

type EffectSetup = {
	value: Record<string, unknown>[];
	worldEffects?: Record<string, unknown>[];
	error?: string;
	readonly?: boolean;
	metadata: Omit<EffectListControlMetadata, "type" | "appearance">;
};

const BASE_METADATA = {
	features: FEATURES,
	childControls: CHILD_CONTROLS,
};

const SETUPS = {
	basic: {
		value: [
			{type: "message", operation: "show", message: "The door opens."},
			{
				type: "flag",
				"flag-type": "normal",
				operation: "set",
				flag: "foyer.doorUnlocked",
				value: true,
			},
		],
		metadata: {
			title: "Command effects",
			description: "Runs in order after a command resolves.",
			...BASE_METADATA,
		},
	},
	freeze: {
		value: [{type: "player", operation: "freeze"}],
		metadata: {
			title: "Freeze player",
			description: "Optional fields remain visible even when their values are unset.",
			...BASE_METADATA,
		},
	},
	reference: {
		value: [{type: "effect-ref", effectId: toID("effect", "ring-bell")}],
		worldEffects: [
			{
				type: "group",
				id: toID("effect", "ring-bell"),
				name: "Ring the bell",
				effects: [{type: "message", operation: "show", message: "A bell rings somewhere below."}],
				allowMultipleUsesInWorld: true,
			},
		],
		metadata: {
			title: "Saved effect reference",
			description: "References choose from definitions already stored in world.effects.",
			...BASE_METADATA,
		},
	},
	collapsible: {
		value: [{type: "counter", operation: "increase", counter: "turns", amount: 1}],
		metadata: {
			title: "Collapsible effects",
			features: {...FEATURES, collapsibleItems: true},
			childControls: CHILD_CONTROLS,
		},
	},
	restricted: {
		value: [{type: "player", operation: "unfreeze"}],
		metadata: {
			title: "Restricted effects",
			features: {...FEATURES, allowedEffectTypes: ["player"]},
			childControls: CHILD_CONTROLS,
		},
	},
	error: {
		value: [
			{
				type: "flag",
				"flag-type": "normal",
				operation: "set",
				flag: "",
				value: true,
			},
		],
		error: "Flag id is required.",
		metadata: {
			title: "Errored effects",
			...BASE_METADATA,
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
		worldEffects: setup.worldEffects,
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
		"Theme coverage for an ordered effect list.",
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
		"panel-field-md-freeze",
		"Freeze action with unset optional message and turns.",
		{tone: "panel", chrome: "field", size: "md"},
		SETUPS.freeze,
	),
	makeVariant(
		"default-field-md-reference",
		"Select an existing saved effect reference.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.reference,
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
		"danger-card-md-error",
		"Error state effect list.",
		{tone: "danger", chrome: "card", size: "md"},
		SETUPS.error,
	),
];
