import {z} from "zod";
import {editor} from "../utils/editorSchemaHelpers";
import {CompassDirectionSchema} from "../world/directionSchema";

export const PlayerStateSchemas = z.object({
	currentRoom: editor.id("room"),
	previousRoom: editor.id("room").optional(),
	lastRoomTransitionTurn: z.number().int().nonnegative().optional(),
	facing: CompassDirectionSchema.default("n"),
	turns: z.number().int().default(0),
	lastCommandSucceeded: z.boolean().optional(),
	lastCommandTurn: z.number().int().nonnegative().optional(),
	randomState: z.number().int().nonnegative().optional(),
	carryingCapacity: z.number().int().nonnegative().optional(),
	equippedItemIds: z.array(editor.id("item")).optional(),
	isDead: z.boolean().optional(),
	customDeathMessage: z.string().optional(),
	hasWon: z.boolean().optional(),
	isEnded: z.boolean().optional(),
	endingMessage: z.string().optional(),
	freezeState: z.object({
		frozen: z.boolean().optional(),
		message: z.string().optional(),
		turns: z.number().int().optional(),
		startOfFreeze: z.number().int().optional(),
	}),
});

export type PlayerState = z.infer<typeof PlayerStateSchemas>;
