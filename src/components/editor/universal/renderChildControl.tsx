import type {
	EditorControlContext,
	EditorControlMetadata,
	EditorControlProps,
	EditorControlType,
	EditorPath,
} from "../../../types/universalEditorTypes";
import {mergeEditorMetadata} from "../../../utils/mergeEditorMetadata";
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
	disabled,
	readonly,
}: RenderChildControlArgs<TValue>) {
	const override = parentMetadata?.childControls?.[childKey];
	const baseMetadata = {
		...metadata,
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
