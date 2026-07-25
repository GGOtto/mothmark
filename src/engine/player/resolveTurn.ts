import {produce} from "immer";
import type {GameState} from "@/schemas/states/gameStateSchemas";
import type {World} from "@/schemas/world/worldSchema";
import {runCommand} from "../commands/execute";
import {resolveEvents} from "../events/resolveEvent";
import {addMessage} from "../messages/createRoomMessage";

export function resolveTurn(world: World, game: GameState, response: string): GameState {
	if (!response.trim()) {
		return produce(game, () => {});
	}

	if (game.player.isDead) {
		return game;
	}

	// the start of every turn increments the turn counter
	let newGameState = produce(game, (draft) => {
		draft.player.turns += 1;
	});

	// add the message that the player put first, so nothing shows up after it
	newGameState = addMessage(newGameState, response, "command");

	if (newGameState.player.freezeState.frozen) {
		const message = newGameState.player.freezeState.message
			? newGameState.player.freezeState.message
			: "You are currently frozen.";
		newGameState = addMessage(newGameState, message, "error");

		// stop the freeze if the wait is over
		const turns = newGameState.player.freezeState.turns;
		const start = newGameState.player.freezeState.startOfFreeze;
		if (turns && start && newGameState.player.turns - start > turns) {
			newGameState = produce(newGameState, (draft) => {
				draft.player.freezeState = {};
			});
		}
	} else {
		newGameState = runCommand(world, newGameState, response);
	}

	newGameState = resolveEvents(world, newGameState);

	return newGameState;
}
