import {produce} from "immer";
import type {Connection, Direction, World} from "@/schemas/world/worldSchema";
import {idValue} from "@/utils/idUtils";
import {createGameMessage} from "../messages/createMessage";
import {createRoomMessage} from "../messages/createRoomMessage";
import type {GameState} from "@/schemas/states/gameStateSchema";
import {getRoom} from "../utils/worldLookupUtils";

function canTravelForward(connection: Connection) {
	return connection.pathway === "two-way" || connection.pathway === "forwards";
}

function canTravelBackward(connection: Connection) {
	return connection.pathway === "two-way" || connection.pathway === "backwards";
}

function getConnectionForDirection(world: World, currentRoomId: string, direction: Direction) {
	return world.connections.find((connection) => {
		const forwardMatch =
			idValue(connection.fromRoomId) === currentRoomId &&
			connection.direction === direction &&
			canTravelForward(connection);

		const backwardMatch =
			idValue(connection.toRoomId) === currentRoomId &&
			connection.returnDirection === direction &&
			canTravelBackward(connection);

		return forwardMatch || backwardMatch;
	});
}

function getDestinationRoomId(connection: Connection, currentRoomId: string) {
	if (idValue(connection.fromRoomId) === currentRoomId) {
		return idValue(connection.toRoomId);
	}

	return idValue(connection.fromRoomId);
}

export function move(world: World, game: GameState, direction: Direction): GameState {
	const connection = getConnectionForDirection(world, idValue(game.currentRoom), direction);

	if (!connection) {
		return produce(game, (draft) => {
			draft.messages.push(createGameMessage("You can't go that way.", "system"));
		});
	}

	const destinationRoomId = getDestinationRoomId(connection, idValue(game.currentRoom));
	const destinationRoom = getRoom(world, destinationRoomId);
	const roomMessage = createRoomMessage(world, destinationRoom, game);

	return produce(game, (draft) => {
		draft.currentRoom = destinationRoom.id;
		draft.messages.push(roomMessage);

		const roomState = draft.roomStates.find((state) => idValue(state.roomId) === destinationRoomId);
		if (roomState) roomState.visited = true;
	});
}
