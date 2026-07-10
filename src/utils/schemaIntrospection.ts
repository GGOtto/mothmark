import type {z} from "zod";
import type {EditorPath} from "@/types/universalEditorTypes";

type ZodDef = {
	type?: string;
	innerType?: z.ZodTypeAny;
	element?: z.ZodTypeAny;
	getter?: () => z.ZodTypeAny;
	shape?: Record<string, z.ZodTypeAny> | (() => Record<string, z.ZodTypeAny>);
	options?: z.ZodTypeAny[];
};

type IntrospectableSchema = z.ZodTypeAny & {
	def?: ZodDef;
	_def?: ZodDef;
	shape?: Record<string, z.ZodTypeAny>;
	element?: z.ZodTypeAny;
};

const WRAPPER_TYPES = new Set(["default", "optional", "nullable", "catch", "readonly"]);

function getDef(schema: z.ZodTypeAny): ZodDef {
	const introspectable = schema as IntrospectableSchema;
	return introspectable.def ?? introspectable._def ?? {};
}

export function unwrapSchema(schema: z.ZodTypeAny): z.ZodTypeAny {
	let current = schema;
	const seen = new Set<z.ZodTypeAny>();

	while (!seen.has(current)) {
		seen.add(current);
		const def = getDef(current);

		if (WRAPPER_TYPES.has(def.type ?? "")) {
			const innerType = def.innerType;
			if (!innerType) break;
			current = innerType;
			continue;
		}

		if (def.type === "lazy") {
			const innerType = def.getter?.();
			if (!innerType) break;
			current = innerType;
			continue;
		}

		break;
	}

	return current;
}

export function getObjectShape(schema: z.ZodTypeAny): Record<string, z.ZodTypeAny> | undefined {
	const unwrapped = unwrapSchema(schema) as IntrospectableSchema;
	const def = getDef(unwrapped);

	if (def.type === "union" && def.options?.length) {
		const shapes = def.options
			.map((option) => getObjectShape(option))
			.filter((shape): shape is Record<string, z.ZodTypeAny> => Boolean(shape));
		if (shapes.length === 0) return undefined;

		return Object.assign({}, ...shapes);
	}

	if (def.type !== "object") return undefined;

	const shape = unwrapped.shape ?? def.shape;
	return typeof shape === "function" ? shape() : shape;
}

export function getArrayElement(schema: z.ZodTypeAny) {
	const unwrapped = unwrapSchema(schema) as IntrospectableSchema;
	if (getDef(unwrapped).type !== "array") return undefined;

	return unwrapped.element ?? getDef(unwrapped).element;
}

export function getSchemaAtPath(schema: z.ZodTypeAny, path: EditorPath): z.ZodTypeAny | undefined {
	let current: z.ZodTypeAny | undefined = schema;

	for (const segment of path) {
		if (!current) return undefined;

		if (typeof segment === "number") {
			current = getArrayElement(current);
			continue;
		}

		const shape = getObjectShape(current);
		if (!shape) return undefined;
		current = shape[segment];
	}

	return current;
}
