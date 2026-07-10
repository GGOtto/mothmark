import type {EditorFieldMetadata} from "@/types/editor/editorMetadataTypes";
import type {EditorControlMetadata} from "@/types/universalEditorTypes";

export type EditorObjectFieldForSorting = {
	index: number;
	metadata: EditorFieldMetadata | EditorControlMetadata;
};

function getPinnedRank(field: EditorObjectFieldForSorting): number {
	return field.metadata.priority?.pinned || field.metadata.layout?.pinned ? 0 : 1;
}

function getOrderRank(field: EditorObjectFieldForSorting): number {
	return field.metadata.priority?.order ?? field.metadata.layout?.order ?? Number.POSITIVE_INFINITY;
}

function getImportanceRank(field: EditorObjectFieldForSorting): number {
	const importance =
		field.metadata.priority?.importance ??
		(field.metadata.advanced ? "advanced" : undefined) ??
		"secondary";

	if (importance === "primary") return 0;
	if (importance === "secondary") return 1;
	if (importance === "advanced") return 2;
	return 3;
}

export function sortEditorObjectFields<TField extends EditorObjectFieldForSorting>(
	fields: TField[],
): TField[] {
	return [...fields].sort((a, b) => {
		const pinnedDiff = getPinnedRank(a) - getPinnedRank(b);
		if (pinnedDiff !== 0) return pinnedDiff;

		const orderDiff = getOrderRank(a) - getOrderRank(b);
		if (orderDiff !== 0) return orderDiff;

		const importanceDiff = getImportanceRank(a) - getImportanceRank(b);
		if (importanceDiff !== 0) return importanceDiff;

		return a.index - b.index;
	});
}
