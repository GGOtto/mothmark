import {z} from "zod";
import {docify} from "@/schemas/utils/docify";
import {editor} from "@/schemas/utils/editorSchemaHelpers";

export const ComparisonOperatorSchema = editor.select(
	z.enum(["eq", "neq", "gt", "gte", "lt", "lte"]),
	{
		title: "Operator",
		options: [
			{label: "Equals", value: "eq"},
			{label: "Does Not Equal", value: "neq"},
			{label: "Greater Than", value: "gt"},
			{label: "Greater Than or Equal", value: "gte"},
			{label: "Less Than", value: "lt"},
			{label: "Less Than or Equal", value: "lte"},
		],
	},
);

export const ConditionReferenceSchema = editor.object(
	{
		type: z.literal("condition-ref"),
		conditionId: editor.reference("condition", {title: "Condition"}),
	},
	{title: "Condition Reference"},
);

export const FlagConditionSchema = editor.discriminatedUnion(
	z.discriminatedUnion("flag-type", [
		z.object({
			type: z.literal("flag"),
			"flag-type": z.literal("normal").default("normal"),
			operation: editor.select(z.enum(["true", "false", "exists", "missing"]), {
				title: "Operation",
			}),
			flag: editor.flagKey({title: "Flag"}),
		}),
		z.object({
			type: z.literal("flag"),
			"flag-type": z.literal("room"),
			operation: editor.select(z.enum(["true", "false", "exists", "missing"]), {
				title: "Operation",
			}),
			roomId: editor.reference("room", {title: "Room"}),
			flag: editor.string({title: "Flag"}).min(1),
		}),
		z.object({
			type: z.literal("flag"),
			"flag-type": z.literal("feature"),
			operation: editor.select(z.enum(["true", "false", "exists", "missing"]), {
				title: "Operation",
			}),
			roomId: editor.reference("room", {title: "Room"}),
			featureId: editor.reference("feature", {title: "Feature"}),
			flag: editor.string({title: "Flag"}).min(1),
		}),
	]),
	{title: "Flag Condition", description: "Checks a boolean world, room, or feature flag."},
);

export const CounterConditionSchema = editor.discriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("counter"),
			operation: z.literal("compare"),
			counter: editor.counterKey({title: "Counter"}),
			operator: ComparisonOperatorSchema,
			value: editor.number({title: "Value"}),
		}),
		z.object({
			type: z.literal("counter"),
			operation: z.literal("between"),
			counter: editor.counterKey({title: "Counter"}),
			min: editor.number({title: "Minimum"}),
			max: editor.number({title: "Maximum"}),
			inclusive: editor.boolean({title: "Inclusive"}).default(true),
		}),
		z.object({
			type: z.literal("counter"),
			operation: z.literal("exists"),
			counter: editor.counterKey({title: "Counter"}),
		}),
		z.object({
			type: z.literal("counter"),
			operation: z.literal("missing"),
			counter: editor.counterKey({title: "Counter"}),
		}),
	]),
	{title: "Counter Condition", description: "Checks a numeric world counter."},
);

export const CurrentRoomConditionSchema = editor.discriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("current-room"),
			operation: z.literal("is"),
			roomId: editor.reference("room", {title: "Room"}),
		}),
		z.object({
			type: z.literal("current-room"),
			operation: z.literal("is-not"),
			roomId: editor.reference("room", {title: "Room"}),
		}),
		z.object({
			type: z.literal("current-room"),
			operation: z.literal("has-tag"),
			tag: editor.input({title: "Room Tag"}).min(1),
		}),
		z.object({
			type: z.literal("current-room"),
			operation: z.literal("missing-tag"),
			tag: editor.input({title: "Room Tag"}).min(1),
		}),
	]),
	{title: "Current Room Condition", description: "Checks the player's current room or its tags."},
);

export const SingleConditionSchema = editor.discriminatedUnion(
	z.discriminatedUnion("type", [
		FlagConditionSchema,
		CounterConditionSchema,
		CurrentRoomConditionSchema,
	]),
	{title: "Condition"},
);

export type SingleCondition = z.infer<typeof SingleConditionSchema>;
export type ConditionReference = z.infer<typeof ConditionReferenceSchema>;
export type ConditionGroup = {
	type: "group";
	operation: "all" | "any" | "none";
	conditions: Condition[];
};
export type ConditionDefinition = SingleCondition | ConditionGroup;
export type Condition = ConditionDefinition | ConditionReference;

export const DefaultConditionGroup: ConditionGroup = {
	type: "group",
	operation: "all",
	conditions: [],
};

export const ConditionGroupSchema: z.ZodType<ConditionGroup> = z.lazy(() =>
	z.object({
		type: z.literal("group"),
		operation: z.enum(["all", "any", "none"]),
		conditions: z.array(ConditionSchema),
	}),
);

function normalizeFlagCondition(value: unknown): unknown {
	if (!value || typeof value !== "object" || Array.isArray(value)) return value;
	const condition = value as Record<string, unknown>;
	if (condition.type === "flag" && !("flag-type" in condition)) {
		return {...condition, "flag-type": "normal"};
	}
	return value;
}

export const ConditionSchema: z.ZodType<Condition> = z.lazy(() =>
	z.preprocess(
		normalizeFlagCondition,
		z.union([SingleConditionSchema, ConditionGroupSchema, ConditionReferenceSchema]),
	),
);

export const WorldConditionSchema = z.preprocess(
	(value) => {
		if (!value || typeof value !== "object" || Array.isArray(value)) return value;
		if ("identity" in value && "condition" in value) {
			return {...value, condition: normalizeFlagCondition(value.condition)};
		}
		if (!("id" in value)) return value;

		const id = value.id;
		const condition: Record<string, unknown> = {...value};
		delete condition.id;
		delete condition.name;
		delete condition.allowMultipleUsesInWorld;
		return {identity: id, condition: normalizeFlagCondition(condition)};
	},
	z.object({
		identity: editor.id("condition"),
		condition: editor.condition(z.union([SingleConditionSchema, ConditionGroupSchema]), {
			title: "Condition",
		}),
	}),
);

export type WorldCondition = z.infer<typeof WorldConditionSchema>;

export const ConditionalTextSchema = editor.object(
	{
		when: editor.conditionControl(ConditionSchema, {title: "Conditions"}),
		text: editor.textarea({title: "Text"}).default(""),
	},
	{
		title: "Conditional Text",
		description: docify(`Text shown when all referenced room or feature conditions pass.`),
	},
);

export type ConditionalText = z.infer<typeof ConditionalTextSchema>;

// TODO: Reintroduce item, NPC, quest, event, and authored-command conditions with those domains.
