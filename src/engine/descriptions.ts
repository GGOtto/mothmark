import type {Condition} from "@/schemas/conditionSchema";
import type {Description} from "@/schemas/descriptionSchema";
import type {GameState} from "./gameState";

export function conditionsMatch(conditions: Condition[], gameState: GameState) {
	return normalizeConditions(conditions).every((condition) =>
		conditionMatches(condition, gameState),
	);
}

export function getConditionKey(conditions: Condition[]) {
	return normalizeConditions(conditions)
		.map((condition) => JSON.stringify(condition))
		.sort()
		.join("|");
}

function normalizeConditions(conditions: Condition[] | Condition | unknown): Condition[] {
	if (Array.isArray(conditions)) return conditions;
	if (conditions && typeof conditions === "object") return [conditions as Condition];
	return [];
}

function conditionMatches(condition: Condition, gameState: GameState): boolean {
	if (condition.type === "group") {
		const matches = normalizeConditions(condition.conditions).map((childCondition) =>
			conditionMatches(childCondition, gameState),
		);

		if (condition.operator === "any") return matches.some(Boolean);
		if (condition.operator === "none") return matches.every((match) => !match);
		return matches.every(Boolean);
	}

	if (condition.type === "flag") {
		if (condition.operation === "exists") return condition.flag in gameState.flags;
		if (condition.operation === "missing") return !(condition.flag in gameState.flags);
		return gameState.flags[condition.flag] === condition.value;
	}

	// TODO: evaluate the rest of the universal condition types against GameState.
	return false;
}

function getRandomItem<T>(items: T[]) {
	return items[Math.floor(Math.random() * items.length)];
}

export function resolveDescription(description: Description, gameState: GameState) {
	for (const variant of description.variants) {
		if (!conditionsMatch(variant.when, gameState)) continue;

		const matchingConditionKey = getConditionKey(variant.when);

		const matchingVariants = description.variants.filter((candidate) => {
			return (
				getConditionKey(candidate.when) === matchingConditionKey &&
				conditionsMatch(candidate.when, gameState)
			);
		});

		return getRandomItem(matchingVariants).text;
	}

	return description.default;
}
