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
 * Records the reviewed schema-source boundary for the expanded item behavior
 * catalog and focused event editor. Authored worlds remain unchanged, while
 * retained playthrough states and messages are replayed because the expanded
 * standard command catalog can intentionally change command resolution.
 */
export const v13ToV14 = defineStorageMigration({
	id: "v13-to-v14-record-item-actions-and-event-editor-contract",
	fromVersion: 13,
	toVersion: 14,
	world: unchanged,
	gameState: replayedGameState,
	messages: replayedMessages,
});
