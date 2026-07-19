import type {World} from "@/schemas/world/worldSchema";
import {idValue} from "@/utils/idUtils";
import type {GameState} from "@/schemas/states/gameStateSchema";
import {createRoomMessage} from "../messages/createRoomMessage";
import {getRoom} from "../utils/worldLookupUtils";

export function createInitialGameState(world: World, startingRoomId: string): GameState {
	const startingRoom = getRoom(world, startingRoomId);
	const game: GameState = {
		currentRoom: startingRoom.id,
		turns: 0,
		variables: {
			flags: world.initialState.flags.map(({flag, value}) => ({[String(flag)]: Boolean(value)})),
			counter: world.initialState.counters.map(({counter, value}) => ({
				[String(counter)]: Number(value),
			})),
		},
		roomStates: world.rooms.map((room) => ({
			type: "room",
			id: room.id,
			visited: false,
			featureStates: room.features.map((feature) => ({
				type: "feature",
				id: feature.id,
				examined: false,
			})),
		})),
		messages: [],
	};

	return {
		...game,
		roomStates: game.roomStates.map((roomState) => ({
			...roomState,
			visited: idValue(roomState.id) === idValue(startingRoom.id),
		})),
		messages: [createRoomMessage(world, startingRoom, game)],
	};
}
