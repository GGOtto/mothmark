import type {StringListControlMetadata} from "../../../components/universal-editor/StringListEditor";
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

type StringListSetup = {
	id: string;
	value: string[];
	error?: string;
	warnings?: string[];
	disabled?: boolean;
	readonly?: boolean;
	metadata: Omit<StringListControlMetadata, "type" | "appearance">;
};

const SETUPS = {
	basic: {
		id: "basic",
		value: ["The lock clicks open.", "The door gives a tired sigh."],
		metadata: {
			title: "Alternate Messages",
			description: "Longer text rows edited as stacked fields.",
			features: {addLabel: "Add message", itemPlaceholder: "Message text", reorderable: true},
		},
	},
	actions: {
		id: "actions",
		value: ["take brass key", "pick up key"],
		metadata: {
			title: "Command Examples",
			description: "Tests duplicate, reorder, min, and max behavior.",
			features: {duplicateable: true, reorderable: true, minItems: 1, maxItems: 4},
		},
	},
	error: {
		id: "error",
		value: [],
		error: "Add at least one example.",
		metadata: {title: "Errored String List", features: {minItems: 1}},
	},
	disabled: {
		id: "disabled",
		value: ["Locked row"],
		disabled: true,
		metadata: {title: "Disabled String List"},
	},
} satisfies Record<string, StringListSetup>;

function makeVariant(
	id: string,
	description: string,
	appearance: Pick<EditorControlAppearance, "tone" | "chrome" | "size">,
	setup: StringListSetup,
	themes?: EditorControlTheme[],
): ControlMatrixVariant<string[], StringListControlMetadata> {
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
		metadata: {...setup.metadata, type: "string-list"},
	};
}

export const stringListControlMatrixVariants = [
	makeVariant(
		"theme-default-field-md-basic",
		"Theme test for string-list.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.basic,
		THEME_TEST_THEMES,
	),
	makeVariant(
		"default-field-md-basic",
		"Baseline string-list.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.basic,
	),
	makeVariant(
		"default-card-md-actions",
		"Action-heavy string-list.",
		{tone: "default", chrome: "card", size: "md"},
		SETUPS.actions,
	),
	makeVariant(
		"default-field-md-error",
		"Error state string-list.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.error,
	),
	makeVariant(
		"quiet-bare-sm-disabled",
		"Disabled bare string-list.",
		{tone: "quiet", chrome: "bare", size: "sm"},
		SETUPS.disabled,
	),
];
