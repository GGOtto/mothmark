import {produce} from "immer";
import type {GameState} from "@/schemas/states/gameStateSchemas";
import type {World} from "@/schemas/world/worldSchema";
import {runCommand} from "../commands/execute";
import {createGameMessage} from "../messages/createMessage";

export function resolveTurn(world: World, game: GameState, response: string): GameState {
	if (!response.trim()) {
		return produce(game, () => {});
	}

	if (game.player.isDead) {
		return game;
	}

	if (game.player.freezeState.frozen) {
		return produce(game, (draft) => {
			const message = game.player.freezeState.message
				? game.player.freezeState.message
				: "You are currently frozen.";
			draft.messages.push(createGameMessage(message, "error"));
			draft.player.turns += 1;
		});
	}

	const resolvedGame = runCommand(world, game, response);

	return produce(resolvedGame, (draft) => {
		draft.player.turns += 1;
	});
}
