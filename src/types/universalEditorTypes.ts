import {FlagRegistry, EntityRegistry} from "./registryTypes";

export type EditorPath = Array<string | number>;

export type EditorControlSize = "sm" | "md" | "lg";

export type EditorControlTone = "default" | "quiet" | "terminal" | "paper" | "panel";

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

export type EditorSelectOption = {
	label: string;
	value: string;
	description?: string;
	group?: string;
	icon?: string;
	tone?: EditorControlTone;
	disabled?: boolean;
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

export type EditorChildControlOverrides = {
	[key: string]: Partial<EditorControlMetadata>;
};

/**
 * Appearance controls how a control looks.
 *
 * Context appearance is the inherited/default appearance for an editor region.
 * Metadata appearance is the per-control override.
 *
 * Precedence:
 * default appearance < context.appearance < metadata.appearance
 */
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

/**
 * Metadata describes the control itself.
 *
 * Use metadata for:
 * - field label and description
 * - placeholder
 * - required/disabled/readonly/hidden
 * - per-control appearance overrides
 * - per-control behavior/features
 *
 * Do not use metadata for:
 * - editor-wide theme defaults
 * - editor mode
 * - registry/services access
 * - reading/writing other paths
 */
export type EditorControlMetadata = {
	type: EditorControlType;

	title?: string;
	description?: string;

	placeholder?: string;
	disabled?: boolean;
	readonly?: boolean;
	hidden?: boolean;

	required?: boolean;

	appearance?: EditorControlAppearance;
	childControls?: EditorChildControlOverrides;
	optionSource?: string;

	className?: string;
	testId?: string;
};

/**
 * Context describes the environment where the control is being rendered.
 *
 * Use context for:
 * - inherited/default appearance
 * - editor mode
 * - reading/writing values by path
 * - validation services
 * - registries such as entities and flags
 *
 * Do not use context for:
 * - field-specific labels
 * - field-specific placeholder
 * - field-specific transforms
 * - field-specific buttons/features
 */
export type EditorControlContext = {
	appearance?: EditorControlAppearance;

	mode: "create" | "edit" | "preview";

	getValue: (path: EditorPath) => unknown;
	setValue: (path: EditorPath, value: unknown) => void;

	validatePath?: (path: EditorPath) => string | undefined;

	getOptionList?: (source: string) => EditorSelectOption[] | undefined;

	registerEntityPicker?: EntityRegistry;
	registerFlagPicker?: FlagRegistry;
};

export type EditorControlProps<TValue, TMetadata extends EditorControlMetadata> = {
	value: TValue;
	onChange: (nextValue: TValue) => void;

	metadata: TMetadata;
	path: EditorPath;

	error?: string;
	warnings?: string[];

	disabled?: boolean;
	readonly?: boolean;

	autoFocus?: boolean;

	context: EditorControlContext;
};
