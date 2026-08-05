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

/**
 * Associates a permissive runtime schema with the concrete schema branches its
 * editor should expose. The relationship lives on the schema so editor code
 * never needs a parallel catalog of supported variants.
 */
export function withEditorVariants<TSchema extends z.ZodTypeAny>(
	schema: TSchema,
	variants: z.ZodTypeAny,
): TSchema {
	return schema.meta({
		...(schema.meta() ?? {}),
		editorVariants: variants,
	}) as TSchema;
}

export function getEditorVariants(schema: z.ZodTypeAny): z.ZodTypeAny | undefined {
	return schema.meta()?.editorVariants as z.ZodTypeAny | undefined;
}
