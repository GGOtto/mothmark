import {produce} from "immer";
import type {Connection, Direction, World} from "@/schemas/world/worldSchema";
import {compareIds, type ID} from "@/utils/idUtils";
import {createGameMessage} from "../messages/createMessage";
import type {GameState} from "@/schemas/states/gameStateSchemas";
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
	const blockedMessage = createGameMessage("You can't go that way.", "system");
	const currentRoomState = game.roomStates.find((state) =>
		compareIds(state.id, game.player.currentRoom),
	);
	const exitIsLocked = currentRoomState?.lockedExits?.includes(direction) ?? false;
	const connection = exitIsLocked
		? undefined
		: getConnectionForDirection(world, game.player.currentRoom, direction);

	if (!connection) {
		return produce(game, (draft) => {
			draft.messages.push(blockedMessage);
		});
	}

	const destinationRoomId = getDestinationRoomId(connection, game.player.currentRoom);
	return teleport(world, game, destinationRoomId, {
		respectActiveFlag: true,
		blockedMessage,
	});
}
