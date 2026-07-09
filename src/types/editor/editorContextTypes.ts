import type {World} from "../../schemas/worldSchema";
import type {
	EditorControlAppearance,
	EditorFieldMetadata,
	EditorOption,
} from "./editorMetadataTypes";
import type {EditorRegistries} from "./editorRegistryTypes";
import type {EditorPath} from "./editorPathTypes";

export type EditorMode = "create" | "edit" | "preview" | "debug";

export type EditorIssueSeverity = "error" | "warning" | "info";

export type EditorIssue = {
	path: EditorPath;
	message: string;
	severity: EditorIssueSeverity;
	code?: string;
};

export type EditorPatch =
	| {
			type: "set";
			path: EditorPath;
			value: unknown;
	  }
	| {
			type: "unset";
			path: EditorPath;
	  }
	| {
			type: "insert";
			path: EditorPath;
			index: number;
			value: unknown;
	  }
	| {
			type: "remove";
			path: EditorPath;
			index: number;
	  }
	| {
			type: "move";
			path: EditorPath;
			fromIndex: number;
			toIndex: number;
	  };

export type EditorControlContext = {
	appearance?: EditorControlAppearance;

	mode: EditorMode;

	world?: World;

	registries: EditorRegistries;

	getValue: (path: EditorPath) => unknown;
	setValue: (path: EditorPath, value: unknown) => void;
	patchValue?: (patch: EditorPatch) => void;

	getIssues?: (path: EditorPath) => EditorIssue[];
	validatePath?: (path: EditorPath) => EditorIssue[];

	getOptionList?: (source: string) => EditorOption[] | undefined;

	readOnly?: boolean;
	disabled?: boolean;

	selectedPath?: EditorPath;
	focusedPath?: EditorPath;
};

export type EditorControlProps<
	TValue,
	TMetadata extends EditorFieldMetadata = EditorFieldMetadata,
> = {
	value: TValue;
	onChange: (nextValue: TValue) => void;

	metadata: TMetadata;
	path: EditorPath;

	error?: string;
	warnings?: string[];
	issues?: EditorIssue[];

	disabled?: boolean;
	readonly?: boolean;

	autoFocus?: boolean;

	context: EditorControlContext;
};

export type EditorContext = {
	world: World;
	path: EditorPath;
	mode: "edit" | "create" | "preview" | "debug";

	registries: EditorRegistries;

	getValue: (path: EditorPath) => unknown;
	setValue: (path: EditorPath, value: unknown) => void;
	patchValue?: (patch: EditorPatch) => void;

	getIssues?: (path: EditorPath) => EditorIssue[];
	validatePath?: (path: EditorPath) => EditorIssue[];

	readOnly?: boolean;
	disabled?: boolean;
	selectedPath?: EditorPath;
	focusedPath?: EditorPath;
};
