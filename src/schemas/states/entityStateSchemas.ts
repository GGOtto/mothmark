import {z} from "zod";
import {editor} from "../utils/editorSchemaHelpers";
import {DirectionSchema, RoomFeatureKindSchema} from "../world/roomSchema";

export const FeatureStateSchema = z.object({
	type: z.literal("feature"),
	id: editor.reference("feature"),
	name: z.string(),
	description: z.string(),
	aliases: z.array(z.string()),
	tags: z.array(z.string()),
	kind: RoomFeatureKindSchema,
	listedInRoom: z.boolean(),
	flags: z.record(z.string(), z.boolean()),
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
	featureStates: z.array(FeatureStateSchema),
});

export type FeatureState = z.infer<typeof FeatureStateSchema>;
export type RoomState = z.infer<typeof RoomStateSchema>;
export type EntityState = FeatureState | RoomState;
