import type {GameState} from "@/schemas/states/gameStateSchemas";
import type {World} from "@/schemas/world/worldSchema";
import {addMessage} from "../messages/createRoomMessage";
import {findMatchingCommands} from "./parse";

export function runCommand(text: string, world: World, game: GameState): GameState {
	const matchedCommands = findMatchingCommands(text, world, game);
	if (matchedCommands.length > 0) {
		return addMessage(
			game,
			String(matchedCommands.map((command) => JSON.stringify(command.patterns))),
			"system",
		);
	}
	return addMessage(game, "I don't know what that means.", "error");
}
