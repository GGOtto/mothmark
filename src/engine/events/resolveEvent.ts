import type {GameState} from "@/schemas/states/gameStateSchemas";
import type {Event} from "@/schemas/world/eventSchema";
import type {World} from "@/schemas/world/worldSchema";
import {compareIds, generateUniqueId} from "@/utils/idUtils";
import {produce} from "immer";
import {resolveConditionBranchWithResult} from "../branches/resolveConditionBranch";
import type {ConditionWithEffect, ConditionBranch} from "@/schemas/world/conditionBranchSchemas";

export function addDelayedConditionEvent(
	game: GameState,
	conditionWithEffect: ConditionWithEffect,
): GameState {
	const branch: ConditionBranch = {
		id: generateUniqueId("condition-branch"),
	};

	if (conditionWithEffect.cancelIfConditionFails) {
		branch.if = conditionWithEffect;
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

export function addEvent(game: GameState, event: Event): GameState {
	return produce(game, (draft) => {
		const index = draft.events.findIndex((element) => element.priority < event.priority);
		if (index === -1) {
			draft.events.push(event);
		} else {
			draft.events.splice(index, 0, event);
		}
	});
}

export function addEvents(game: GameState, events: Event[]): GameState {
	let newGameState = game;
	for (const event of events) {
		newGameState = addEvent(newGameState, event);
	}
	return newGameState;
}

export function resolveEvents(world: World, game: GameState): GameState {
	let newGameState = game;

	// Only events present at the start of this pass are eligible to run. Event
	// IDs let us find those same events if resolving an earlier event inserts or
	// reorders entries in the live queue.
	const eventIds = game.events.map((event) => event.id);
	for (const eventId of eventIds) {
		const eventIndex = newGameState.events.findIndex((event) => compareIds(event.id, eventId));
		if (eventIndex === -1) continue;

		const event = newGameState.events[eventIndex];

		if (!event.enabled || game.player.turns - event.lastSuccess < event.wait) {
			continue;
		}

		const branchResult = resolveConditionBranchWithResult(world, newGameState, event.branch);
		newGameState = branchResult.game;

		if (branchResult.actionTaken) {
			const resolvedEventIndex = newGameState.events.findIndex((candidate) =>
				compareIds(candidate.id, eventId),
			);
			if (resolvedEventIndex === -1) continue;

			newGameState = produce(newGameState, (draft) => {
				if (event.disposable) {
					draft.events.splice(resolvedEventIndex, 1);
				} else {
					draft.events[resolvedEventIndex].lastSuccess = draft.player.turns;
				}
			});
		}
	}

	return newGameState;
}
