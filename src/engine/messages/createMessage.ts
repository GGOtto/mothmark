export type GameMessageType = "room" | "command" | "system" | "error";

export type GameMessage = {
	id: string;
	text: string;
	type: GameMessageType;
	roomId?: ID<"room">;
};

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
import type {ID} from "@/utils/idUtils";
