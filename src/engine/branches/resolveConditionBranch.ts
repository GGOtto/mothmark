import type {GameState} from "@/schemas/states/gameStateSchemas";
import type {ConditionBranch} from "@/schemas/world/conditionBranchSchemas";
import type {World} from "@/schemas/world/worldSchema";
import {produce} from "immer";
import {resolveEffects} from "../effects/resolveEffects";
import {evaluateCondition} from "../conditions/evaluateCondition";

export function resolveConditionBranch(
	world: World,
	game: GameState,
	branch: ConditionBranch,
): GameState {
	let newGameState = game;

	// this part of the branch is always performed if defined
	if (branch.always) {
		newGameState = resolveEffects(world, newGameState, branch.always);
	}

	// check the if part of the branch
	if (branch.if && evaluateCondition(world, game, branch.if.condition)) {
		return resolveEffects(world, newGameState, branch.if.effect);
	}

	// check the else if statements in the branch
	if (branch.elifs) {
		for (const condition of branch.elifs) {
			if (evaluateCondition(world, newGameState, condition.condition)) {
				return resolveEffects(world, newGameState, condition.effect);
			}
		}
	}

	// check the else statement in the branch
	if (branch.else) {
		return resolveEffects(world, newGameState, branch.else);
	}

	return newGameState;
}
