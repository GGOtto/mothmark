import type {z} from "zod";
import type {EditorSelectOption} from "@/types/universalEditorTypes";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {getEditorMetadata} from "@/utils/editorMetadata";

type ZodDef = {
	type?: string;
	innerType?: z.ZodTypeAny;
	in?: z.ZodTypeAny;
	out?: z.ZodTypeAny;
	getter?: () => z.ZodTypeAny;
	shape?: Record<string, z.ZodTypeAny> | (() => Record<string, z.ZodTypeAny>);
	options?: z.ZodTypeAny[];
	entries?: Record<string, string>;
	values?: unknown[] | Set<unknown>;
	value?: unknown;
};

type IntrospectableSchema = z.ZodTypeAny & {
	def?: ZodDef;
	_def?: ZodDef;
	shape?: Record<string, z.ZodTypeAny>;
	options?: string[] | z.ZodTypeAny[];
};

export type EditorSchemaVariant = {
	schema: z.ZodTypeAny;
	shape: Record<string, z.ZodTypeAny>;
	metadataSchema: z.ZodTypeAny;
};

function getDef(schema: z.ZodTypeAny): ZodDef {
	const introspectable = schema as IntrospectableSchema;
	return introspectable.def ?? introspectable._def ?? {};
}

function titleFromValue(value: string) {
	const words = value.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[-_]+/g, " ");
	return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

function objectShape(schema: z.ZodTypeAny) {
	const introspectable = schema as IntrospectableSchema;
	const shape = introspectable.shape ?? getDef(schema).shape;
	return typeof shape === "function" ? shape() : shape;
}

/** Returns every concrete object branch represented by a wrapped or nested Zod union. */
export function getEditorSchemaVariants(
	schema: z.ZodTypeAny,
	seen = new Set<z.ZodTypeAny>(),
	inheritedMetadataSchema: z.ZodTypeAny = schema,
): EditorSchemaVariant[] {
	if (seen.has(schema)) return [];
	seen.add(schema);
	const metadataSchema = getEditorMetadata(schema) ? schema : inheritedMetadataSchema;

	const def = getDef(schema);
	if (["default", "optional", "nullable", "catch", "readonly"].includes(def.type ?? "")) {
		return def.innerType ? getEditorSchemaVariants(def.innerType, seen, metadataSchema) : [];
	}
	if (def.type === "pipe") {
		return def.out ? getEditorSchemaVariants(def.out, seen, metadataSchema) : [];
	}
	if (def.type === "lazy") {
		return def.getter ? getEditorSchemaVariants(def.getter(), seen, metadataSchema) : [];
	}
	if (def.type === "union") {
		return (def.options ?? []).flatMap((option) =>
			getEditorSchemaVariants(option, seen, metadataSchema),
		);
	}
	if (def.type === "object") {
		const shape = objectShape(schema);
		return shape ? [{schema, shape, metadataSchema}] : [];
	}

	return [];
}

export function getSchemaFieldValues(schema: z.ZodTypeAny): string[] {
	const def = getDef(schema);
	if (["default", "optional", "nullable", "catch", "readonly"].includes(def.type ?? "")) {
		return def.innerType ? getSchemaFieldValues(def.innerType) : [];
	}
	if (def.type === "literal") {
		const values = def.values instanceof Set ? [...def.values] : def.values;
		const value = values?.[0] ?? def.value;
		return value === undefined ? [] : [String(value)];
	}
	if (def.type === "enum") {
		const introspectable = schema as IntrospectableSchema;
		const values = Array.isArray(introspectable.options)
			? introspectable.options
			: Object.values(def.entries ?? {});
		return values.filter((value): value is string => typeof value === "string");
	}
	return [];
}

export function schemaVariantValue(variant: EditorSchemaVariant, field: string) {
	return variant.shape[field] ? getSchemaFieldValues(variant.shape[field])[0] : undefined;
}

export function findEditorSchemaVariant(
	schema: z.ZodTypeAny,
	selection: Record<string, string | undefined>,
) {
	return getEditorSchemaVariants(schema).find((variant) =>
		Object.entries(selection).every(
			([field, selected]) => selected === undefined || schemaVariantValue(variant, field) === selected,
		),
	);
}

export function schemaFieldOptions(
	schema: z.ZodTypeAny,
	field: string,
	selection: Record<string, string | undefined> = {},
): EditorSelectOption[] {
	const options = new Map<string, EditorSelectOption>();
	for (const variant of getEditorSchemaVariants(schema)) {
		if (
			!Object.entries(selection).every(
				([key, selected]) =>
					selected === undefined || key === field || schemaVariantValue(variant, key) === selected,
			)
		)
			continue;

		const fieldSchema = variant.shape[field];
		if (!fieldSchema) continue;
		const metadata = getEditorMetadata(fieldSchema);
		for (const value of getSchemaFieldValues(fieldSchema)) {
			const declared = metadata?.options?.find((option) => option.value === value);
			options.set(value, declared ?? {label: titleFromValue(value), value});
		}
	}
	return [...options.values()];
}

export function schemaTypeOptions(schema: z.ZodTypeAny, field = "type"): EditorSelectOption[] {
	const options = new Map<string, EditorSelectOption>();
	for (const variant of getEditorSchemaVariants(schema)) {
		const value = schemaVariantValue(variant, field);
		if (!value || options.has(value)) continue;
		const metadata = getEditorMetadata(variant.metadataSchema);
		const schemaTitle = value.endsWith("-ref")
			? metadata?.title
			: metadata?.title?.replace(/\s+(condition|effect)$/i, "");
		options.set(value, {
			label: schemaTitle || titleFromValue(value),
			value,
			description: metadata?.description,
		});
	}
	return [...options.values()];
}

export function createSchemaVariantDefault(
	schema: z.ZodTypeAny,
	selection: Record<string, string | undefined>,
): Record<string, unknown> {
	const variant = findEditorSchemaVariant(schema, selection);
	return variant
		? (createDefaultFieldObject(variant.schema) as Record<string, unknown>)
		: Object.fromEntries(Object.entries(selection).filter((entry) => entry[1] !== undefined));
}
