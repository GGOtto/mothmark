import type {World} from "@/schemas/world/worldSchema";
import {compareIds, type ID} from "@/utils/idUtils";
import type {GameState} from "@/schemas/states/gameStateSchemas";
import {createRoomMessage} from "../messages/createRoomMessage";
import {getRoom} from "../utils/lookupUtils";
import {createItemState, createRoomState} from "./createEntityState";

export function createInitialGameState(world: World, startingRoomId: ID<"room">): GameState {
	const startingRoom = getRoom(world, startingRoomId);
	const game: GameState = {
		player: {
			currentRoom: startingRoomId,
			turns: 0,
			freezeState: {},
		},
		variables: {
			flags: world.initialState.flags.map(({flag, value}) => ({[String(flag)]: Boolean(value)})),
			counters: world.initialState.counters.map(({counter, value}) => ({
				[String(counter)]: Number(value),
			})),
			command: [],
		},
		roomStates: world.rooms.map(createRoomState),
		itemStates: world.items.map(createItemState),
		events: [...(world.events ?? [])].sort((left, right) => right.priority - left.priority),
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
