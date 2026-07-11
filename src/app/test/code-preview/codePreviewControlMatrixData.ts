import type {CodePreviewControlMetadata} from "../../../components/universal-editor/CodePreviewEditor";
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

type CodeSetup = {
	id: string;
	value: unknown;
	error?: string;
	metadata: Omit<CodePreviewControlMetadata, "type" | "appearance">;
};

const SETUPS = {
	basic: {
		id: "basic",
		value: {id: "foyer", exits: ["north"], visible: true},
		metadata: {
			title: "JSON Preview",
			description: "Read-only structured preview.",
			features: {language: "json", copyButton: true},
		},
	},
	text: {
		id: "text",
		value: "look brass key -> examine:item:brass-key",
		metadata: {title: "Text Preview", features: {language: "text", copyButton: true}},
	},
	collapsed: {
		id: "collapsed",
		value: "type CommandRule = { trigger: string; effects: Effect[] };",
		metadata: {
			title: "Collapsed TypeScript",
			placeholder: "Generated type",
			features: {language: "ts", collapsible: true, defaultCollapsed: true},
		},
	},
	error: {
		id: "error",
		value: {invalid: true},
		error: "Preview source is stale.",
		metadata: {title: "Errored Preview", features: {language: "json"}},
	},
} satisfies Record<string, CodeSetup>;

function makeVariant(
	id: string,
	description: string,
	appearance: Pick<EditorControlAppearance, "tone" | "chrome" | "size">,
	setup: CodeSetup,
	themes?: EditorControlTheme[],
): ControlMatrixVariant<unknown, CodePreviewControlMetadata> {
	return {
		id,
		description,
		value: setup.value,
		error: setup.error,
		appearance,
		themes,
		metadata: {...setup.metadata, type: "code-preview"},
	};
}

export const codePreviewControlMatrixVariants = [
	makeVariant(
		"theme-default-field-md-basic",
		"Theme test for code preview.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.basic,
		THEME_TEST_THEMES,
	),
	makeVariant(
		"default-field-md-basic",
		"Baseline JSON preview.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.basic,
	),
	makeVariant(
		"terminal-card-md-text",
		"Terminal text preview.",
		{tone: "terminal", chrome: "card", size: "md"},
		SETUPS.text,
	),
	makeVariant(
		"default-field-md-collapsed",
		"Collapsed TypeScript preview.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.collapsed,
	),
	makeVariant(
		"default-field-md-error",
		"Error state preview.",
		{tone: "default", chrome: "field", size: "md"},
		SETUPS.error,
	),
];
