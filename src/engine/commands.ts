import type {Direction, World} from "@/schemas/worldSchema";
import type {GameState} from "./gameState";
import {createGameMessage} from "./gameState";
import {movePlayer} from "./movement";
import {lookAtRoom} from "./rooms";

const DIRECTION_ALIASES: Record<string, Direction> = {
	n: "n",
	north: "n",
	ne: "ne",
	northeast: "ne",
	e: "e",
	east: "e",
	se: "se",
	southeast: "se",
	s: "s",
	south: "s",
	sw: "sw",
	southwest: "sw",
	w: "w",
	west: "w",
	nw: "nw",
	northwest: "nw",
};

function addCommandMessage(gameState: GameState, command: string): GameState {
	return {
		...gameState,
		messages: [...gameState.messages, createGameMessage(`> ${command}`, "command")],
	};
}

function addSystemMessage(gameState: GameState, text: string): GameState {
	return {
		...gameState,
		messages: [...gameState.messages, createGameMessage(text, "system")],
	};
}

export function runCommand(world: World, gameState: GameState, rawCommand: string): GameState {
	const command = rawCommand.trim().toLowerCase();

	if (!command) return gameState;

	const stateWithCommand = addCommandMessage(gameState, rawCommand);

	if (command === "look" || command === "l") {
		return lookAtRoom(world, stateWithCommand);
	}

	const direction = DIRECTION_ALIASES[command];

	if (direction) {
		return movePlayer(world, stateWithCommand, direction);
	}

	if (command.startsWith("go ")) {
		const requestedDirection = command.slice(3);
		const goDirection = DIRECTION_ALIASES[requestedDirection];

		if (goDirection) {
			return movePlayer(world, stateWithCommand, goDirection);
		}
	}

	return addSystemMessage(stateWithCommand, "I don't understand that command."); // TODO: add these to world data
}
