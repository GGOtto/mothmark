import type {Condition, ConditionalText, Description} from "@/schemas/worldSchema";
import type {GameState} from "./gameState";
import {DefaultDeserializer} from "v8";

export function conditionsMatch(conditions: Condition[], gameState: GameState) {
	return conditions.every((condition) => {
		return gameState.flags[condition.flag] === condition.value;
	});
}

export function getConditionKey(conditions: Condition[]) {
	return conditions
		.map((condition) => `${condition.flag}:${condition.value}`)
		.sort()
		.join("|");
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
