import type {EditorFieldMetadata} from "@/types/editor/editorMetadataTypes";
import type {EditorControlMetadata} from "@/types/universalEditorTypes";

export type EditorObjectFieldForSorting = {
	index: number;
	metadata: EditorFieldMetadata | EditorControlMetadata;
};

function getOrderRank(field: EditorObjectFieldForSorting): number {
	return field.metadata.layout?.order ?? 0;
}

function getOrderBucket(order: number): number {
	if (order > 0) {
		return 0;
	}
	if (order === 0) {
		return 1;
	}
	return 2;
}

export function sortEditorObjectFields<TField extends EditorObjectFieldForSorting>(
	fields: TField[],
): TField[] {
	return [...fields].sort((a, b) => {
		const aOrder = getOrderRank(a);
		const bOrder = getOrderRank(b);

		const bucketDiff = getOrderBucket(aOrder) - getOrderBucket(bOrder);
		if (bucketDiff !== 0) {
			return bucketDiff;
		}

		const orderDiff = aOrder - bOrder;
		if (orderDiff !== 0) {
			return orderDiff;
		}

		return a.index - b.index;
	});
}
