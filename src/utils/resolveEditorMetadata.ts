import type {z} from "zod";
import type {ObjectFieldMetadata} from "@/components/editor/universal/ObjectEditor";
import type {
	EditorControlMetadata,
	EditorControlType,
	EditorSelectOption,
} from "@/types/universalEditorTypes";
import type {EditorFieldMetadata} from "@/types/editor/editorMetadataTypes";
import {getEditorMetadata} from "@/utils/editorMetadata";
import {mergeEditorMetadata} from "@/utils/mergeEditorMetadata";
import {sortEditorObjectFields} from "@/utils/sortEditorObjectFields";

type ZodDef = {
	type?: string;
	innerType?: z.ZodTypeAny;
	element?: z.ZodTypeAny;
	shape?: Record<string, z.ZodTypeAny> | (() => Record<string, z.ZodTypeAny>);
	options?: z.ZodTypeAny[];
	entries?: Record<string, string>;
	values?: unknown[];
	defaultValue?: unknown;
	discriminator?: string;
};

type IntrospectableSchema = z.ZodTypeAny & {
	def?: ZodDef;
	_def?: ZodDef;
	shape?: Record<string, z.ZodTypeAny>;
	element?: z.ZodTypeAny;
	options?: string[] | z.ZodTypeAny[];
	values?: Set<unknown>;
	description?: string;
};

type ResolvedSchemaParts = {
	schema: z.ZodTypeAny;
	def: ZodDef;
	metadata?: EditorFieldMetadata;
};

const WRAPPER_TYPES = new Set(["default", "optional", "nullable", "catch", "readonly"]);

function getDef(schema: z.ZodTypeAny): ZodDef {
	const introspectable = schema as IntrospectableSchema;
	return introspectable.def ?? introspectable._def ?? {};
}

function getInnerSchema(schema: z.ZodTypeAny): z.ZodTypeAny | undefined {
	return getDef(schema).innerType;
}

function resolveSchemaParts(schema: z.ZodTypeAny): ResolvedSchemaParts {
	let current = schema;
	let metadata = getEditorMetadata(current);

	while (!metadata && WRAPPER_TYPES.has(getDef(current).type ?? "")) {
		const innerType = getInnerSchema(current);
		if (!innerType) break;

		current = innerType;
		metadata = getEditorMetadata(current);
	}

	return {
		schema: current,
		def: getDef(current),
		metadata,
	};
}

function unwrapSchema(schema: z.ZodTypeAny): z.ZodTypeAny {
	let current = schema;

	while (WRAPPER_TYPES.has(getDef(current).type ?? "")) {
		const innerType = getInnerSchema(current);
		if (!innerType) break;
		current = innerType;
	}

	return current;
}

function getObjectShape(schema: z.ZodTypeAny) {
	const unwrapped = unwrapSchema(schema) as IntrospectableSchema;
	if (getDef(unwrapped).type !== "object") return undefined;

	const shape = unwrapped.shape ?? getDef(unwrapped).shape;
	return typeof shape === "function" ? shape() : shape;
}

function getArrayElement(schema: z.ZodTypeAny) {
	const unwrapped = unwrapSchema(schema) as IntrospectableSchema;
	if (getDef(unwrapped).type !== "array") return undefined;

	return unwrapped.element ?? getDef(unwrapped).element;
}

function titleFromKey(key: string) {
	return key
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/[-_]+/g, " ")
		.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function optionLabel(value: string) {
	return titleFromKey(value);
}

function getEnumOptions(schema: z.ZodTypeAny): EditorSelectOption[] {
	const unwrapped = unwrapSchema(schema) as IntrospectableSchema;
	const def = getDef(unwrapped);
	const rawOptions =
		Array.isArray(unwrapped.options) &&
		unwrapped.options.every((option) => typeof option === "string")
			? unwrapped.options
			: def.entries
				? Object.values(def.entries)
				: [];

	return rawOptions.map((value) => ({
		label: optionLabel(String(value)),
		value: String(value),
	}));
}

function inferControlType(schema: z.ZodTypeAny): EditorControlType {
	const def = getDef(unwrapSchema(schema));

	if (def.type === "object") return "object";
	if (def.type === "array") return "array";
	if (def.type === "number") return "number";
	if (def.type === "boolean") return "toggle";
	if (def.type === "enum") return "select";
	if (def.type === "literal") return "hidden";
	if (def.type === "union") return "discriminated-union";

	return "text";
}

export function createDefaultValue(schema: z.ZodTypeAny): unknown {
	const parsed = schema.safeParse(undefined);
	if (parsed.success && parsed.data !== undefined) return parsed.data;

	const current = unwrapSchema(schema);
	const def = getDef(current);

	if (def.type === "object") {
		const shape = getObjectShape(current) ?? {};

		return Object.fromEntries(
			Object.entries(shape).map(([key, childSchema]) => [key, createDefaultValue(childSchema)]),
		);
	}

	if (def.type === "array") return [];
	if (def.type === "number") return 0;
	if (def.type === "boolean") return false;
	if (def.type === "enum") return getEnumOptions(current)[0]?.value ?? "";
	if (def.type === "literal") return def.values?.[0] ?? "";
	if (def.type === "union") return {};

	return "";
}

function featureDefaults(metadata?: EditorFieldMetadata): Record<string, unknown> {
	return {
		...(metadata?.picker ?? {}),
		...(metadata?.emptyState ?? {}),
		...(metadata?.duplicate ?? {}),
	};
}

function buildObjectFeatures(schema: z.ZodTypeAny, metadata?: EditorFieldMetadata) {
	const shape = getObjectShape(schema);
	const fields = shape
		? sortEditorObjectFields(
				Object.entries(shape).map(([key, fieldSchema], index) => {
					const fieldMetadata = resolveEditorMetadata(fieldSchema, {
						title: titleFromKey(key),
					});

					return {
						key,
						metadata: mergeEditorMetadata(fieldMetadata, metadata?.childControls?.[key]),
						defaultValue: createDefaultValue(fieldSchema),
						index,
					};
				}),
			).map((field) => ({
				key: field.key,
				metadata: field.metadata,
				defaultValue: field.defaultValue,
			}))
		: [];

	return {
		...featureDefaults(metadata),
		layout: "stack",
		fields,
	} satisfies Record<string, unknown> & {fields: ObjectFieldMetadata[]};
}

function buildArrayFeatures(schema: z.ZodTypeAny, metadata?: EditorFieldMetadata) {
	const itemSchema = getArrayElement(schema);

	return {
		...featureDefaults(metadata),
		reorderable: true,
		duplicateable: true,
		collapsibleItems: true,
		defaultCollapsedItems: true,
		getItemTitle: "{name}",
		getItemSubtitle: "{id}",
		itemMetadata: itemSchema ? resolveEditorMetadata(itemSchema) : undefined,
		defaultItem: itemSchema ? createDefaultValue(itemSchema) : "",
		emptyTitle: metadata?.emptyState?.emptyTitle,
		emptyDescription: metadata?.emptyState?.emptyDescription,
		emptyActionLabel: metadata?.emptyState?.emptyActionLabel,
		duplicateBehavior: metadata?.duplicate?.duplicateBehavior,
		idField: metadata?.duplicate?.idField,
		idPrefix: metadata?.duplicate?.idPrefix,
	};
}

function buildSelectFeatures(schema: z.ZodTypeAny, metadata?: EditorFieldMetadata) {
	return {
		...featureDefaults(metadata),
		options: metadata?.options ?? getEnumOptions(schema),
		optionSource: metadata?.optionSource,
		placeholder: metadata?.placeholder,
	};
}

function buildPickerFeatures(metadata?: EditorFieldMetadata) {
	return {
		...featureDefaults(metadata),
		entityType: metadata?.entityType,
		tagSource: metadata?.tagSource,
	};
}

function buildFeatures(
	schema: z.ZodTypeAny,
	type: EditorControlType,
	metadata?: EditorFieldMetadata,
) {
	if (type === "object") return buildObjectFeatures(schema, metadata);
	if (type === "array") return buildArrayFeatures(schema, metadata);
	if (type === "select" || type === "multi-select" || type === "scope-picker") {
		return buildSelectFeatures(schema, metadata);
	}
	if (
		type === "entity-picker" ||
		type === "room-picker" ||
		type === "connection-picker" ||
		type === "flag-picker" ||
		type === "counter-picker" ||
		type === "tag-list" ||
		type === "id"
	) {
		return buildPickerFeatures(metadata);
	}

	return featureDefaults(metadata);
}

export function resolveEditorMetadata(
	schema: z.ZodTypeAny,
	fallback: Partial<EditorControlMetadata> = {},
): EditorControlMetadata {
	const {schema: metadataSchema, metadata} = resolveSchemaParts(schema);
	const type = metadata?.control ?? fallback.type ?? inferControlType(metadataSchema);
	const description = metadataSchema.description ?? metadata?.description ?? fallback.description;

	return {
		...fallback,
		...metadata,
		type,
		description,
		features: {
			...buildFeatures(metadataSchema, type, metadata),
			...(fallback.features ?? {}),
		},
	};
}
