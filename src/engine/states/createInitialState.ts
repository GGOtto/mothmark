import type {World} from "@/schemas/world/worldSchema";
import {compareIds, idValue, type ID} from "@/utils/idUtils";
import type {GameState} from "@/schemas/states/gameStateSchemas";
import {produce} from "immer";
import {createRoomMessage} from "../messages/createRoomMessage";
import {resolveEvents} from "../events/resolveEvent";
import {getRoom} from "../utils/lookupUtils";
import {createItemState, createRoomState} from "./createEntityState";

export function createInitialGameState(world: World, startingRoomId: ID<"room">): GameState {
	getRoom(world, startingRoomId);
	const initiallyEquippedItemIds = world.items
		.filter(
			(item) =>
				item.initialState.location.type === "inventory" &&
				item.behaviors.some((behavior) => behavior.type === "equippable" && behavior.startsEquipped),
		)
		.map((item) => item.id);
	let game: GameState = {
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

	game = resolveEvents(world, game, {
		visitedRoomIdsAtStart: new Set(
			game.roomStates
				.filter((roomState) => roomState.flags.visited)
				.map((roomState) => idValue(roomState.id)),
		),
		suppressAutomaticRoomMessages: true,
	});

	if (game.player.isDead || game.player.isEnded) return game;

	const openingRoom = getRoom(world, game.player.currentRoom);
	const openingMessage = createRoomMessage(world, openingRoom, game, {forceFullDescription: true});
	return produce(game, (draft) => {
		draft.messages.push(openingMessage);
		const roomState = draft.roomStates.find((candidate) => compareIds(candidate.id, openingRoom.id));
		if (roomState) roomState.flags.visited = true;
	});
}
