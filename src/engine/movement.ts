import type {Connection, Direction, World} from "../schemas/worldSchema";
import {idValue} from "../utils/idUtils";
import type {GameState} from "./gameState";
import {createGameMessage} from "./gameState";
import {lookAtRoom} from "./rooms";

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

export function movePlayer(world: World, gameState: GameState, direction: Direction): GameState {
	const connection = getConnectionForDirection(world, gameState.currentRoomId, direction);

	if (!connection) {
		return {
			...gameState,
			messages: [
				...gameState.messages,
				createGameMessage("You can't go that way.", "error"), // TODO: world data for messages like these
			],
		};
	}

	const nextState: GameState = {
		...gameState,
		currentRoomId: getDestinationRoomId(connection, gameState.currentRoomId),
	};

	return lookAtRoom(world, nextState);
}
