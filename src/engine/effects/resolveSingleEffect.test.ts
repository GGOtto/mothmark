import {GameStateSchema, type GameMessage, type GameState} from "@/schemas/states/gameStateSchema";
import type {Effect} from "@/schemas/world/effectSchema";
import {choose} from "@/utils/choose";
import {appendLastMessage, createGameMessage} from "../messages/createMessage";
import {resolveCounterEffect, resolveFlagEffect, resolveMessageEffect} from "./resolveSingleEffect";
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
