import {defineStorageMigration, unchanged} from "./types";

export const LEGACY_EMPTY_FLAG_KEY = "legacy.empty-flag";

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function replaceEmptyLogicFlag(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(replaceEmptyLogicFlag);
	if (!isRecord(value)) return value;

	const migrated = Object.fromEntries(
		Object.entries(value).map(([key, child]) => [key, replaceEmptyLogicFlag(child)]),
	);
	return typeof migrated.type === "string" &&
		typeof migrated.operation === "string" &&
		typeof migrated.flag === "string" &&
		migrated.flag.trim().length === 0
		? {...migrated, flag: LEGACY_EMPTY_FLAG_KEY}
		: migrated;
}

export const v6ToV7 = defineStorageMigration({
	id: "v6-to-v7-name-empty-logic-flags",
	fromVersion: 6,
	toVersion: 7,
	world: replaceEmptyLogicFlag,
	gameState: unchanged,
	messages: unchanged,
});
