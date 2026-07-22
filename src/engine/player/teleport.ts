import {produce} from "immer";
import type {GameState} from "@/schemas/states/gameStateSchema";
import type {World} from "@/schemas/world/worldSchema";
import {compareIds, type ID} from "@/utils/idUtils";
import {evaluateCondition} from "../conditions/evaluateCondition";
import {createGameMessage, type GameMessage} from "../messages/createMessage";
import {createRoomMessage} from "../messages/createRoomMessage";
import {getRoom} from "../utils/lookupUtils";

export type TeleportOptions = {
	respectActiveWhen?: boolean;
	blockedMessage?: GameMessage;
};

/**
 * Moves an existing player state to a room without resetting the rest of the game.
 * The destination room state and feature states are reconciled with the authored world.
 */
export function teleport(
	world: World,
	game: GameState,
	destinationRoomId: ID<"room">,
	options: TeleportOptions = {},
): GameState {
	const destinationRoom = getRoom(world, destinationRoomId);

	if (options.respectActiveWhen && !evaluateCondition(world, game, destinationRoom.activeWhen)) {
		return produce(game, (draft) => {
			draft.messages.push(
				options.blockedMessage ?? createGameMessage("You can't go that way.", "system"),
			);
		});
	}

	const roomMessage = createRoomMessage(world, destinationRoom, game);

	return produce(game, (draft) => {
		draft.currentRoom = destinationRoom.id;
		draft.messages.push(roomMessage);

		const roomState = draft.roomStates.find((state) => compareIds(state.id, destinationRoom.id));

		if (!roomState) {
			draft.roomStates.push({
				type: "room",
				id: destinationRoom.id,
				visited: true,
				featureStates: destinationRoom.features.map((feature) => ({
					type: "feature",
					id: feature.id,
					examined: false,
				})),
			});
			return;
		}

		roomState.visited = true;
		roomState.featureStates = destinationRoom.features.map((feature) => {
			const existingState = roomState.featureStates.find((state) => compareIds(state.id, feature.id));
			return existingState ?? {type: "feature", id: feature.id, examined: false};
		});
	});
}
