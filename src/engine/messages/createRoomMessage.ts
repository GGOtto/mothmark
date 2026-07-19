import type {Room, World} from "@/schemas/world/worldSchema";
import {idValue} from "@/utils/idUtils";
import type {GameState} from "@/schemas/states/gameStateSchema";
import {createGameMessage, type GameMessage} from "./createMessage";

export function createRoomMessage(world: World, room: Room, gameState: GameState): GameMessage {
	const hasVisited = gameState.roomStates.some(
		(roomState) => idValue(roomState.roomId) === idValue(room.id) && roomState.visited,
	);
	const description =
		hasVisited && room.shortDescription ? room.shortDescription : room.description.default;
	let text = `${room.name}\n${description}\n`;

	for (const feature of room.features ?? []) {
		if (feature.listedInRoom) {
			text += `${feature.description.default}\n`;
		}
	}

	return createGameMessage(`${text}\n`, "room", {roomId: idValue(room.id)});
}
