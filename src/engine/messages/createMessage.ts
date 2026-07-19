export type GameMessageType = "room" | "command" | "system" | "error";

export type GameMessage = {
	id: string;
	text: string;
	type: GameMessageType;
	roomId?: string;
};

export type CreateGameMessageOptions = {
	roomId?: string;
};

export function createGameMessage(
	text: string,
	type: GameMessageType,
	options: CreateGameMessageOptions = {},
): GameMessage {
	return {id: crypto.randomUUID(), text, type, ...options};
}
