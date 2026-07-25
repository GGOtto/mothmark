import type {GameState} from "@/schemas/states/gameStateSchemas";
import type {ConditionBranch} from "@/schemas/world/conditionBranchSchemas";
import type {World} from "@/schemas/world/worldSchema";
import {resolveEffects} from "../effects/resolveEffects";
import {evaluateCondition} from "../conditions/evaluateCondition";

export type ConditionBranchResult = {
	game: GameState;
	actionTaken: boolean;
};

export function resolveConditionBranchWithResult(
	world: World,
	game: GameState,
	branch: ConditionBranch,
): ConditionBranchResult {
	let newGameState = game;
	let actionTaken = false;

	if (branch.always) {
		newGameState = resolveEffects(world, newGameState, branch.always);
		actionTaken = true;
	}

	if (branch.if && evaluateCondition(world, game, branch.if.condition)) {
		return {
			game: resolveEffects(world, newGameState, branch.if.effect),
			actionTaken: true,
		};
	}

	if (branch.elifs) {
		for (const condition of branch.elifs) {
			if (evaluateCondition(world, newGameState, condition.condition)) {
				return {
					game: resolveEffects(world, newGameState, condition.effect),
					actionTaken: true,
				};
			}
		}
	}

	if (branch.else) {
		return {
			game: resolveEffects(world, newGameState, branch.else),
			actionTaken: true,
		};
	}

	return {game: newGameState, actionTaken};
}

export function resolveConditionBranch(
	world: World,
	game: GameState,
	branch: ConditionBranch,
): GameState {
	return resolveConditionBranchWithResult(world, game, branch).game;
}
