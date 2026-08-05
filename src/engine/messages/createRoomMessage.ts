import type {Room, World} from "@/schemas/world/worldSchema";
import {compareIds} from "@/utils/idUtils";
import type {GameMessageType, GameState} from "@/schemas/states/gameStateSchemas";
import {createGameMessage} from "./createMessage";
import {GameMessage} from "@/schemas/states/gameStateSchemas";
import {getRoom} from "../utils/lookupUtils";
import {produce} from "immer";

export function addMessage(game: GameState, message: string, type: GameMessageType): GameState {
	return produce(game, (draft) => {
		draft.messages.push(createGameMessage(message, type));
	});
}

export function lookAtRoom(world: World, game: GameState, forceFullDescription = true): GameState {
	const room = getRoom(world, game.player.currentRoom);
	const roomMessage = createRoomMessage(world, room, game, {forceFullDescription});

	return produce(game, (draft) => {
		draft.messages.push(roomMessage);
	});
}

export function createRoomMessage(
	world: World,
	room: Room,
	gameState: GameState,
	options: {forceFullDescription?: boolean} = {},
): GameMessage {
	const roomState = gameState.roomStates.find((state) => compareIds(state.id, room.id));
	const hasVisited = roomState?.flags.visited ?? false;
	const name = roomState?.name ?? room.name;
	const description =
		hasVisited && !options.forceFullDescription
			? roomState?.shortDescription ||
				roomState?.description ||
				room.shortDescription ||
				room.description
			: (roomState?.description ?? room.description);
	let text = `${name}\n${description}\n`;

	const featureStates =
		roomState?.featureStates ??
		room.features.map((feature) => ({
			type: "feature" as const,
			id: feature.id,
			name: feature.name,
			description: feature.description,
			aliases: [...feature.aliases],
			tags: [...feature.tags],
			kind: feature.kind,
			listedInRoom: feature.listedInRoom,
			flags: {...feature.flags},
		}));
	for (const featureState of featureStates) {
		const feature = world.rooms
			.flatMap((candidate) => candidate.features)
			.find((candidate) => compareIds(candidate.id, featureState.id));
		if (!feature) continue;

		const hidden = featureState.flags.hidden ?? feature.flags.hidden ?? false;
		const listedInRoom = featureState.listedInRoom;
		if (!hidden && listedInRoom) {
			text += `${featureState.description}\n`;
		}
	}

	return createGameMessage(`${text}\n`, "room", {roomId: room.id});
}
