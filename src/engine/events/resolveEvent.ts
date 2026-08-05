import type {GameState} from "@/schemas/states/gameStateSchemas";
import type {World} from "@/schemas/world/worldSchema";
import {compareIds} from "@/utils/idUtils";
import {produce} from "immer";
import {resolveConditionBranchWithResult} from "../branches/resolveConditionBranch";

export {addEvent, addEvents} from "./eventQueue";

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
