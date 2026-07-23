import {produce} from "immer";
import type {GameState, GameMessage} from "@/schemas/states/gameStateSchemas";
import type {World} from "@/schemas/world/worldSchema";
import {compareIds, type ID} from "@/utils/idUtils";
import {createGameMessage} from "../messages/createMessage";
import {createRoomMessage} from "../messages/createRoomMessage";
import {getRoom} from "../utils/lookupUtils";

export type TeleportOptions = {
	respectActiveFlag?: boolean;
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

	const roomMessage = createRoomMessage(world, destinationRoom, game);

	return produce(game, (draft) => {
		draft.player.currentRoom = destinationRoom.id;
		draft.messages.push(roomMessage);

		const roomState = draft.roomStates.find((state) => compareIds(state.id, destinationRoom.id));

		if (!roomState) {
			draft.roomStates.push({
				type: "room",
				id: destinationRoom.id,
				tags: [...destinationRoom.tags],
				lockedExits: [],
				flags: {...destinationRoom.flags, visited: true},
				featureStates: destinationRoom.features.map((feature) => ({
					type: "feature",
					id: feature.id,
					flags: {...feature.flags},
				})),
			});
			return;
		}

		roomState.flags = {...destinationRoom.flags, ...roomState.flags, visited: true};
		roomState.tags ??= [...destinationRoom.tags];
		roomState.lockedExits ??= [];
		roomState.featureStates = destinationRoom.features.map((feature) => {
			const existingState = roomState.featureStates.find((state) => compareIds(state.id, feature.id));
			return existingState
				? {...existingState, flags: {...feature.flags, ...existingState.flags}}
				: {type: "feature", id: feature.id, flags: {...feature.flags}};
		});
	});
}
