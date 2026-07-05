import type {Room, World} from "@/schemas/worldSchema";
import {resolveDescription} from "./descriptions";
import {getRoomViewedFlag, getRoomVisitedFlag} from "./flags";
import type {GameState, GameMessage} from "./gameState";
import {createGameMessage} from "./gameState";
import {de} from "zod/locales";

export function getRoom(world: World, roomId: string): Room {
	const room = world.rooms.find((room) => room.id === roomId);

	if (!room) {
		throw new Error(`Missing room: ${roomId}`);
	}

	return room;
}

export function buildRoomDescription(room: Room, gameState: GameState): GameMessage {
	let text = room.name + "\n\n";

	// print out the room's description
	const description = resolveDescription(room.description, gameState);
	text += description + "\n";

	// print out the room features that are available to list
	if (room.features) {
		for (const feature of room.features) {
			text += resolveDescription(feature.description, gameState) + "\n";
		}
	}

	text += "\n";
	return createGameMessage(text, "room");
}

export function lookAtRoom(world: World, gameState: GameState): GameState {
	const room = getRoom(world, gameState.currentRoomId);
	const description = buildRoomDescription(room, gameState);

	return {
		...gameState,
		flags: {
			...gameState.flags,
			[getRoomVisitedFlag(room.id)]: true,
			[getRoomViewedFlag(room.id)]: true,
		},
		messages: [...gameState.messages, description],
	};
}
