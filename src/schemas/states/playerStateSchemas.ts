import {z} from "zod";
import {editor} from "../utils/editorSchemaHelpers";

export const PlayerStateSchemas = z.object({
	currentRoom: editor.id("room"),
	turns: z.number().int().default(0),
	isDead: z.boolean().optional(),
	customDeathMessage: z.string().optional(),
	freezeState: z.object({
		frozen: z.boolean().optional(),
		message: z.string().optional(),
		turns: z.number().int().optional(),
		startOfFreeze: z.number().int().optional(),
	}),
});

export type PlayerState = z.infer<typeof PlayerStateSchemas>;
