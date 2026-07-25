import type {GameState} from "@/schemas/states/gameStateSchemas";
import type {Event} from "@/schemas/world/eventSchema";
import {produce} from "immer";

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
