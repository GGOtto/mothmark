import {z} from "zod";
import {editor} from "../utils/editorSchemaHelpers";

export const FeatureStateSchema = z.object({
	type: z.literal("feature"),
	id: editor.reference("feature"),
	examined: z.boolean(),
});

export const RoomStateSchema = z.object({
	type: z.literal("room"),
	id: editor.reference("room"),
	visited: z.boolean(),
	featureStates: z.array(FeatureStateSchema),
});

export type FeatureState = z.infer<typeof FeatureStateSchema>;
export type RoomState = z.infer<typeof RoomStateSchema>;
export type EntityState = FeatureState | RoomState;
