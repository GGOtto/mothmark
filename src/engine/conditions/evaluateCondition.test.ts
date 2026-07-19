import type {GameState} from "@/schemas/states/gameStateSchema";
import type {Condition, ConditionGroup, SingleCondition} from "@/schemas/world/conditionSchema";
import type {World} from "@/schemas/world/worldSchema";
import {toID} from "@/utils/idUtils";
import {evaluateCondition} from "./evaluateCondition";

const currentRoom = toID("room", "atrium");

const game = {
	currentRoom,
	turns: 0,
	variables: {
		flags: [{passing: true, failing: false}],
		counter: [],
	},
	roomStates: [],
	messages: [],
} satisfies GameState;

const passingCondition = {
	type: "flag",
	operation: "true",
	flag: "passing",
} satisfies SingleCondition;

const failingCondition = {
	type: "flag",
	operation: "true",
	flag: "failing",
} satisfies SingleCondition;

const passingConditionId = toID("condition", "passing-condition");
const failingConditionId = toID("condition", "failing-condition");
const nestedConditionId = toID("condition", "nested-condition");

const world = {
	rooms: [{id: currentRoom, name: "Atrium", tags: []}],
	conditions: [
		{identity: passingConditionId, condition: passingCondition},
		{identity: failingConditionId, condition: failingCondition},
		{
			identity: nestedConditionId,
			condition: {
				type: "group",
				operation: "all",
				conditions: [
					{type: "condition-ref", conditionId: passingConditionId},
					{
						type: "group",
						operation: "none",
						conditions: [{type: "condition-ref", conditionId: failingConditionId}],
					},
				],
			},
		},
	],
} as unknown as World;

function group(operation: ConditionGroup["operation"], conditions: Condition[]): ConditionGroup {
	return {type: "group", operation, conditions};
}

describe("evaluateCondition", () => {
	it("evaluates direct single conditions", () => {
		expect(evaluateCondition(world, game, passingCondition)).toBe(true);
		expect(evaluateCondition(world, game, failingCondition)).toBe(false);
	});

	it.each([
		["all", [], true],
		["all", [passingCondition], true],
		["all", [passingCondition, failingCondition], false],
		["any", [], false],
		["any", [failingCondition], false],
		["any", [failingCondition, passingCondition], true],
		["none", [], true],
		["none", [failingCondition], true],
		["none", [failingCondition, passingCondition], false],
	] satisfies Array<[ConditionGroup["operation"], Condition[], boolean]>)(
		"evaluates a %s group with %j as %s",
		(operation, conditions, expected) => {
			expect(evaluateCondition(world, game, group(operation, conditions))).toBe(expected);
		},
	);

	it("resolves and evaluates a stored condition reference", () => {
		expect(
			evaluateCondition(world, game, {
				type: "condition-ref",
				conditionId: passingConditionId,
			}),
		).toBe(true);
	});

	it("recursively evaluates nested groups and stored references", () => {
		expect(
			evaluateCondition(world, game, {
				type: "condition-ref",
				conditionId: nestedConditionId,
			}),
		).toBe(true);
	});

	it("throws when a referenced condition is missing", () => {
		expect(() =>
			evaluateCondition(world, game, {
				type: "condition-ref",
				conditionId: toID("condition", "missing"),
			}),
		).toThrow("Missing condition: missing");
	});

	it.each([
		["all", failingCondition, false],
		["any", passingCondition, true],
		["none", passingCondition, false],
	] satisfies Array<[ConditionGroup["operation"], Condition, boolean]>)(
		"short-circuits a decisive %s group result",
		(operation, decisiveCondition, expected) => {
			const missingReference = {
				type: "condition-ref" as const,
				conditionId: toID("condition", "missing"),
			};
			expect(
				evaluateCondition(world, game, group(operation, [decisiveCondition, missingReference])),
			).toBe(expected);
		},
	);
});
