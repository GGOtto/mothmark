import {produce} from "immer";
import type {GameState} from "@/schemas/states/gameStateSchemas";
import type {World} from "@/schemas/world/worldSchema";
import {runCommand} from "../commands/execute";

export function resolveTurn(world: World, game: GameState, response: string): GameState {
	if (!response.trim()) return produce(game, () => {});

	const resolvedGame = runCommand(world, game, response);

	return produce(resolvedGame, (draft) => {
		draft.player.turns += 1;
	});
}
