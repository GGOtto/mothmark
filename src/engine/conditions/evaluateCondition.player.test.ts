import {produce} from "immer";
import type {Condition} from "@/schemas/world/conditionSchema";
import type {Effect} from "@/schemas/world/effectSchema";
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
								operation: "true",
								flag: "blocked",
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
});
