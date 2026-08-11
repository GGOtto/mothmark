import {defineStorageMigration, unchanged} from "./types";

/**
 * Command help metadata adds neutral defaults and new worlds add Help/List exits
 * to their initial command set. Retained documents already parse and replay
 * safely without rewriting their authored commands or historical player output.
 */
export const v3ToV4 = defineStorageMigration({
	id: "v3-to-v4-record-command-help-contract",
	fromVersion: 3,
	toVersion: 4,
	world: unchanged,
	gameState: unchanged,
	messages: unchanged,
});
