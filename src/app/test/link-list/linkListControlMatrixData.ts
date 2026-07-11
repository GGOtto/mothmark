import type {LinkListControlMetadata} from "../../../components/universal-editor/LinkListEditor";
import type {
	EditorControlAppearance,
	EditorControlTheme,
	EditorLinkRef,
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

type LinkListMatrixValue = string[] | EditorLinkRef[] | string | EditorLinkRef | null;

type LinkListSetup = {
	id: string;
	value: LinkListMatrixValue;
	error?: string;
	warnings?: string[];
	disabled?: boolean;
	readonly?: boolean;
	metadata: Omit<LinkListControlMetadata, "type" | "appearance">;
};

const SETUPS = {
	internal: {
		id: "internal",
		value: ["/editor/world", "rooms/foyer?tab=description"],
		metadata: {
			title: "Related Pages",
			description: "Internal app routes with same-tab navigation.",
			features: {
				mode: "edit",
				linkType: "internal-link",
				display: "inline",
				basePath: "/",
				inputPlaceholder: "Add internal path...",
				clearButton: true,
			},
		},
	},
	external: {
		id: "external",
		value: ["https://example.com/spec", "not-a-url"],
		warnings: ["One reference is intentionally invalid for the warning state."],
		metadata: {
			title: "References",
			description: "External URLs opened in a new tab.",
			features: {
				mode: "edit",
				linkType: "external-link",
				openBehavior: "new-tab",
				validateExternalUrl: true,
				inputPlaceholder: "https://...",
			},
		},
	},
	editorRooms: {
		id: "editor-rooms",
		value: [
			{type: "room", id: "foyer"},
			{type: "room", id: "library"},
		],
		metadata: {
			title: "Connected Rooms",
			description: "Editor links use buttons and pull labels from the entity registry.",
			features: {
				mode: "edit",
				linkType: "editor",
				display: "inline",
				pickerPlaceholder: "Choose a room...",
				editorTarget: {
					kind: "entity",
					entityType: "room",
					path: ["rooms", "{id}"],
				},
			},
		},
	},
	missingEditorTarget: {
		id: "missing-editor-target",
		value: [{type: "room", id: "attic"}],
		metadata: {
			title: "Missing Room Link",
			description: "Missing editor targets stay visible and removable.",
			features: {
				mode: "edit",
				linkType: "editor",
				display: "compact",
				editorTarget: {
					kind: "entity",
					entityType: "room",
					path: ["rooms", "{id}"],
				},
			},
		},
	},
	readonly: {
		id: "readonly",
		value: ["https://example.com/locked"],
		readonly: true,
		metadata: {
			title: "Readonly Links",
			description: "Opening remains available, but editing controls are locked.",
			features: {
				mode: "edit",
				linkType: "external-link",
				openBehavior: "new-tab",
			},
		},
	},
	singleInternal: {
		id: "single-internal",
		value: "/editor/world",
		metadata: {
			title: "Primary Page",
			description: "Single-link mode writes a single string value.",
			features: {
				mode: "single-link",
				linkType: "internal-link",
				display: "block",
				inputPlaceholder: "Primary route...",
			},
		},
	},
} satisfies Record<string, LinkListSetup>;

function makeVariant(
	id: string,
	description: string,
	appearance: Pick<EditorControlAppearance, "tone" | "chrome" | "size">,
	setup: LinkListSetup,
	themes?: EditorControlTheme[],
): ControlMatrixVariant<LinkListMatrixValue, LinkListControlMetadata> {
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
		metadata: {...setup.metadata, type: "link-list"},
	};
}

export const linkListControlMatrixVariants = [
	makeVariant(
		"theme-default-field-md-internal",
		"Theme test for link-list.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.internal,
		THEME_TEST_THEMES,
	),
	makeVariant(
		"default-field-md-internal",
		"Editable internal link-list.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.internal,
	),
	makeVariant(
		"default-field-md-external",
		"Editable external link-list with URL validation.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.external,
	),
	makeVariant(
		"default-inline-md-editor",
		"Editable editor link-list backed by entity options.",
		{tone: "default", chrome: "inline", size: "md"},
		SETUPS.editorRooms,
	),
	makeVariant(
		"warning-compact-sm-missing",
		"Missing editor target warning.",
		{tone: "warning", chrome: "compact", size: "sm"},
		SETUPS.missingEditorTarget,
	),
	makeVariant(
		"default-field-md-readonly",
		"Readonly link-list.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.readonly,
	),
	makeVariant(
		"panel-card-md-single",
		"Single-link mode.",
		{tone: "panel", chrome: "card", size: "md"},
		SETUPS.singleInternal,
	),
];
