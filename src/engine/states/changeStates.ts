import {produce} from "immer";
import type {GameState} from "@/schemas/states/gameStateSchema";
import type {World} from "@/schemas/world/worldSchema";
import {createRoomMessage} from "../messages/createRoomMessage";
import {getRoom} from "../utils/worldLookupUtils";

export function lookAtRoom(world: World, game: GameState): GameState {
	const room = getRoom(world, game.currentRoom);
	const roomMessage = createRoomMessage(world, room, game);

	return produce(game, (draft) => {
		draft.messages.push(roomMessage);
	});
}
