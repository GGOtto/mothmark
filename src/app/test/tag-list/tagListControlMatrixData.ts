import type {TagListControlMetadata} from "../../../components/universal-editor/TagListEditor";
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

type TagListSetup = {
	id: string;
	value: string[];
	error?: string;
	warnings?: string[];
	disabled?: boolean;
	readonly?: boolean;
	metadata: Omit<TagListControlMetadata, "type" | "appearance">;
};

const SETUPS = {
	basic: {
		id: "basic",
		value: ["look", "inspect"],
		metadata: {
			title: "Aliases",
			description: "Short alternate command words.",
			placeholder: "Add alias",
			features: {
				transform: "lowercase",
				suggestions: ["examine", "search", "study"],
				addOnComma: true,
			},
		},
	},
	error: {
		id: "error",
		value: [],
		error: "At least one alias is required.",
		metadata: {title: "Errored Tags", features: {maxItems: 4}},
	},
	readonly: {
		id: "readonly",
		value: ["generated", "locked"],
		readonly: true,
		metadata: {title: "Readonly Tags", description: "Cannot be edited here."},
	},
	limited: {
		id: "limited",
		value: ["north", "east"],
		metadata: {
			title: "Limited Tags",
			description: "Tests maxItems, ID transform, and suggestions.",
			features: {maxItems: 3, transform: "id", suggestions: ["south", "west"], addOnBlur: true},
		},
	},
} satisfies Record<string, TagListSetup>;

function makeVariant(
	id: string,
	description: string,
	appearance: Pick<EditorControlAppearance, "tone" | "chrome" | "size">,
	setup: TagListSetup,
	themes?: EditorControlTheme[],
): ControlMatrixVariant<string[], TagListControlMetadata> {
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
		metadata: {...setup.metadata, type: "tag-list"},
	};
}

export const tagListControlMatrixVariants = [
	makeVariant(
		"theme-default-field-md-basic",
		"Theme test for tag-list.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.basic,
		THEME_TEST_THEMES,
	),
	makeVariant(
		"default-field-md-basic",
		"Baseline editable tag-list.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.basic,
	),
	makeVariant(
		"default-inline-md-basic",
		"Inline chrome tag-list.",
		{tone: "default", chrome: "inline", size: "md"},
		SETUPS.basic,
	),
	makeVariant(
		"default-field-md-error",
		"Error state tag-list.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.error,
	),
	makeVariant(
		"default-field-md-readonly",
		"Readonly tag-list.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.readonly,
	),
	makeVariant(
		"panel-card-sm-limited",
		"Compact limited tag-list.",
		{tone: "panel", chrome: "card", size: "sm"},
		SETUPS.limited,
	),
];
