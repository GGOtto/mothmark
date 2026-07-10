import {TextFieldControlMetadata} from "@/components/editor/universal/TextFieldEditor";
import type {EditorSummaryMetadata} from "@/types/universalEditorTypes";

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

export const conditionOperatorSummaryLabels: Record<string, string> = {
	equals: "is",
	"not-equals": "is not",
	"greater-than": "is greater than",
	"greater-than-or-equal": "is at least",
	"less-than": "is less than",
	"less-than-or-equal": "is at most",
	contains: "contains",
	"does-not-contain": "does not contain",
	"starts-with": "starts with",
	"ends-with": "ends with",
	matches: "matches",
	"is-empty": "is empty",
	"is-not-empty": "is not empty",
	"is-true": "is true",
	"is-false": "is false",
	eq: "is",
	neq: "is not",
	gt: "is greater than",
	gte: "is at least",
	lt: "is less than",
	lte: "is at most",
};

export const conditionGroupSummaryLabels: Record<string, string> = {
	all: "and",
	any: "or",
	and: "and",
	or: "or",
	none: "none of",
};

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

function stringifySummaryValue(value: unknown) {
	if (value === undefined) return "";
	if (typeof value === "string") return value.length ? value : "(empty)";
	return String(value);
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
			if (label != null) return String(label);
		}
	}

	if (value == null || value === "") return summary?.emptySummary ?? fallback;

	return fallback;
}

export function createStableId(value: unknown, prefix = "copy") {
	const source = isRecord(value)
		? String(value.id ?? value.key ?? value.name ?? value.title ?? prefix)
		: prefix;
	const base = applyTextTransform(source, "id") || prefix;
	return `${base}-copy`;
}

export function generateConditionSummary(condition: unknown): string {
	if (!isRecord(condition)) return "no conditions";

	return generateConditionSummaryAtDepth(condition, 0);
}

function generateConditionSummaryAtDepth(
	condition: Record<string, unknown>,
	depth: number,
): string {
	const kind = String(condition.kind ?? condition.type ?? "single");

	if (kind === "group") {
		const rawOperator = String(condition.operator ?? "all");
		const operator = rawOperator === "and" ? "all" : rawOperator === "or" ? "any" : rawOperator;
		const childSummaries = (Array.isArray(condition.conditions) ? condition.conditions : [])
			.map((child) => (isRecord(child) ? generateConditionSummaryAtDepth(child, depth + 1) : ""))
			.filter(Boolean);

		if (childSummaries.length === 0) return "no conditions";
		if (operator === "none") return `none of (${childSummaries.join(" or ")})`;

		const joiner = operator === "any" ? " or " : " and ";
		const summary = childSummaries.join(joiner);
		return depth > 0 && childSummaries.length > 1 ? `(${summary})` : summary;
	}

	if (kind === "single") {
		const flag = String(condition.flag ?? condition.subject ?? "");
		const value = condition.value ?? true;
		return `${flag || "(flag)"} is ${stringifySummaryValue(value)}`;
	}

	const subject = String(
		condition.subject ??
			condition.flag ??
			condition.counter ??
			condition.roomId ??
			condition.itemId ??
			"",
	);
	const operator = String(condition.operator ?? condition.operation ?? "equals");
	const operatorLabel = conditionOperatorSummaryLabels[operator] ?? operator;
	const value = condition.value ?? condition.chance;

	if (value === undefined || operatorLabel.endsWith("true") || operatorLabel.endsWith("false")) {
		return `${subject || "(subject)"} ${operatorLabel}`;
	}

	return `${subject || "(subject)"} ${operatorLabel} ${stringifySummaryValue(value)}`;
}

export function generateEffectSummary(effect: unknown): string {
	if (!isRecord(effect)) return "Unknown effect";

	const type = String(effect.type ?? "effect");
	if (type === "message") return `show message ${stringifySummaryValue(effect.text ?? "")}`;
	if (type === "flag")
		return `${stringifySummaryValue(effect.operation ?? "set")} flag ${stringifySummaryValue(effect.flag)}`;
	if (type === "counter") {
		return `${stringifySummaryValue(effect.operation ?? "set")} counter ${stringifySummaryValue(effect.counter)} ${stringifySummaryValue(effect.value)}`.trim();
	}
	if (type === "inventory") {
		return `${stringifySummaryValue(effect.operation ?? "update")} item ${stringifySummaryValue(effect.itemId)}`;
	}
	if (type === "room") {
		return `${stringifySummaryValue(effect.operation ?? "move-player")} ${stringifySummaryValue(effect.roomId)}`;
	}

	return Object.entries(effect)
		.map(([key, value]) => `${key}: ${stringifySummaryValue(value)}`)
		.join(", ");
}
