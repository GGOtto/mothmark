import type {World} from "@/schemas/world/worldSchema";
import {createGameMessage} from "../messages/createMessage";
import type {GameState} from "../states/createInitialState";
import {normalizeInput} from "./parse";
import {commands, findCommand, type CommandContext, type CommandDefinition} from "./resolveCommand";

function addMessage(gameState: GameState, text: string, type: "command" | "system"): GameState {
	return {...gameState, messages: [...gameState.messages, createGameMessage(text, type)]};
}

export function runCommand(
	world: World,
	gameState: GameState,
	rawCommand: string,
	commandList: CommandDefinition[] = commands,
): GameState {
	const input = normalizeInput(rawCommand);
	if (!input) return gameState;

	const stateWithCommand = addMessage(gameState, rawCommand, "command");
	const match = findCommand(input, commandList);

	if (!match) return addMessage(stateWithCommand, "I don't understand that command.", "system");

	const context: CommandContext = {
		world,
		gameState: stateWithCommand,
		rawCommand,
		input,
		parsed: match.parsed,
		commands: commandList,
	};

	return match.command.run(context);
}
