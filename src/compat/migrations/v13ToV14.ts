import {defineStorageMigration, unchanged} from "./types";

/**
 * Records the reviewed schema-source boundary for the expanded item behavior
 * catalog and focused event editor. The candidate schemas continue to parse
 * retained v13 worlds, game states, and messages without rewriting authored
 * content or historical player output.
 */
export const v13ToV14 = defineStorageMigration({
	id: "v13-to-v14-record-item-actions-and-event-editor-contract",
	fromVersion: 13,
	toVersion: 14,
	world: unchanged,
	gameState: unchanged,
	messages: unchanged,
});
