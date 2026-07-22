import type {ID} from "@/utils/idUtils";
import type {GameState} from "@/schemas/states/gameStateSchema";
import {produce} from "immer";
import {GameMessage} from "@/schemas/states/gameStateSchema";

export type GameMessageType = "room" | "command" | "system" | "error";

export type CreateGameMessageOptions = {
	roomId?: ID<"room">;
};

export function createGameMessage(
	text: string,
	type: GameMessageType,
	options: CreateGameMessageOptions = {},
): GameMessage {
	return {id: crypto.randomUUID(), text, type, ...options};
}

export function appendLastMessage(
	game: GameState,
	message: string,
	format: "inline" | "newline",
): GameState {
	const lastMessage = game.messages.at(-1) ?? createGameMessage("", "system");

	if (format === "newline" && lastMessage.text !== "") {
		lastMessage.text += "\n" + message;
	} else {
		lastMessage.text += message;
	}

	return produce(game, (draft) => {
		if (draft.messages.length === 0) {
			draft.messages.push(lastMessage);
		} else {
			draft.messages[draft.messages.length - 1] = lastMessage;
		}
	});
}
