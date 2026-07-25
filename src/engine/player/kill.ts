import {GameState} from "@/schemas/states/gameStateSchemas";
import {World} from "@/schemas/world/worldSchema";
import {produce} from "immer";
import {createGameMessage} from "../messages/createMessage";

export function kill(world: World, game: GameState, customDeathMessage?: string): GameState {
	return produce(game, (draft) => {
		const message = createGameMessage(
			customDeathMessage ?? game.player.customDeathMessage ?? world.deathMessage,
			"death",
		);
		draft.player.isDead = true;
		draft.messages.push(message);
	});
}
