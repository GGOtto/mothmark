import type {
	EditorControlAppearance,
	EditorControlScheme,
	EditorControlTheme,
	EditorControlType,
	EditorDisclosure,
	EditorFieldMetadata,
	EditorFieldGroupMetadata,
	EditorFieldImportance,
	EditorOption,
	EditorSummaryMetadata,
	ResolvedEditorControlAppearance,
	UniversalEditorShellMetadata,
} from "./editor/editorMetadataTypes";
import type {
	EditorControlContext as CurrentEditorControlContext,
	EditorActiveSection,
	EditorCreateLinkRequest,
	EditorLinkOpenRequest,
	EditorLinkRef,
	EditorLinkTargetMetadata,
	EditorNavigationContext,
	EditorNavigationEntry,
	EditorIssue,
	EditorPatch,
} from "./editor/editorContextTypes";
import type {EntityRegistry, FlagRegistry} from "./editor/editorRegistryTypes";
import type {EditorPath} from "./editor/editorPathTypes";

export type {
	EditorControlAppearance,
	EditorControlScheme,
	EditorControlTheme,
	EditorControlType,
	EditorDisclosure,
	EditorActiveSection,
	EditorFieldGroupMetadata,
	EditorFieldImportance,
	EditorCreateLinkRequest,
	EditorIssue,
	EditorLinkOpenRequest,
	EditorLinkRef,
	EditorLinkTargetMetadata,
	EditorNavigationContext,
	EditorNavigationEntry,
	EditorPatch,
	EditorPath,
	EditorSummaryMetadata,
	ResolvedEditorControlAppearance,
	UniversalEditorShellMetadata,
};
export {resolveEditorControlAppearance} from "./editor/editorMetadataTypes";

export type EditorSelectOption = EditorOption;

export type EditorControlMetadata = Omit<EditorFieldMetadata, "control"> & {
	type: EditorControlType;
	features?: Record<string, unknown>;
};

export type EditorControlContext = Omit<CurrentEditorControlContext, "registries"> & {
	registries?: CurrentEditorControlContext["registries"];
	// TODO: move legacy picker registries into EditorRegistries once universal controls use the new registry shape.
	registerEntityPicker?: EntityRegistry;
	registerFlagPicker?: FlagRegistry;
};

export type EditorControlProps<
	TValue,
	TMetadata extends EditorControlMetadata = EditorControlMetadata,
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
