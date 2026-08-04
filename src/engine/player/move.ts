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

function getConnectionsForDirection(world: World, currentRoomId: ID<"room">, direction: Direction) {
	return world.connections.filter((connection) => {
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

function openExitDestination(
	world: World,
	game: GameState,
	direction: Direction,
): ID<"room"> | undefined {
	const currentRoomState = game.roomStates.find((state) =>
		compareIds(state.id, game.player.currentRoom),
	);
	if (currentRoomState?.lockedExits.includes(direction)) return undefined;

	const connection = getConnectionsForDirection(world, game.player.currentRoom, direction)[0];
	if (!connection) return undefined;

	const destinationRoomId = getDestinationRoomId(connection, game.player.currentRoom);
	const destinationRoom = world.rooms.find((room) => compareIds(room.id, destinationRoomId));
	if (!destinationRoom) return undefined;
	const destinationRoomState = game.roomStates.find((state) =>
		compareIds(state.id, destinationRoomId),
	);
	const destinationIsActive =
		destinationRoomState?.flags.active ?? destinationRoom.flags.active ?? true;

	return destinationIsActive ? destinationRoomId : undefined;
}

export function isExitOpen(world: World, game: GameState, direction: Direction): boolean {
	return openExitDestination(world, game, direction) !== undefined;
}

export function silentlyMove(world: World, game: GameState, direction: Direction): GameState {
	const destinationRoomId = openExitDestination(world, game, direction);
	if (!destinationRoomId) return game;

	return teleport(world, game, destinationRoomId, {respectActiveFlag: true, silent: true});
}

export function move(world: World, game: GameState, direction: Direction): GameState {
	const genericBlockedMessage = createGameMessage("You can't go that way.", "system");
	const destinationRoomId = openExitDestination(world, game, direction);
	if (!destinationRoomId) {
		return produce(game, (draft) => {
			draft.messages.push(genericBlockedMessage);
		});
	}

	return teleport(world, game, destinationRoomId, {
		respectActiveFlag: true,
		blockedMessage: genericBlockedMessage,
	});
}
