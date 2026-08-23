import type {GameState} from "@/schemas/states/gameStateSchemas";
import type {ConditionBranch} from "@/schemas/world/conditionBranchSchemas";
import type {World} from "@/schemas/world/worldSchema";
import {resolveEffects, type EffectResolutionContext} from "../effects/resolveEffects";
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
	context?: EffectResolutionContext,
): GameState {
	if (conditionWithEffect.delayTurns > 0) {
		return addDelayedConditionEvent(game, conditionWithEffect);
	}

	return resolveEffects(world, game, conditionWithEffect.effect, context);
}

export function resolveConditionBranchWithResult(
	world: World,
	game: GameState,
	branch: ConditionBranch,
	context?: EffectResolutionContext,
): ConditionBranchResult {
	let newGameState = game;
	let actionTaken = false;

	if (branch.always) {
		newGameState = resolveEffects(world, newGameState, branch.always, context);
		actionTaken = true;
	}

	if (branch.if && evaluateCondition(world, newGameState, branch.if.condition)) {
		return {
			game: resolveConditionEffect(world, newGameState, branch.if, context),
			actionTaken: true,
		};
	}

	if (branch.elifs) {
		for (const condition of branch.elifs) {
			if (evaluateCondition(world, newGameState, condition.condition)) {
				return {
					game: resolveConditionEffect(world, newGameState, condition, context),
					actionTaken: true,
				};
			}
		}
	}

	if (branch.else) {
		return {
			game: resolveEffects(world, newGameState, branch.else, context),
			actionTaken: true,
		};
	}

	return {game: newGameState, actionTaken};
}

export function resolveConditionBranch(
	world: World,
	game: GameState,
	branch: ConditionBranch,
	context?: EffectResolutionContext,
): GameState {
	return resolveConditionBranchWithResult(world, game, branch, context).game;
}
