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
	sectioned: {
		id: "sectioned",
		value: {
			id: "observatory",
			name: "Observatory",
			description: "A brass telescope faces a cloudy pane of glass.",
			aliases: ["tower", "scope room"],
			visible: true,
			notes: "Used by the lantern puzzle.",
			internalKey: "generated-observatory-001",
		},
		metadata: {
			title: "Sectioned Room",
			description: "Pinned, grouped, searchable object fields with advanced disclosure.",
			summary: {
				summaryTemplate: "{name} · {aliases.length} aliases",
				emptySummary: "No room details yet",
			},
			features: {
				showFieldCount: true,
				showOutline: true,
				searchable: true,
				layout: "section",
				groups: [
					{
						id: "identity",
						title: "Identity",
						description: "Names, IDs, aliases, and visibility.",
						order: 10,
					},
					{
						id: "content",
						title: "Description",
						description: "What the player sees and what authors need to remember.",
						order: 20,
					},
					{
						id: "advanced",
						title: "Advanced",
						description: "Generated or rarely edited details.",
						defaultCollapsed: true,
						importance: "advanced",
						order: 90,
					},
				],
				fields: [
					{
						key: "id",
						metadata: {
							type: "input",
							title: "Room ID",
							description: "Stable ID used by commands, exits, and references.",
							required: true,
							priority: {group: "identity", order: 10, pinned: true, importance: "primary"},
							transform: "id",
						},
					},
					{
						key: "name",
						metadata: {
							type: "input",
							title: "Name",
							priority: {group: "identity", order: 20, pinned: true, importance: "primary"},
						},
					},
					{
						key: "aliases",
						metadata: {
							type: "string-list",
							title: "Aliases",
							priority: {group: "identity", order: 30, importance: "secondary"},
							summary: {summaryTemplate: "{length} aliases", emptySummary: "No aliases yet"},
						},
						defaultValue: [],
					},
					{
						key: "visible",
						metadata: {
							type: "toggle",
							title: "Visible",
							priority: {group: "identity", order: 40, importance: "secondary"},
						},
					},
					{
						key: "description",
						metadata: {
							type: "textarea",
							title: "Default Description",
							priority: {group: "content", order: 10, importance: "primary"},
						},
					},
					{
						key: "notes",
						metadata: {
							type: "textarea",
							title: "Author Notes",
							priority: {group: "content", order: 20, importance: "secondary"},
						},
					},
					{
						key: "internalKey",
						metadata: {
							type: "input",
							title: "Internal Key",
							description: "Rarely edited generated identifier.",
							priority: {group: "advanced", order: 10, importance: "advanced"},
							disclosure: {defaultCollapsed: true, advanced: true},
						},
					},
				],
			},
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
		"default-card-md-sectioned",
		"Sectioned object with priority, outline, search, and advanced disclosure.",
		{tone: "default", chrome: "card", size: "md"},
		SETUPS.sectioned,
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
