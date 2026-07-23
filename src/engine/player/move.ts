import {produce} from "immer";
import type {Connection, Direction, World} from "@/schemas/world/worldSchema";
import {compareIds, type ID} from "@/utils/idUtils";
import {createGameMessage} from "../messages/createMessage";
import type {GameState} from "@/schemas/states/gameStateSchema";
import {teleport} from "./teleport";

function canTravelForward(connection: Connection) {
	return connection.pathway === "two-way" || connection.pathway === "forwards";
}

function canTravelBackward(connection: Connection) {
	return connection.pathway === "two-way" || connection.pathway === "backwards";
}

function getConnectionForDirection(world: World, currentRoomId: ID<"room">, direction: Direction) {
	return world.connections.find((connection) => {
		const forwardMatch =
			compareIds(connection.fromRoomId, currentRoomId) &&
			connection.direction === direction &&
			canTravelForward(connection);

		const backwardMatch =
			compareIds(connection.toRoomId, currentRoomId) &&
			connection.returnDirection === direction &&
			canTravelBackward(connection);

		return forwardMatch || backwardMatch;
	});
}

function getDestinationRoomId(connection: Connection, currentRoomId: ID<"room">) {
	if (compareIds(connection.fromRoomId, currentRoomId)) {
		return connection.toRoomId;
	}

	return connection.fromRoomId;
}

export function move(world: World, game: GameState, direction: Direction): GameState {
	const connection = getConnectionForDirection(world, game.currentRoom, direction);
	const blockedMessage = createGameMessage("You can't go that way.", "system");

	if (!connection) {
		return produce(game, (draft) => {
			draft.messages.push(blockedMessage);
		});
	}

	const destinationRoomId = getDestinationRoomId(connection, game.currentRoom);
	return teleport(world, game, destinationRoomId, {
		respectActiveFlag: true,
		blockedMessage,
	});
}
