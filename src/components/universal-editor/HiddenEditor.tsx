import type {EditorControlMetadata, EditorControlProps} from "../../types/universalEditorTypes";

export type HiddenFeatures = {
	reason?: string;
};

export type HiddenControlMetadata = EditorControlMetadata & {
	type: "hidden";
	features?: HiddenFeatures;
};

export type HiddenEditorProps = EditorControlProps<unknown, HiddenControlMetadata>;

export function HiddenEditor(_props: HiddenEditorProps) {
	void _props;

	return null;
}
