import {GameState} from "@/schemas/states/gameStateSchemas";
import type {Condition} from "@/schemas/world/conditionSchema";
import {World} from "@/schemas/world/worldSchema";
import {evaluateSingleCondition} from "./evaluateSingleCondition";
import {getCondition} from "../utils/lookupUtils";

export function evaluateCondition(world: World, game: GameState, condition: Condition): boolean {
	if (condition.type === "condition-ref") {
		const foundCondition = getCondition(world, condition.conditionId);
		return evaluateCondition(world, game, foundCondition);
	}

	if (condition.type === "group") {
		switch (condition.operation) {
			case "all":
				return condition.conditions.every((condition) => evaluateCondition(world, game, condition));
			case "any":
				return condition.conditions.some((condition) => evaluateCondition(world, game, condition));
			case "none":
				return !condition.conditions.some((condition) => evaluateCondition(world, game, condition));
			default:
				return false;
		}
	}

	return evaluateSingleCondition(world, game, condition);
}
