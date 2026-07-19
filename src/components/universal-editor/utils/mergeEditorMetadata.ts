import type {EditorFieldMetadata} from "@/types/editor/editorMetadataTypes";
import type {EditorControlMetadata} from "@/types/universalEditorTypes";

export type MergeableEditorMetadata = EditorFieldMetadata | EditorControlMetadata;

export function mergeEditorMetadata<TMetadata extends MergeableEditorMetadata>(
	base: TMetadata,
	override?: Partial<EditorFieldMetadata>,
): TMetadata {
	if (!override) return base;

	const {control, layout, appearance, ...overrideMetadata} = override;
	const controlMetadata = control && "type" in base ? {type: control} : control ? {control} : {};
	const merged = {
		...base,
		...overrideMetadata,
		...controlMetadata,
	} as TMetadata;

	if (base.layout || layout) {
		merged.layout = {
			...base.layout,
			...layout,
		};
	}

	if (base.appearance || appearance) {
		merged.appearance = {
			...base.appearance,
			...appearance,
		};
	}

	return merged;
}
