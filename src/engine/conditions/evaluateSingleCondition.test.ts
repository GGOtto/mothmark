import {GameStateSchema, type GameState} from "@/schemas/states/gameStateSchemas";
import {FeatureStateSchema, RoomStateSchema} from "@/schemas/states/entityStateSchemas";
import {SingleConditionSchema, type SingleCondition} from "@/schemas/world/conditionSchema";
import {WorldSchema, type World} from "@/schemas/world/worldSchema";
import {RoomSchema} from "@/schemas/world/roomSchema";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {toID} from "@/utils/idUtils";
import {produce} from "immer";
import {evaluateSingleCondition} from "./evaluateSingleCondition";

const currentRoom = toID("room", "atrium");

const game: GameState = produce(createDefaultFieldObject(GameStateSchema), (draft) => {
	draft.player.currentRoom = currentRoom;
	draft.variables.flags = [{"gate.open": true}, {"lamp.lit": false}];
	draft.variables.counters = [{steps: 3}, {score: 10}];
	draft.roomStates = [
		{
			...createDefaultFieldObject(RoomStateSchema),
			id: currentRoom,
			tags: ["indoors", "safe"],
			flags: {visited: true, active: true},
			featureStates: [
				{
					...createDefaultFieldObject(FeatureStateSchema),
					id: toID("feature", "statue"),
					flags: {examined: false, glowing: true},
				},
			],
		},
	];
});

const world: World = produce(createDefaultFieldObject(WorldSchema), (draft) => {
	draft.rooms = [
		{
			...createDefaultFieldObject(RoomSchema),
			id: currentRoom,
			name: "Atrium",
			tags: ["indoors", "safe"],
		},
	];
});

function condition(overrides: Record<string, unknown>): SingleCondition {
	return SingleConditionSchema.parse({
		...createDefaultFieldObject(SingleConditionSchema),
		...overrides,
	});
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

	it("evaluates room flags, including permanent flags", () => {
		expect(
			evaluateSingleCondition(
				world,
				game,
				condition({
					type: "flag",
					"flag-type": "room",
					operation: "true",
					roomId: currentRoom,
					flag: "visited",
				}),
			),
		).toBe(true);
		expect(
			evaluateSingleCondition(
				world,
				game,
				condition({
					type: "flag",
					"flag-type": "room",
					operation: "missing",
					roomId: currentRoom,
					flag: "dark",
				}),
			),
		).toBe(true);
	});

	it("evaluates feature flags, including permanent flags", () => {
		expect(
			evaluateSingleCondition(
				world,
				game,
				condition({
					type: "flag",
					"flag-type": "feature",
					operation: "false",
					roomId: currentRoom,
					featureId: toID("feature", "statue"),
					flag: "examined",
				}),
			),
		).toBe(true);
		expect(
			evaluateSingleCondition(
				world,
				game,
				condition({
					type: "flag",
					"flag-type": "feature",
					operation: "true",
					roomId: currentRoom,
					featureId: toID("feature", "statue"),
					flag: "glowing",
				}),
			),
		).toBe(true);
	});
});
