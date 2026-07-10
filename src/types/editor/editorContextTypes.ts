import type {World} from "../../schemas/worldSchema";
import type {
	EditorControlAppearance,
	EditorControlType,
	EditorFieldMetadata,
	EditorOption,
} from "./editorMetadataTypes";
import type {EntityType} from "./editorRegistryTypes";
import type {EditorRegistries} from "./editorRegistryTypes";
import type {EditorPath} from "./editorPathTypes";
import type {z} from "zod";

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

export type EditorLinkRef = {
	type: string;
	id: string;
	label?: string;
};

export type EditorLinkTargetKind = "entity" | "path" | "control" | "condition" | "effect";

export type EditorLinkTargetMetadata = {
	kind: EditorLinkTargetKind;
	entityType?: EntityType;
	path?: EditorPath;
	schemaKey?: string;
	controlType?: EditorControlType;
	create?: {
		enabled?: boolean;
		buttonLabel?: string;
		defaultLabel?: string;
		idPrefix?: string;
		openAfterCreate?: boolean;
	};
	showBackLink?: boolean;
	backLabel?: string;
	emptyLabel?: string;
};

export type EditorNavigationEntry = {
	title?: string;
	description?: string;
	schema: z.ZodTypeAny;
	value: unknown;
	path: EditorPath;
	metadata?: EditorFieldMetadata;
	showBackLink?: boolean;
	backLabel?: string;
};

export type EditorLinkOpenRequest = {
	ref: EditorLinkRef;
	target: EditorLinkTargetMetadata;
	sourcePath: EditorPath;
};

export type EditorCreateLinkRequest = {
	target: EditorLinkTargetMetadata;
	sourcePath: EditorPath;
};

export type EditorNavigationContext = {
	openChildEditor?: (entry: EditorNavigationEntry) => void;
	goBack?: () => void;
	canGoBack?: boolean;
	breadcrumbs?: Array<{
		label: string;
		path?: EditorPath;
	}>;
	openEditorLink?: (request: EditorLinkOpenRequest) => void;
	createEditorLink?: (request: EditorCreateLinkRequest) => EditorLinkRef | undefined;
	resolveEditorLinkLabel?: (ref: EditorLinkRef, target?: EditorLinkTargetMetadata) => string;
	resolveEditorLinkDescription?: (
		ref: EditorLinkRef,
		target?: EditorLinkTargetMetadata,
	) => string | undefined;
};

export type EditorActiveSection = {
	id: string;
	title: string;
	description?: string;
	countLabel?: string;
	path: EditorPath;
};

export type EditorChromeContext = {
	rootPath?: EditorPath;
	activeSection?: EditorActiveSection;
	setActiveSection?: (section?: EditorActiveSection) => void;
	getSectionDisclosure?: (path: EditorPath, sectionId: string) => boolean | undefined;
	setSectionDisclosure?: (path: EditorPath, sectionId: string, isOpen: boolean) => void;
};

export type EditorControlContext = {
	appearance?: EditorControlAppearance;

	mode: EditorMode;

	world?: World;

	registries: EditorRegistries;

	getValue: (path: EditorPath) => unknown;
	setValue: (path: EditorPath, value: unknown) => void;
	getWorldValue?: (path: EditorPath) => unknown;
	setWorldValue?: (path: EditorPath, value: unknown) => void;
	patchValue?: (patch: EditorPatch) => void;

	getIssues?: (path: EditorPath) => EditorIssue[];
	validatePath?: (path: EditorPath) => EditorIssue[];

	getOptionList?: (source: string) => EditorOption[] | undefined;

	editorNavigation?: EditorNavigationContext;
	editorChrome?: EditorChromeContext;

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
