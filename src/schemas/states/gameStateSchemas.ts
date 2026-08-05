import {z} from "zod";
import {editor} from "../utils/editorSchemaHelpers";
import {RoomStateSchema} from "./entityStateSchemas";
import {PlayerStateSchemas} from "./playerStateSchemas";
import {EventSchema} from "../world/eventSchema";
import {DirectionSchema} from "../world/roomSchema";
import {RelationTypeSchema, TargetReferenceSchema} from "../world/commandSchemas";

export const GameMessageTypeSchema = z.enum(["room", "command", "system", "error", "death"]);

export const GameMessageSchema = z.object({
	id: z.string(),
	text: z.string(),
	type: GameMessageTypeSchema,
});

export const FlagSchema = z.record(z.string(), z.boolean());

export const CounterSchema = z.record(z.string(), z.number().int());

const CommandBlockIdSchema = editor.id("command-block");

export const CommandVariableSchema = z.discriminatedUnion("type", [
	z.object({
		blockId: CommandBlockIdSchema,
		type: z.literal("phrase"),
		value: z.string(),
		rawText: z.string().optional(),
	}),
	z.object({
		blockId: CommandBlockIdSchema,
		type: z.literal("relation"),
		value: RelationTypeSchema,
		rawText: z.string().optional(),
	}),
	z.object({
		blockId: CommandBlockIdSchema,
		type: z.literal("target"),
		value: TargetReferenceSchema,
		rawText: z.string().optional(),
	}),
	z.object({
		blockId: CommandBlockIdSchema,
		type: z.literal("number"),
		value: z.number().finite(),
		rawText: z.string().optional(),
	}),
	z.object({
		blockId: CommandBlockIdSchema,
		type: z.literal("boolean"),
		value: z.boolean(),
		rawText: z.string().optional(),
	}),
	z.object({
		blockId: CommandBlockIdSchema,
		type: z.literal("direction"),
		value: DirectionSchema,
		rawText: z.string().optional(),
	}),
	z.object({
		blockId: CommandBlockIdSchema,
		type: z.literal("choice"),
		value: z.string(),
		rawText: z.string().optional(),
	}),
	z.object({
		blockId: CommandBlockIdSchema,
		type: z.literal("text"),
		value: z.string(),
		rawText: z.string().optional(),
	}),
	z.object({
		blockId: CommandBlockIdSchema,
		type: z.literal("failed"),
		rawText: z.string(),
	}),
]);

export const CommandVariableRepositorySchema = z
	.array(CommandVariableSchema)
	.default([])
	.superRefine((variables, ctx) => {
		const blockIds = new Set<string>();
		variables.forEach((variable, index) => {
			const blockId = variable.blockId.id;
			if (blockIds.has(blockId)) {
				ctx.addIssue({
					code: "custom",
					message: "A command block can only have one resolved variable.",
					path: [index, "blockId"],
				});
			}
			blockIds.add(blockId);
		});
	});

export const VariableRepositorySchema = z.object({
	flags: z.array(FlagSchema),
	counters: z.array(CounterSchema),
	command: CommandVariableRepositorySchema,
});

export const GameStateSchema = z.object({
	player: PlayerStateSchemas,
	variables: VariableRepositorySchema,
	roomStates: z.array(RoomStateSchema),
	messages: z.array(GameMessageSchema),
	events: z.array(EventSchema),
});

export type GameMessageType = z.infer<typeof GameMessageTypeSchema>;
export type GameMessage = z.infer<typeof GameMessageSchema>;
export type Flag = z.infer<typeof FlagSchema>;
export type Counter = z.infer<typeof CounterSchema>;
export type CommandVariable = z.infer<typeof CommandVariableSchema>;
export type VariableRepository = z.infer<typeof VariableRepositorySchema>;
export type GameState = z.infer<typeof GameStateSchema>;
