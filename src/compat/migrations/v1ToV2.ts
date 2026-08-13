import v2BlankWorld from "./fixtures/v2BlankWorld.json";

import {defineStorageMigration, unchanged, type WorldMigrationContext} from "./types";

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const optionalString = (value: unknown): string | undefined =>
	typeof value === "string" ? value : undefined;

/**
 * One-time launch reset. This intentionally discards authored world content while retaining the
 * world's title and the standard built-in command documents.
 */
export function resetWorldToBlank(value: unknown, context: WorldMigrationContext): unknown {
	const metadata = isRecord(value) && isRecord(value.metadata) ? value.metadata : {};
	const title = context.name ?? optionalString(metadata.title) ?? "Untitled world";

	// The first migration's output is immutable. Later edits to built-in commands must
	// not change the document produced for a retained v1 world.
	return {
		...structuredClone(v2BlankWorld),
		metadata: {...v2BlankWorld.metadata, title},
	};
}

export const v1ToV2 = defineStorageMigration({
	id: "v1-to-v2-reset-worlds-to-blank",
	fromVersion: 1,
	toVersion: 2,
	world: resetWorldToBlank,
	gameState: unchanged,
	messages: unchanged,
});
