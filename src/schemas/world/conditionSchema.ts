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

const ConditionIdentitySchema = z.object({
	id: editor.id("condition", {title: "Condition ID", advanced: true}).optional(),
	name: editor.input({title: "Condition Name"}).optional(),
	allowMultipleUsesInWorld: editor.boolean({title: "Allow multiple uses in world"}).default(false),
});

export const ConditionReferenceSchema = editor.object(
	{
		type: z.literal("condition-ref"),
		conditionId: editor.reference("condition", {title: "Condition"}),
	},
	{title: "Condition Reference"},
);

export const FlagConditionSchema = editor.discriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("flag"),
			operation: z.literal("true"),
			flag: editor.flagKey({title: "Flag"}),
		}),
		z.object({
			type: z.literal("flag"),
			operation: z.literal("false"),
			flag: editor.flagKey({title: "Flag"}),
		}),
		z.object({
			type: z.literal("flag"),
			operation: z.literal("exists"),
			flag: editor.flagKey({title: "Flag"}),
		}),
		z.object({
			type: z.literal("flag"),
			operation: z.literal("missing"),
			flag: editor.flagKey({title: "Flag"}),
		}),
	]),
	{title: "Flag Condition", description: "Checks a boolean world flag."},
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

export const RoomStateConditionSchema = editor.object(
	{
		type: z.literal("room-state"),
		state: editor.select(z.enum(["visited", "not-visited"])),
		roomId: editor.reference("room", {title: "Room"}),
	},
	{title: "Room History Condition"},
);

export const FeatureStateConditionSchema = editor.object(
	{
		type: z.literal("feature-state"),
		roomId: editor.reference("room", {title: "Room"}),
		featureId: editor.reference("feature", {title: "Feature"}),
		state: editor.select(z.enum(["examined", "not-examined"])),
	},
	{title: "Feature Examined Condition"},
);

// TODO: overhaul the object state system. For now, this is out
export const ObjectStateConditionSchema = editor.object(
	{
		type: z.literal("object-state"),
		operation: editor.select(
			z.enum([
				"examined",
				"open",
				"closed",
				"locked",
				"unlocked",
				"lit",
				"unlit",
				"broken",
				"intact",
				"clean",
				"dirty",
			]),
			{title: "State"},
		),
		objectId: editor.reference("feature", {title: "Feature"}),
	},
	{title: "Feature State Condition", description: "Checks built-in state on a room feature."},
);

export const SingleConditionSchema = editor.discriminatedUnion(
	z.discriminatedUnion("type", [
		FlagConditionSchema,
		CounterConditionSchema,
		CurrentRoomConditionSchema,
		RoomStateConditionSchema,
		FeatureStateConditionSchema,
		ObjectStateConditionSchema,
	]),
	{title: "Condition"},
);

export type SingleCondition = z.infer<typeof SingleConditionSchema>;
export type ConditionReference = z.infer<typeof ConditionReferenceSchema>;
export type ConditionGroup = {
	type: "group";
	operation: "all" | "any" | "none";
	conditions: Condition[];
	id?: unknown;
	name?: string;
	allowMultipleUsesInWorld: boolean;
};
export type Condition = SingleCondition | ConditionGroup | ConditionReference;

export const WorldConditionSchema: z.ZodType<SingleCondition | ConditionGroup> = z.lazy(() =>
	z.union([
		SingleConditionSchema.and(ConditionIdentitySchema),
		z.object({
			type: z.literal("group"),
			operation: z.enum(["all", "any", "none"]),
			conditions: z.array(ConditionSchema),
			...ConditionIdentitySchema.shape,
		}),
	]),
);

export const ConditionSchema: z.ZodType<Condition> = z.lazy(() =>
	z.union([WorldConditionSchema, ConditionReferenceSchema]),
);
export const ConditionUsageSchema = ConditionReferenceSchema;

export const ConditionalTextSchema = editor.object(
	{
		when: editor.conditionList(ConditionUsageSchema, {title: "Conditions"}),
		text: editor.textarea({title: "Text"}).default(""),
	},
	{
		title: "Conditional Text",
		description: docify(`Text shown when all referenced room or feature conditions pass.`),
	},
);

export type ConditionalText = z.infer<typeof ConditionalTextSchema>;

// TODO: Reintroduce item, NPC, quest, event, and authored-command conditions with those domains.
