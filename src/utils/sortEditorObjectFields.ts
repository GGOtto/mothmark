import type {EditorFieldMetadata} from "@/types/editor/editorMetadataTypes";
import type {EditorControlMetadata} from "@/types/universalEditorTypes";

export type EditorObjectFieldForSorting = {
	index: number;
	metadata: EditorFieldMetadata | EditorControlMetadata;
};

function getPinnedRank(field: EditorObjectFieldForSorting): number {
	return field.metadata.layout?.pinned ? 0 : 1;
}

function getOrderRank(field: EditorObjectFieldForSorting): number {
	return field.metadata.layout?.order ?? Number.POSITIVE_INFINITY;
}

export function sortEditorObjectFields<TField extends EditorObjectFieldForSorting>(
	fields: TField[],
): TField[] {
	return [...fields].sort((a, b) => {
		const pinnedDiff = getPinnedRank(a) - getPinnedRank(b);
		if (pinnedDiff !== 0) return pinnedDiff;

		const orderDiff = getOrderRank(a) - getOrderRank(b);
		if (orderDiff !== 0) return orderDiff;

		return a.index - b.index;
	});
}
