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

/**
 * Retained worlds receive the neutral empty starting-exit default. Retained
 * playthroughs are replayed because wait-zero events now resolve before the
 * opening room description and first player turn.
 */
export const v14ToV15 = defineStorageMigration({
	id: "v14-to-v15-run-events-before-the-opening-room",
	fromVersion: 14,
	toVersion: 15,
	world: unchanged,
	gameState: replayedGameState,
	messages: replayedMessages,
});
