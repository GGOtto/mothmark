import type {GameState} from "@/schemas/states/gameStateSchemas";
import type {ConditionBranch, ConditionWithEffect} from "@/schemas/world/conditionBranchSchemas";
import type {Event} from "@/schemas/world/eventSchema";
import {generateUniqueId} from "@/utils/idUtils";
import {addEvent} from "./eventQueue";

export function addDelayedConditionEvent(
	game: GameState,
	conditionWithEffect: ConditionWithEffect,
): GameState {
	const branch: ConditionBranch = {
		id: generateUniqueId("condition-branch"),
	};

	if (conditionWithEffect.cancelIfConditionFails) {
		branch.if = {...conditionWithEffect, delayTurns: 0};
		branch.else = {
			...conditionWithEffect.effect,
			id: generateUniqueId("effect"),
			name: "Cancel Delayed Condition",
			effects: [],
		};
	} else {
		branch.always = conditionWithEffect.effect;
	}

	const event: Event = {
		id: generateUniqueId("event"),
		name: "Delayed Condition",
		enabled: true,
		branch,
		disposable: true,
		wait: conditionWithEffect.delayTurns,
		priority: 0,
		lastSuccess: game.player.turns,
	};

	return addEvent(game, event);
}
