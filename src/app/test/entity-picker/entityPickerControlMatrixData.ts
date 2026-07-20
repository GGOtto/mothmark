import type {EntityPickerControlMetadata} from "../../../components/universal-editor/EntityPickerEditor";
import type {
	EditorControlAppearance,
	EditorControlTheme,
} from "../../../types/universalEditorTypes";
import type {ControlMatrixVariant} from "../ControlMatrix";
import {toID, type ID} from "../../../utils/idUtils";

const THEME_TEST_THEMES: EditorControlTheme[] = [
	"auto",
	"plain",
	"parchment",
	"blueprint",
	"terminal",
	"mothmark",
];

type EntitySetup = {
	id: string;
	value: ID;
	error?: string;
	readonly?: boolean;
	metadata: Omit<EntityPickerControlMetadata, "type" | "appearance">;
};

const SETUPS = {
	basic: {
		id: "basic",
		value: toID("room", "foyer"),
		metadata: {
			title: "Room",
			description: "Uses the matrix sample entity registry.",
			features: {entityType: "room", showPreview: true, clearButton: true},
		},
	},
	item: {
		id: "item",
		value: toID("item", "brass-key"),
		metadata: {title: "Item", features: {entityType: "item", showPreview: true}},
	},
	create: {
		id: "create",
		value: toID("room", "new-room"),
		metadata: {
			title: "Create Entity ID",
			features: {entityType: "room", allowCreate: true, clearButton: true},
		},
	},
	error: {
		id: "error",
		value: toID("room", ""),
		error: "Select a target room.",
		metadata: {title: "Errored Entity", features: {entityType: "room"}},
	},
	readonly: {
		id: "readonly",
		value: toID("room", "library"),
		readonly: true,
		metadata: {title: "Readonly Entity", features: {entityType: "room", showPreview: true}},
	},
} satisfies Record<string, EntitySetup>;

function makeVariant(
	id: string,
	description: string,
	appearance: Pick<EditorControlAppearance, "tone" | "chrome" | "size">,
	setup: EntitySetup,
	themes?: EditorControlTheme[],
): ControlMatrixVariant<ID, EntityPickerControlMetadata> {
	return {
		id,
		description,
		value: setup.value,
		error: setup.error,
		readonly: setup.readonly,
		appearance,
		themes,
		metadata: {...setup.metadata, type: "entity-picker"},
	};
}

export const entityPickerControlMatrixVariants = [
	makeVariant(
		"theme-default-field-md-basic",
		"Theme test for entity picker.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.basic,
		THEME_TEST_THEMES,
	),
	makeVariant(
		"default-field-md-basic",
		"Baseline room picker.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.basic,
	),
	makeVariant(
		"default-card-md-item",
		"Item picker with preview.",
		{tone: "default", chrome: "card", size: "md"},
		SETUPS.item,
	),
	makeVariant(
		"default-field-md-create",
		"Create/unknown entity state.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.create,
	),
	makeVariant(
		"default-field-md-error",
		"Error state picker.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.error,
	),
	makeVariant(
		"quiet-bare-sm-readonly",
		"Readonly bare picker.",
		{tone: "quiet", chrome: "bare", size: "sm"},
		SETUPS.readonly,
	),
];
