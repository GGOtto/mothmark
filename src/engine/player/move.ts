import {produce} from "immer";
import type {Connection, Direction, World} from "@/schemas/world/worldSchema";
import {compareIds, type ID} from "@/utils/idUtils";
import {createGameMessage} from "../messages/createMessage";
import type {GameState} from "@/schemas/states/gameStateSchemas";
import {teleport} from "./teleport";
import {evaluateCondition} from "../conditions/evaluateCondition";

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

function conditionHasCriteria(condition: Connection["lockedWhen"]): boolean {
	return condition.type !== "group" || condition.conditions.length > 0;
}

function getDestinationRoomId(connection: Connection, currentRoomId: ID<"room">) {
	if (compareIds(connection.fromRoomId, currentRoomId)) {
		return connection.toRoomId;
	}

	return connection.fromRoomId;
}

export function move(world: World, game: GameState, direction: Direction): GameState {
	const genericBlockedMessage = createGameMessage("You can't go that way.", "system");
	const currentRoomState = game.roomStates.find((state) =>
		compareIds(state.id, game.player.currentRoom),
	);
	const exitIsLocked = currentRoomState?.lockedExits?.includes(direction) ?? false;
	const connection = getConnectionsForDirection(world, game.player.currentRoom, direction).find(
		(candidate) => evaluateCondition(world, game, candidate.visibleWhen),
	);

	if (!connection) {
		return produce(game, (draft) => {
			draft.messages.push(genericBlockedMessage);
		});
	}

	const blockedMessage = createGameMessage(
		connection.blockedMessage || "You can't go that way.",
		"system",
	);
	const conditionLocksConnection =
		conditionHasCriteria(connection.lockedWhen) &&
		evaluateCondition(world, game, connection.lockedWhen);
	const travelIsAllowed = evaluateCondition(world, game, connection.travelAllowedWhen);
	if (exitIsLocked || conditionLocksConnection || !travelIsAllowed) {
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
