import type {Condition} from "@/schemas/conditionSchema";
import type {Description} from "@/schemas/descriptionSchema";
import type {World} from "@/schemas/worldSchema";
import type {GameState} from "./gameState";

export function conditionsMatch(conditions: Condition[], gameState: GameState, world?: World) {
	return normalizeConditions(conditions).every((condition) =>
		conditionMatches(condition, gameState, world),
	);
}

export function getConditionKey(conditions: Condition[], world?: World) {
	return normalizeConditions(conditions)
		.map((condition) => JSON.stringify(resolveConditionReference(condition, world) ?? condition))
		.sort()
		.join("|");
}

function normalizeConditions(conditions: Condition[] | Condition | unknown): Condition[] {
	if (Array.isArray(conditions)) return conditions;
	if (conditions && typeof conditions === "object") return [conditions as Condition];
	return [];
}

function resolveConditionReference(
	condition: Condition,
	world: World | undefined,
	seenConditionIds = new Set<string>(),
): Condition | undefined {
	if (condition.type !== "condition-ref") return condition;

	const conditionId = condition.conditionId.trim();
	if (!conditionId || seenConditionIds.has(conditionId)) return undefined;

	const worldCondition = world?.conditions.find(
		(candidate) => "id" in candidate && candidate.id === conditionId,
	);
	if (!worldCondition) return undefined;

	const nextSeenConditionIds = new Set(seenConditionIds);
	nextSeenConditionIds.add(conditionId);
	return worldCondition as Condition;
}

function conditionMatches(
	condition: Condition,
	gameState: GameState,
	world?: World,
	seenConditionIds = new Set<string>(),
): boolean {
	const resolvedCondition = resolveConditionReference(condition, world, seenConditionIds);
	if (!resolvedCondition) return false;

	const nextSeenConditionIds = new Set(seenConditionIds);
	if (condition.type === "condition-ref") {
		nextSeenConditionIds.add(condition.conditionId);
	}

	if (resolvedCondition.type === "group") {
		const matches = normalizeConditions(resolvedCondition.conditions).map((childCondition) =>
			conditionMatches(childCondition, gameState, world, nextSeenConditionIds),
		);

		if (resolvedCondition.operator === "any") return matches.some(Boolean);
		if (resolvedCondition.operator === "none") return matches.every((match) => !match);
		return matches.every(Boolean);
	}

	if (resolvedCondition.type === "flag") {
		if (resolvedCondition.operation === "exists") return resolvedCondition.flag in gameState.flags;
		if (resolvedCondition.operation === "missing")
			return !(resolvedCondition.flag in gameState.flags);
		return gameState.flags[resolvedCondition.flag] === resolvedCondition.value;
	}

	// TODO: evaluate the rest of the universal condition types against GameState.
	return false;
}

function getRandomItem<T>(items: T[]) {
	return items[Math.floor(Math.random() * items.length)];
}

export function resolveDescription(description: Description, gameState: GameState, world?: World) {
	for (const variant of description.variants) {
		if (!conditionsMatch(variant.when, gameState, world)) continue;

		const matchingConditionKey = getConditionKey(variant.when, world);

		const matchingVariants = description.variants.filter((candidate) => {
			return (
				getConditionKey(candidate.when, world) === matchingConditionKey &&
				conditionsMatch(candidate.when, gameState, world)
			);
		});

		return getRandomItem(matchingVariants).text;
	}

	return description.default;
}
