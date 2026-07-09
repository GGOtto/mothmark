import type {z} from "zod";
import type {EditorFieldMetadata} from "@/types/editor/editorMetadataTypes";

export function withEditorMetadata<TSchema extends z.ZodTypeAny>(
	schema: TSchema,
	metadata: EditorFieldMetadata,
): TSchema {
	return schema.meta({
		...(schema.meta() ?? {}),
		editor: metadata,
	}) as TSchema;
}

export function getEditorMetadata(schema: z.ZodTypeAny): EditorFieldMetadata | undefined {
	return schema.meta()?.editor as EditorFieldMetadata | undefined;
}
