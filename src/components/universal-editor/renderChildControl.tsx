import type {
	EditorControlContext,
	EditorControlMetadata,
	EditorControlProps,
	EditorControlType,
	EditorPath,
} from "../../types/universalEditorTypes";
import {mergeEditorMetadata} from "./utils/mergeEditorMetadata";
import {renderEditorControl} from "./renderEditorControl";

type RenderChildControlArgs<TValue> = {
	type: EditorControlType;
	value: TValue;
	onChange: (value: TValue) => void;
	metadata: Partial<EditorControlMetadata> & Record<string, unknown>;
	context: EditorControlContext;
	path: EditorPath;
	childKey: string;
	parentMetadata?: EditorControlMetadata;
	useMetadataCopy?: boolean;
	disabled?: boolean;
	readonly?: boolean;
};

export function renderChildControl<TValue>({
	type,
	value,
	onChange,
	metadata,
	context,
	path,
	childKey,
	parentMetadata,
	useMetadataCopy,
	disabled,
	readonly,
}: RenderChildControlArgs<TValue>) {
	const override = parentMetadata?.childControls?.[childKey];
	// Renderer-owned child metadata normally provides behavior only. Some
	// specialized controls own a fixed vocabulary that has no child schema to
	// supply copy; those controls can opt into their explicit labels here.
	const behaviorMetadata = {...metadata};
	if (!useMetadataCopy) {
		delete behaviorMetadata.title;
		delete behaviorMetadata.description;
	}
	const baseMetadata = {
		...behaviorMetadata,
		type,
	} as EditorControlMetadata;
	const childMetadata = mergeEditorMetadata(baseMetadata, override);

	return renderEditorControl({
		value,
		onChange,
		metadata: childMetadata,
		path,
		disabled,
		readonly,
		context,
	} as EditorControlProps<unknown, EditorControlMetadata>);
}
