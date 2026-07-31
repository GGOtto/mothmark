import type {GameState} from "@/schemas/states/gameStateSchemas";
import type {World} from "@/schemas/world/worldSchema";
import {addMessage} from "../messages/createRoomMessage";
import {findMatchingCommands} from "./parse";
import type {Command} from "@/schemas/world/commandSchemas";
import {getHigherPriorityCommand} from "./getHigherPriorityCommand";

export function runCommand(text: string, world: World, game: GameState): GameState {
	const matchedCommands = findMatchingCommands(text, world, game);
	let chosenCommand: Command | null = null;

	if (matchedCommands.length === 0) {
		return addMessage(game, "I don't know what that means.", "error");
	}

	if (matchedCommands.length === 1) {
		chosenCommand = matchedCommands[0];
	} else {
		for (let i = 0; i < matchedCommands.length - 1; i++) {
			chosenCommand = getHigherPriorityCommand(matchedCommands[i], matchedCommands[i + 1]);
		}
	}

	if (chosenCommand === null) {
		throw Error("At least one command was resolved, but none were chosen.");
	}

	return addMessage(game, String(JSON.stringify(chosenCommand.patterns)), "system");
}
