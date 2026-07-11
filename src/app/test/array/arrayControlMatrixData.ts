import type {ArrayControlMetadata} from "../../../components/universal-editor/ArrayEditor";
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

type ArraySetup = {
	id: string;
	value: unknown[];
	error?: string;
	readonly?: boolean;
	metadata: Omit<ArrayControlMetadata, "type" | "appearance">;
};

const ITEM_METADATA = {
	type: "object" as const,
	features: {
		fields: [
			{key: "id", metadata: {type: "input" as const, title: "ID", transform: "id" as const}},
			{key: "label", metadata: {type: "input" as const, title: "Label"}},
		],
	},
};

const SETUPS = {
	basic: {
		id: "basic",
		value: [
			{id: "brass-key", label: "Brass Key"},
			{id: "silver-coin", label: "Silver Coin"},
		],
		metadata: {
			title: "Inventory Items",
			description: "Structured repeatable items.",
			features: {
				itemMetadata: ITEM_METADATA,
				defaultItem: {id: "", label: ""},
				getItemTitle: "{label}",
				addLabel: "Add item",
				reorderable: true,
				duplicateable: true,
			},
		},
	},
	collapsed: {
		id: "collapsed",
		value: [{id: "north", label: "North Exit"}],
		metadata: {
			title: "Collapsible Items",
			features: {
				itemMetadata: ITEM_METADATA,
				defaultItem: {id: "", label: ""},
				collapsibleItems: true,
				defaultCollapsedItems: true,
				getItemTitle: "{label}",
			},
		},
	},
	preview: {
		id: "preview",
		value: ["look", "take", "use"],
		metadata: {title: "Preview Array", description: "No item metadata; renders JSON previews."},
	},
	error: {
		id: "error",
		value: [],
		error: "At least one item is required.",
		metadata: {title: "Errored Array", features: {minItems: 1}},
	},
} satisfies Record<string, ArraySetup>;

function makeVariant(
	id: string,
	description: string,
	appearance: Pick<EditorControlAppearance, "tone" | "chrome" | "size">,
	setup: ArraySetup,
	themes?: EditorControlTheme[],
): ControlMatrixVariant<unknown[], ArrayControlMetadata> {
	return {
		id,
		description,
		value: setup.value,
		error: setup.error,
		readonly: setup.readonly,
		appearance,
		themes,
		metadata: {...setup.metadata, type: "array"},
	};
}

export const arrayControlMatrixVariants = [
	makeVariant(
		"theme-default-field-md-basic",
		"Theme test for array.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.basic,
		THEME_TEST_THEMES,
	),
	makeVariant(
		"default-field-md-basic",
		"Baseline structured array.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.basic,
	),
	makeVariant(
		"default-card-md-collapsed",
		"Collapsible item array.",
		{tone: "default", chrome: "card", size: "md"},
		SETUPS.collapsed,
	),
	makeVariant(
		"default-field-md-preview",
		"Preview fallback array.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.preview,
	),
	makeVariant(
		"default-field-md-error",
		"Error state array.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.error,
	),
];
