import {z} from "zod";
import {editor} from "../utils/editorSchemaHelpers";

export const FeatureStateSchema = z.object({
	type: z.literal("feature"),
	id: editor.reference("feature"),
	name: z.string().optional(),
	description: z.string().optional(),
	flags: z.record(z.string(), z.boolean()),
});

export const RoomStateSchema = z.object({
	type: z.literal("room"),
	id: editor.reference("room"),
	flags: z.record(z.string(), z.boolean()),
	featureStates: z.array(FeatureStateSchema),
});

export type FeatureState = z.infer<typeof FeatureStateSchema>;
export type RoomState = z.infer<typeof RoomStateSchema>;
export type EntityState = FeatureState | RoomState;
