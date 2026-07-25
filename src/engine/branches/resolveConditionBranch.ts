import type {GameState} from "@/schemas/states/gameStateSchemas";
import type {ConditionBranch} from "@/schemas/world/conditionBranchSchemas";
import type {World} from "@/schemas/world/worldSchema";
import {resolveEffects} from "../effects/resolveEffects";
import {evaluateCondition} from "../conditions/evaluateCondition";
import {addDelayedConditionEvent} from "../events/addDelayedConditionEvent";
import type {ConditionWithEffect} from "@/schemas/world/conditionBranchSchemas";

export type ConditionBranchResult = {
	game: GameState;
	actionTaken: boolean;
};

function resolveConditionEffect(
	world: World,
	game: GameState,
	conditionWithEffect: ConditionWithEffect,
): GameState {
	if (conditionWithEffect.delayTurns > 0) {
		return addDelayedConditionEvent(game, conditionWithEffect);
	}

	return resolveEffects(world, game, conditionWithEffect.effect);
}

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

	if (branch.if && evaluateCondition(world, newGameState, branch.if.condition)) {
		return {
			game: resolveConditionEffect(world, newGameState, branch.if),
			actionTaken: true,
		};
	}

	if (branch.elifs) {
		for (const condition of branch.elifs) {
			if (evaluateCondition(world, newGameState, condition.condition)) {
				return {
					game: resolveConditionEffect(world, newGameState, condition),
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
