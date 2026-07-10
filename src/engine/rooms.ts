import type {Room, World} from "@/schemas/worldSchema";
import {resolveDescription} from "./descriptions";
import {getRoomViewedFlag, getRoomVisitedFlag} from "./flags";
import type {GameState, GameMessage} from "./gameState";
import {createGameMessage} from "./gameState";

export function getRoom(world: World, roomId: string): Room {
	const room = world.rooms.find((room) => room.id === roomId);

	if (!room) {
		throw new Error(`Missing room: ${roomId}`);
	}

	return room;
}

export function buildRoomDescription(room: Room, gameState: GameState): GameMessage {
	let text = room.name + "\n";

	// print out the room's description
	const description = resolveDescription(room.description, gameState);
	text += description + "\n";

	// print out the room features that are available to list
	if (room.features) {
		for (const feature of room.features) {
			if (feature.listedInRoom) {
				text += resolveDescription(feature.description, gameState) + "\n";
			}
		}
	}

	text += "\n";
	return createGameMessage(text, "room", {
		roomId: room.id,
	});
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

export function refreshLatestRoomMessage(world: World, gameState: GameState): GameState {
	let latestRoomMessageIndex = -1;

	for (let index = gameState.messages.length - 1; index >= 0; index -= 1) {
		if (gameState.messages[index].type !== "room") continue;

		latestRoomMessageIndex = index;
		break;
	}

	if (latestRoomMessageIndex === -1) return gameState;

	const latestRoomMessage = gameState.messages[latestRoomMessageIndex];
	const roomId = latestRoomMessage.roomId ?? gameState.currentRoomId;
	const room = world.rooms.find((candidateRoom) => candidateRoom.id === roomId);

	if (!room) return gameState;

	const refreshedMessage = {
		...buildRoomDescription(room, gameState),
		id: latestRoomMessage.id,
	};
	const messages = [...gameState.messages];
	messages[latestRoomMessageIndex] = refreshedMessage;

	return {
		...gameState,
		messages,
	};
}
