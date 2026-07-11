import type {MessageControlMetadata} from "../../../components/universal-editor/MessageEditor";
import type {
	EditorControlAppearance,
	EditorControlTheme,
} from "../../../types/universalEditorTypes";
import type {ControlMatrixVariant} from "../ControlMatrix";

type MessageSetup = {
	id: string;
	value: string;
	error?: string;
	warnings?: string[];
	metadata: Omit<MessageControlMetadata, "type" | "appearance">;
};

const THEME_TEST_THEMES: EditorControlTheme[] = [
	"auto",
	"plain",
	"parchment",
	"blueprint",
	"terminal",
	"mothmark",
];

const MESSAGE_SETUPS = {
	basic: {
		id: "basic",
		value: "This room has no outgoing exits yet.",
		metadata: {
			title: "Editor Notice",
			description: "Read-only information that still participates in the control layout.",
			features: {
				variant: "info",
			},
		},
	},
	noHeader: {
		id: "no-header",
		value: "No label or description chrome is reserved.",
		metadata: {
			features: {
				variant: "info",
			},
		},
	},
	warning: {
		id: "warning",
		value: "This command can run, but it has no fallback response.",
		metadata: {
			title: "Warning Message",
			description: "Tests semantic warning styling.",
			features: {
				variant: "warning",
			},
		},
	},
	error: {
		id: "error",
		value: "The selected target no longer exists in the world file.",
		metadata: {
			title: "Error Message",
			description: "Tests semantic error styling.",
			features: {
				variant: "error",
			},
		},
	},
	success: {
		id: "success",
		value: "All command aliases resolve cleanly.",
		metadata: {
			title: "Success Message",
			description: "Tests semantic success styling.",
			features: {
				variant: "success",
			},
		},
	},
	empty: {
		id: "empty",
		value: "No conditions have been added.",
		metadata: {
			title: "Empty Message",
			description: "Tests empty-state styling.",
			features: {
				variant: "empty",
			},
		},
	},
	collapsible: {
		id: "collapsible",
		value:
			"The generated command preview will update as trigger phrases, target rules, and effects change.",
		metadata: {
			title: "Collapsible Message",
			description: "Tests details/summary behavior.",
			placeholder: "Preview notes",
			features: {
				variant: "info",
				collapsible: true,
			},
		},
	},
	collapsed: {
		id: "collapsed",
		value: "Collapsed by default for dense workbench panels.",
		metadata: {
			title: "Default Collapsed Message",
			description: "Tests collapsed initial state.",
			placeholder: "Hidden notes",
			features: {
				variant: "info",
				collapsible: true,
				defaultCollapsed: true,
			},
		},
	},
} satisfies Record<string, MessageSetup>;

function makeMessageVariant({
	id,
	description,
	appearance,
	setup,
	themes,
}: {
	id: string;
	description: string;
	appearance: Pick<EditorControlAppearance, "tone" | "chrome" | "size">;
	setup: MessageSetup;
	themes?: EditorControlTheme[];
}): ControlMatrixVariant<string, MessageControlMetadata> {
	return {
		id,
		description,
		value: setup.value,
		error: setup.error,
		warnings: setup.warnings,
		appearance,
		themes,
		metadata: {
			...setup.metadata,
			type: "message",
		},
	};
}

export const messageControlMatrixVariants: Array<
	ControlMatrixVariant<string, MessageControlMetadata>
> = [
	makeMessageVariant({
		id: "theme-default-field-md-basic",
		description: "Theme test. Renders the baseline message with each explicit theme.",
		appearance: {
			tone: "default",
			chrome: "field",
			size: "md",
		},
		setup: MESSAGE_SETUPS.basic,
		themes: THEME_TEST_THEMES,
	}),
	...(["default", "quiet", "terminal", "paper", "panel"] as const).map((tone) =>
		makeMessageVariant({
			id: `${tone}-field-md-basic`,
			description: `${tone} tone message using auto theme across parent surfaces.`,
			appearance: {
				tone,
				chrome: "field",
				size: "md",
			},
			setup: MESSAGE_SETUPS.basic,
		}),
	),
	...(["card", "inline", "compact", "bare"] as const).map((chrome) =>
		makeMessageVariant({
			id: `default-${chrome}-md-basic`,
			description: `${chrome} chrome message using auto theme.`,
			appearance: {
				tone: "default",
				chrome,
				size: "md",
			},
			setup: MESSAGE_SETUPS.basic,
		}),
	),
	...(["sm", "lg"] as const).map((size) =>
		makeMessageVariant({
			id: `default-field-${size}-basic`,
			description: `${size} size message using auto theme.`,
			appearance: {
				tone: "default",
				chrome: "field",
				size,
			},
			setup: MESSAGE_SETUPS.basic,
		}),
	),
	...[
		MESSAGE_SETUPS.noHeader,
		MESSAGE_SETUPS.warning,
		MESSAGE_SETUPS.error,
		MESSAGE_SETUPS.success,
		MESSAGE_SETUPS.empty,
		MESSAGE_SETUPS.collapsible,
		MESSAGE_SETUPS.collapsed,
	].map((setup) =>
		makeMessageVariant({
			id: `default-field-md-${setup.id}`,
			description: `${setup.id} message variant using auto theme.`,
			appearance: {
				tone: "default",
				chrome: "field",
				size: "md",
			},
			setup,
		}),
	),
];
