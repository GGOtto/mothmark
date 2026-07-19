import {z} from "zod";
import {editor} from "@/schemas/utils/editorSchemaHelpers";
import {ConditionUsageSchema} from "./conditionSchema";

const EffectIdentitySchema = z.object({
	id: editor.id("effect", {title: "Effect ID", advanced: true}).optional(),
	name: editor.input({title: "Effect Name"}).optional(),
	allowMultipleUsesInWorld: editor.boolean({title: "Allow multiple uses in world"}).default(false),
});

export const EffectReferenceSchema = editor.object(
	{type: z.literal("effect-ref"), effectId: editor.reference("effect", {title: "Effect"})},
	{title: "Effect Reference"},
);

export const MessageEffectSchema = editor.discriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("message"),
			operation: z.literal("show"),
			message: editor.message({title: "Message"}),
		}),
		z.object({
			type: z.literal("message"),
			operation: z.literal("random"),
			messages: editor.stringList({title: "Messages"}),
		}),
		z.object({
			type: z.literal("message"),
			operation: z.literal("append-room-description"),
			message: editor.message({title: "Description Text"}),
		}),
	]),
	{title: "Message Effect", description: "Shows text or augments the current room description."},
);

export const FlagEffectSchema = editor.discriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("flag"),
			operation: z.literal("set"),
			flag: editor.flagKey({title: "Flag"}),
			value: editor.boolean({title: "Value"}).default(true),
		}),
		z.object({
			type: z.literal("flag"),
			operation: z.literal("toggle"),
			flag: editor.flagKey({title: "Flag"}),
		}),
		z.object({
			type: z.literal("flag"),
			operation: z.literal("clear"),
			flag: editor.flagKey({title: "Flag"}),
		}),
	]),
	{title: "Flag Effect", description: "Changes a boolean world flag."},
);

export const CounterEffectSchema = editor.discriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("counter"),
			operation: z.literal("set"),
			counter: editor.counterKey({title: "Counter"}),
			value: editor.number({title: "Value"}),
		}),
		z.object({
			type: z.literal("counter"),
			operation: z.literal("increase"),
			counter: editor.counterKey({title: "Counter"}),
			amount: editor.number({title: "Amount"}).default(1),
		}),
		z.object({
			type: z.literal("counter"),
			operation: z.literal("decrease"),
			counter: editor.counterKey({title: "Counter"}),
			amount: editor.number({title: "Amount"}).default(1),
		}),
		z.object({
			type: z.literal("counter"),
			operation: z.literal("reset"),
			counter: editor.counterKey({title: "Counter"}),
		}),
	]),
	{title: "Counter Effect", description: "Changes a numeric world counter."},
);

export const ObjectStateEffectSchema = editor.object(
	{
		type: z.literal("object-state"),
		operation: editor.select(
			z.enum([
				"open",
				"close",
				"lock",
				"unlock",
				"light",
				"extinguish",
				"break",
				"repair",
				"clean",
				"dirty",
			]),
			{title: "Operation"},
		),
		objectId: editor.reference("feature", {title: "Feature"}),
	},
	{title: "Feature State Effect", description: "Changes built-in state on a room feature."},
);

export const RoomEffectSchema = editor.discriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("room"),
			operation: z.literal("move-player"),
			roomId: editor.reference("room", {title: "Room"}),
		}),
		z.object({
			type: z.literal("room"),
			operation: z.literal("set-description-variant"),
			roomId: editor.reference("room", {title: "Room"}),
			variantId: editor.input({title: "Variant ID"}).min(1),
		}),
		z.object({
			type: z.literal("room"),
			operation: z.enum(["reveal-exit", "hide-exit", "lock-exit", "unlock-exit"]),
			roomId: editor.reference("room", {title: "Room"}),
			direction: editor.direction({title: "Direction"}),
		}),
		z.object({
			type: z.literal("room"),
			operation: z.literal("add-tag"),
			roomId: editor.reference("room", {title: "Room"}),
			tag: editor.input({title: "Tag"}).min(1),
		}),
		z.object({
			type: z.literal("room"),
			operation: z.literal("remove-tag"),
			roomId: editor.reference("room", {title: "Room"}),
			tag: editor.input({title: "Tag"}).min(1),
		}),
	]),
	{title: "Room Effect", description: "Moves the player or changes room and exit state."},
);

export type MessageEffect = z.infer<typeof MessageEffectSchema>;
export type FlagEffect = z.infer<typeof FlagEffectSchema>;
export type CounterEffect = z.infer<typeof CounterEffectSchema>;
export type ObjectStateEffect = z.infer<typeof ObjectStateEffectSchema>;
export type RoomEffect = z.infer<typeof RoomEffectSchema>;
export type EffectReference = z.infer<typeof EffectReferenceSchema>;
export type EffectGroup = {
	type: "group";
	mode: "sequence" | "all" | "first";
	effects: Effect[];
	id?: unknown;
	name?: string;
	allowMultipleUsesInWorld: boolean;
};
export type ConditionalEffect = {
	type: "conditional";
	conditions: z.infer<typeof ConditionUsageSchema>[];
	then: Effect[];
	else: Effect[];
	id?: unknown;
	name?: string;
	allowMultipleUsesInWorld: boolean;
};
export type Effect =
	| MessageEffect
	| FlagEffect
	| CounterEffect
	| ObjectStateEffect
	| RoomEffect
	| EffectGroup
	| ConditionalEffect
	| EffectReference;

export const WorldEffectSchema: z.ZodType<Exclude<Effect, EffectReference>> = z.lazy(() =>
	z.union([
		z
			.union([
				MessageEffectSchema,
				FlagEffectSchema,
				CounterEffectSchema,
				ObjectStateEffectSchema,
				RoomEffectSchema,
			])
			.and(EffectIdentitySchema),
		z.object({
			type: z.literal("group"),
			mode: z.enum(["sequence", "all", "first"]).default("sequence"),
			effects: z.array(EffectSchema),
			...EffectIdentitySchema.shape,
		}),
		z.object({
			type: z.literal("conditional"),
			conditions: z.array(ConditionUsageSchema),
			then: z.array(EffectSchema),
			else: z.array(EffectSchema).default([]),
			...EffectIdentitySchema.shape,
		}),
	]),
);

export const EffectSchema: z.ZodType<Effect> = z.lazy(() =>
	z.union([WorldEffectSchema, EffectReferenceSchema]),
);
export const EffectUsageSchema = EffectReferenceSchema;

// TODO: Restore item, inventory, NPC, event, and flow effects when their domains return.
