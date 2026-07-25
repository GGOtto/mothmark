import type {EffectControlMetadata} from "../../../components/universal-editor/EffectEditor";
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

const CHILD_CONTROLS: EffectControlMetadata["childControls"] = {
	name: {
		control: "input",
		title: "Group name",
		placeholder: "What does this group accomplish?",
	},
	effects: {control: "effect-list", title: "Effects"},
	effectType: {
		control: "select",
		title: "Effect type",
		description: "Choose what should happen.",
	},
	operator: {control: "select", title: "Action"},
	message: {
		control: "textarea",
		title: "Message",
		placeholder: "Enter the message shown to the player",
	},
	flag: {control: "flag-picker", title: "Flag"},
	value: {
		control: "toggle",
		title: "Value",
		features: {labels: {on: "True", off: "False"}},
	},
	counter: {control: "input", title: "Counter", placeholder: "Counter name"},
	amount: {control: "number", title: "Amount", placeholder: "Enter an amount"},
	customDeathMessage: {
		control: "input",
		title: "Death message",
		placeholder: "Use the default death message",
	},
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
	roomId: {control: "entity-picker", title: "Destination"},
	effectId: {control: "entity-picker", title: "Saved effect group"},
};

const FEATURES = {
	effectTypeOptionSource: "schema.effect.types",
	operationOptionSourcesByType: {
		message: "schema.effect.message.operations",
		flag: "schema.effect.flagOperations",
		counter: "schema.effect.counterOperations",
		player: "schema.effect.player.operations",
	},
	showGeneratedSummary: true,
	reorderable: true,
	duplicateable: true,
	removable: true,
	collapsibleItems: true,
};

type EffectSetup = {
	value: Record<string, unknown>;
	worldEffects?: Record<string, unknown>[];
	error?: string;
	readonly?: boolean;
	metadata: Omit<EffectControlMetadata, "type" | "appearance">;
};

function group(id: string, name: string, effects: Record<string, unknown>[]) {
	return {
		type: "group",
		id: toID("effect", id),
		name,
		effects,
		allowMultipleUsesInWorld: true,
	};
}

const BASE_METADATA = {
	features: FEATURES,
	childControls: CHILD_CONTROLS,
};

const SETUPS = {
	basic: {
		value: group("open-gate", "Open the gate", [
			{type: "message", operation: "show", message: "The iron gate groans open."},
			{
				type: "flag",
				"flag-type": "normal",
				operation: "set",
				flag: "foyer.doorUnlocked",
				value: true,
			},
		]),
		metadata: {
			title: "Effect group",
			description: "One outcome composed from an ordered list of concrete effects.",
			...BASE_METADATA,
		},
	},
	empty: {
		value: group("new-effect-group", "", []),
		metadata: {
			title: "Empty group",
			description: "An empty group receives a sensible default name automatically.",
			...BASE_METADATA,
		},
	},
	freeze: {
		value: group("freeze-player", "", [{type: "player", operation: "freeze"}]),
		metadata: {
			title: "Optional effect fields",
			description:
				"The name is generated from the freeze effect, while optional fields remain visible.",
			...BASE_METADATA,
		},
	},
	reusable: {
		value: group("ring-bell", "Ring the bell", [
			{type: "message", operation: "show", message: "A bell rings below."},
		]),
		worldEffects: [
			group("ring-bell", "Ring the bell", [
				{type: "message", operation: "show", message: "A bell rings below."},
			]),
		],
		metadata: {
			title: "Saved group",
			description: "Reusable groups stay synchronized with world.effects.",
			...BASE_METADATA,
		},
	},
	reference: {
		value: group("open-and-ring", "Open and ring", [
			{type: "effect-ref", effectId: toID("effect", "ring-bell")},
			{type: "message", operation: "show", message: "The gate opens."},
		]),
		worldEffects: [
			group("ring-bell", "Ring the bell", [
				{type: "message", operation: "show", message: "A bell rings below."},
			]),
		],
		metadata: {
			title: "Group reference",
			description: "Child rows can reference another saved group without nesting it inline.",
			...BASE_METADATA,
		},
	},
	restricted: {
		value: group("player-only", "Player only", [
			{type: "player", operation: "teleport", roomId: toID("room", "library")},
		]),
		metadata: {
			title: "Restricted group",
			description: "Metadata can narrow the available concrete effect types.",
			features: {...FEATURES, allowedEffectTypes: ["player", "effect-ref"]},
			childControls: CHILD_CONTROLS,
		},
	},
	readonly: {
		value: group("inherited", "Inherited outcome", [
			{type: "message", operation: "show", message: "This outcome is inherited."},
		]),
		readonly: true,
		metadata: {
			title: "Inherited group",
			description: "Readonly state remains legible without suggesting edits.",
			...BASE_METADATA,
		},
	},
	error: {
		value: group("invalid-group", "Invalid group", [
			{type: "flag", "flag-type": "normal", operation: "set", flag: "", value: true},
		]),
		error: "Choose a flag before saving this group.",
		metadata: {
			title: "Group with an error",
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
): ControlMatrixVariant<Record<string, unknown>, EffectControlMetadata> {
	return {
		id,
		description,
		value: setup.value,
		worldEffects: setup.worldEffects,
		error: setup.error,
		readonly: setup.readonly,
		appearance,
		themes,
		metadata: {...setup.metadata, type: "effect"},
	};
}

export const effectControlMatrixVariants = [
	makeVariant(
		"theme-default-field-md-basic",
		"Theme coverage for the complete effect group control.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.basic,
		THEME_TEST_THEMES,
	),
	makeVariant(
		"default-field-md-basic",
		"Baseline group.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.basic,
	),
	makeVariant(
		"default-card-md-empty",
		"Empty group.",
		{tone: "default", chrome: "card", size: "md"},
		SETUPS.empty,
	),
	makeVariant(
		"panel-field-md-freeze",
		"Unset optional fields.",
		{tone: "panel", chrome: "field", size: "md"},
		SETUPS.freeze,
	),
	makeVariant(
		"success-card-md-reusable",
		"Saved group.",
		{tone: "success", chrome: "card", size: "md"},
		SETUPS.reusable,
	),
	makeVariant(
		"default-field-md-reference",
		"Reference another group.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.reference,
	),
	makeVariant(
		"panel-field-sm-restricted",
		"Restricted child types.",
		{tone: "panel", chrome: "field", size: "sm"},
		SETUPS.restricted,
	),
	makeVariant(
		"default-field-md-readonly",
		"Readonly group.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.readonly,
	),
	makeVariant(
		"danger-card-md-error",
		"Validation error.",
		{tone: "danger", chrome: "card", size: "md"},
		SETUPS.error,
	),
];
