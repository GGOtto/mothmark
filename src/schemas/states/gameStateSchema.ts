import {z} from "zod";
import {editor} from "../utils/editorSchemaHelpers";
import {RoomStateSchema} from "./entityStates";

export const GameMessageTypeSchema = z.enum(["room", "command", "system", "error"]);

export const GameMessageSchema = z.object({
	id: z.string(),
	text: z.string(),
	type: GameMessageTypeSchema,
});

export const FlagSchema = z.record(z.string(), z.boolean());

export const CounterSchema = z.record(z.string(), z.number().int());

export const VariableRepositorySchema = z.object({
	flags: z.array(FlagSchema),
	counter: z.array(CounterSchema),
});

export const GameStateSchema = z.object({
	currentRoom: editor.id("room"),
	turns: z.number().default(0),
	variables: VariableRepositorySchema,
	roomStates: z.array(RoomStateSchema),
	messages: z.array(GameMessageSchema),
});

export type GameMessageType = z.infer<typeof GameMessageTypeSchema>;
export type GameMessage = z.infer<typeof GameMessageSchema>;
export type Flag = z.infer<typeof FlagSchema>;
export type Counter = z.infer<typeof CounterSchema>;
export type VariableRepository = z.infer<typeof VariableRepositorySchema>;
export type GameState = z.infer<typeof GameStateSchema>;
