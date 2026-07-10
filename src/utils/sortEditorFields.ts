import type {EditorFieldMetadata} from "@/types/editor/editorMetadataTypes";
import {sortEditorObjectFields} from "./sortEditorObjectFields";

export type EditorRenderableField = {
	key: string;
	metadata: EditorFieldMetadata;
	schema: unknown;
	value: unknown;
	index: number;
};

export function sortEditorFields<TField extends EditorRenderableField>(fields: TField[]): TField[] {
	return sortEditorObjectFields(fields);
}
