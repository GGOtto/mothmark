import {type GameState} from "@/schemas/states/gameStateSchema";
import {type Effect} from "@/schemas/world/effectSchema";
import {produce} from "immer";
import {findVariable} from "../utils/worldLookupUtils";
import {appendLastMessage, createGameMessage, GameMessage} from "../messages/createMessage";
import {choose} from "@/utils/choose";

export function resolveMessageEffect(game: GameState, effect: Effect): GameState {
	if (effect.type !== "message") {
		return game;
	}

	let message: GameMessage;
	switch (effect.operation) {
		case "show":
			message = createGameMessage(effect.message, "system");
			break;
		case "random":
			message = createGameMessage(choose(effect.messages) ?? "", "system");
			break;
		case "append-last-message":
			return appendLastMessage(game, effect.message, effect.format);
		default:
			return game;
	}

	return produce(game, (draft) => {
		draft.messages.push(message);
	});
}
