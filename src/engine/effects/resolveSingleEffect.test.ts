import {GameStateSchema, type GameMessage, type GameState} from "@/schemas/states/gameStateSchemas";
import type {Effect} from "@/schemas/world/effectSchema";
import {choose} from "@/utils/choose";
import {appendLastMessage, createGameMessage} from "../messages/createMessage";
import {
	resolveCounterEffect,
	resolveFeatureEffect,
	resolveFlagEffect,
	resolveMessageEffect,
	resolveRoomEffect,
} from "./resolveSingleEffect";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";

jest.mock("@/utils/choose", () => ({
	choose: jest.fn(),
}));

jest.mock("../messages/createMessage", () => ({
	createGameMessage: jest.fn(),
	appendLastMessage: jest.fn(),
}));

const mockedChoose = jest.mocked(choose);
const mockedCreateGameMessage = jest.mocked(createGameMessage);
const mockedAppendLastMessage = jest.mocked(appendLastMessage);

function createGameState(overrides: Partial<GameState> = {}): GameState {
	const baseGame = createDefaultFieldObject(GameStateSchema);

	return {
		...baseGame,
		...overrides,
		variables: {
			...baseGame.variables,
			...overrides.variables,
		},
	};
}

describe("resolveMessageEffect", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("returns the original game for a non-message effect", () => {
		const game = createGameState();

		const effect = {
			type: "flag",
			operation: "set",
			flag: "door-open",
			value: true,
		} as Effect;

		const result = resolveMessageEffect(game, effect);

		expect(result).toBe(game);
		expect(mockedCreateGameMessage).not.toHaveBeenCalled();
		expect(mockedAppendLastMessage).not.toHaveBeenCalled();
	});

	it("creates and adds a system message for the show operation", () => {
		const game = createGameState();

		const createdMessage: GameMessage = {
			id: "message-1",
			text: "The door opens.",
			type: "system",
		};

		mockedCreateGameMessage.mockReturnValue(createdMessage);

		const effect = {
			type: "message",
			operation: "show",
			message: "The door opens.",
		} as Effect;

		const result = resolveMessageEffect(game, effect);

		expect(mockedCreateGameMessage).toHaveBeenCalledWith("The door opens.", "system");
		expect(result.messages).toEqual([createdMessage]);
		expect(game.messages).toEqual([]);
	});

	it("chooses and adds a random system message", () => {
		const game = createGameState();

		const messages = ["The room is quiet.", "You hear footsteps.", "A bell rings."];

		const createdMessage: GameMessage = {
			id: "message-1",
			text: "You hear footsteps.",
			type: "system",
		};

		mockedChoose.mockReturnValue("You hear footsteps.");
		mockedCreateGameMessage.mockReturnValue(createdMessage);

		const effect = {
			type: "message",
			operation: "random",
			messages,
		} as Effect;

		const result = resolveMessageEffect(game, effect);

		expect(mockedChoose).toHaveBeenCalledWith(messages);
		expect(mockedCreateGameMessage).toHaveBeenCalledWith("You hear footsteps.", "system");
		expect(result.messages).toEqual([createdMessage]);
		expect(game.messages).toEqual([]);
	});

	it("uses an empty string when choose returns undefined", () => {
		const game = createGameState();

		const createdMessage: GameMessage = {
			id: "message-1",
			text: "",
			type: "system",
		};

		mockedChoose.mockReturnValue(undefined as never);
		mockedCreateGameMessage.mockReturnValue(createdMessage);

		const effect = {
			type: "message",
			operation: "random",
			messages: ["Fallback"],
		} as Effect;

		const result = resolveMessageEffect(game, effect);

		expect(mockedCreateGameMessage).toHaveBeenCalledWith("", "system");
		expect(result.messages).toEqual([createdMessage]);
	});

	it("delegates append-last-message to appendLastMessage", () => {
		const game = createGameState({
			messages: [
				{
					id: "message-1",
					text: "Original",
					type: "system",
				},
			],
		});

		const appendedGame = createGameState({
			messages: [
				{
					id: "message-1",
					text: "Original updated",
					type: "system",
				},
			],
		});

		mockedAppendLastMessage.mockReturnValue(appendedGame);

		const effect = {
			type: "message",
			operation: "append-last-message",
			message: " updated",
			format: "inline",
		} as Effect;

		const result = resolveMessageEffect(game, effect);

		expect(mockedAppendLastMessage).toHaveBeenCalledWith(game, " updated", "inline");
		expect(result).toBe(appendedGame);
		expect(mockedCreateGameMessage).not.toHaveBeenCalled();
	});

	it("does not mutate existing messages", () => {
		const existingMessage: GameMessage = {
			id: "message-1",
			text: "Existing",
			type: "system",
		};

		const newMessage: GameMessage = {
			id: "message-2",
			text: "New",
			type: "system",
		};

		const game = createGameState({
			messages: [existingMessage],
		});

		mockedCreateGameMessage.mockReturnValue(newMessage);

		const effect = {
			type: "message",
			operation: "show",
			message: "New",
		} as Effect;

		const result = resolveMessageEffect(game, effect);

		expect(result).not.toBe(game);
		expect(result.messages).not.toBe(game.messages);
		expect(result.messages).toEqual([existingMessage, newMessage]);
		expect(game.messages).toEqual([existingMessage]);
	});
});

describe("resolveFlagEffect", () => {
	it("returns the original game for a non-flag effect", () => {
		const game = createGameState();

		const effect = {
			type: "counter",
			operation: "set",
			counter: "health",
			value: 10,
		} as Effect;

		const result = resolveFlagEffect(game, effect);

		expect(result).toBe(game);
	});

	describe.each(["create", "set"] as const)("%s", (operation) => {
		it("adds a new flag when it does not exist", () => {
			const game = createGameState();

			const effect = {
				type: "flag",
				operation,
				flag: "door-open",
				value: true,
			} as Effect;

			const result = resolveFlagEffect(game, effect);

			expect(result.variables.flags).toEqual([{"door-open": true}]);
			expect(game.variables.flags).toEqual([]);
		});

		it("updates an existing flag", () => {
			const game = createGameState({
				variables: {
					flags: [{"door-open": false}],
					counters: [],
				},
			});

			const effect = {
				type: "flag",
				operation,
				flag: "door-open",
				value: true,
			} as Effect;

			const result = resolveFlagEffect(game, effect);

			expect(result.variables.flags).toEqual([{"door-open": true}]);
			expect(game.variables.flags).toEqual([{"door-open": false}]);
		});

		it("updates only the matching flag record", () => {
			const game = createGameState({
				variables: {
					flags: [{"has-key": true}, {"door-open": false}, {"alarm-active": true}],
					counters: [],
				},
			});

			const effect = {
				type: "flag",
				operation,
				flag: "door-open",
				value: true,
			} as Effect;

			const result = resolveFlagEffect(game, effect);

			expect(result.variables.flags).toEqual([
				{"has-key": true},
				{"door-open": true},
				{"alarm-active": true},
			]);
		});

		it("updates a flag inside a record containing multiple flags", () => {
			const game = createGameState({
				variables: {
					flags: [
						{
							"door-open": false,
							"has-key": true,
						},
					],
					counters: [],
				},
			});

			const effect = {
				type: "flag",
				operation,
				flag: "door-open",
				value: true,
			} as Effect;

			const result = resolveFlagEffect(game, effect);

			expect(result.variables.flags).toEqual([
				{
					"door-open": true,
					"has-key": true,
				},
			]);
		});
	});

	describe("toggle", () => {
		it("creates a missing flag with a value of true", () => {
			const game = createGameState();

			const effect = {
				type: "flag",
				operation: "toggle",
				flag: "door-open",
			} as Effect;

			const result = resolveFlagEffect(game, effect);

			expect(result.variables.flags).toEqual([{"door-open": true}]);
		});

		it("toggles an existing false flag to true", () => {
			const game = createGameState({
				variables: {
					flags: [{"door-open": false}],
					counters: [],
				},
			});

			const effect = {
				type: "flag",
				operation: "toggle",
				flag: "door-open",
			} as Effect;

			const result = resolveFlagEffect(game, effect);

			expect(result.variables.flags).toEqual([{"door-open": true}]);
		});

		it("toggles an existing true flag to false", () => {
			const game = createGameState({
				variables: {
					flags: [{"door-open": true}],
					counters: [],
				},
			});

			const effect = {
				type: "flag",
				operation: "toggle",
				flag: "door-open",
			} as Effect;

			const result = resolveFlagEffect(game, effect);

			expect(result.variables.flags).toEqual([{"door-open": false}]);
		});
	});

	describe("delete", () => {
		it("removes the record when its only flag is deleted", () => {
			const game = createGameState({
				variables: {
					flags: [{"has-key": true}, {"door-open": false}],
					counters: [],
				},
			});

			const effect = {
				type: "flag",
				operation: "delete",
				flag: "door-open",
			} as Effect;

			const result = resolveFlagEffect(game, effect);

			expect(result.variables.flags).toEqual([{"has-key": true}]);
			expect(game.variables.flags).toEqual([{"has-key": true}, {"door-open": false}]);
		});

		it("keeps the record when it contains another flag", () => {
			const game = createGameState({
				variables: {
					flags: [
						{
							"door-open": true,
							"has-key": true,
						},
					],
					counters: [],
				},
			});

			const effect = {
				type: "flag",
				operation: "delete",
				flag: "door-open",
			} as Effect;

			const result = resolveFlagEffect(game, effect);

			expect(result.variables.flags).toEqual([{"has-key": true}]);
		});

		it("returns the original game when the flag does not exist", () => {
			const game = createGameState({
				variables: {
					flags: [{"has-key": true}],
					counters: [],
				},
			});

			const effect = {
				type: "flag",
				operation: "delete",
				flag: "door-open",
			} as Effect;

			const result = resolveFlagEffect(game, effect);

			expect(result).toBe(game);
			expect(result.variables.flags).toEqual([{"has-key": true}]);
		});
	});

	it("does not mutate the original game", () => {
		const game = createGameState({
			variables: {
				flags: [{"door-open": false}],
				counters: [],
			},
		});

		const effect = {
			type: "flag",
			operation: "set",
			flag: "door-open",
			value: true,
		} as Effect;

		const result = resolveFlagEffect(game, effect);

		expect(result).not.toBe(game);
		expect(result.variables).not.toBe(game.variables);
		expect(result.variables.flags).not.toBe(game.variables.flags);
		expect(result.variables.flags).toEqual([{"door-open": true}]);
		expect(game.variables.flags).toEqual([{"door-open": false}]);
	});

	it("edits room and feature flags through scoped flag effects", () => {
		const game = createGameState({
			roomStates: [
				{
					type: "room",
					id: {type: "room", id: "hall"},
					flags: {active: true, dark: false},
					featureStates: [
						{
							type: "feature",
							id: {type: "feature", id: "statue"},
							flags: {examined: false, glowing: false},
						},
					],
				},
			],
		});
		const roomSet = resolveFlagEffect(game, {
			type: "flag",
			"flag-type": "room",
			operation: "set",
			roomId: {type: "room", id: "hall"},
			flag: "dark",
			value: true,
		} as Effect);
		const featureToggle = resolveFlagEffect(roomSet, {
			type: "flag",
			"flag-type": "feature",
			operation: "toggle",
			roomId: {type: "room", id: "hall"},
			featureId: {type: "feature", id: "statue"},
			flag: "glowing",
		} as Effect);

		expect(roomSet.roomStates[0].flags.dark).toBe(true);
		expect(featureToggle.roomStates[0].featureStates[0].flags.glowing).toBe(true);
		expect(game.roomStates[0].flags.dark).toBe(false);
		expect(game.roomStates[0].featureStates[0].flags.glowing).toBe(false);
	});

	it("does not edit readonly flags or delete permanent flags", () => {
		const game = createGameState({
			roomStates: [
				{
					type: "room",
					id: {type: "room", id: "hall"},
					flags: {visited: true, active: true},
					featureStates: [
						{
							type: "feature",
							id: {type: "feature", id: "statue"},
							flags: {examined: false},
						},
					],
				},
			],
		});
		const visited = resolveFlagEffect(game, {
			type: "flag",
			"flag-type": "room",
			operation: "toggle",
			roomId: {type: "room", id: "hall"},
			flag: "visited",
		} as Effect);
		const examined = resolveFlagEffect(game, {
			type: "flag",
			"flag-type": "feature",
			operation: "set",
			roomId: {type: "room", id: "hall"},
			featureId: {type: "feature", id: "statue"},
			flag: "examined",
			value: true,
		} as Effect);
		const active = resolveFlagEffect(game, {
			type: "flag",
			"flag-type": "room",
			operation: "delete",
			roomId: {type: "room", id: "hall"},
			flag: "active",
		} as Effect);

		expect(visited.roomStates[0].flags.visited).toBe(true);
		expect(examined.roomStates[0].featureStates[0].flags.examined).toBe(false);
		expect(active.roomStates[0].flags.active).toBe(true);
	});
});

describe("resolveCounterEffect", () => {
	it("returns the original game for a non-counter effect", () => {
		const game = createGameState();

		const effect = {
			type: "flag",
			operation: "set",
			flag: "door-open",
			value: true,
		} as Effect;

		const result = resolveCounterEffect(game, effect);

		expect(result).toBe(game);
	});

	describe.each(["create", "set"] as const)("%s", (operation) => {
		it("adds a new counter when it does not exist", () => {
			const game = createGameState();

			const effect = {
				type: "counter",
				operation,
				counter: "health",
				value: 10,
			} as Effect;

			const result = resolveCounterEffect(game, effect);

			expect(result.variables.counters).toEqual([{health: 10}]);
			expect(game.variables.counters).toEqual([]);
		});

		it("updates an existing counter", () => {
			const game = createGameState({
				variables: {
					flags: [],
					counters: [{health: 5}],
				},
			});

			const effect = {
				type: "counter",
				operation,
				counter: "health",
				value: 10,
			} as Effect;

			const result = resolveCounterEffect(game, effect);

			expect(result.variables.counters).toEqual([{health: 10}]);
			expect(game.variables.counters).toEqual([{health: 5}]);
		});

		it("updates only the matching counter record", () => {
			const game = createGameState({
				variables: {
					flags: [],
					counters: [{health: 5}, {gold: 20}, {reputation: 3}],
				},
			});

			const effect = {
				type: "counter",
				operation,
				counter: "gold",
				value: 50,
			} as Effect;

			const result = resolveCounterEffect(game, effect);

			expect(result.variables.counters).toEqual([{health: 5}, {gold: 50}, {reputation: 3}]);
		});

		it("updates a counter inside a record containing multiple counters", () => {
			const game = createGameState({
				variables: {
					flags: [],
					counters: [
						{
							health: 5,
							mana: 10,
						},
					],
				},
			});

			const effect = {
				type: "counter",
				operation,
				counter: "health",
				value: 20,
			} as Effect;

			const result = resolveCounterEffect(game, effect);

			expect(result.variables.counters).toEqual([
				{
					health: 20,
					mana: 10,
				},
			]);
		});
	});

	describe("increase", () => {
		it("increases an existing counter by the requested amount", () => {
			const game = createGameState({
				variables: {
					flags: [],
					counters: [{gold: 10}],
				},
			});

			const effect = {
				type: "counter",
				operation: "increase",
				counter: "gold",
				amount: 4,
			} as Effect;

			const result = resolveCounterEffect(game, effect);

			expect(result.variables.counters).toEqual([{gold: 14}]);
			expect(game.variables.counters).toEqual([{gold: 10}]);
		});

		it("creates a missing counter with the requested amount", () => {
			const game = createGameState();

			const effect = {
				type: "counter",
				operation: "increase",
				counter: "gold",
				amount: 4,
			} as Effect;

			const result = resolveCounterEffect(game, effect);

			expect(result.variables.counters).toEqual([{gold: 4}]);
		});
	});

	describe("decrease", () => {
		it("decreases an existing counter by the requested amount", () => {
			const game = createGameState({
				variables: {
					flags: [],
					counters: [{health: 10}],
				},
			});

			const effect = {
				type: "counter",
				operation: "decrease",
				counter: "health",
				amount: 3,
			} as Effect;

			const result = resolveCounterEffect(game, effect);

			expect(result.variables.counters).toEqual([{health: 7}]);
			expect(game.variables.counters).toEqual([{health: 10}]);
		});

		it("creates a missing counter with the negative requested amount", () => {
			const game = createGameState();

			const effect = {
				type: "counter",
				operation: "decrease",
				counter: "health",
				amount: 3,
			} as Effect;

			const result = resolveCounterEffect(game, effect);

			expect(result.variables.counters).toEqual([{health: -3}]);
		});
	});

	describe("delete", () => {
		it("removes the record when its only counter is deleted", () => {
			const game = createGameState({
				variables: {
					flags: [],
					counters: [{health: 10}, {gold: 20}],
				},
			});

			const effect = {
				type: "counter",
				operation: "delete",
				counter: "health",
			} as Effect;

			const result = resolveCounterEffect(game, effect);

			expect(result.variables.counters).toEqual([{gold: 20}]);
			expect(game.variables.counters).toEqual([{health: 10}, {gold: 20}]);
		});

		it("keeps the record when it contains another counter", () => {
			const game = createGameState({
				variables: {
					flags: [],
					counters: [
						{
							health: 10,
							mana: 5,
						},
					],
				},
			});

			const effect = {
				type: "counter",
				operation: "delete",
				counter: "health",
			} as Effect;

			const result = resolveCounterEffect(game, effect);

			expect(result.variables.counters).toEqual([{mana: 5}]);
		});

		it("does not alter flags when deleting a counter", () => {
			const game = createGameState({
				variables: {
					flags: [{"has-key": true}, {"door-open": false}],
					counters: [{health: 10}, {gold: 20}],
				},
			});

			const effect = {
				type: "counter",
				operation: "delete",
				counter: "health",
			} as Effect;

			const result = resolveCounterEffect(game, effect);

			expect(result.variables.flags).toEqual([{"has-key": true}, {"door-open": false}]);
			expect(result.variables.counters).toEqual([{gold: 20}]);
		});

		it("returns the original game when the counter does not exist", () => {
			const game = createGameState({
				variables: {
					flags: [],
					counters: [{health: 10}],
				},
			});

			const effect = {
				type: "counter",
				operation: "delete",
				counter: "gold",
			} as Effect;

			const result = resolveCounterEffect(game, effect);

			expect(result).toBe(game);
			expect(result.variables.counters).toEqual([{health: 10}]);
		});
	});

	it("does not mutate the original game", () => {
		const game = createGameState({
			variables: {
				flags: [],
				counters: [{health: 10}],
			},
		});

		const effect = {
			type: "counter",
			operation: "increase",
			counter: "health",
			amount: 5,
		} as Effect;

		const result = resolveCounterEffect(game, effect);

		expect(result).not.toBe(game);
		expect(result.variables).not.toBe(game.variables);
		expect(result.variables.counters).not.toBe(game.variables.counters);
		expect(result.variables.counters).toEqual([{health: 15}]);
		expect(game.variables.counters).toEqual([{health: 10}]);
	});
});

describe("resolveFeatureEffect", () => {
	function createGameWithFeatures(): GameState {
		return createGameState({
			roomStates: [
				{
					type: "room",
					id: {type: "room", id: "hall"},
					flags: {},
					featureStates: [
						{
							type: "feature",
							id: {type: "feature", id: "statue"},
							flags: {examined: false},
						},
					],
				},
				{
					type: "room",
					id: {type: "room", id: "vault"},
					flags: {},
					featureStates: [],
				},
			],
		});
	}

	function featureEffect(operation: string, values: Record<string, unknown> = {}): Effect {
		return {
			type: "feature",
			operation,
			roomId: {type: "room", id: "hall"},
			featureId: {type: "feature", id: "statue"},
			...values,
		} as Effect;
	}

	it("returns the original game for a non-feature effect", () => {
		const game = createGameWithFeatures();

		expect(
			resolveFeatureEffect(game, {
				type: "flag",
				operation: "toggle",
				flag: "door-open",
			} as Effect),
		).toBe(game);
	});

	it.each([
		["change-name", "name", "Ancient statue"],
		["change-description", "description", "Its eyes are glowing."],
	] as const)("resolves %s without mutating the original feature", (operation, property, value) => {
		const game = createGameWithFeatures();
		const result = resolveFeatureEffect(game, featureEffect(operation, {value}));

		expect(result.roomStates[0].featureStates[0]).toEqual({
			...game.roomStates[0].featureStates[0],
			[property]: value,
		});
		expect(result).not.toBe(game);
		expect(game.roomStates[0].featureStates[0]).not.toHaveProperty(property);
	});

	it.each([
		["hide-from-player", "hidden", true],
		["show-to-player", "hidden", false],
		["show-in-room-description", "listedInRoom", true],
		["hide-in-room-description", "listedInRoom", false],
	] as const)("resolves %s by updating the feature flags", (operation, flag, value) => {
		const game = createGameWithFeatures();
		const result = resolveFeatureEffect(game, featureEffect(operation));

		expect(result.roomStates[0].featureStates[0].flags).toEqual({
			examined: false,
			[flag]: value,
		});
		expect(game.roomStates[0].featureStates[0].flags).toEqual({examined: false});
	});

	it("moves a feature state to another room", () => {
		const game = createGameWithFeatures();
		const result = resolveFeatureEffect(
			game,
			featureEffect("move-to-room", {newRoomId: {type: "room", id: "vault"}}),
		);

		expect(result.roomStates[0].featureStates).toEqual([]);
		expect(result.roomStates[1].featureStates).toEqual([game.roomStates[0].featureStates[0]]);
		expect(game.roomStates[0].featureStates).toHaveLength(1);
		expect(game.roomStates[1].featureStates).toEqual([]);
	});

	it("destroys a feature by removing its runtime state", () => {
		const game = createGameWithFeatures();
		const result = resolveFeatureEffect(game, featureEffect("destroy"));

		expect(result.roomStates[0].featureStates).toEqual([]);
		expect(game.roomStates[0].featureStates).toHaveLength(1);
	});

	it.each([
		["missing source room", {roomId: {type: "room", id: "missing"}}],
		["missing feature", {featureId: {type: "feature", id: "missing"}}],
		["missing destination room", {newRoomId: {type: "room", id: "missing"}}],
	] as const)("is a no-op for a %s", (_scenario, values) => {
		const game = createGameWithFeatures();
		const operation = "newRoomId" in values ? "move-to-room" : "destroy";

		expect(resolveFeatureEffect(game, featureEffect(operation, values))).toBe(game);
	});
});

describe("resolveRoomEffect", () => {
	function createGameWithRoom(): GameState {
		return createGameState({
			player: {
				currentRoom: {type: "room", id: "hall"},
				turns: 0,
				freezeState: {},
			},
			roomStates: [
				{
					type: "room",
					id: {type: "room", id: "hall"},
					tags: ["indoors", "safe"],
					lockedExits: ["n"],
					flags: {visited: true, active: true},
					featureStates: [],
				},
			],
		});
	}

	function roomEffect(operation: string, values: Record<string, unknown> = {}): Effect {
		return {
			type: "room",
			operation,
			roomId: {type: "room", id: "hall"},
			...values,
		} as Effect;
	}

	it("returns the original game for a non-room effect", () => {
		const game = createGameWithRoom();
		expect(resolveRoomEffect(game, {type: "flag", operation: "toggle", flag: "x"} as Effect)).toBe(
			game,
		);
	});

	it("moves the player to the selected room", () => {
		const game = createGameWithRoom();
		game.roomStates.push({
			type: "room",
			id: {type: "room", id: "vault"},
			flags: {visited: false, active: true},
			featureStates: [],
		});
		const result = resolveRoomEffect(
			game,
			roomEffect("move-player-to", {roomId: {type: "room", id: "vault"}}),
		);

		expect(result.player.currentRoom).toEqual({type: "room", id: "vault"});
		expect(result.roomStates[1].flags.visited).toBe(true);
		expect(game.player.currentRoom).toEqual({type: "room", id: "hall"});
		expect(game.roomStates[1].flags.visited).toBe(false);
	});

	it.each([
		["set-name", "name", "ruined-hall"],
		["set-description", "description", "flooded-hall"],
		["set-short-description", "shortDescription", "still-flooded-hall"],
	] as const)("resolves %s", (operation, property, variantId) => {
		const game = createGameWithRoom();
		const result = resolveRoomEffect(game, roomEffect(operation, {variantId}));

		expect(result.roomStates[0]).toMatchObject({[property]: variantId});
		expect(game.roomStates[0]).not.toHaveProperty(property);
	});

	it("locks an exit once and unlocks it", () => {
		const game = createGameWithRoom();
		const locked = resolveRoomEffect(game, roomEffect("lock-exit", {direction: "e"}));
		const relocked = resolveRoomEffect(locked, roomEffect("lock-exit", {direction: "e"}));
		const unlocked = resolveRoomEffect(relocked, roomEffect("unlock-exit", {direction: "n"}));

		expect(locked.roomStates[0].lockedExits).toEqual(["n", "e"]);
		expect(relocked.roomStates[0].lockedExits).toEqual(["n", "e"]);
		expect(unlocked.roomStates[0].lockedExits).toEqual(["e"]);
	});

	it("locks and unlocks all exits", () => {
		const game = createGameWithRoom();
		const locked = resolveRoomEffect(game, roomEffect("lock-all-exits"));
		const unlocked = resolveRoomEffect(locked, roomEffect("unlock-all-exits"));

		expect(locked.roomStates[0].lockedExits).toEqual([
			"n",
			"ne",
			"e",
			"se",
			"s",
			"sw",
			"w",
			"nw",
			"up",
			"down",
			"in",
			"out",
		]);
		expect(unlocked.roomStates[0].lockedExits).toEqual([]);
		expect(game.roomStates[0].lockedExits).toEqual(["n"]);
	});

	it("adds a tag once and removes tags", () => {
		const game = createGameWithRoom();
		const tagged = resolveRoomEffect(game, roomEffect("add-tag", {tag: "dark"}));
		const retagged = resolveRoomEffect(tagged, roomEffect("add-tag", {tag: "dark"}));
		const removed = resolveRoomEffect(retagged, roomEffect("remove-tag", {tag: "safe"}));

		expect(tagged.roomStates[0].tags).toEqual(["indoors", "safe", "dark"]);
		expect(retagged.roomStates[0].tags).toEqual(["indoors", "safe", "dark"]);
		expect(removed.roomStates[0].tags).toEqual(["indoors", "dark"]);
	});

	it.each([
		["set-active", true],
		["set-inactive", false],
	] as const)("resolves %s", (operation, active) => {
		const game = createGameWithRoom();
		const result = resolveRoomEffect(game, roomEffect(operation));

		expect(result.roomStates[0].flags.active).toBe(active);
		expect(game.roomStates[0].flags.active).toBe(true);
	});

	it("is a no-op when the targeted room state is missing", () => {
		const game = createGameWithRoom();
		const effect = roomEffect("set-inactive", {roomId: {type: "room", id: "missing"}});

		expect(resolveRoomEffect(game, effect)).toBe(game);
	});
});
