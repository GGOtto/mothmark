import {z} from "zod";
import {editor} from "../utils/editorSchemaHelpers";
import {ObjectStateDefaultsSchema} from "./objectStateSchema";

export const FeatureStateSchema = z.object({
	featureId: editor.reference("feature"),
	examined: z.boolean(),
	objectState: ObjectStateDefaultsSchema,
});

export const RoomStateSchema = z.object({
	roomId: editor.reference("room"),
	visited: z.boolean(),
	featureStates: z.array(FeatureStateSchema),
});

export type FeatureState = z.infer<typeof FeatureStateSchema>;
export type RoomState = z.infer<typeof RoomStateSchema>;
