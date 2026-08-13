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

export const v10ToV11 = defineStorageMigration({
	id: "v10-to-v11-replay-deterministic-random-messages",
	fromVersion: 10,
	toVersion: 11,
	world: unchanged,
	gameState: replayedGameState,
	messages: replayedMessages,
});
