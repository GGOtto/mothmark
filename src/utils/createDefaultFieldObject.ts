import {z} from "zod";

type AnyZodSchema = z.ZodType;
type AnyRecord = Record<string, unknown>;

type CreateDefaultOptions = {
	populateArrays?: boolean;
	maxDepth?: number;
	useZodDefaults?: boolean;
	useMetadata?: boolean;
};

const DEFAULT_OPTIONS: Required<CreateDefaultOptions> = {
	populateArrays: true,
	maxDepth: 20,
	useZodDefaults: true,
	useMetadata: true,
};

export function createDefaultFieldObject<TSchema extends AnyZodSchema>(
	schema: TSchema,
	options: CreateDefaultOptions = {},
): z.infer<TSchema> {
	const resolvedOptions: Required<CreateDefaultOptions> = {
		...DEFAULT_OPTIONS,
		...options,
	};

	return createDefaultValue(schema, resolvedOptions, {
		depth: 0,
		insideObject: false,
	}) as z.infer<TSchema>;
}

type WalkContext = {
	depth: number;
	insideObject: boolean;
};

function createDefaultValue(
	schema: AnyZodSchema,
	options: Required<CreateDefaultOptions>,
	context: WalkContext,
): unknown {
	if (context.depth > options.maxDepth) {
		return undefined;
	}

	if (context.insideObject && shouldSkipSchema(schema, options)) {
		return undefined;
	}

	const nextContext: WalkContext = {
		...context,
		depth: context.depth + 1,
	};

	const value = createDefaultValueWithoutMetadata(schema, options, nextContext);
	const metadataValue = options.useMetadata
		? createDefaultFromMeta(schema, options, nextContext)
		: undefined;

	if (isPlainObject(value) && isPlainObject(metadataValue)) {
		return {
			...metadataValue,
			...value,
		};
	}

	if (metadataValue !== undefined) {
		return metadataValue;
	}

	return value;
}

function createDefaultValueWithoutMetadata(
	schema: AnyZodSchema,
	options: Required<CreateDefaultOptions>,
	context: WalkContext,
): unknown {
	const def = getDef(schema);

	switch (def.type) {
		case "string":
			return "";

		case "number":
			return 0;

		case "int":
			return 0;

		case "bigint":
			return BigInt(0);

		case "boolean":
			return false;

		case "date":
			return new Date(0);

		case "symbol":
			return Symbol();

		case "undefined":
			return undefined;

		case "null":
			return null;

		case "void":
			return undefined;

		case "never":
			return undefined;

		case "any":
			return undefined;

		case "unknown":
			return undefined;

		case "nan":
			return Number.NaN;

		case "literal":
			return getLiteralDefault(def);

		case "enum":
			return getEnumDefault(def);

		case "object":
			return createDefaultObject(schema, options, context);

		case "array":
			return createDefaultArray(def, options, context);

		case "tuple":
			return createDefaultTuple(def, options, context);

		case "record":
			return {};

		case "map":
			return new Map();

		case "set":
			return new Set();

		case "union":
			return createDefaultUnion(def, options, context);

		case "intersection":
			return createDefaultIntersection(def, options, context);

		case "optional":
			return undefined;

		case "nullable":
			return undefined;

		case "default":
			return createDefaultFromDefault(def, options, context);

		case "prefault":
			return createDefaultFromPrefault(def, options, context);

		case "catch":
			return createDefaultFromCatch(def, options, context);

		case "pipe":
			return createDefaultFromPipe(def, options, context);

		case "transform":
			return undefined;

		case "lazy":
			return createDefaultFromLazy(def, options, context);

		case "promise":
			return createDefaultFromPromise(def, options, context);

		case "readonly":
			return createDefaultFromInnerType(def, options, context);

		case "template_literal":
			return "";

		case "file":
			return undefined;

		case "custom":
			return undefined;

		default:
			return undefined;
	}
}

function createDefaultObject(
	schema: AnyZodSchema,
	options: Required<CreateDefaultOptions>,
	context: WalkContext,
): AnyRecord {
	const shape = getObjectShape(schema);
	const result: AnyRecord = {};

	for (const [key, childSchema] of Object.entries(shape)) {
		const childValue = createDefaultValue(childSchema, options, {
			...context,
			insideObject: true,
		});

		if (childValue !== undefined) {
			result[key] = childValue;
		}
	}

	return result;
}

function createDefaultArray(
	def: ZodDef,
	options: Required<CreateDefaultOptions>,
	context: WalkContext,
): unknown[] {
	if (!options.populateArrays) {
		return [];
	}

	/**
	 * Arrays are where recursive schemas can expand forever.
	 * Keep the array field, but stop adding the synthetic first child
	 * once the traversal reaches the depth boundary.
	 */
	if (context.depth >= options.maxDepth) {
		return [];
	}

	const elementSchema = asSchema(def.element ?? def.valueType);

	if (!elementSchema) {
		return [];
	}

	const value = createDefaultValue(elementSchema, options, {
		...context,
		// The array container already consumed this traversal level.
		depth: Math.max(0, context.depth - 1),
		insideObject: false,
	});

	return value === undefined ? [] : [value];
}

function createDefaultTuple(
	def: ZodDef,
	options: Required<CreateDefaultOptions>,
	context: WalkContext,
): unknown[] {
	const items = Array.isArray(def.items) ? def.items : [];

	return items.map((item) =>
		createDefaultValue(item, options, {
			...context,
			insideObject: false,
		}),
	);
}

function createDefaultUnion(
	def: ZodDef,
	options: Required<CreateDefaultOptions>,
	context: WalkContext,
): unknown {
	const unionOptions = Array.isArray(def.options) ? def.options : [];

	for (const option of unionOptions) {
		const value = createDefaultValue(option, options, {
			...context,
			insideObject: false,
		});

		if (value !== undefined) {
			return value;
		}
	}

	return undefined;
}

function createDefaultIntersection(
	def: ZodDef,
	options: Required<CreateDefaultOptions>,
	context: WalkContext,
): unknown {
	const left = asSchema(def.left);
	const right = asSchema(def.right);

	const leftValue = left
		? createDefaultValue(left, options, {
				...context,
				insideObject: false,
			})
		: undefined;

	const rightValue = right
		? createDefaultValue(right, options, {
				...context,
				insideObject: false,
			})
		: undefined;

	if (isPlainObject(leftValue) && isPlainObject(rightValue)) {
		return {
			...leftValue,
			...rightValue,
		};
	}

	return rightValue !== undefined ? rightValue : leftValue;
}

function createDefaultFromDefault(
	def: ZodDef,
	options: Required<CreateDefaultOptions>,
	context: WalkContext,
): unknown {
	if (!options.useZodDefaults) {
		return createDefaultFromInnerType(def, options, context);
	}

	const defaultValue = def.defaultValue;

	if (typeof defaultValue === "function") {
		return defaultValue();
	}

	if (defaultValue !== undefined) {
		return defaultValue;
	}

	return createDefaultFromInnerType(def, options, context);
}

function createDefaultFromPrefault(
	def: ZodDef,
	options: Required<CreateDefaultOptions>,
	context: WalkContext,
): unknown {
	const prefaultValue = def.defaultValue ?? def.prefaultValue;

	if (typeof prefaultValue === "function") {
		return prefaultValue();
	}

	if (prefaultValue !== undefined) {
		return prefaultValue;
	}

	return createDefaultFromInnerType(def, options, context);
}

function createDefaultFromCatch(
	def: ZodDef,
	options: Required<CreateDefaultOptions>,
	context: WalkContext,
): unknown {
	const catchValue = def.catchValue;

	if (typeof catchValue === "function") {
		return catchValue();
	}

	if (catchValue !== undefined) {
		return catchValue;
	}

	return createDefaultFromInnerType(def, options, context);
}

function createDefaultFromPipe(
	def: ZodDef,
	options: Required<CreateDefaultOptions>,
	context: WalkContext,
): unknown {
	const inputSchema = asSchema(def.in);
	const outputSchema = asSchema(def.out);

	/**
	 * In Zod 4, z.string().transform(...) is represented as a pipe:
	 * input: string
	 * output: transform
	 *
	 * We cannot safely know what the transform returns, so return undefined.
	 */
	if (outputSchema && getDef(outputSchema).type === "transform") {
		return undefined;
	}

	if (inputSchema) {
		return createDefaultValue(inputSchema, options, {
			...context,
			insideObject: false,
		});
	}

	if (outputSchema) {
		return createDefaultValue(outputSchema, options, {
			...context,
			insideObject: false,
		});
	}

	return undefined;
}

function createDefaultFromLazy(
	def: ZodDef,
	options: Required<CreateDefaultOptions>,
	context: WalkContext,
): unknown {
	const getter = def.getter;

	if (typeof getter !== "function") {
		return undefined;
	}

	const innerSchema = getter();

	if (!isZodSchema(innerSchema)) {
		return undefined;
	}

	return createDefaultValue(innerSchema, options, {
		...context,
		insideObject: false,
	});
}

function createDefaultFromPromise(
	def: ZodDef,
	options: Required<CreateDefaultOptions>,
	context: WalkContext,
): Promise<unknown> {
	const innerValue = createDefaultFromInnerType(def, options, context);

	return Promise.resolve(innerValue);
}

function createDefaultFromInnerType(
	def: ZodDef,
	options: Required<CreateDefaultOptions>,
	context: WalkContext,
): unknown {
	const innerSchema = asSchema(def.innerType ?? def.schema);

	if (!innerSchema) {
		return undefined;
	}

	return createDefaultValue(innerSchema, options, {
		...context,
		insideObject: false,
	});
}

function createDefaultFromMeta(
	schema: AnyZodSchema,
	options: Required<CreateDefaultOptions>,
	context: WalkContext,
): unknown {
	const meta = getSchemaMeta(schema);

	if (!meta || !isPlainObject(meta)) {
		return undefined;
	}

	return createDefaultFromMetaObject(meta, options, context);
}

function createDefaultFromMetaObject(
	metaObject: AnyRecord,
	options: Required<CreateDefaultOptions>,
	context: WalkContext,
): unknown {
	const result: AnyRecord = {};

	for (const [key, value] of Object.entries(metaObject)) {
		if (isZodSchema(value)) {
			const childValue = createDefaultValue(value, options, {
				...context,
				insideObject: true,
			});

			if (childValue !== undefined) {
				result[key] = childValue;
			}

			continue;
		}

		if (Array.isArray(value)) {
			result[key] = value.map((item) => {
				if (isZodSchema(item)) {
					return createDefaultValue(item, options, {
						...context,
						insideObject: false,
					});
				}

				if (isPlainObject(item)) {
					return createDefaultFromMetaObject(item, options, context);
				}

				return item;
			});

			continue;
		}

		if (isPlainObject(value)) {
			const childValue = createDefaultFromMetaObject(value, options, context);

			if (childValue !== undefined) {
				result[key] = childValue;
			}

			continue;
		}

		if (value !== undefined) {
			result[key] = value;
		}
	}

	return Object.keys(result).length > 0 ? result : undefined;
}

function getSchemaMeta(schema: AnyZodSchema): unknown {
	const schemaWithMeta = schema as AnyZodSchema & {
		meta?: () => unknown;
	};

	if (typeof schemaWithMeta.meta !== "function") {
		return undefined;
	}

	return schemaWithMeta.meta();
}

function shouldSkipSchema(schema: AnyZodSchema, options: Required<CreateDefaultOptions>): boolean {
	const def = getDef(schema);

	switch (def.type) {
		case "optional":
		case "nullable":
		case "catch":
			return true;

		case "default":
		case "prefault":
			return !options.useZodDefaults;

		default:
			return false;
	}
}

function getObjectShape(schema: AnyZodSchema): Record<string, AnyZodSchema> {
	const def = getDef(schema);
	const shape = def.shape;

	if (typeof shape === "function") {
		return shape();
	}

	if (isPlainObject(shape)) {
		return shape as Record<string, AnyZodSchema>;
	}

	const schemaWithShape = schema as AnyZodSchema & {
		shape?: Record<string, AnyZodSchema>;
	};

	return schemaWithShape.shape ?? {};
}

function getLiteralDefault(def: ZodDef): unknown {
	if (Array.isArray(def.values)) {
		return def.values[0];
	}

	if (def.values instanceof Set) {
		return Array.from(def.values)[0];
	}

	if ("value" in def) {
		return def.value;
	}

	return undefined;
}

function getEnumDefault(def: ZodDef): unknown {
	const entries = def.entries;

	if (isPlainObject(entries)) {
		return Object.values(entries)[0];
	}

	if (Array.isArray(def.options)) {
		return def.options[0];
	}

	return undefined;
}

type ZodDef = {
	type?: string;
	shape?: unknown;
	element?: unknown;
	valueType?: unknown;
	innerType?: unknown;
	schema?: unknown;
	items?: unknown;
	options?: unknown;
	left?: unknown;
	right?: unknown;
	in?: unknown;
	out?: unknown;
	getter?: unknown;
	defaultValue?: unknown;
	prefaultValue?: unknown;
	catchValue?: unknown;
	values?: unknown;
	value?: unknown;
	entries?: unknown;
	[key: string]: unknown;
};

function getDef(schema: AnyZodSchema): ZodDef {
	return (schema as AnyZodSchema & {_def?: ZodDef})._def ?? {};
}

function asSchema(value: unknown): AnyZodSchema | undefined {
	return isZodSchema(value) ? value : undefined;
}

function isZodSchema(value: unknown): value is AnyZodSchema {
	return value instanceof z.ZodType;
}

function isPlainObject(value: unknown): value is AnyRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
