import {defineStorageMigration, unchanged} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function nameSavedConditions(value: unknown): unknown {
	if (!isRecord(value) || !Array.isArray(value.conditions)) return value;

	let changed = false;
	const conditions = value.conditions.map((condition) => {
		if (!isRecord(condition) || "name" in condition) return condition;
		changed = true;
		return {...condition, name: ""};
	});

	return changed ? {...value, conditions} : value;
}

export const v8ToV9 = defineStorageMigration({
	id: "v8-to-v9-name-saved-conditions",
	fromVersion: 8,
	toVersion: 9,
	world: nameSavedConditions,
	gameState: unchanged,
	messages: unchanged,
});
