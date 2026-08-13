import {produce} from "immer";
import type {GameState, GameMessage} from "@/schemas/states/gameStateSchemas";
import type {World} from "@/schemas/world/worldSchema";
import {compareIds, type ID} from "@/utils/idUtils";
import {createGameMessage} from "../messages/createMessage";
import {createRoomMessage} from "../messages/createRoomMessage";
import {createRoomState} from "../states/createEntityState";
import {getRoom} from "../utils/lookupUtils";

export type TeleportOptions = {
	respectActiveFlag?: boolean;
	blockedMessage?: GameMessage;
	silent?: boolean;
};

/**
 * Moves an existing player state to a room without resetting the rest of the game.
 * Item state remains global and keeps its current authoritative location.
 */
export function teleport(
	world: World,
	game: GameState,
	destinationRoomId: ID<"room">,
	options: TeleportOptions = {},
): GameState {
	const destinationRoom = getRoom(world, destinationRoomId);
	const destinationRoomState = game.roomStates.find((state) =>
		compareIds(state.id, destinationRoom.id),
	);
	const destinationIsActive =
		destinationRoomState?.flags.active ?? destinationRoom.flags.active ?? true;

	if (options.respectActiveFlag && !destinationIsActive) {
		return produce(game, (draft) => {
			draft.messages.push(
				options.blockedMessage ?? createGameMessage("You can't go that way.", "system"),
			);
		});
	}

	const roomMessage = options.silent ? undefined : createRoomMessage(world, destinationRoom, game);

	return produce(game, (draft) => {
		if (!compareIds(draft.player.currentRoom, destinationRoom.id)) {
			draft.player.previousRoom = draft.player.currentRoom;
			draft.player.lastRoomTransitionTurn = draft.player.turns;
		}
		draft.player.currentRoom = destinationRoom.id;
		if (roomMessage) draft.messages.push(roomMessage);

		const roomState = draft.roomStates.find((state) => compareIds(state.id, destinationRoom.id));

		if (!roomState) {
			const createdRoomState = createRoomState(destinationRoom);
			createdRoomState.flags.visited = true;
			draft.roomStates.push(createdRoomState);
			return;
		}

		roomState.flags.visited = true;
	});
}
