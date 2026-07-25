import {produce} from "immer";
import type {Condition} from "@/schemas/world/conditionSchema";
import type {Effect} from "@/schemas/world/effectSchema";
import {toID} from "@/utils/idUtils";
import {resolveTurn} from "../player/resolveTurn";
import {createInitialGameState} from "../states/createInitialState";
import {
	createPlayerTestEffectGroup,
	createPlayerTestEvent,
	createPlayerTestScenario,
} from "../testUtils";

function createConditionalEvent(id: string, condition: Condition, effects: Effect[]) {
	return createPlayerTestEvent(id, [], (draft) => {
		draft.disposable = true;
		delete draft.branch.always;
		draft.branch.if = {
			condition: {type: "group", operation: "all", conditions: [condition]},
			effect: createPlayerTestEffectGroup(`${id}-conditional-effects`, effects),
			delayTurns: 0,
			cancelIfConditionFails: true,
		};
	});
}

describe("events and conditions through the player path", () => {
	it("echoes the command, shows its result, then resolves end-of-turn events", () => {
		const {world, game} = createPlayerTestScenario("turn-event");

		const nextGame = resolveTurn(world, game, "help");

		expect(nextGame.messages.slice(1).map(({type, text}) => ({type, text}))).toEqual([
			{type: "command", text: "help"},
			expect.objectContaining({type: "system", text: expect.stringContaining("look (look, l)")}),
			{type: "system", text: "The clockwork instrument chimes."},
		]);
	});

	it("waits the authored number of turns before an event becomes eligible", () => {
		const scenario = createPlayerTestScenario("navigation");
		const event = createPlayerTestEvent(
			"delayed",
			[{type: "message", operation: "show", message: "At last, the gears engage."}],
			(draft) => {
				draft.disposable = true;
				draft.wait = 2;
			},
		);
		const world = produce(scenario.world, (draft) => {
			draft.events = [event];
		});
		const game = {...scenario.game, events: [event]};

		const firstTurn = resolveTurn(world, game, "help");
		const secondTurn = resolveTurn(world, firstTurn, "help");

		expect(firstTurn.messages.some((message) => message.text.includes("gears engage"))).toBe(false);
		expect(secondTurn.messages.at(-1)).toMatchObject({
			type: "system",
			text: "At last, the gears engage.",
		});
		expect(secondTurn.events).toEqual([]);
	});

	it("resolves higher-priority authored events first", () => {
		const scenario = createPlayerTestScenario("navigation");
		const low = createPlayerTestEvent(
			"low",
			[{type: "message", operation: "show", message: "Low priority."}],
			(draft) => {
				draft.priority = 1;
				draft.disposable = true;
			},
		);
		const high = createPlayerTestEvent(
			"high",
			[{type: "message", operation: "show", message: "High priority."}],
			(draft) => {
				draft.priority = 10;
				draft.disposable = true;
			},
		);
		const world = produce(scenario.world, (draft) => {
			draft.events = [low, high];
		});
		const game = createInitialGameState(world, world.startRoomId);

		const nextGame = resolveTurn(world, game, "help");

		expect(nextGame.messages.slice(-2).map((message) => message.text)).toEqual([
			"High priority.",
			"Low priority.",
		]);
	});

	it("keeps a disposable conditional event until the player's action makes it true", () => {
		const scenario = createPlayerTestScenario("navigation");
		const event = createConditionalEvent(
			"arrive-gallery",
			{type: "current-room", operation: "is", roomId: toID("room", "gallery")},
			[{type: "message", operation: "show", message: "The gallery recognizes you."}],
		);
		const world = produce(scenario.world, (draft) => {
			draft.events = [event];
		});
		const game = {...scenario.game, events: [event]};

		const waitingGame = resolveTurn(world, game, "help");
		const arrivedGame = resolveTurn(world, waitingGame, "east");

		expect(waitingGame.events).toHaveLength(1);
		expect(arrivedGame.messages.at(-1)).toMatchObject({
			type: "system",
			text: "The gallery recognizes you.",
		});
		expect(arrivedGame.events).toEqual([]);
	});

	it("schedules a matching delayed condition and applies its effect after the delay", () => {
		const scenario = createPlayerTestScenario("navigation");
		const event = produce(
			createConditionalEvent(
				"delayed-reaction",
				{type: "current-room", operation: "is", roomId: toID("room", "foyer")},
				[{type: "message", operation: "show", message: "The delayed bell rings."}],
			),
			(draft) => {
				draft.branch.if!.delayTurns = 2;
			},
		);
		const world = produce(scenario.world, (draft) => {
			draft.events = [event];
		});
		const game = {...scenario.game, events: [event]};

		const scheduledGame = resolveTurn(world, game, "help");
		const waitingGame = resolveTurn(world, scheduledGame, "help");
		const resolvedGame = resolveTurn(world, waitingGame, "help");

		expect(scheduledGame.events).toHaveLength(1);
		expect(scheduledGame.events[0]).toMatchObject({
			name: "Delayed Condition",
			wait: 2,
			branch: {if: {delayTurns: 0}},
		});
		expect(waitingGame.messages.some((message) => message.text.includes("delayed bell"))).toBe(false);
		expect(resolvedGame.messages.at(-1)).toMatchObject({
			type: "system",
			text: "The delayed bell rings.",
		});
		expect(resolvedGame.events).toEqual([]);
	});

	it("applies a delayed effect even if its condition changes when cancellation is disabled", () => {
		const scenario = createPlayerTestScenario("navigation");
		const event = produce(
			createConditionalEvent(
				"non-cancellable-reaction",
				{type: "current-room", operation: "is", roomId: toID("room", "foyer")},
				[{type: "message", operation: "show", message: "The committed bell rings."}],
			),
			(draft) => {
				draft.branch.if!.delayTurns = 2;
				draft.branch.if!.cancelIfConditionFails = false;
			},
		);
		const world = produce(scenario.world, (draft) => {
			draft.events = [event];
		});
		const game = {...scenario.game, events: [event]};

		const scheduledGame = resolveTurn(world, game, "help");
		const movedGame = resolveTurn(world, scheduledGame, "east");
		const resolvedGame = resolveTurn(world, movedGame, "help");

		expect(resolvedGame.messages.at(-1)).toMatchObject({
			type: "system",
			text: "The committed bell rings.",
		});
		expect(resolvedGame.events).toEqual([]);
	});

	it("discards a due delayed event when its rechecked condition fails", () => {
		const scenario = createPlayerTestScenario("navigation");
		const event = produce(
			createConditionalEvent(
				"cancellable-reaction",
				{type: "current-room", operation: "is", roomId: toID("room", "foyer")},
				[{type: "message", operation: "show", message: "This should not ring."}],
			),
			(draft) => {
				draft.branch.if!.delayTurns = 2;
				draft.branch.if!.cancelIfConditionFails = true;
			},
		);
		const world = produce(scenario.world, (draft) => {
			draft.events = [event];
		});
		const game = {...scenario.game, events: [event]};

		const scheduledGame = resolveTurn(world, game, "help");
		const movedGame = resolveTurn(world, scheduledGame, "east");
		const cancelledGame = resolveTurn(world, movedGame, "help");

		expect(cancelledGame.messages.some((message) => message.text.includes("should not ring"))).toBe(
			false,
		);
		expect(cancelledGame.events).toEqual([]);
	});

	it("passes flag and counter changes from one event into later conditions that turn", () => {
		const scenario = createPlayerTestScenario("navigation");
		const setup = createPlayerTestEvent(
			"setup",
			[
				{
					type: "flag",
					"flag-type": "normal",
					operation: "create",
					flag: "mechanism-ready",
					value: true,
				},
				{type: "counter", operation: "set", counter: "gears", value: 2},
			],
			(draft) => {
				draft.priority = 10;
				draft.disposable = true;
			},
		);
		const reaction = createConditionalEvent(
			"reaction",
			{
				type: "group",
				operation: "all",
				conditions: [
					{
						type: "flag",
						"flag-type": "normal",
						operation: "true",
						flag: "mechanism-ready",
					},
					{
						type: "counter",
						operation: "compare",
						counter: "gears",
						operator: "gte",
						value: 2,
					},
				],
			},
			[{type: "message", operation: "show", message: "The mechanism is ready."}],
		);
		const world = produce(scenario.world, (draft) => {
			draft.events = [setup, reaction];
		});
		const game = {...scenario.game, events: [setup, reaction]};

		const nextGame = resolveTurn(world, game, "help");

		expect(nextGame.variables.flags).toContainEqual({"mechanism-ready": true});
		expect(nextGame.variables.counters).toContainEqual({gears: 2});
		expect(nextGame.messages.at(-1)).toMatchObject({
			type: "system",
			text: "The mechanism is ready.",
		});
	});

	it("reacts to a feature the player examined during the same turn", () => {
		const scenario = createPlayerTestScenario("navigation");
		const event = createConditionalEvent(
			"bell-examined",
			{
				type: "flag",
				"flag-type": "feature",
				operation: "true",
				roomId: toID("room", "foyer"),
				featureId: toID("feature", "brass-bell"),
				flag: "examined",
			},
			[{type: "message", operation: "show", message: "The bell trembles under your gaze."}],
		);
		const world = produce(scenario.world, (draft) => {
			draft.events = [event];
		});
		const game = {...scenario.game, events: [event]};

		const nextGame = resolveTurn(world, game, "examine bell");

		expect(nextGame.messages.slice(-2)).toEqual([
			expect.objectContaining({
				type: "system",
				text: "A small brass bell hangs beside the doorway.",
			}),
			expect.objectContaining({
				type: "system",
				text: "The bell trembles under your gaze.",
			}),
		]);
	});
});
