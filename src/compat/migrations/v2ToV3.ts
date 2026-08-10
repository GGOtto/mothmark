import {defineStorageMigration, unchanged} from "./types";

/**
 * The launch-era v2 contract predates the current schema metadata, but its retained documents
 * already parse and replay under the current schemas. Advance every document family without
 * rewriting authored or player data so the reviewed contract is recorded at an adjacent version.
 */
export const v2ToV3 = defineStorageMigration({
	id: "v2-to-v3-record-reviewed-schema-contract",
	fromVersion: 2,
	toVersion: 3,
	world: unchanged,
	gameState: unchanged,
	messages: unchanged,
});
