import {produce} from "immer";
import type {World} from "@/schemas/world/worldSchema";
import type {GameState} from "@/schemas/states/gameStateSchemas";
import {createGameMessage} from "../messages/createMessage";
import {normalizeInput} from "./parse";
import {commands, findCommand, type CommandContext, type CommandDefinition} from "./resolveCommand";

function addMessage(gameState: GameState, text: string, type: "command" | "system"): GameState {
	return produce(gameState, (draft) => {
		draft.messages.push(createGameMessage(text, type));
	});
}

export function runCommand(
	world: World,
	game: GameState,
	rawCommand: string,
	commandList: CommandDefinition[] = commands,
): GameState {
	return produce(game, () => {
		const input = normalizeInput(rawCommand);
		if (!input) return game;

		const match = findCommand(input, commandList);

		if (!match) return addMessage(game, "I don't understand that command.", "system");

		const context: CommandContext = {
			world,
			gameState: game,
			rawCommand,
			input,
			parsed: match.parsed,
			commands: commandList,
		};

		return match.command.run(context);
	});
}
