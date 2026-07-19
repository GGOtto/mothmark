import type {GameState} from "@/schemas/states/gameStateSchema";
import type {SingleCondition} from "@/schemas/world/conditionSchema";
import type {World} from "@/schemas/world/worldSchema";
import {toID} from "@/utils/idUtils";
import {evaluateSingleCondition} from "./evaluateSingleCondition";

const currentRoom = toID("room", "atrium");

const game: GameState = {
	currentRoom,
	turns: 0,
	variables: {
		flags: [{"gate.open": true}, {"lamp.lit": false}],
		counter: [{steps: 3}, {score: 10}],
	},
	roomStates: [],
	messages: [],
};

const world = {
	rooms: [{id: currentRoom, name: "Atrium", tags: ["indoors", "safe"]}],
} as unknown as World;

function condition(value: unknown): SingleCondition {
	return value as SingleCondition;
}

describe("evaluateSingleCondition", () => {
	it("evaluates true, false, existing, and missing flags", () => {
		expect(
			evaluateSingleCondition(
				world,
				game,
				condition({type: "flag", operation: "true", flag: "gate.open"}),
			),
		).toBe(true);
		expect(
			evaluateSingleCondition(
				world,
				game,
				condition({type: "flag", operation: "false", flag: "lamp.lit"}),
			),
		).toBe(true);
		expect(
			evaluateSingleCondition(
				world,
				game,
				condition({type: "flag", operation: "exists", flag: "lamp.lit"}),
			),
		).toBe(true);
		expect(
			evaluateSingleCondition(
				world,
				game,
				condition({type: "flag", operation: "missing", flag: "unknown"}),
			),
		).toBe(true);
	});

	it("evaluates counter comparisons", () => {
		expect(
			evaluateSingleCondition(
				world,
				game,
				condition({
					type: "counter",
					operation: "compare",
					counter: "score",
					operator: "gte",
					value: 10,
				}),
			),
		).toBe(true);
		expect(
			evaluateSingleCondition(
				world,
				game,
				condition({type: "counter", operation: "compare", counter: "steps", operator: "gt", value: 3}),
			),
		).toBe(false);
		expect(
			evaluateSingleCondition(
				world,
				game,
				condition({type: "counter", operation: "missing", counter: "turns"}),
			),
		).toBe(true);
	});

	it("honors inclusive and exclusive counter ranges", () => {
		expect(
			evaluateSingleCondition(
				world,
				game,
				condition({
					type: "counter",
					operation: "between",
					counter: "steps",
					min: 3,
					max: 5,
					inclusive: true,
				}),
			),
		).toBe(true);
		expect(
			evaluateSingleCondition(
				world,
				game,
				condition({
					type: "counter",
					operation: "between",
					counter: "steps",
					min: 3,
					max: 5,
					inclusive: false,
				}),
			),
		).toBe(false);
	});

	it("compares typed room IDs and evaluates current-room tags", () => {
		expect(
			evaluateSingleCondition(
				world,
				game,
				condition({type: "current-room", operation: "is", roomId: toID("room", "atrium")}),
			),
		).toBe(true);
		expect(
			evaluateSingleCondition(
				world,
				game,
				condition({type: "current-room", operation: "is-not", roomId: toID("room", "cellar")}),
			),
		).toBe(true);
		expect(
			evaluateSingleCondition(
				world,
				game,
				condition({type: "current-room", operation: "has-tag", tag: "safe"}),
			),
		).toBe(true);
		expect(
			evaluateSingleCondition(
				world,
				game,
				condition({type: "current-room", operation: "missing-tag", tag: "outdoors"}),
			),
		).toBe(true);
	});

	it("evaluate room state: visited and not-visited", () => {
		expect(
			evaluateSingleCondition(
				world,
				game,
				condition({type: "current-room", operation: "is", roomId: toID("room", "atrium")}),
			),
		).toBe(true);
		expect(
			evaluateSingleCondition(
				world,
				game,
				condition({type: "current-room", operation: "is-not", roomId: toID("room", "cellar")}),
			),
		).toBe(true);
		expect(
			evaluateSingleCondition(
				world,
				game,
				condition({type: "current-room", operation: "has-tag", tag: "safe"}),
			),
		).toBe(true);
		expect(
			evaluateSingleCondition(
				world,
				game,
				condition({type: "current-room", operation: "missing-tag", tag: "outdoors"}),
			),
		).toBe(true);
	});
});
