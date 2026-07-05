import type {World} from "@/schemas/worldSchema";
import type {GameState} from "./gameState";
import {
	buildHelpText,
	findCommand,
	getPhraseMatchKeys,
	namedThingMatchesText,
	normalizeInput,
	parseInputWithAlias,
	phraseMatches,
	runCommand,
	type CommandDefinition,
} from "./commands";
import {movePlayer} from "./movement";
import {lookAtRoom} from "./rooms";

jest.mock("./gameState", () => ({
	createGameMessage: jest.fn((text: string, type: string) => ({
		id: `${type}-${text}`,
		text,
		type,
	})),
}));

jest.mock("./movement", () => ({
	movePlayer: jest.fn((world: World, gameState: GameState, direction: string) => ({
		...gameState,
		currentRoomId: `moved-${direction}`,
		messages: [
			...gameState.messages,
			{
				id: `system-moved-${direction}`,
				text: `Moved ${direction}.`,
				type: "system",
			},
		],
	})),
}));

jest.mock("./rooms", () => ({
	lookAtRoom: jest.fn((world: World, gameState: GameState) => ({
		...gameState,
		messages: [
			...gameState.messages,
			{
				id: "system-look",
				text: "Looked around.",
				type: "system",
			},
		],
	})),
}));

function createWorld(): World {
	return {
		rooms: [],
		connections: [],
	} as unknown as World;
}

function createGameState(): GameState {
	return {
		currentRoomId: "start",
		messages: [],
	} as unknown as GameState;
}

function getMessageTexts(gameState: GameState): string[] {
	return gameState.messages.map((message: {text: string}) => message.text);
}

function createHelpCommand(): CommandDefinition {
	return {
		name: "help",
		aliases: ["help"],
		description: "Show available commands.",
		run: ({gameState, commands}) => ({
			...gameState,
			messages: [
				...gameState.messages,
				{
					id: "system-test-help",
					text: buildHelpText(commands),
					type: "system",
				},
			],
		}),
	};
}

describe("normalizeInput", () => {
	it("trims, lowercases, and collapses whitespace", () => {
		expect(normalizeInput("  Pick   Up   THE Brass   Key  ")).toBe("pick up the brass key");
	});
});

describe("parseInputWithAlias", () => {
	it("matches a single-word alias and preserves the rest as target text", () => {
		expect(parseInputWithAlias("take brass key", "take")).toEqual({
			input: "take brass key",
			matchedAlias: "take",
			targetText: "brass key",
		});
	});

	it("matches a multi-word alias and preserves the rest as target text", () => {
		expect(parseInputWithAlias("pick up brass key", "pick up")).toEqual({
			input: "pick up brass key",
			matchedAlias: "pick up",
			targetText: "brass key",
		});
	});

	it("does not match an alias inside a larger word", () => {
		expect(parseInputWithAlias("gold key", "go")).toBeNull();
	});

	it("unwraps quoted target text", () => {
		expect(parseInputWithAlias('take "brass key"', "take")).toEqual({
			input: 'take "brass key"',
			matchedAlias: "take",
			targetText: "brass key",
		});
	});
});

describe("phrase matching", () => {
	it("matches phrases exactly after normalization", () => {
		expect(phraseMatches("Brass   Key", "brass key")).toBe(true);
	});

	it("treats leading articles as optional", () => {
		expect(phraseMatches("the brass key", "brass key")).toBe(true);
		expect(phraseMatches("brass key", "the brass key")).toBe(true);
		expect(phraseMatches("a brass key", "brass key")).toBe(true);
	});

	it("does not strip articles from the middle of a phrase", () => {
		expect(getPhraseMatchKeys("book of the dead")).toEqual(["book of the dead"]);
		expect(phraseMatches("book of the dead", "book of dead")).toBe(false);
	});

	it("preserves author aliases that include leading articles", () => {
		const thing = {
			name: "Brass Key",
			aliases: ["the brass key"],
		};

		expect(namedThingMatchesText(thing, "the brass key")).toBe(true);
		expect(namedThingMatchesText(thing, "brass key")).toBe(true);
	});

	it("matches against aliases", () => {
		const thing = {
			name: "Brass Key",
			aliases: ["small key", "old key"],
		};

		expect(namedThingMatchesText(thing, "the small key")).toBe(true);
		expect(namedThingMatchesText(thing, "old key")).toBe(true);
		expect(namedThingMatchesText(thing, "silver key")).toBe(false);
	});
});

describe("findCommand", () => {
	it("finds look", () => {
		const match = findCommand("look");

		expect(match?.command.name).toBe("look");
		expect(match?.parsed).toEqual({
			input: "look",
			matchedAlias: "look",
			targetText: "",
		});
	});

	it("finds a look alias", () => {
		const match = findCommand("l");

		expect(match?.command.name).toBe("look");
		expect(match?.parsed.matchedAlias).toBe("l");
	});

	it("matches the longest alias globally", () => {
		const match = findCommand("look at old wooden door");

		expect(match?.command.name).toBe("examine");
		expect(match?.parsed).toEqual({
			input: "look at old wooden door",
			matchedAlias: "look at",
			targetText: "old wooden door",
		});
	});

	it("matches the longest alias first for item commands", () => {
		const match = findCommand("pick up brass key");

		expect(match?.command.name).toBe("take");
		expect(match?.parsed).toEqual({
			input: "pick up brass key",
			matchedAlias: "pick up",
			targetText: "brass key",
		});
	});

	it("supports direction-only movement commands", () => {
		const match = findCommand("north");

		expect(match?.command.name).toBe("go");
		expect(match?.parsed).toEqual({
			input: "north",
			matchedAlias: "north",
			targetText: "north",
		});
	});

	it("supports go direction movement commands", () => {
		const match = findCommand("go north");

		expect(match?.command.name).toBe("go");
		expect(match?.parsed).toEqual({
			input: "go north",
			matchedAlias: "go",
			targetText: "north",
		});
	});

	it("parses command-defined connectors", () => {
		const match = findCommand("use brass key on old wooden door");

		expect(match?.command.name).toBe("use");
		expect(match?.parsed).toEqual({
			input: "use brass key on old wooden door",
			matchedAlias: "use",
			targetText: "brass key on old wooden door",
			connector: {
				connector: "on",
				left: "brass key",
				right: "old wooden door",
			},
		});
	});

	it("does not parse connectors for commands that do not define them", () => {
		const testCommands: CommandDefinition[] = [
			{
				name: "examine",
				aliases: ["examine"],
				run: ({gameState}) => gameState,
			},
		];

		const match = findCommand("examine brass key on table", testCommands);

		expect(match?.command.name).toBe("examine");
		expect(match?.parsed).toEqual({
			input: "examine brass key on table",
			matchedAlias: "examine",
			targetText: "brass key on table",
		});
	});

	it("returns null for unknown commands", () => {
		expect(findCommand("dance wildly")).toBeNull();
	});

	it("handles commands with multiple connector aliases", () => {
		const match = findCommand("use brass key with old wooden door");

		expect(match?.command.name).toBe("use");
		expect(match?.parsed).toEqual({
			input: "use brass key with old wooden door",
			matchedAlias: "use",
			targetText: "brass key with old wooden door",
			connector: {
				connector: "with",
				left: "brass key",
				right: "old wooden door",
			},
		});
	});

	it("handles multi-word connectors such as in front of", () => {
		const match = findCommand("look at statue in front of fireplace");

		expect(match?.command.name).toBe("examine");
		expect(match?.parsed).toEqual({
			input: "look at statue in front of fireplace",
			matchedAlias: "look at",
			targetText: "statue in front of fireplace",
			connector: {
				connector: "in front of",
				left: "statue",
				right: "fireplace",
			},
		});
	});

	it("handles repeated connector words inside object names", () => {
		const match = findCommand("use brass key on door on north wall");

		expect(match?.command.name).toBe("use");
		expect(match?.parsed).toEqual({
			input: "use brass key on door on north wall",
			matchedAlias: "use",
			targetText: "brass key on door on north wall",
			connector: {
				connector: "on",
				left: "brass key",
				right: "door on north wall",
			},
		});
	});

	it("supports commands like put coin in fountain", () => {
		const match = findCommand("put silver coin in stone fountain");

		expect(match?.command.name).toBe("put");
		expect(match?.parsed).toEqual({
			input: "put silver coin in stone fountain",
			matchedAlias: "put",
			targetText: "silver coin in stone fountain",
			connector: {
				connector: "in",
				left: "silver coin",
				right: "stone fountain",
			},
		});
	});

	it("supports commands like give apple to old woman", () => {
		const match = findCommand("give red apple to old woman");

		expect(match?.command.name).toBe("give");
		expect(match?.parsed).toEqual({
			input: "give red apple to old woman",
			matchedAlias: "give",
			targetText: "red apple to old woman",
			connector: {
				connector: "to",
				left: "red apple",
				right: "old woman",
			},
		});
	});

	it("supports commands like unlock door with brass key", () => {
		const match = findCommand("unlock old wooden door with brass key");

		expect(match?.command.name).toBe("unlock");
		expect(match?.parsed).toEqual({
			input: "unlock old wooden door with brass key",
			matchedAlias: "unlock",
			targetText: "old wooden door with brass key",
			connector: {
				connector: "with",
				left: "old wooden door",
				right: "brass key",
			},
		});
	});
});

describe("runCommand", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("ignores empty commands", () => {
		const world = createWorld();
		const gameState = createGameState();

		const result = runCommand(world, gameState, "   ");

		expect(result).toBe(gameState);
		expect(getMessageTexts(result)).toEqual([]);
	});

	it("adds the raw player command to the log", () => {
		const world = createWorld();
		const gameState = createGameState();

		const result = runCommand(world, gameState, "Pick Up Brass Key");

		expect(getMessageTexts(result)[0]).toBe("> Pick Up Brass Key");
	});

	it("runs look", () => {
		const world = createWorld();
		const gameState = createGameState();

		const result = runCommand(world, gameState, "look");

		expect(lookAtRoom).toHaveBeenCalledWith(world, expect.any(Object));
		expect(getMessageTexts(result)).toEqual(["> look", "Looked around."]);
	});

	it("runs examine with a multi-word target", () => {
		const world = createWorld();
		const gameState = createGameState();

		const result = runCommand(world, gameState, "examine old wooden door");

		expect(getMessageTexts(result)).toEqual([
			"> examine old wooden door",
			"You examine the old wooden door.",
		]);
	});

	it("runs take with a multi-word target", () => {
		const world = createWorld();
		const gameState = createGameState();

		const result = runCommand(world, gameState, "pick up the brass key");

		expect(getMessageTexts(result)).toEqual(["> pick up the brass key", "You take the brass key."]);
	});

	it("runs use with one target", () => {
		const world = createWorld();
		const gameState = createGameState();

		const result = runCommand(world, gameState, "use brass key");

		expect(getMessageTexts(result)).toEqual(["> use brass key", "You use the brass key."]);
	});

	it("runs use with a connector target", () => {
		const world = createWorld();
		const gameState = createGameState();

		const result = runCommand(world, gameState, "use brass key on old wooden door");

		expect(getMessageTexts(result)).toEqual([
			"> use brass key on old wooden door",
			"You use the brass key on the old wooden door.",
		]);
	});

	it("runs direction-only movement", () => {
		const world = createWorld();
		const gameState = createGameState();

		const result = runCommand(world, gameState, "north");

		expect(movePlayer).toHaveBeenCalledWith(world, expect.any(Object), "n");
		expect(getMessageTexts(result)).toEqual(["> north", "Moved n."]);
	});

	it("runs go movement", () => {
		const world = createWorld();
		const gameState = createGameState();

		const result = runCommand(world, gameState, "go southwest");

		expect(movePlayer).toHaveBeenCalledWith(world, expect.any(Object), "sw");
		expect(getMessageTexts(result)).toEqual(["> go southwest", "Moved sw."]);
	});

	it("shows a fallback for unknown commands", () => {
		const world = createWorld();
		const gameState = createGameState();

		const result = runCommand(world, gameState, "sing at moon");

		expect(getMessageTexts(result)).toEqual(["> sing at moon", "I don't understand that command."]);
	});

	it("shows help text from the provided command list", () => {
		const world = createWorld();
		const gameState = createGameState();

		const testCommands: CommandDefinition[] = [
			{
				name: "test-one",
				aliases: ["test-one", "one"],
				description: "First test command.",
				run: ({gameState}) => gameState,
			},
			{
				name: "test-two",
				aliases: ["test-two", "two words"],
				description: "Second test command.",
				run: ({gameState}) => gameState,
			},
			{
				name: "hidden-test",
				aliases: ["hidden-test"],
				run: ({gameState}) => gameState,
			},
			createHelpCommand(),
		];

		const result = runCommand(world, gameState, "help", testCommands);

		expect(getMessageTexts(result)).toEqual([
			"> help",
			[
				"test-one (test-one, one): First test command.",
				"test-two (test-two, two words): Second test command.",
				"help (help): Show available commands.",
			].join("\n"),
		]);
	});

	it("avoids duplicated articles in display text like the the brass key", () => {
		const world = createWorld();
		const gameState = createGameState();

		const result = runCommand(world, gameState, "take the brass key");

		expect(getMessageTexts(result)).toEqual(["> take the brass key", "You take the brass key."]);
	});
});

describe("future parser behavior", () => {
	it("handles ambiguous item names", () => {
		const brassKey = {
			name: "Brass Key",
			aliases: ["key"],
		};

		const silverKey = {
			name: "Silver Key",
			aliases: ["key"],
		};

		const matches = [brassKey, silverKey].filter((thing) => namedThingMatchesText(thing, "key"));

		expect(matches).toHaveLength(2);
		expect(matches.map((thing) => thing.name)).toEqual(["Brass Key", "Silver Key"]);
	});

	it.todo("resolves take targets against actual room items");
	it.todo("resolves examine targets against visible items, scenery, NPCs, and inventory");
	it.todo("resolves use targets against inventory and visible objects");
});
