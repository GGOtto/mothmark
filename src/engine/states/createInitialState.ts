import type {World} from "@/schemas/world/worldSchema";
import {compareIds, type ID} from "@/utils/idUtils";
import type {GameState} from "@/schemas/states/gameStateSchema";
import {createRoomMessage} from "../messages/createRoomMessage";
import {getRoom} from "../utils/lookupUtils";

export function createInitialGameState(world: World, startingRoomId: ID<"room">): GameState {
	const startingRoom = getRoom(world, startingRoomId);
	const game: GameState = {
		currentRoom: startingRoom.id,
		turns: 0,
		variables: {
			flags: world.initialState.flags.map(({flag, value}) => ({[String(flag)]: Boolean(value)})),
			counters: world.initialState.counters.map(({counter, value}) => ({
				[String(counter)]: Number(value),
			})),
		},
		roomStates: world.rooms.map((room) => ({
			type: "room",
			id: room.id,
			tags: [...room.tags],
			lockedExits: [],
			flags: {...room.flags},
			featureStates: room.features.map((feature) => ({
				type: "feature",
				id: feature.id,
				flags: {...feature.flags},
			})),
		})),
		messages: [],
	};

	return {
		...game,
		roomStates: game.roomStates.map((roomState) => ({
			...roomState,
			flags: {
				...roomState.flags,
				visited: compareIds(roomState.id, startingRoom.id) || roomState.flags.visited,
			},
		})),
		messages: [createRoomMessage(world, startingRoom, game)],
	};
}
