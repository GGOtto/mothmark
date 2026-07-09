import type {DiscriminatedUnionControlMetadata} from "../../../components/editor/universal/DiscriminatedUnionEditor";
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

const UNION_METADATA: Omit<DiscriminatedUnionControlMetadata, "type" | "appearance"> = {
	title: "Effect Branch",
	description: "Switches fields when the type discriminator changes.",
	features: {
		discriminator: "type",
		options: [
			{
				label: "Message",
				value: "message",
				description: "Shows text to the player.",
				defaultValue: {type: "message", text: ""},
				fields: [{key: "text", metadata: {type: "textarea", title: "Text", features: {minRows: 2}}}],
			},
			{
				label: "Flag",
				value: "flag",
				description: "Updates a game-state flag.",
				defaultValue: {type: "flag", flag: "", value: true},
				fields: [
					{key: "flag", metadata: {type: "flag-picker", title: "Flag", features: {clearButton: true}}},
					{key: "value", metadata: {type: "toggle", title: "Value"}},
				],
			},
		],
	},
};

type UnionSetup = {
	id: string;
	value: Record<string, unknown>;
	error?: string;
	metadata: Omit<DiscriminatedUnionControlMetadata, "type" | "appearance">;
};

const SETUPS = {
	basic: {id: "basic", value: {type: "message", text: "The door opens."}, metadata: UNION_METADATA},
	flag: {
		id: "flag",
		value: {type: "flag", flag: "foyer.doorUnlocked", value: true},
		metadata: UNION_METADATA,
	},
	error: {
		id: "error",
		value: {type: "flag", flag: "", value: true},
		error: "The active branch is incomplete.",
		metadata: UNION_METADATA,
	},
} satisfies Record<string, UnionSetup>;

function makeVariant(
	id: string,
	description: string,
	appearance: Pick<EditorControlAppearance, "tone" | "chrome" | "size">,
	setup: UnionSetup,
	themes?: EditorControlTheme[],
): ControlMatrixVariant<Record<string, unknown>, DiscriminatedUnionControlMetadata> {
	return {
		id,
		description,
		value: setup.value,
		error: setup.error,
		appearance,
		themes,
		metadata: {...setup.metadata, type: "discriminated-union"},
	};
}

export const discriminatedUnionControlMatrixVariants = [
	makeVariant(
		"theme-default-field-md-basic",
		"Theme test for discriminated union.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.basic,
		THEME_TEST_THEMES,
	),
	makeVariant(
		"default-field-md-basic",
		"Baseline message branch.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.basic,
	),
	makeVariant(
		"default-card-md-flag",
		"Flag branch with nested picker.",
		{tone: "default", chrome: "card", size: "md"},
		SETUPS.flag,
	),
	makeVariant(
		"default-field-md-error",
		"Error state branch.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.error,
	),
];
