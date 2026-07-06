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

const OPTIONAL_LEADING_ARTICLES = new Set(["a", "an", "the"]);

export type ParsedConnector = {
	connector: string;
	left: string;
	right: string;
};

export type ParsedCommand = {
	input: string;
	matchedAlias: string;
	targetText: string;
	connector?: ParsedConnector;
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

export type NamedThing = {
	name: string;
	aliases?: string[];
};

function addCommandMessage(gameState: GameState, command: string): GameState {
	return {
		...gameState,
		messages: [...gameState.messages, createGameMessage(command, "command")],
	};
}

function addSystemMessage(gameState: GameState, text: string): GameState {
	return {
		...gameState,
		messages: [...gameState.messages, createGameMessage(text, "system")],
	};
}

export function normalizeInput(input: string): string {
	return input.trim().toLowerCase().replace(/\s+/g, " ");
}

function stripLeadingArticle(input: string): string {
	const words = normalizeInput(input).split(" ");

	if (words.length <= 1) {
		return words.join(" ");
	}

	const [firstWord, ...remainingWords] = words;

	if (!OPTIONAL_LEADING_ARTICLES.has(firstWord)) {
		return words.join(" ");
	}

	return remainingWords.join(" ");
}

export function getPhraseMatchKeys(input: string): string[] {
	const normalizedInput = normalizeInput(input);
	const withoutLeadingArticle = stripLeadingArticle(normalizedInput);

	return Array.from(new Set([normalizedInput, withoutLeadingArticle]));
}

export function phraseMatches(left: string, right: string): boolean {
	const leftKeys = getPhraseMatchKeys(left);
	const rightKeys = getPhraseMatchKeys(right);

	return leftKeys.some((leftKey) => rightKeys.includes(leftKey));
}

export function namedThingMatchesText(thing: NamedThing, targetText: string): boolean {
	const possibleNames = [thing.name, ...(thing.aliases ?? [])];

	return possibleNames.some((possibleName) => phraseMatches(possibleName, targetText));
}

function startsWithPhrase(input: string, phrase: string): boolean {
	return input === phrase || input.startsWith(`${phrase} `);
}

function unwrapQuotedPhrase(input: string): string {
	const trimmedInput = input.trim();

	const startsWithDoubleQuote = trimmedInput.startsWith('"');
	const endsWithDoubleQuote = trimmedInput.endsWith('"');

	const startsWithSingleQuote = trimmedInput.startsWith("'");
	const endsWithSingleQuote = trimmedInput.endsWith("'");

	if (
		trimmedInput.length >= 2 &&
		((startsWithDoubleQuote && endsWithDoubleQuote) || (startsWithSingleQuote && endsWithSingleQuote))
	) {
		return trimmedInput.slice(1, -1).trim();
	}

	return trimmedInput;
}

function normalizeTargetText(input: string): string {
	return unwrapQuotedPhrase(normalizeInput(input));
}

function formatTargetWithArticle(targetText: string): string {
	const normalizedTargetText = normalizeTargetText(targetText);
	const firstWord = normalizedTargetText.split(" ")[0];

	if (OPTIONAL_LEADING_ARTICLES.has(firstWord)) {
		return normalizedTargetText;
	}

	return `the ${normalizedTargetText}`;
}

export function parseInputWithAlias(input: string, alias: string): ParsedCommand | null {
	const normalizedInput = normalizeInput(input);
	const normalizedAlias = normalizeInput(alias);

	if (!startsWithPhrase(normalizedInput, normalizedAlias)) {
		return null;
	}

	const targetText = normalizeTargetText(normalizedInput.slice(normalizedAlias.length));

	return {
		input: normalizedInput,
		matchedAlias: normalizedAlias,
		targetText,
	};
}

function sortConnectorsLongestFirst(connectors: string[]): string[] {
	return [...connectors].sort((a, b) => normalizeInput(b).length - normalizeInput(a).length);
}

function splitTargetByConnector(targetText: string, connector: string): ParsedConnector | null {
	const normalizedTargetText = normalizeTargetText(targetText);
	const normalizedConnector = normalizeInput(connector);
	const connectorWithSpaces = ` ${normalizedConnector} `;
	const connectorIndex = normalizedTargetText.indexOf(connectorWithSpaces);

	if (connectorIndex === -1) {
		return null;
	}

	const left = normalizeTargetText(normalizedTargetText.slice(0, connectorIndex));
	const right = normalizeTargetText(
		normalizedTargetText.slice(connectorIndex + connectorWithSpaces.length),
	);

	if (!left || !right) {
		return null;
	}

	return {
		connector: normalizedConnector,
		left,
		right,
	};
}

function parseCommandConnectors(
	parsed: ParsedCommand,
	connectors: string[] | undefined,
): ParsedCommand {
	if (!connectors?.length || !parsed.targetText) {
		return parsed;
	}

	const sortedConnectors = sortConnectorsLongestFirst(connectors);

	for (const connector of sortedConnectors) {
		const parsedConnector = splitTargetByConnector(parsed.targetText, connector);

		if (parsedConnector) {
			return {
				...parsed,
				connector: parsedConnector,
			};
		}
	}

	return parsed;
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

const commands: CommandDefinition[] = [
	{
		name: "look",
		aliases: ["look", "l"],
		description: "Look around the current room.",
		run: ({world, gameState}) => {
			return lookAtRoom(world, gameState);
		},
	},
	{
		name: "examine",
		aliases: ["examine", "inspect", "look at", "x"],
		description: "Examine something more closely.",
		connectors: ["in front of"],
		run: ({gameState, parsed}) => {
			const targetText = parsed.targetText;

			if (!targetText) {
				return addSystemMessage(gameState, "Examine what?");
			}

			if (parsed.connector) {
				// TODO: Resolve parsed.connector.left and parsed.connector.right against visible room things.
				return addSystemMessage(
					gameState,
					`You examine ${formatTargetWithArticle(parsed.connector.left)} ${parsed.connector.connector} ${formatTargetWithArticle(parsed.connector.right)}.`,
				);
			}

			// TODO: Resolve targetText against visible room items, inventory items, NPCs, and scenery.
			return addSystemMessage(gameState, `You examine ${formatTargetWithArticle(targetText)}.`);
		},
	},
	{
		name: "take",
		aliases: ["take", "get", "pick up"],
		description: "Take an item.",
		run: ({gameState, parsed}) => {
			const targetText = parsed.targetText;

			if (!targetText) {
				return addSystemMessage(gameState, "Take what?");
			}

			// TODO: Resolve targetText against takeable room items and move the resolved item into inventory.
			return addSystemMessage(gameState, `You take ${formatTargetWithArticle(targetText)}.`);
		},
	},
	{
		name: "use",
		aliases: ["use"],
		description: "Use an item, optionally on something else.",
		connectors: ["on", "with"],
		run: ({gameState, parsed}) => {
			const targetText = parsed.targetText;

			if (!targetText) {
				return addSystemMessage(gameState, "Use what?");
			}

			if (parsed.connector) {
				// TODO: Resolve parsed.connector.left and parsed.connector.right into game objects before applying use behavior.
				return addSystemMessage(
					gameState,
					`You use ${formatTargetWithArticle(parsed.connector.left)} ${parsed.connector.connector} ${formatTargetWithArticle(parsed.connector.right)}.`,
				);
			}

			// TODO: Resolve targetText into a usable item or visible object.
			return addSystemMessage(gameState, `You use ${formatTargetWithArticle(targetText)}.`);
		},
	},
	{
		name: "put",
		aliases: ["put", "place", "set"],
		description: "Put something somewhere.",
		connectors: ["in", "into", "on"],
		run: ({gameState, parsed}) => {
			const targetText = parsed.targetText;

			if (!targetText) {
				return addSystemMessage(gameState, "Put what?");
			}

			if (!parsed.connector) {
				return addSystemMessage(gameState, "Put it where?");
			}

			// TODO: Resolve parsed.connector.left as an inventory item and parsed.connector.right as a destination/container/surface.
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
			const targetText = parsed.targetText;

			if (!targetText) {
				return addSystemMessage(gameState, "Give what?");
			}

			if (!parsed.connector) {
				return addSystemMessage(gameState, "Give it to whom?");
			}

			// TODO: Resolve parsed.connector.left as an inventory item and parsed.connector.right as an NPC or recipient.
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
			const targetText = parsed.targetText;

			if (!targetText) {
				return addSystemMessage(gameState, "Unlock what?");
			}

			if (!parsed.connector) {
				return addSystemMessage(gameState, "Unlock it with what?");
			}

			// TODO: Resolve parsed.connector.left as a lockable object and parsed.connector.right as a key/tool.
			return addSystemMessage(
				gameState,
				`You unlock ${formatTargetWithArticle(parsed.connector.left)} with ${formatTargetWithArticle(parsed.connector.right)}.`,
			);
		},
	},
	{
		name: "go",
		aliases: ["go", "walk", "move"],
		description: "Move in a direction.",
		customMatch: (input) => {
			const direction = DIRECTION_ALIASES[input];

			if (!direction) {
				return null;
			}

			return {
				input,
				matchedAlias: input,
				targetText: input,
			};
		},
		run: ({world, gameState, parsed}) => {
			const direction = DIRECTION_ALIASES[parsed.targetText];

			if (!direction) {
				return addSystemMessage(gameState, "Go where?");
			}

			return movePlayer(world, gameState, direction);
		},
	},
	{
		name: "help",
		aliases: ["help", "h", "?"],
		description: "Show available commands.",
		run: ({gameState, commands}) => {
			return addSystemMessage(gameState, buildHelpText(commands));
		},
	},
];

export function findCommand(
	input: string,
	commandList: CommandDefinition[] = commands,
): {command: CommandDefinition; parsed: ParsedCommand} | null {
	const normalizedInput = normalizeInput(input);

	for (const command of commandList) {
		const customParsed = command.customMatch?.(normalizedInput);

		if (customParsed) {
			return {
				command,
				parsed: parseCommandConnectors(customParsed, command.connectors),
			};
		}
	}

	const aliasMatches = commandList.flatMap((command) =>
		command.aliases.map((alias) => ({
			command,
			alias,
		})),
	);

	const sortedAliasMatches = aliasMatches.sort(
		(a, b) => normalizeInput(b.alias).length - normalizeInput(a.alias).length,
	);

	for (const {command, alias} of sortedAliasMatches) {
		const parsed = parseInputWithAlias(normalizedInput, alias);

		if (parsed) {
			return {
				command,
				parsed: parseCommandConnectors(parsed, command.connectors),
			};
		}
	}

	return null;
}

export function runCommand(
	world: World,
	gameState: GameState,
	rawCommand: string,
	commandList: CommandDefinition[] = commands,
): GameState {
	const input = normalizeInput(rawCommand);

	if (!input) return gameState;

	const stateWithCommand = addCommandMessage(gameState, rawCommand);
	const match = findCommand(input, commandList);

	if (!match) {
		return addSystemMessage(stateWithCommand, "I don't understand that command.");
	}

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
