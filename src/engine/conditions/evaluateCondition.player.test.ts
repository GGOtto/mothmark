import {produce} from "immer";
import {
	CurrentRoomConditionSchema,
	TextConditionSchema,
	type Condition,
} from "@/schemas/world/conditionSchema";
import type {Effect} from "@/schemas/world/effectSchema";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {toID} from "@/utils/idUtils";
import {resolveTurn} from "../player/resolveTurn";
import {
	createPlayerTestEffectGroup,
	createPlayerTestEvent,
	createPlayerTestScenario,
} from "../utils/testUtils";

function conditionalEvent(id: string, condition: Condition, effects: Effect[]) {
	return createPlayerTestEvent(id, [], (draft) => {
		draft.disposable = true;
		delete draft.branch.always;
		draft.branch.if = {
			condition: {type: "group", operation: "all", conditions: [condition]},
			effect: createPlayerTestEffectGroup(`${id}-effects`, effects),
			delayTurns: 0,
			cancelIfConditionFails: true,
		};
		draft.branch.else = createPlayerTestEffectGroup(`${id}-else`, [
			{type: "message", operation: "show", message: "The condition did not pass."},
		]);
	});
}

describe("conditions through the player path", () => {
	it("checks whether an exit from the current room is open", () => {
		const scenario = createPlayerTestScenario("navigation");
		const event = conditionalEvent(
			"open-exit",
			CurrentRoomConditionSchema.parse({
				...createDefaultFieldObject(CurrentRoomConditionSchema),
				operation: "is-exit-open",
				direction: "e",
			}),
			[{type: "message", operation: "show", message: "The eastern exit is open."}],
		);
		const world = produce(scenario.world, (draft) => {
			draft.events = [event];
		});
		const openGame = {...scenario.game, events: [event]};
		const lockedGame = produce(openGame, (draft) => {
			draft.roomStates[0].lockedExits.push("e");
		});

		expect(resolveTurn(world, openGame, "help").messages.at(-1)).toMatchObject({
			type: "system",
			text: "The eastern exit is open.",
		});
		expect(resolveTurn(world, lockedGame, "help").messages.at(-1)).toMatchObject({
			type: "system",
			text: "The condition did not pass.",
		});
	});

	it("uses nested groups and stored condition references to choose event output", () => {
		const scenario = createPlayerTestScenario("navigation");
		const storedConditionId = toID("condition", "ready-in-foyer");
		const event = conditionalEvent(
			"stored-condition",
			{
				type: "group",
				operation: "all",
				conditions: [
					{type: "condition-ref", conditionId: storedConditionId},
					{
						type: "group",
						operation: "none",
						conditions: [
							{
								type: "flag",
								"flag-type": "normal",
								operation: "is",
								flag: "blocked",
								value: true,
							},
						],
					},
				],
			},
			[{type: "message", operation: "show", message: "The stored condition passed."}],
		);
		const world = produce(scenario.world, (draft) => {
			draft.conditions = [
				{
					identity: storedConditionId,
					condition: {
						type: "current-room",
						operation: "is",
						roomId: toID("room", "foyer"),
					},
				},
			];
			draft.events = [event];
		});
		const game = {...scenario.game, events: [event]};

		const nextGame = resolveTurn(world, game, "help");

		expect(nextGame.messages.at(-1)).toMatchObject({
			type: "system",
			text: "The stored condition passed.",
		});
	});

	it("evaluates runtime room tags changed by an earlier event in the same turn", () => {
		const scenario = createPlayerTestScenario("navigation");
		const addTag = createPlayerTestEvent(
			"add-tag",
			[
				{
					type: "room",
					operation: "add-tag",
					roomId: toID("room", "foyer"),
					tag: "moonlit",
				},
			],
			(draft) => {
				draft.priority = 10;
				draft.disposable = true;
			},
		);
		const react = conditionalEvent(
			"tag-reaction",
			{type: "current-room", operation: "has-tag", tag: "moonlit"},
			[{type: "message", operation: "show", message: "Moonlight fills the foyer."}],
		);
		const world = produce(scenario.world, (draft) => {
			draft.events = [addTag, react];
		});
		const game = {...scenario.game, events: [addTag, react]};

		const nextGame = resolveTurn(world, game, "help");

		expect(nextGame.messages.at(-1)).toMatchObject({
			type: "system",
			text: "Moonlight fills the foyer.",
		});
	});

	it("takes the else branch when a counter condition is false", () => {
		const scenario = createPlayerTestScenario("navigation");
		const event = conditionalEvent(
			"counter-check",
			{
				type: "counter",
				operation: "between",
				counter: "keys",
				min: 1,
				max: 3,
				inclusive: true,
			},
			[{type: "message", operation: "show", message: "You have enough keys."}],
		);
		const world = produce(scenario.world, (draft) => {
			draft.events = [event];
		});
		const game = {...scenario.game, events: [event]};

		const nextGame = resolveTurn(world, game, "help");

		expect(nextGame.messages.at(-1)).toMatchObject({
			type: "system",
			text: "The condition did not pass.",
		});
	});

	it.each([
		["is", "title", "Mothmark Archive"],
		["is-not", "title", "Another title"],
		["starts-with", "title", "Mothmark"],
		["does-not-start-with", "title", "Archive"],
		["ends-with", "title", "Archive"],
		["does-not-end-with", "title", "Mothmark"],
		["contains", "title", "mark Arc"],
		["does-not-contain", "title", "spider"],
		["is-empty", "empty", undefined],
		["is-not-empty", "title", undefined],
		["exists", "empty", undefined],
		["missing", "unknown", undefined],
	] as const)("evaluates saved text operation %s through resolveTurn", (operation, text, value) => {
		const scenario = createPlayerTestScenario("navigation");
		const condition = TextConditionSchema.parse({
			...createDefaultFieldObject(TextConditionSchema),
			type: "text",
			operation,
			text,
			...(value === undefined ? {} : {value}),
		});
		const event = conditionalEvent(`text-${operation}`, condition, [
			{type: "message", operation: "show", message: "The text condition passed."},
		]);
		const world = produce(scenario.world, (draft) => {
			draft.events = [event];
		});
		const game = produce({...scenario.game, events: [event]}, (draft) => {
			draft.variables.texts = [{title: "Mothmark Archive"}, {empty: ""}];
		});

		expect(resolveTurn(world, game, "help").messages.at(-1)).toMatchObject({
			type: "system",
			text: "The text condition passed.",
		});
	});
});
