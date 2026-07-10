import type {World} from "@/schemas/worldSchema";
import {getFeatureExaminedFlag, getRoomViewedFlag, getRoomVisitedFlag} from "./flags";

export type GameMessageType = "room" | "command" | "system" | "error";

export type GameMessage = {
	id: string;
	text: string;
	type: GameMessageType;
	roomId?: string;
};

export type GameState = {
	currentRoomId: string;
	flags: Record<string, boolean>;
	inventory: string[];
	messages: GameMessage[];
};

export type CreateGameMessageOptions = {
	roomId?: string;
};

export function createGameMessage(
	text: string,
	type: GameMessageType,
	options: CreateGameMessageOptions = {},
): GameMessage {
	return {
		id: crypto.randomUUID(),
		text,
		type,
		...options,
	};
}

export function createInitialGameState(world: World, startingRoomId: string): GameState {
	const flags: Record<string, boolean> = {};

	for (const room of world.rooms) {
		flags[getRoomVisitedFlag(room.id)] = false;
		flags[getRoomViewedFlag(room.id)] = false;

		if (!room.features) {
			continue;
		}

		for (const feature of room.features) {
			flags[getFeatureExaminedFlag(room.id, feature.id)] = false;
		}
	}

	return {
		currentRoomId: startingRoomId,
		flags,
		inventory: [],
		messages: [],
	};
}
