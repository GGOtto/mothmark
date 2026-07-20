import {TextFieldControlMetadata} from "../TextFieldEditor";
import type {EditorSummaryMetadata} from "@/types/universalEditorTypes";
import {idValue, isID} from "@/utils/idUtils";

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
	is: "is",
	"is-not": "is not",
	"has-tag": "has tag",
	"missing-tag": "is missing tag",
	"has-item": "has item",
	"missing-item": "is missing item",
	"has-all-items": "has all items",
	"has-any-item": "has any item",
	"contains-tag": "contains tag",
	count: "count is",
	"tag-count": "tag count is",
	"in-inventory": "is in inventory",
	"in-current-room": "is in current room",
	"in-room": "is in room",
	"on-surface": "is on surface",
	"in-container": "is in container",
	"held-by-npc": "is held by NPC",
	hidden: "is hidden",
	destroyed: "is destroyed",
	visible: "is visible",
	reachable: "is reachable",
	open: "is open",
	closed: "is closed",
	locked: "is locked",
	unlocked: "is unlocked",
	lit: "is lit",
	unlit: "is unlit",
	broken: "is broken",
	intact: "is intact",
	clean: "is clean",
	dirty: "is dirty",
	"contains-item": "contains item",
	"surface-has-item": "surface has item",
	"surface-missing-item": "surface is missing item",
	empty: "is empty",
	custom: "custom state",
	"mood-is": "mood is",
	trust: "trust is",
	"met-player": "has met player",
	"not-met-player": "has not met player",
	hostile: "is hostile",
	friendly: "is friendly",
	asleep: "is asleep",
	awake: "is awake",
	"can-see-player": "can see player",
	"cannot-see-player": "cannot see player",
	"previous-command-was": "previous command was",
	"previous-raw-command-was": "previous raw command was",
	"previous-target-was": "previous target was",
	"used-command-before": "used command before",
	"never-used-command": "never used command",
	"used-command-within-turns": "used command within turns",
	"repeated-command": "repeated command",
	sequence: "sequence",
	"not-started": "is not started",
	active: "is active",
	completed: "is completed",
	failed: "is failed",
	"objective-complete": "objective is complete",
	"objective-incomplete": "objective is incomplete",
	"event-scheduled": "event is scheduled",
	"event-not-scheduled": "event is not scheduled",
	"tag-scheduled": "tag is scheduled",
	"tag-not-scheduled": "tag is not scheduled",
	compare: "is",
	between: "is between",
	exists: "exists",
	missing: "is missing",
	"multiple-of": "is multiple of",
	"object-is": "object is",
	"target-is": "target is",
	"connector-is": "connector is",
	"topic-is": "topic is",
	"direction-is": "direction is",
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
// TODO: stuff like this just means we have to edit multiple locations to add or remove these

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

function stringifySummaryValue(value: unknown): string {
	if (value === undefined) return "";
	if (isID(value)) return idValue(value) || "(empty)";
	if (Array.isArray(value))
		return value.length ? value.map(stringifySummaryValue).join(", ") : "(none)";
	if (typeof value === "string") return value.length ? value : "(empty)";
	return String(value);
}

function conditionSummarySubject(condition: Record<string, unknown>) {
	const subjectKeys = [
		"subject",
		"flag",
		"counter",
		"itemId",
		"itemIds",
		"objectId",
		"surfaceId",
		"containerId",
		"roomId",
		"npcId",
		"questId",
		"objectiveId",
		"instanceId",
		"eventId",
		"commandName",
		"rawCommand",
		"targetId",
		"object",
		"connector",
		"topicId",
		"direction",
		"tag",
		"key",
		"seedKey",
	];

	for (const key of subjectKeys) {
		const value = condition[key];
		if (isID(value)) return stringifySummaryValue(value);
		if (Array.isArray(value) && value.length > 0) return stringifySummaryValue(value);
		if (typeof value === "string" && value.trim().length > 0) return value.trim();
		if (typeof value === "number" || typeof value === "boolean") return stringifySummaryValue(value);
	}

	const type = String(condition.type ?? condition.kind ?? "");
	if (type === "condition-ref")
		return stringifySummaryValue(condition.conditionId) || "(unchosen) condition";
	if (type === "flag") return "unspecified flag";
	if (type === "counter") return "unspecified counter";
	if (type === "current-room") return "unspecified room";
	if (type === "inventory") return "unspecified inventory target";
	if (type === "item-location") return "unspecified item";
	if (type === "object-state") return "unspecified object";
	if (type === "npc") return "unspecified NPC";
	if (type === "command-history") return "unspecifed command";
	if (type === "turn") return "turn";
	if (type === "random-chance") return "chance";
	if (type === "quest") return "unspecifed quest";
	if (type === "scheduled-event") return "unspecifed event";
	if (type === "resolved-target") return "resolved target";

	return "unspecifed target";
}

function conditionSummaryTarget(value: unknown, fallback: string): string {
	if (Array.isArray(value)) return value.length ? stringifySummaryValue(value) : fallback;
	if (typeof value === "string") return value.trim().length > 0 ? value.trim() : fallback;
	if (value === undefined || value === null) return fallback;
	return stringifySummaryValue(value);
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
		const rawOperator = String(condition.operation ?? condition.operator ?? "all");
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
		return `${flag || "unspecified flag"} is ${stringifySummaryValue(value)}`;
	}

	if (kind === "current-room") {
		const operator = String(condition.operation ?? "is");
		const operatorLabel = conditionOperatorSummaryLabels[operator] ?? operator;
		const usesTag = operator === "has-tag" || operator === "missing-tag";
		const value = usesTag ? condition.tag : condition.roomId;
		return `current room ${operatorLabel} ${conditionSummaryTarget(
			value,
			usesTag ? "unspecified tag" : "unspecified room",
		)}`.trim();
	}

	const subject = conditionSummarySubject(condition);
	const operator = String(condition.operator ?? condition.operation ?? "equals");
	const operatorLabel = conditionOperatorSummaryLabels[operator] ?? operator;
	const value = condition.value ?? condition.chance;

	if (value === undefined || operatorLabel.endsWith("true") || operatorLabel.endsWith("false")) {
		return `${subject} ${operatorLabel}`;
	}

	return `${subject} ${operatorLabel} ${stringifySummaryValue(value)}`;
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
