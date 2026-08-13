import {TextFieldControlMetadata} from "../TextFieldEditor";
import {parseVariableText} from "@/features/command-variables/syntax";
import type {EditorSummaryMetadata} from "@/types/universalEditorTypes";
import {idValue, isID} from "@/utils/idUtils";
import type {z} from "zod";
import {
	getEditorSchemaVariants,
	getSchemaFieldValues,
	schemaFieldOptions,
	schemaTypeOptions,
} from "./editorSchemaVariants";

export type UniversalCondition =
	| {
			kind: "single";
			flag: string;
			value: boolean;
	  }
	| {
			kind: "expression";
			subject: string;
			operator: string;
			value?: string | number | boolean;
	  }
	| {
			kind: "group";
			operator: "all" | "any" | "none" | "and" | "or";
			conditions: UniversalCondition[];
	  }
	| Record<string, unknown>;

export function applyTextTransform(
	value: string,
	transform?: TextFieldControlMetadata["transform"],
) {
	if (!transform || transform === "none") return value;

	if (transform === "lowercase") return value.toLowerCase();
	if (transform === "uppercase") return value.toUpperCase();

	if (transform === "slug") {
		return value
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "");
	}

	if (transform === "id") {
		return value
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9_/-]+/g, "-")
			.replace(/^-+|-+$/g, "");
	}

	return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function summarizeText(value: string) {
	const nodes = parseVariableText(value);
	if (!nodes.some((node) => node.type === "variable")) return value.length ? value : "(empty)";
	return nodes
		.map((node) => (node.type === "text" ? node.value : "command input"))
		.join("")
		.trim();
}

function findSummaryVariant(schema: z.ZodTypeAny, value: Record<string, unknown>) {
	return getEditorSchemaVariants(schema).find((variant) =>
		Object.entries(variant.shape).every(([field, fieldSchema]) => {
			const allowedValues = getSchemaFieldValues(fieldSchema);
			if (allowedValues.length === 0 || value[field] === undefined) return true;
			return allowedValues.includes(String(value[field]));
		}),
	);
}

function stringifySummaryValue(value: unknown, schema?: z.ZodTypeAny): string {
	if (value === undefined) return "";
	if (isID(value)) return idValue(value) || "(empty)";
	if (Array.isArray(value))
		return value.length ? value.map((child) => stringifySummaryValue(child)).join(", ") : "(none)";
	if (typeof value === "string") return summarizeText(value);
	if (isRecord(value)) {
		const nestedSummary = schema ? generateNestedSchemaSummary(value, schema) : "";
		if (nestedSummary) return nestedSummary;
		return Object.values(value)
			.map((child) => stringifySummaryValue(child))
			.filter(Boolean)
			.join(" ");
	}
	return String(value);
}

function commandBoundFields(value: Record<string, unknown>) {
	if (!Array.isArray(value.commandVariables)) return new Set<string>();
	return new Set(
		value.commandVariables.flatMap((binding) =>
			isRecord(binding) && typeof binding.field === "string" ? [binding.field] : [],
		),
	);
}

function generateNestedSchemaSummary(value: Record<string, unknown>, schema: z.ZodTypeAny) {
	return generateSchemaVariantSummary(value, schema, "nested");
}

function getTemplateValue(value: unknown, path: string) {
	return path.split(".").reduce<unknown>((currentValue, segment) => {
		if (currentValue == null) return undefined;

		if (segment === "length") {
			return Array.isArray(currentValue) || typeof currentValue === "string"
				? currentValue.length
				: undefined;
		}

		if (isRecord(currentValue)) return currentValue[segment];
		return undefined;
	}, value);
}

function applySummaryTemplate(value: unknown, template: string) {
	return template.replace(/\{([^}]+)\}/g, (_, rawPath: string) => {
		const nextValue = getTemplateValue(value, rawPath.trim());
		return nextValue == null ? "" : stringifySummaryValue(nextValue);
	});
}

export function generateEditorSummary(
	value: unknown,
	summary?: EditorSummaryMetadata,
	fallback?: string,
) {
	if (summary?.summary) return summary.summary;

	if (summary?.summaryTemplate) {
		const templatedSummary = applySummaryTemplate(value, summary.summaryTemplate).trim();
		if (templatedSummary) return templatedSummary;
	}

	if (Array.isArray(value)) {
		if (value.length === 0) return summary?.emptySummary ?? fallback ?? "No items yet";
		if (summary?.mode === "deterministic" || summary?.enabled) return `${value.length} items`;
	}

	if (isRecord(value)) {
		if (Object.keys(value).length === 0) {
			return summary?.emptySummary ?? fallback ?? "No details yet";
		}
		if (summary?.mode === "deterministic" || summary?.enabled) {
			const label = value.name ?? value.title ?? value.label ?? value.id;
			if (label != null) return stringifySummaryValue(label);
		}
	}

	if (value == null || value === "") return summary?.emptySummary ?? fallback;

	return fallback;
}

export function createStableId(value: unknown, prefix = "copy") {
	const candidate = isRecord(value)
		? (value.id ?? value.key ?? value.name ?? value.title)
		: undefined;
	const source = candidate === undefined ? prefix : stringifySummaryValue(candidate);
	const base = applyTextTransform(source, "id") || prefix;
	return `${base}-copy`;
}

export function generateConditionSummary(condition: unknown, schema: z.ZodTypeAny): string {
	if (!isRecord(condition)) return "no conditions";
	return generateConditionSummaryAtDepth(condition, 0, schema);
}

function generateConditionSummaryAtDepth(
	condition: Record<string, unknown>,
	depth: number,
	schema: z.ZodTypeAny,
): string {
	const kind = String(condition.kind ?? condition.type ?? "single");

	if (kind === "group") {
		const rawOperator = String(condition.operation ?? condition.operator ?? "all");
		const operator = rawOperator === "and" ? "all" : rawOperator === "or" ? "any" : rawOperator;
		const childSummaries = (Array.isArray(condition.conditions) ? condition.conditions : [])
			.map((child) =>
				isRecord(child) ? generateConditionSummaryAtDepth(child, depth + 1, schema) : "",
			)
			.filter(Boolean);

		if (childSummaries.length === 0) return "no conditions";
		if (operator === "none") return `none of (${childSummaries.join(" or ")})`;

		const joiner = operator === "any" ? " or " : " and ";
		const summary = childSummaries.join(joiner);
		return depth > 0 && childSummaries.length > 1 ? `(${summary})` : summary;
	}

	return generateSchemaVariantSummary(condition, schema, "condition");
}

export function generateEffectSummary(effect: unknown, schema: z.ZodTypeAny): string {
	if (!isRecord(effect)) return "Unknown effect";
	return generateSchemaVariantSummary(effect, schema, "effect");
}

function generateSchemaVariantSummary(
	value: Record<string, unknown>,
	schema: z.ZodTypeAny,
	kind: "condition" | "effect" | "nested",
) {
	const type = String(value.type ?? "");
	const operation = typeof value.operation === "string" ? value.operation : undefined;
	const variant = findSummaryVariant(schema, value);
	if (!variant) return kind === "nested" ? "" : `Unknown ${kind}`;

	const typeLabel = schemaTypeOptions(schema).find((option) => option.value === type)?.label ?? type;
	const operationLabel = operation
		? schemaFieldOptions(schema, "operation", {type}).find((option) => option.value === operation)
				?.label
		: undefined;
	const boundFields = commandBoundFields(value);
	const details = Object.keys(variant.shape)
		.filter(
			(key) =>
				!["type", "operation", "commandVariables"].includes(key) &&
				(value[key] !== undefined || boundFields.has(key)),
		)
		.map((key) =>
			boundFields.has(key) ? "command input" : stringifySummaryValue(value[key], variant.shape[key]),
		)
		.filter(Boolean);
	const parts = kind === "effect" ? [operationLabel ?? typeLabel] : [typeLabel, operationLabel];
	return [...parts, ...details].filter(Boolean).join(" ").trim() || typeLabel;
}
