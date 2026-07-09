import type {ObjectControlMetadata} from "../../../components/editor/universal/ObjectEditor";
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

const BASIC_METADATA: Omit<ObjectControlMetadata, "type" | "appearance"> = {
	title: "Room Summary",
	description: "Structured nested fields rendered from child metadata.",
	features: {
		showFieldCount: true,
		layout: "stack",
		fields: [
			{key: "id", metadata: {type: "input", title: "ID", transform: "id"}},
			{key: "name", metadata: {type: "input", title: "Name"}},
			{key: "visible", metadata: {type: "toggle", title: "Visible"}},
		],
	},
};

type ObjectSetup = {
	id: string;
	value: Record<string, unknown>;
	error?: string;
	metadata: Omit<ObjectControlMetadata, "type" | "appearance">;
};

const SETUPS = {
	basic: {id: "basic", value: {id: "foyer", name: "Foyer", visible: true}, metadata: BASIC_METADATA},
	grid: {
		id: "grid",
		value: {id: "library", name: "Library", visible: false},
		metadata: {
			...BASIC_METADATA,
			title: "Grid Object",
			features: {...BASIC_METADATA.features, layout: "grid"},
		},
	},
	collapsed: {
		id: "collapsed",
		value: {id: "cellar", name: "Cellar", visible: true},
		metadata: {
			...BASIC_METADATA,
			title: "Collapsible Object",
			placeholder: "Room fields",
			features: {...BASIC_METADATA.features, collapsible: true, defaultCollapsed: true},
		},
	},
	preview: {
		id: "preview",
		value: {id: "raw-room", exits: ["north", "east"], danger: 2},
		metadata: {title: "Preview Object", description: "No child metadata; renders key/value preview."},
	},
	error: {
		id: "error",
		value: {id: "", name: "", visible: false},
		error: "Object has invalid required fields.",
		metadata: BASIC_METADATA,
	},
} satisfies Record<string, ObjectSetup>;

function makeVariant(
	id: string,
	description: string,
	appearance: Pick<EditorControlAppearance, "tone" | "chrome" | "size">,
	setup: ObjectSetup,
	themes?: EditorControlTheme[],
): ControlMatrixVariant<Record<string, unknown>, ObjectControlMetadata> {
	return {
		id,
		description,
		value: setup.value,
		error: setup.error,
		appearance,
		themes,
		metadata: {...setup.metadata, type: "object"},
	};
}

export const objectControlMatrixVariants = [
	makeVariant(
		"theme-default-field-md-basic",
		"Theme test for object.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.basic,
		THEME_TEST_THEMES,
	),
	makeVariant(
		"default-field-md-basic",
		"Baseline nested object.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.basic,
	),
	makeVariant(
		"default-card-md-grid",
		"Grid layout object.",
		{tone: "default", chrome: "card", size: "md"},
		SETUPS.grid,
	),
	makeVariant(
		"panel-field-sm-collapsed",
		"Collapsible object.",
		{tone: "panel", chrome: "field", size: "sm"},
		SETUPS.collapsed,
	),
	makeVariant(
		"default-field-md-preview",
		"Preview fallback object.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.preview,
	),
	makeVariant(
		"default-field-md-error",
		"Error state object.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.error,
	),
];
