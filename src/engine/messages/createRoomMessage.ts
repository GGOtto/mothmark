import type {Room, World} from "@/schemas/world/worldSchema";
import {compareIds} from "@/utils/idUtils";
import type {GameState} from "@/schemas/states/gameStateSchemas";
import {createGameMessage} from "./createMessage";
import {GameMessage} from "@/schemas/states/gameStateSchemas";
import {getRoom} from "../utils/lookupUtils";
import {produce} from "immer";

export function lookAtRoom(world: World, game: GameState): GameState {
	const room = getRoom(world, game.player.currentRoom);
	const roomMessage = createRoomMessage(world, room, game);

	return produce(game, (draft) => {
		draft.messages.push(roomMessage);
	});
}

export function createRoomMessage(world: World, room: Room, gameState: GameState): GameMessage {
	const roomState = gameState.roomStates.find((state) => compareIds(state.id, room.id));
	const hasVisited = roomState?.flags.visited ?? false;
	const name = roomState?.name ?? room.name;
	const description = hasVisited
		? (roomState?.shortDescription ?? (room.shortDescription || room.description))
		: (roomState?.description ?? room.description);
	let text = `${name}\n${description}\n`;

	for (const feature of room.features ?? []) {
		if (feature.listedInRoom) {
			text += `${feature.description}\n`;
		}
	}

	return createGameMessage(`${text}\n`, "room", {roomId: room.id});
}
