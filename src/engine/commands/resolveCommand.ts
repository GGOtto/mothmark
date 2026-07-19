import type {Direction, World} from "@/schemas/world/worldSchema";
import type {GameState} from "../states/createInitialState";
import {createGameMessage} from "../messages/createMessage";
import {movePlayer} from "../player/move";
import {lookAtRoom} from "../states/changeStates";
import {
	formatTargetWithArticle,
	normalizeInput,
	parseCommandConnectors,
	parseInputWithAlias,
	type ParsedCommand,
} from "./parse";

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
	up: "up",
	u: "up",
	down: "down",
	d: "down",
	in: "in",
	enter: "in",
	out: "out",
	exit: "out",
};

export type CommandContext = {
	world: World;
	gameState: GameState;
	rawCommand: string;
	input: string;
	parsed: ParsedCommand;
	commands: CommandDefinition[];
};

export type CommandDefinition = {
	name: string;
	aliases: string[];
	description?: string;
	connectors?: string[];
	customMatch?: (input: string) => ParsedCommand | null;
	run: (context: CommandContext) => GameState;
};

function addSystemMessage(gameState: GameState, text: string): GameState {
	return {
		...gameState,
		messages: [...gameState.messages, createGameMessage(text, "system")],
	};
}

export function buildHelpText(commandList: CommandDefinition[]): string {
	return commandList
		.filter((command) => command.description)
		.map((command) => {
			const aliases = command.aliases.length ? ` (${command.aliases.join(", ")})` : "";
			return `${command.name}${aliases}: ${command.description}`;
		})
		.join("\n");
}

export const commands: CommandDefinition[] = [
	{
		name: "look",
		aliases: ["look", "l"],
		description: "Look around the current room.",
		run: ({world, gameState}) => lookAtRoom(world, gameState),
	},
	{
		name: "examine",
		aliases: ["examine", "inspect", "look at", "x"],
		description: "Examine something more closely.",
		connectors: ["in front of"],
		run: ({gameState, parsed}) => {
			if (!parsed.targetText) return addSystemMessage(gameState, "Examine what?");
			if (parsed.connector) {
				return addSystemMessage(
					gameState,
					`You examine ${formatTargetWithArticle(parsed.connector.left)} ${parsed.connector.connector} ${formatTargetWithArticle(parsed.connector.right)}.`,
				);
			}
			return addSystemMessage(gameState, `You examine ${formatTargetWithArticle(parsed.targetText)}.`);
		},
	},
	{
		name: "take",
		aliases: ["take", "get", "pick up"],
		description: "Take an item.",
		run: ({gameState, parsed}) =>
			parsed.targetText
				? addSystemMessage(gameState, `You take ${formatTargetWithArticle(parsed.targetText)}.`)
				: addSystemMessage(gameState, "Take what?"),
	},
	{
		name: "use",
		aliases: ["use"],
		description: "Use an item, optionally on something else.",
		connectors: ["on", "with"],
		run: ({gameState, parsed}) => {
			if (!parsed.targetText) return addSystemMessage(gameState, "Use what?");
			if (parsed.connector) {
				return addSystemMessage(
					gameState,
					`You use ${formatTargetWithArticle(parsed.connector.left)} ${parsed.connector.connector} ${formatTargetWithArticle(parsed.connector.right)}.`,
				);
			}
			return addSystemMessage(gameState, `You use ${formatTargetWithArticle(parsed.targetText)}.`);
		},
	},
	{
		name: "put",
		aliases: ["put", "place", "set"],
		description: "Put something somewhere.",
		connectors: ["in", "into", "on"],
		run: ({gameState, parsed}) => {
			if (!parsed.targetText) return addSystemMessage(gameState, "Put what?");
			if (!parsed.connector) return addSystemMessage(gameState, "Put it where?");
			return addSystemMessage(
				gameState,
				`You put ${formatTargetWithArticle(parsed.connector.left)} ${parsed.connector.connector} ${formatTargetWithArticle(parsed.connector.right)}.`,
			);
		},
	},
	{
		name: "give",
		aliases: ["give", "hand", "hand over"],
		description: "Give something to someone.",
		connectors: ["to"],
		run: ({gameState, parsed}) => {
			if (!parsed.targetText) return addSystemMessage(gameState, "Give what?");
			if (!parsed.connector) return addSystemMessage(gameState, "Give it to whom?");
			return addSystemMessage(
				gameState,
				`You give ${formatTargetWithArticle(parsed.connector.left)} to ${formatTargetWithArticle(parsed.connector.right)}.`,
			);
		},
	},
	{
		name: "unlock",
		aliases: ["unlock", "open"],
		description: "Unlock something with an item.",
		connectors: ["with"],
		run: ({gameState, parsed}) => {
			if (!parsed.targetText) return addSystemMessage(gameState, "Unlock what?");
			if (!parsed.connector) return addSystemMessage(gameState, "Unlock it with what?");
			return addSystemMessage(
				gameState,
				`You unlock ${formatTargetWithArticle(parsed.connector.left)} with ${formatTargetWithArticle(parsed.connector.right)}.`,
			);
		},
	},
	{
		name: "go",
		aliases: ["go", "walk", "move", "go to"],
		description: "Move in a direction.",
		customMatch: (input) =>
			DIRECTION_ALIASES[input] ? {input, matchedAlias: input, targetText: input} : null,
		run: ({world, gameState, parsed}) => {
			const direction = DIRECTION_ALIASES[parsed.targetText];
			return direction
				? movePlayer(world, gameState, direction)
				: addSystemMessage(gameState, "Go where?");
		},
	},
	{
		name: "help",
		aliases: ["help", "h", "?"],
		description: "Show available commands.",
		run: ({gameState, commands: commandList}) =>
			addSystemMessage(gameState, buildHelpText(commandList)),
	},
];

export function findCommand(
	input: string,
	commandList: CommandDefinition[] = commands,
): {command: CommandDefinition; parsed: ParsedCommand} | null {
	const normalizedInput = normalizeInput(input);

	for (const command of commandList) {
		const customParsed = command.customMatch?.(normalizedInput);
		if (customParsed)
			return {command, parsed: parseCommandConnectors(customParsed, command.connectors)};
	}

	const aliasMatches = commandList
		.flatMap((command) => command.aliases.map((alias) => ({command, alias})))
		.sort((a, b) => normalizeInput(b.alias).length - normalizeInput(a.alias).length);

	for (const {command, alias} of aliasMatches) {
		const parsed = parseInputWithAlias(normalizedInput, alias);
		if (parsed) return {command, parsed: parseCommandConnectors(parsed, command.connectors)};
	}

	return null;
}
