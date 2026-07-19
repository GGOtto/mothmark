import {z} from "zod";
import {editor} from "../utils/editorSchemaHelpers";
import {RoomStateSchema} from "./entityStates";
import {Flag} from "lucide-react";

export const GameMessageTypeSchema = z.enum(["room", "command", "system", "error"]);

export const GameMessageSchema = z.object({
	id: z.string(),
	text: z.string(),
	type: GameMessageTypeSchema,
	roomId: editor.id("room").optional(),
});

export const InventorySchema = z.object({
	items: z.array(editor.reference("item")),
	capacity: z.number(),
});

export const FlagSchema = z.record(z.string(), z.boolean());

export const CounterSchema = z.record(z.string(), z.number().int());

export const VariableRepositorySchema = z.object({
	flags: z.array(FlagSchema),
	counter: z.array(CounterSchema),
});

export const GameStateSchema = z.object({
	currentRoom: editor.id("room"),
	inventory: InventorySchema,
	turns: z.number().default(0),
	variables: VariableRepositorySchema,
	roomStates: z.array(RoomStateSchema),
});

export type GameMessageType = z.infer<typeof GameMessageTypeSchema>;
export type GameMessage = z.infer<typeof GameMessageSchema>;
export type Inventory = z.infer<typeof InventorySchema>;
export type Flag = z.infer<typeof FlagSchema>;
export type Counter = z.infer<typeof CounterSchema>;
export type VariableRepository = z.infer<typeof VariableRepositorySchema>;
export type GameState = z.infer<typeof GameStateSchema>;
