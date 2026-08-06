import {z} from "zod";
import {docify} from "@/schemas/utils/docify";
import {editor} from "@/schemas/utils/editorSchemaHelpers";
import {DirectionSchema} from "./directionSchema";

export const ComparisonOperatorSchema = editor.select(
	z.enum(["eq", "neq", "gt", "gte", "lt", "lte"]),
	{
		title: "Operator",
		options: [
			{label: "Equals", value: "eq"},
			{label: "Does not equal", value: "neq"},
			{label: "Greater than", value: "gt"},
			{label: "Greater than or equal", value: "gte"},
			{label: "Less than", value: "lt"},
			{label: "Less than or equal", value: "lte"},
		],
	},
);

export const ConditionReferenceSchema = editor.object(
	{
		type: z.literal("condition-ref"),
		conditionId: editor.reference("condition", {title: "Saved condition"}),
	},
	{title: "Use saved condition"},
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
			"flag-type": z.literal("item"),
			operation: editor.select(z.enum(["true", "false", "exists", "missing"]), {
				title: "Operation",
			}),
			itemId: editor.reference("item", {title: "Item"}),
			flag: editor.string({title: "Flag"}).min(1),
		}),
	]),
	{title: "Flag Condition", description: "Checks a boolean world, room, or item flag."},
);

export const ItemStatePredicateSchema = editor.object(
	{
		type: z.literal("state"),
		state: editor.select(
			z.enum([
				"visible",
				"reachable",
				"known",
				"carried",
				"hidden",
				"destroyed",
				"examined",
				"listed",
				"open",
				"locked",
			]),
			{title: "State"},
		),
		value: editor.boolean({title: "Expected"}).default(true),
	},
	{title: "State", description: "Checks player knowledge, access, location, or item state."},
);

export const ItemLocationPredicateSchema = editor.discriminatedUnion(
	z.discriminatedUnion("location", [
		editor.object(
			{
				type: z.literal("location"),
				location: z.enum(["current-room", "inventory", "hidden", "destroyed"]),
			},
			{title: "Simple location"},
		),
		editor.object(
			{
				type: z.literal("location"),
				location: z.literal("room"),
				roomId: editor.reference("room", {title: "Room"}),
			},
			{title: "Room"},
		),
		editor.object(
			{
				type: z.literal("location"),
				location: z.enum(["inside-item", "on-item"]),
				parentItemId: editor.reference("item", {title: "Containing item"}),
			},
			{title: "In or on item"},
		),
	]),
	{title: "Location"},
);

export const ItemImportantTagPredicateSchema = editor.object(
	{
		type: z.literal("important-tag"),
		tag: editor.select(
			z.enum(["takeable", "container", "surface", "openable", "lockable", "door", "usable"]),
			{title: "Important tag"},
		),
		value: editor.boolean({title: "Expected"}).default(true),
	},
	{title: "Important tag"},
);

export const ItemTagPredicateSchema = editor.object(
	{
		type: z.literal("tag"),
		tag: editor.input({title: "Tag"}).trim().min(1),
		value: editor.boolean({title: "Expected"}).default(true),
	},
	{title: "Author tag"},
);

export const ItemContentsPredicateSchema = editor.discriminatedUnion(
	z.discriminatedUnion("test", [
		editor.object(
			{
				type: z.literal("contents"),
				test: z.literal("empty"),
				placement: editor.select(z.enum(["inside", "on", "either"]), {title: "Placement"}),
				value: editor.boolean({title: "Expected"}).default(true),
			},
			{title: "Empty"},
		),
		editor.object(
			{
				type: z.literal("contents"),
				test: z.literal("contains-item"),
				itemId: editor.reference("item", {title: "Contained item"}),
				placement: editor.select(z.enum(["inside", "on", "either"]), {title: "Placement"}),
			},
			{title: "Contains item"},
		),
		editor.object(
			{
				type: z.literal("contents"),
				test: z.literal("contains-tag"),
				tag: editor.input({title: "Tag"}).trim().min(1),
				placement: editor.select(z.enum(["inside", "on", "either"]), {title: "Placement"}),
			},
			{title: "Contains tagged item"},
		),
	]),
	{title: "Contents"},
);

export const ItemCapacityPredicateSchema = editor.discriminatedUnion(
	z.discriminatedUnion("test", [
		editor.object(
			{
				type: z.literal("capacity"),
				test: z.enum(["empty", "full"]),
				placement: editor.select(z.enum(["inside", "on"]), {title: "Placement"}),
				value: editor.boolean({title: "Expected"}).default(true),
			},
			{title: "Capacity state"},
		),
		editor.object(
			{
				type: z.literal("capacity"),
				test: z.literal("can-fit"),
				itemId: editor.reference("item", {title: "Item to fit"}),
				placement: editor.select(z.enum(["inside", "on"]), {title: "Placement"}),
			},
			{title: "Can fit item"},
		),
	]),
	{title: "Capacity"},
);

export const ItemCanUnlockPredicateSchema = editor.object(
	{
		type: z.literal("can-unlock"),
		lockItemId: editor.reference("item", {title: "Lock"}),
		keyItemId: editor.reference("item", {title: "Key"}),
	},
	{title: "Can unlock"},
);

export const ItemDoorPredicateSchema = editor.object(
	{
		type: z.literal("door"),
		test: editor.select(z.enum(["controls-connection", "connection-passable"]), {title: "Test"}),
		connectionId: editor.reference("connection", {title: "Connection"}).optional(),
		value: editor.boolean({title: "Expected"}).default(true),
	},
	{title: "Door"},
);

export const ItemPredicateSchema = editor.discriminatedUnion(
	z.discriminatedUnion("type", [
		ItemStatePredicateSchema,
		ItemLocationPredicateSchema,
		ItemImportantTagPredicateSchema,
		ItemTagPredicateSchema,
		ItemContentsPredicateSchema,
		ItemCapacityPredicateSchema,
		ItemCanUnlockPredicateSchema,
		ItemDoorPredicateSchema,
	]),
	{title: "Item test", picker: {showDescriptions: true}},
);

export const ItemConditionSchema = editor.object(
	{
		type: z.literal("item"),
		itemId: editor.reference("item", {title: "Item"}),
		test: ItemPredicateSchema,
	},
	{title: "Item condition", description: "Checks an item's state, location, contents, or behavior."},
);

export const CounterConditionSchema = editor.discriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("counter"),
			operation: z.literal("compare"),
			counter: editor.input({title: "Counter"}),
			operator: ComparisonOperatorSchema,
			value: editor.number({title: "Value"}),
		}),
		z.object({
			type: z.literal("counter"),
			operation: z.literal("between"),
			counter: editor.input({title: "Counter"}),
			min: editor.number({title: "Minimum"}),
			max: editor.number({title: "Maximum"}),
			inclusive: editor.boolean({title: "Inclusive"}).default(true),
		}),
		z.object({
			type: z.literal("counter"),
			operation: z.literal("exists"),
			counter: editor.input({title: "Counter"}),
		}),
		z.object({
			type: z.literal("counter"),
			operation: z.literal("missing"),
			counter: editor.input({title: "Counter"}),
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
		z.object({
			type: z.literal("current-room"),
			operation: z.literal("is-exit-open"),
			direction: DirectionSchema,
		}),
	]),
	{
		title: "Current Room Condition",
		description: "Checks the player's current room, its tags, or an available exit.",
	},
);

export const SingleConditionSchema = editor.discriminatedUnion(
	z.discriminatedUnion("type", [
		FlagConditionSchema,
		CounterConditionSchema,
		CurrentRoomConditionSchema,
		ItemConditionSchema,
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
	editor.object(
		{
			type: z.literal("group"),
			operation: editor.select(z.enum(["all", "any", "none"]), {
				title: "Operation",
				options: [
					{label: "All conditions pass", value: "all"},
					{label: "Any condition passes", value: "any"},
					{label: "No conditions pass", value: "none"},
				],
			}),
			conditions: z.array(ConditionSchema),
		},
		{title: "Group", description: "Combines multiple conditions."},
	),
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
		description: docify(`Text shown when all referenced room or item conditions pass.`),
	},
);

export type ConditionalText = z.infer<typeof ConditionalTextSchema>;

// TODO: Reintroduce NPC, quest, event, and authored-command conditions with those domains.
