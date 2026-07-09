import {FlagRegistry, EntityRegistry} from "./registryTypes";

export type EditorPath = Array<string | number>;

export type EditorControlSize = "sm" | "md" | "lg";

export type EditorControlTone = "default" | "quiet" | "terminal" | "paper" | "panel";

export type EditorControlChrome = "field" | "card" | "inline" | "compact" | "bare";

// only add themes and types that exist for now
export type EditorControlType = "input";

export type EditorControlTheme =
	"auto" | "mothmark" | "parchment" | "blueprint" | "terminal" | "plain";

export type EditorControlMetadata = {
	type: EditorControlType;

	title?: string;
	description?: string;

	placeholder?: string;
	disabled?: boolean;
	readonly?: boolean;
	hidden?: boolean;

	required?: boolean;
	size?: EditorControlSize;
	tone?: EditorControlTone;
	chrome?: EditorControlChrome;

	className?: string;
	testId?: string;
};

export type EditorControlContext = {
	theme: EditorControlTheme;
	mode: "create" | "edit" | "preview";

	getValue: (path: EditorPath) => unknown;
	setValue: (path: EditorPath, value: unknown) => void;

	validatePath?: (path: EditorPath) => string | undefined;

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
