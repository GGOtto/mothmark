import type {z} from "zod";
import type {EditorFieldMetadata} from "@/types/editor/editorMetadataTypes";

export function withEditorMetadata<TSchema extends z.ZodTypeAny>(
	schema: TSchema,
	metadata: EditorFieldMetadata,
	defaultFieldValue?: unknown,
): TSchema {
	return schema.meta({
		...(schema.meta() ?? {}),
		...(defaultFieldValue !== undefined ? {defaultFieldValue} : {}),
		editor: metadata,
	}) as TSchema;
}

export function getEditorMetadata(schema: z.ZodTypeAny): EditorFieldMetadata | undefined {
	return schema.meta()?.editor as EditorFieldMetadata | undefined;
}
