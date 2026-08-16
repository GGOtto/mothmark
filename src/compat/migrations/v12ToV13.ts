import {defineStorageMigration, unchanged} from "./types";

/**
 * Item behavior discovery metadata changes authoring recommendations only.
 * Retained worlds, game states, and messages already parse and replay safely
 * without rewriting authored content or historical player output.
 */
export const v12ToV13 = defineStorageMigration({
	id: "v12-to-v13-record-item-behavior-discovery-contract",
	fromVersion: 12,
	toVersion: 13,
	world: unchanged,
	gameState: unchanged,
	messages: unchanged,
});
