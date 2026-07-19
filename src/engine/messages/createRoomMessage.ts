import type {Room, World} from "@/schemas/world/worldSchema";
import {idValue} from "@/utils/idUtils";
import type {GameState} from "@/schemas/states/gameStateSchema";
import {createGameMessage, type GameMessage} from "./createMessage";

export function createRoomMessage(world: World, room: Room, gameState: GameState): GameMessage {
	let text = `${room.name}\n${room.description}\n`;

	for (const feature of room.features ?? []) {
		if (feature.listedInRoom) {
			text += `${feature.description}\n`;
		}
	}

	return createGameMessage(`${text}\n`, "room", {roomId: idValue(room.id)});
}
