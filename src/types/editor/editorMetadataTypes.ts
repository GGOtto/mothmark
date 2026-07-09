export type EditorControlSize = "sm" | "md" | "lg";

export type EditorControlTone =
	"default" | "quiet" | "terminal" | "paper" | "panel" | "danger" | "warning" | "success";

export type EditorControlChrome = "field" | "card" | "inline" | "compact" | "bare";

export type EditorControlTheme =
	"auto" | "mothmark" | "parchment" | "blueprint" | "terminal" | "plain";

export type EditorControlScheme = "auto" | "light" | "dark";

export type EditorControlType =
	| "text"
	| "input"
	| "id"
	| "textarea"
	| "rich-text"
	| "message"
	| "number"
	| "toggle"
	| "select"
	| "multi-select"
	| "tag-list"
	| "string-list"
	| "object"
	| "array"
	| "discriminated-union"
	| "conditional-text"
	| "condition-builder"
	| "effect-list"
	| "logic-branch-list"
	| "command-pattern"
	| "alias-suggestions"
	| "entity-picker"
	| "room-picker"
	| "connection-picker"
	| "flag-picker"
	| "counter-picker"
	| "flag-editor"
	| "direction-picker"
	| "scope-picker"
	| "priority-control"
	| "template-picker"
	| "validation-summary"
	| "code-preview"
	| "json-inspector"
	| "diff-preview"
	| "hidden";

export type EditorEntityType =
	| "room"
	| "connection"
	| "item"
	| "npc"
	| "topic"
	| "quest"
	| "quest-objective"
	| "command"
	| "event"
	| "feature"
	| "container"
	| "surface"
	| "object"
	| "direction";

export type EditorTagSource =
	"rooms" | "items" | "features" | "npcs" | "topics" | "quests" | "commands" | "events" | "all";

export type EditorOption = {
	label: string;
	value: string;
	description?: string;
	group?: string;
	icon?: string;
	tone?: EditorControlTone;
	disabled?: boolean;
	deprecated?: boolean;
	badge?: string;
};

export type EditorPreviewFeatures = {
	showPreview?: boolean;
	previewMode?: "inline" | "below" | "popover";
};

export type EditorEmptyStateFeatures = {
	emptyTitle?: string;
	emptyDescription?: string;
	emptyActionLabel?: string;
};

export type EditorDuplicateFeatures = {
	duplicateBehavior?: "exact" | "with-new-id" | "from-template";
	idField?: string;
	idPrefix?: string;
};

export type EditorPickerFeatures = {
	searchable?: boolean;
	groupBy?: string;
	showDescriptions?: boolean;
	showBadges?: boolean;
	allowCreate?: boolean;
	clearButton?: boolean;
	clearable?: boolean;
	grouped?: boolean;
};

export type EditorFieldLayoutMetadata = {
	group?: string;
	section?: string;
	order?: number;
	width?: "full" | "half" | "third" | "auto";
};

export type EditorSummaryMetadata = {
	enabled?: boolean;
	mode?: "deterministic" | "preview";
};

export type EditorControlAppearance = {
	theme?: EditorControlTheme;
	scheme?: EditorControlScheme;
	tone?: EditorControlTone;
	chrome?: EditorControlChrome;
	size?: EditorControlSize;
};

export type ResolvedEditorControlAppearance = {
	theme: EditorControlTheme;
	scheme: EditorControlScheme;
	tone: EditorControlTone;
	chrome: EditorControlChrome;
	size: EditorControlSize;
};

export const DEFAULT_EDITOR_CONTROL_APPEARANCE: ResolvedEditorControlAppearance = {
	theme: "auto",
	scheme: "auto",
	tone: "default",
	chrome: "field",
	size: "md",
};

export function resolveEditorControlAppearance(
	contextAppearance?: EditorControlAppearance,
	metadataAppearance?: EditorControlAppearance,
): ResolvedEditorControlAppearance {
	return {
		...DEFAULT_EDITOR_CONTROL_APPEARANCE,
		...contextAppearance,
		...metadataAppearance,
	};
}

export type EditorChildControlOverrides = {
	[key: string]: Partial<EditorFieldMetadata>;
};

/**
 * Metadata describes a schema field.
 *
 * Use metadata for:
 * - field label and description
 * - placeholder
 * - required/disabled/readonly/hidden
 * - per-field appearance overrides
 * - per-field editor behavior
 * - picker source metadata
 * - deterministic summaries
 *
 * Do not use metadata for:
 * - current world data
 * - editor mode
 * - runtime services
 * - registries
 * - value access
 */
export type EditorFieldMetadata = {
	control: EditorControlType;

	title?: string;
	description?: string;
	placeholder?: string;

	required?: boolean;
	readonly?: boolean;
	disabled?: boolean;
	hidden?: boolean;
	advanced?: boolean;
	deprecated?: boolean;

	appearance?: EditorControlAppearance;
	layout?: EditorFieldLayoutMetadata;

	options?: EditorOption[];
	optionSource?: string;

	entityType?: EditorEntityType;
	tagSource?: EditorTagSource;

	childControls?: EditorChildControlOverrides;

	preview?: EditorPreviewFeatures;
	emptyState?: EditorEmptyStateFeatures;
	duplicate?: EditorDuplicateFeatures;
	picker?: EditorPickerFeatures;

	summary?: EditorSummaryMetadata;

	className?: string;
	testId?: string;
	debugName?: string;
};
