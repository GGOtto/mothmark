import type {z} from "zod";
import type {EditorSelectOption} from "@/types/universalEditorTypes";
import type {EditorDiscoveryMetadata} from "@/types/editor/editorMetadataTypes";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {getEditorMetadata, getEditorVariants} from "@/utils/editorMetadata";

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

export function titleFromSchemaValue(value: string) {
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
	inheritedMetadataSchema?: z.ZodTypeAny,
): EditorSchemaVariant[] {
	if (seen.has(schema)) return [];
	seen.add(schema);
	const ownMetadataSchema = getEditorMetadata(schema) ? schema : undefined;
	const metadataSchema = ownMetadataSchema ?? inheritedMetadataSchema;
	const declaredVariants = getEditorVariants(schema);
	if (declaredVariants && declaredVariants !== schema) {
		return getEditorSchemaVariants(declaredVariants, seen, metadataSchema);
	}

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
		// Once a containing union supplies domain metadata, an operation-level object's
		// title must not replace it in the top-level type picker.
		return shape ? [{schema, shape, metadataSchema: inheritedMetadataSchema ?? schema}] : [];
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

function schemaVariantSupportsValue(variant: EditorSchemaVariant, field: string, selected: string) {
	return variant.shape[field]
		? getSchemaFieldValues(variant.shape[field]).includes(selected)
		: false;
}

export function findEditorSchemaVariant(
	schema: z.ZodTypeAny,
	selection: Record<string, string | undefined>,
) {
	return getEditorSchemaVariants(schema).find((variant) =>
		Object.entries(selection).every(
			([field, selected]) =>
				selected === undefined || schemaVariantSupportsValue(variant, field, selected),
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
					selected === undefined || key === field || schemaVariantSupportsValue(variant, key, selected),
			)
		)
			continue;

		const fieldSchema = variant.shape[field];
		if (!fieldSchema) continue;
		const metadata = getEditorMetadata(fieldSchema);
		for (const value of getSchemaFieldValues(fieldSchema)) {
			const declared = metadata?.options?.find((option) => option.value === value);
			options.set(value, declared ?? {label: titleFromSchemaValue(value), value});
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
			label: schemaTitle || titleFromSchemaValue(value),
			value,
			description: metadata?.description,
		});
	}
	return [...options.values()];
}

export type SchemaLogicOption = {
	key: string;
	type: string;
	operation?: string;
	title: string;
	description?: string;
	category: string;
	keywords: string[];
	situations: string[];
	example?: string;
	note?: string;
	requires: string[];
	fields: string[];
	defaultValue: Record<string, unknown>;
	searchText: string;
};

const LOGIC_INTERNAL_FIELDS = new Set([
	"type",
	"operation",
	"messageType",
	"commandVariables",
	"id",
	"name",
	"label",
	"title",
	"allowMultipleUsesInWorld",
]);

function mergeDiscovery(
	...values: Array<EditorDiscoveryMetadata | undefined>
): Required<Pick<EditorDiscoveryMetadata, "keywords" | "situations" | "requires">> &
	Pick<EditorDiscoveryMetadata, "example" | "note"> {
	return {
		keywords: [...new Set(values.flatMap((value) => value?.keywords ?? []))],
		situations: [...new Set(values.flatMap((value) => value?.situations ?? []))],
		requires: [...new Set(values.flatMap((value) => value?.requires ?? []))],
		example: values.find((value) => value?.example)?.example,
		note: values.find((value) => value?.note)?.note,
	};
}

/**
 * Produces every concrete condition/effect choice from the supplied schema.
 * The active schema controls availability, while metadata on its type, object,
 * operation, and input fields controls author-facing discovery.
 */
export function schemaLogicOptions(schema: z.ZodTypeAny): SchemaLogicOption[] {
	const typeOptions = new Map(schemaTypeOptions(schema).map((option) => [option.value, option]));
	const options = new Map<string, SchemaLogicOption>();

	for (const variant of getEditorSchemaVariants(schema)) {
		const type = schemaVariantValue(variant, "type");
		if (!type || type === "group") continue;

		const typeOption = typeOptions.get(type);
		const domainMetadata = getEditorMetadata(variant.metadataSchema);
		const branchMetadata = getEditorMetadata(variant.schema);
		const operationSchema = variant.shape.operation ?? variant.shape.messageType;
		const operationMetadata = operationSchema ? getEditorMetadata(operationSchema) : undefined;
		const operations = operationSchema ? getSchemaFieldValues(operationSchema) : [undefined];

		for (const operation of operations.length > 0 ? operations : [undefined]) {
			const declaredOperation = operationMetadata?.options?.find(
				(option) => option.value === operation,
			);
			const key = `${type}:${operation ?? ""}`;
			if (options.has(key)) continue;

			const discovery = mergeDiscovery(
				domainMetadata?.discovery,
				branchMetadata?.discovery,
				operationMetadata?.discovery,
				declaredOperation,
			);
			const title =
				declaredOperation?.label ??
				branchMetadata?.title ??
				(operation ? titleFromSchemaValue(operation) : typeOption?.label) ??
				titleFromSchemaValue(type);
			const description =
				declaredOperation?.description ?? branchMetadata?.description ?? domainMetadata?.description;
			const fields = Object.entries(variant.shape)
				.filter(([field]) => !LOGIC_INTERNAL_FIELDS.has(field))
				.map(
					([field, fieldSchema]) => getEditorMetadata(fieldSchema)?.title ?? titleFromSchemaValue(field),
				);
			const category = type.endsWith("-ref")
				? "Reusable"
				: (typeOption?.label ?? titleFromSchemaValue(type));
			const searchText = [
				title,
				description,
				category,
				...discovery.keywords,
				...discovery.situations,
				...fields,
				operation,
				type,
			]
				.filter(Boolean)
				.join(" ")
				.toLocaleLowerCase();

			options.set(key, {
				key,
				type,
				operation,
				title,
				description,
				category,
				keywords: discovery.keywords,
				situations: discovery.situations,
				example: declaredOperation?.example ?? discovery.example,
				note: declaredOperation?.note ?? discovery.note,
				requires: discovery.requires,
				fields,
				defaultValue: createSchemaVariantDefault(schema, {type, operation}),
				searchText,
			});
		}
	}

	return [...options.values()];
}

export function schemaLogicOptionForValue(schema: z.ZodTypeAny, value: Record<string, unknown>) {
	const type = String(value.type ?? "");
	const operation = value.operation ?? value.messageType;
	return schemaLogicOptions(schema).find(
		(option) => option.type === type && option.operation === operation,
	);
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
