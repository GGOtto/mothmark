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

	// Echo the player's input before command output and end-of-turn events.
	newGameState = addMessage(newGameState, response, "command");

	if (newGameState.player.freezeState.frozen) {
		const turns = newGameState.player.freezeState.turns;
		const start = newGameState.player.freezeState.startOfFreeze;
		const freezeHasExpired =
			turns !== undefined && start !== undefined && newGameState.player.turns - start > turns;

		if (freezeHasExpired) {
			newGameState = produce(newGameState, (draft) => {
				draft.player.freezeState = {};
			});
			newGameState = runCommand(world, newGameState, response);
		} else {
			const message = newGameState.player.freezeState.message || "You are currently unable to act.";
			newGameState = addMessage(newGameState, message, "error");
		}
	} else {
		newGameState = runCommand(world, newGameState, response);
	}

	newGameState = resolveEvents(world, newGameState);

	return newGameState;
}
