import {resolveTurn} from "@/engine/player/resolveTurn";
import {GameStateSchema} from "@/schemas/states/gameStateSchemas";
import {
	defineStorageMigration,
	unchanged,
	type GameStateMigrationContext,
	type MessageMigrationContext,
} from "./types";

function replayedGameState(value: unknown, context: GameStateMigrationContext): unknown {
	if (!context.previousState || !context.world) return value;
	const previous = GameStateSchema.parse(context.previousState);
	return context.command ? resolveTurn(context.world, previous, context.command) : previous;
}

function replayedMessages(value: unknown, context: MessageMigrationContext): unknown {
	if (!context.gameState) return value;
	const state = GameStateSchema.parse(context.gameState);
	if (context.storage === "transcript") return state.messages;
	if (context.storage !== "output" || !context.previousState) return value;
	const previous = GameStateSchema.parse(context.previousState);
	return state.messages.slice(previous.messages.length);
}

export const v9ToV10 = defineStorageMigration({
	id: "v9-to-v10-replay-indented-room-listings",
	fromVersion: 9,
	toVersion: 10,
	world: unchanged,
	gameState: replayedGameState,
	messages: replayedMessages,
});
