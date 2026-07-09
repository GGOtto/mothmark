import type {
	AliasSuggestionsMetadata,
	DirectionPickerMetadata,
	IdControlMetadata,
	JsonInspectorMetadata,
	PriorityControlMetadata,
	RichTextMetadata,
	RoomPickerMetadata,
	ScopePickerMetadata,
	SpecializedControlMetadata,
} from "../../components/editor/universal/SpecializedEditors";
import type {EditorControlAppearance} from "../../types/universalEditorTypes";
import type {ControlMatrixVariant} from "./ControlMatrix";

const FIELD_MD: Pick<EditorControlAppearance, "tone" | "chrome" | "size"> = {
	tone: "default",
	chrome: "field",
	size: "md",
};

export const idControlMatrixVariants: Array<ControlMatrixVariant<string, IdControlMetadata>> = [
	{
		id: "default-field-md-room",
		description: "Canonical ID control with normalization and duplicate warning.",
		value: "Foyer Door",
		appearance: FIELD_MD,
		metadata: {
			type: "id",
			title: "Room ID",
			features: {
				scope: "room",
				prefix: "room.",
				checkUnique: true,
				knownIds: ["Foyer Door"],
				clearButton: true,
				copyButton: true,
			},
		},
	},
];

export const richTextControlMatrixVariants: Array<ControlMatrixVariant<string, RichTextMetadata>> =
	[
		{
			id: "default-field-md-preview",
			description: "Rich text composer with allowed marks and preview behavior.",
			value: "The lamp hums softly beside the archive desk.",
			appearance: FIELD_MD,
			metadata: {
				type: "rich-text",
				title: "Room Prose",
				features: {
					allowedMarks: ["bold", "italic", "code"],
					conditionalSnippets: true,
					variableInsert: true,
					preview: true,
					copyButton: true,
				},
			},
		},
	];

export const conditionalTextControlMatrixVariants: Array<
	ControlMatrixVariant<unknown, SpecializedControlMetadata>
> = [
	{
		id: "default-field-md-variants",
		description: "Default prose with conditional variants and nested condition builder.",
		value: {
			default: "The hallway is quiet.",
			variants: [
				{
					text: "The hallway glows under the lit lamp.",
					when: {type: "flag", operation: "equals", flag: "library.lampLit", value: true},
				},
			],
		},
		appearance: FIELD_MD,
		metadata: {type: "conditional-text", title: "Description"},
	},
];

export const logicBranchListControlMatrixVariants: Array<
	ControlMatrixVariant<unknown, SpecializedControlMetadata>
> = [
	{
		id: "default-field-md-list",
		description: "Branch list with branch type options supplied as metadata.",
		value: [
			{
				branchType: "if",
				when: {type: "flag", operation: "equals", flag: "foyer.doorUnlocked", value: true},
				message: "The door gives way.",
				effects: [{type: "room", operation: "move-player", roomId: "library"}],
			},
		],
		appearance: FIELD_MD,
		metadata: {
			type: "logic-branch-list",
			title: "Command Branches",
			features: {
				branchTypeOptions: [
					{label: "If", value: "if"},
					{label: "Else if", value: "else-if"},
					{label: "Otherwise", value: "else"},
				],
			},
		},
	},
];

export const commandPatternControlMatrixVariants: Array<
	ControlMatrixVariant<unknown, SpecializedControlMetadata>
> = [
	{
		id: "default-field-md-pattern",
		description: "Command pattern editor with list-backed mode selectors.",
		value: {
			matchMode: "starts-with",
			targetMode: "single",
			verbs: ["open", "unlock"],
			scope: "room",
			priority: 10,
		},
		appearance: FIELD_MD,
		metadata: {
			type: "command-pattern",
			title: "Command Pattern",
			features: {
				matchModeOptions: [
					{label: "Exact", value: "exact"},
					{label: "Starts with", value: "starts-with"},
					{label: "Contains", value: "contains"},
				],
				targetModeOptions: [
					{label: "None", value: "none"},
					{label: "Single target", value: "single"},
					{label: "Multiple targets", value: "multiple"},
				],
			},
		},
	},
];

export const aliasSuggestionsControlMatrixVariants: Array<
	ControlMatrixVariant<string[], AliasSuggestionsMetadata>
> = [
	{
		id: "default-field-md-suggestions",
		description: "Alias suggestions with pluralization and collision warnings.",
		value: ["lamp", "desk"],
		appearance: FIELD_MD,
		metadata: {
			type: "alias-suggestions",
			title: "Aliases",
			features: {
				sourceText: "the brass lamp",
				includePluralization: true,
				showCollisionWarnings: true,
				collisionValues: ["desk"],
			},
		},
	},
];

export const directionPickerControlMatrixVariants: Array<
	ControlMatrixVariant<string, DirectionPickerMetadata>
> = [
	{
		id: "default-field-md-world-list",
		description: "Direction picker using a world/schema option source.",
		value: "up",
		appearance: FIELD_MD,
		metadata: {
			type: "direction-picker",
			title: "Direction",
			features: {optionSource: "schema.world.directions", mode: "compact", showOpposite: true},
		},
	},
];

export const connectionPickerControlMatrixVariants: Array<
	ControlMatrixVariant<unknown, SpecializedControlMetadata>
> = [
	{
		id: "default-field-md-connection",
		description: "Connection editor with room, direction, pathway, and condition controls.",
		value: {
			fromRoom: "foyer",
			toRoom: "library",
			direction: "e",
			pathway: "two-way",
			condition: {type: "flag", operation: "equals", flag: "foyer.doorUnlocked", value: true},
		},
		appearance: FIELD_MD,
		metadata: {
			type: "connection-picker",
			title: "Connection",
			features: {pathwayOptionSource: "schema.world.pathways"},
		},
	},
];

export const roomPickerControlMatrixVariants: Array<
	ControlMatrixVariant<string, RoomPickerMetadata>
> = [
	{
		id: "default-field-md-preview",
		description: "Room picker with preview and badges.",
		value: "foyer",
		appearance: FIELD_MD,
		metadata: {
			type: "room-picker",
			title: "Start Room",
			features: {
				showMapPreview: true,
				showStartRoomBadge: true,
				showIssueBadges: true,
				clearButton: true,
			},
		},
	},
];

export const flagEditorControlMatrixVariants: Array<
	ControlMatrixVariant<unknown, SpecializedControlMetadata>
> = [
	{
		id: "default-field-md-flags",
		description: "Flag registry editor with list-backed flag kinds.",
		value: [
			{id: "foyer.doorUnlocked", kind: "boolean", description: "Whether the door opens."},
			{id: "library.visitCount", kind: "number", description: "Number of visits."},
		],
		appearance: FIELD_MD,
		metadata: {
			type: "flag-editor",
			title: "Flags",
			features: {
				flagKindOptions: [
					{label: "Boolean", value: "boolean"},
					{label: "Number", value: "number"},
					{label: "String", value: "string"},
				],
			},
		},
	},
];

export const scopePickerControlMatrixVariants: Array<
	ControlMatrixVariant<string, ScopePickerMetadata>
> = [
	{
		id: "default-field-md-list",
		description: "Scope picker using explicit option metadata.",
		value: "room",
		appearance: FIELD_MD,
		metadata: {
			type: "scope-picker",
			title: "Scope",
			features: {
				clearButton: true,
				options: [
					{label: "Global", value: "global", description: "Available everywhere."},
					{label: "Room", value: "room", description: "Available in selected rooms."},
					{label: "Item", value: "item", description: "Attached to an item."},
					{label: "Command", value: "command", description: "Attached to this command."},
				],
			},
		},
	},
];

export const priorityControlMatrixVariants: Array<
	ControlMatrixVariant<number, PriorityControlMetadata>
> = [
	{
		id: "default-field-md-custom-presets",
		description: "Priority preset picker with a revealed custom number field.",
		value: 25,
		appearance: FIELD_MD,
		metadata: {
			type: "priority-control",
			title: "Priority",
			features: {
				presets: {low: -10, normal: 0, high: 10},
				presetOptions: [
					{label: "Low", value: "low", description: "Runs after normal commands."},
					{label: "Normal", value: "normal", description: "Default command priority."},
					{label: "High", value: "high", description: "Runs before normal commands."},
				],
			},
		},
	},
];

export const validationSummaryControlMatrixVariants: Array<
	ControlMatrixVariant<unknown, SpecializedControlMetadata>
> = [
	{
		id: "default-field-md-issues",
		description: "Scoped validation summary with warnings and errors.",
		value: [
			{severity: "error", message: "Start room does not exist."},
			{severity: "warning", message: "Flag library.lampLit is never changed."},
		],
		appearance: FIELD_MD,
		metadata: {
			type: "validation-summary",
			title: "World Validation",
			features: {scope: "world", showWarnings: true, showErrors: true},
		},
	},
];

export const jsonInspectorControlMatrixVariants: Array<
	ControlMatrixVariant<unknown, JsonInspectorMetadata>
> = [
	{
		id: "default-field-md-collapsible",
		description: "JSON inspector rendered through the code preview path.",
		value: {id: "foyer", flags: {doorUnlocked: false}},
		appearance: FIELD_MD,
		metadata: {
			type: "json-inspector",
			title: "World JSON",
			features: {collapsible: true, copyButton: true},
		},
	},
];

export const diffPreviewControlMatrixVariants: Array<
	ControlMatrixVariant<unknown, SpecializedControlMetadata>
> = [
	{
		id: "default-field-md-side-by-side",
		description: "Diff preview for import or autofix changes.",
		value: {before: "startRoomId: foyer", after: "startRoomId: library"},
		appearance: FIELD_MD,
		metadata: {type: "diff-preview", title: "Pending Changes", features: {mode: "side-by-side"}},
	},
];

export const templatePickerControlMatrixVariants: Array<
	ControlMatrixVariant<unknown, SpecializedControlMetadata>
> = [
	{
		id: "default-field-md-templates",
		description: "Template picker with reusable authored object presets.",
		value: {},
		appearance: FIELD_MD,
		metadata: {
			type: "template-picker",
			title: "Templates",
			features: {
				templates: [
					{label: "Locked door", description: "Door, flag, and unlock command.", value: {kind: "door"}},
					{label: "Takeable item", description: "Portable item with aliases.", value: {kind: "item"}},
				],
			},
		},
	},
];
