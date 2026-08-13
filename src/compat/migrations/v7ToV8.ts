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

export const v7ToV8 = defineStorageMigration({
	id: "v7-to-v8-replay-retained-game-states",
	fromVersion: 7,
	toVersion: 8,
	world: unchanged,
	gameState: replayedGameState,
	messages: replayedMessages,
});
