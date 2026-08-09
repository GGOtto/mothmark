import type {z} from "zod";
import {
	ConditionSchema,
	ItemConditionSchema,
	ItemPredicateSchema,
} from "@/schemas/world/conditionSchema";
import {CommandConditionSchema, CommandEffectSchema} from "@/schemas/world/commandLogicSchemas";
import {EffectSchema} from "@/schemas/world/effectSchema";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {isID, toID} from "@/utils/idUtils";
import {
	getEditorSchemaVariants,
	getSchemaFieldValues,
	type EditorSchemaVariant,
} from "./editorSchemaVariants";
import {generateConditionSummary, generateEffectSummary} from "./universalEditorUtils";

type SummaryCase = {
	key: string;
	value: Record<string, unknown>;
};

const TOP_LEVEL_DISCRIMINATORS = ["type", "flag-type", "operation", "action"] as const;
const ITEM_PREDICATE_DISCRIMINATORS = [
	"type",
	"state",
	"location",
	"test",
	"tag",
	"placement",
] as const;

function sampleId(field: string) {
	if (field === "roomId") return toID("room", "summary-room");
	if (field === "connectionId") return toID("connection", "summary-connection");
	if (field === "conditionId") return toID("condition", "summary-condition");
	if (field === "effectId") return toID("effect", "summary-effect");
	if (field.endsWith("ItemId") || field === "itemId") {
		return toID("item", `summary-${field.replace(/Id$/, "").toLowerCase()}`);
	}
	return undefined;
}

function sampledField(field: string, current: unknown) {
	const id = sampleId(field);
	if (id) return id;
	if (isID(current)) return toID(current.type, `summary-${current.type}`);
	if (field === "messages") return ["First summary message", "Second summary message"];
	if (Array.isArray(current)) return current;
	if (typeof current === "boolean") return true;
	if (typeof current === "number") return 7;
	if (typeof current === "string") return current.length > 0 ? current : `summary-${field}`;
	if (field === "turns" || field === "amount" || field === "min" || field === "max") return 7;
	if (field === "allowShorten" || field === "inclusive" || field === "value") return true;
	return `summary-${field}`;
}

function selectionsFor(
	variant: EditorSchemaVariant,
	discriminators: readonly string[],
): Array<Record<string, string>> {
	return discriminators.reduce<Array<Record<string, string>>>(
		(selections, field) => {
			const fieldSchema = variant.shape[field];
			if (!fieldSchema) return selections;
			const values = getSchemaFieldValues(fieldSchema);
			if (values.length === 0) return selections;
			return selections.flatMap((selection) =>
				values.map((value) => ({...selection, [field]: value})),
			);
		},
		[{}],
	);
}

function summaryCases(
	schema: z.ZodTypeAny,
	discriminators: readonly string[] = TOP_LEVEL_DISCRIMINATORS,
): SummaryCase[] {
	return getEditorSchemaVariants(schema).flatMap((variant) =>
		selectionsFor(variant, discriminators).map((selection) => {
			const value = createDefaultFieldObject(variant.schema) as Record<string, unknown>;
			for (const field of Object.keys(variant.shape)) {
				if (field in selection) continue;
				value[field] = sampledField(field, value[field]);
			}
			Object.assign(value, selection);
			return {
				key: discriminators
					.flatMap((field) => (selection[field] ? [`${field}=${selection[field]}`] : []))
					.join(","),
				value,
			};
		}),
	);
}

function expectUsefulSummary(summary: string) {
	expect(summary.trim()).not.toBe("");
	expect(summary).not.toMatch(/^Unknown (condition|effect)$/);
	expect(summary).not.toContain("[object Object]");
}

const effectCases = summaryCases(EffectSchema);
const nonItemConditionCases = summaryCases(ConditionSchema).filter(
	(candidate) => candidate.value.type !== "item",
);
const itemConditionCases = summaryCases(ItemPredicateSchema, ITEM_PREDICATE_DISCRIMINATORS).map(
	({key, value: test}) => {
		const condition = createDefaultFieldObject(ItemConditionSchema);
		return {
			key: `type=item,test(${key})`,
			value: {
				...condition,
				itemId: toID("item", "summary-subject"),
				test,
			},
		};
	},
);

describe("effect summary schema coverage", () => {
	it.each(effectCases)("summarizes $key", ({value}) => {
		expectUsefulSummary(generateEffectSummary(value, EffectSchema));
	});
});

describe("condition summary schema coverage", () => {
	it.each(nonItemConditionCases)("summarizes $key", ({value}) => {
		expectUsefulSummary(generateConditionSummary(value, ConditionSchema));
	});

	it("summarizes every nested item predicate without leaking object serialization", () => {
		const invalidSummaries = itemConditionCases.flatMap(({key, value}) => {
			const summary = generateConditionSummary(value, ConditionSchema);
			return summary.includes("[object Object]") || summary.startsWith("Unknown")
				? [{key, summary}]
				: [];
		});

		expect(invalidSummaries).toEqual([]);
	});

	it.each([
		["literal and literal", 3, 7],
		["counter and literal", {source: "counter", counter: "score"}, 7],
		["literal and counter", 3, {source: "counter", counter: "score"}],
		[
			"counter and counter",
			{source: "counter", counter: "score"},
			{source: "counter", counter: "limit"},
		],
	] as const)("summarizes a command comparison using %s operands", (_, left, right) => {
		const comparison = {
			...createDefaultFieldObject(CommandConditionSchema),
			type: "comparison",
			valueType: "number",
			operator: "gte",
			left,
			right,
		};

		expectUsefulSummary(generateConditionSummary(comparison, CommandConditionSchema));
	});
});

const commandBlockIds = {
	boolean: toID("command-block", "summary-boolean-block"),
	direction: toID("command-block", "summary-direction-block"),
	number: toID("command-block", "summary-number-block"),
	target: toID("command-block", "summary-target-block"),
	text: toID("command-block", "summary-text-block"),
};

const boundSummaryCases: Array<{
	key: string;
	kind: "condition" | "effect";
	fallback: string;
	value: Record<string, unknown>;
}> = [
	{
		key: "effect string field",
		kind: "effect",
		fallback: "authored-fallback-message",
		value: {
			...createDefaultFieldObject(CommandEffectSchema),
			type: "message",
			operation: "show",
			message: "authored-fallback-message",
			commandVariables: [{blockId: commandBlockIds.text, field: "message"}],
		},
	},
	{
		key: "effect number field",
		kind: "effect",
		fallback: "91",
		value: {
			...createDefaultFieldObject(CommandEffectSchema),
			type: "counter",
			operation: "increase",
			counter: "turn-count",
			amount: 91,
			commandVariables: [{blockId: commandBlockIds.number, field: "amount"}],
		},
	},
	{
		key: "effect boolean field",
		kind: "effect",
		fallback: "false",
		value: {
			...createDefaultFieldObject(CommandEffectSchema),
			type: "message",
			operation: "current-room-description",
			allowShorten: false,
			commandVariables: [{blockId: commandBlockIds.boolean, field: "allowShorten"}],
		},
	},
	{
		key: "effect entity field",
		kind: "effect",
		fallback: "fallback-room",
		value: {
			...createDefaultFieldObject(CommandEffectSchema),
			type: "room",
			operation: "move-player-to",
			roomId: toID("room", "fallback-room"),
			commandVariables: [{blockId: commandBlockIds.target, field: "roomId"}],
		},
	},
	{
		key: "effect direction field",
		kind: "effect",
		fallback: "sw",
		value: {
			...createDefaultFieldObject(CommandEffectSchema),
			type: "player",
			operation: "move-in-direction",
			direction: "sw",
			commandVariables: [{blockId: commandBlockIds.direction, field: "direction"}],
		},
	},
	{
		key: "condition string field",
		kind: "condition",
		fallback: "fallback-room-tag",
		value: {
			...createDefaultFieldObject(CommandConditionSchema),
			type: "current-room",
			operation: "has-tag",
			tag: "fallback-room-tag",
			commandVariables: [{blockId: commandBlockIds.text, field: "tag"}],
		},
	},
	{
		key: "condition number field",
		kind: "condition",
		fallback: "92",
		value: {
			...createDefaultFieldObject(CommandConditionSchema),
			type: "counter",
			operation: "compare",
			counter: "turn-count",
			operator: "gte",
			value: 92,
			commandVariables: [{blockId: commandBlockIds.number, field: "value"}],
		},
	},
	{
		key: "condition entity field",
		kind: "condition",
		fallback: "fallback-current-room",
		value: {
			...createDefaultFieldObject(CommandConditionSchema),
			type: "current-room",
			operation: "is",
			roomId: toID("room", "fallback-current-room"),
			commandVariables: [{blockId: commandBlockIds.target, field: "roomId"}],
		},
	},
	{
		key: "condition direction field",
		kind: "condition",
		fallback: "ne",
		value: {
			...createDefaultFieldObject(CommandConditionSchema),
			type: "current-room",
			operation: "is-exit-open",
			direction: "ne",
			commandVariables: [{blockId: commandBlockIds.direction, field: "direction"}],
		},
	},
	{
		key: "command comparison operands",
		kind: "condition",
		fallback: "93",
		value: {
			...createDefaultFieldObject(CommandConditionSchema),
			type: "comparison",
			valueType: "number",
			operator: "lt",
			left: 93,
			right: 94,
			commandVariables: [
				{blockId: commandBlockIds.number, field: "left"},
				{blockId: commandBlockIds.target, field: "right"},
			],
		},
	},
];

describe("command-variable summaries", () => {
	it("describes whole-field bindings instead of presenting fallback values as unconditional", () => {
		const misleadingSummaries = boundSummaryCases.flatMap(({key, kind, fallback, value}) => {
			const summary =
				kind === "effect"
					? generateEffectSummary(value, CommandEffectSchema)
					: generateConditionSummary(value, CommandConditionSchema);
			const blockIdExposed = Object.values(commandBlockIds).some(({id}) => summary.includes(id));
			return !summary.toLowerCase().includes("command input") ||
				summary.includes(fallback) ||
				blockIdExposed
				? [{key, summary}]
				: [];
		});

		expect(misleadingSummaries).toEqual([]);
	});

	it.each([
		["value", `{variable ${commandBlockIds.number.id}}`],
		["name", `{variable ${commandBlockIds.target.id} name}`],
		["description", `{variable ${commandBlockIds.target.id} description}`],
		["entered text", `{variable ${commandBlockIds.target.id} text}`],
	])("summarizes an inline %s variable without exposing its internal block ID", (_, token) => {
		const value = {
			...createDefaultFieldObject(CommandEffectSchema),
			type: "message",
			operation: "show",
			message: `Resolved from ${token}`,
		};
		const summary = generateEffectSummary(value, CommandEffectSchema);

		expect(summary.toLowerCase()).toContain("command input");
		expect(summary).not.toContain(token);
		expect(summary).not.toMatch(/summary-(number|target)-block/);
	});
});
