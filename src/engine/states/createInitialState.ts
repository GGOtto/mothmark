import type {World} from "@/schemas/world/worldSchema";
import {compareIds, type ID} from "@/utils/idUtils";
import type {GameState} from "@/schemas/states/gameStateSchemas";
import {createRoomMessage} from "../messages/createRoomMessage";
import {getRoom} from "../utils/lookupUtils";
import {createItemState, createRoomState} from "./createEntityState";

export function createInitialGameState(world: World, startingRoomId: ID<"room">): GameState {
	const startingRoom = getRoom(world, startingRoomId);
	const initiallyEquippedItemIds = world.items
		.filter(
			(item) =>
				item.initialState.location.type === "inventory" &&
				item.behaviors.some((behavior) => behavior.type === "equippable" && behavior.startsEquipped),
		)
		.map((item) => item.id);
	const game: GameState = {
		player: {
			currentRoom: startingRoomId,
			facing: "n",
			turns: 0,
			randomState: 0x6d2b79f5,
			equippedItemIds: initiallyEquippedItemIds,
			freezeState: {},
		},
		variables: {
			flags: world.initialState.flags.map(({flag, value}) => ({[String(flag)]: Boolean(value)})),
			counters: world.initialState.counters.map(({counter, value}) => ({
				[String(counter)]: Number(value),
			})),
			texts: world.initialState.texts.map(({text, value}) => ({
				[String(text)]: String(value),
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
