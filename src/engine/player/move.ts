import type {Connection, Direction, World} from "@/schemas/world/worldSchema";
import {idValue} from "@/utils/idUtils";
import {createGameMessage} from "../messages/createMessage";
import type {GameState} from "@/schemas/states/gameStateSchema";

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
	// TODO use limmer here
	return game;
}
