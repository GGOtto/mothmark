import {z} from "zod";
import {editor} from "../utils/editorSchemaHelpers";
import {DirectionSchema} from "../world/roomSchema";
import {ItemLocationSchema} from "../world/itemSchema";

export const ItemStateSchema = z.object({
	type: z.literal("item"),
	id: editor.reference("item"),
	templateItemId: editor.reference("item").optional(),
	name: z.string(),
	description: z.string(),
	aliases: z.array(z.string()),
	tags: z.array(z.string()),
	behaviorTags: z.array(
		z.enum([
			"takeable",
			"container",
			"surface",
			"openable",
			"lockable",
			"door",
			"usable",
			"equippable",
			"readable",
			"sensory",
			"searchable",
			"edible",
			"drinkable",
			"switchable",
			"lightable",
			"sound-making",
			"movable",
			"climbable",
			"restable",
			"enterable",
			"rideable",
			"binding",
			"breakable",
			"cuttable",
			"liquid-container",
			"cleanable",
			"repairable",
			"writable",
			"throwable",
			"presentable",
		]),
	),
	listedInRoom: z.boolean(),
	listingText: z.string(),
	location: ItemLocationSchema,
	open: z.boolean(),
	locked: z.boolean(),
	flags: z.record(z.string(), z.boolean()),
	behaviorAmounts: z.record(z.string(), z.number().nonnegative()).optional(),
	boundToItemId: editor.reference("item").optional(),
	writtenText: z.string().optional(),
	lastActionTargetItemId: editor.reference("item").optional(),
});

export const RoomStateSchema = z.object({
	type: z.literal("room"),
	id: editor.reference("room"),
	name: z.string(),
	description: z.string(),
	shortDescription: z.string(),
	aliases: z.array(z.string()),
	tags: z.array(z.string()),
	lockedExits: z.array(DirectionSchema),
	flags: z.record(z.string(), z.boolean()),
});

export type ItemState = z.infer<typeof ItemStateSchema>;
export type RoomState = z.infer<typeof RoomStateSchema>;
export type EntityState = ItemState | RoomState;
