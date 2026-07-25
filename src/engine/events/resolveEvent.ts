import type {GameState} from "@/schemas/states/gameStateSchemas";
import type {Event} from "@/schemas/world/eventSchema";
import type {World} from "@/schemas/world/worldSchema";
import {produce} from "immer";
import {resolveConditionBranchWithResult} from "../branches/resolveConditionBranch";

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
	let eventIndex = 0;

	// Only events present at the start of this pass are eligible to run. Event
	// effects do not currently add events, but this also keeps that future
	// behavior from unexpectedly resolving a newly scheduled event immediately.
	for (let checkedEvents = 0; checkedEvents < game.events.length; checkedEvents += 1) {
		const event = newGameState.events[eventIndex];
		if (!event) break;

		if (!event.enabled) {
			eventIndex += 1;
			continue;
		}

		if (event.wait > 0) {
			newGameState = produce(newGameState, (draft) => {
				draft.events[eventIndex].wait -= 1;
			});
			eventIndex += 1;
			continue;
		}

		const branchResult = resolveConditionBranchWithResult(world, newGameState, event.branch);
		newGameState = branchResult.game;

		if (event.disposable && branchResult.actionTaken) {
			newGameState = produce(newGameState, (draft) => {
				draft.events.splice(eventIndex, 1);
			});
		} else {
			eventIndex += 1;
		}
	}

	return newGameState;
}
