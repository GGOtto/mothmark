import type {ConditionDefinition} from "@/schemas/world/conditionSchema";
import type {World} from "@/schemas/world/worldSchema";
import {toID} from "@/utils/idUtils";
import {getCondition} from "./lookupUtils";

const gateOpen = {
	type: "flag",
	operation: "true",
	flag: "gate.open",
} as ConditionDefinition;

const world = {
	conditions: [{identity: toID("condition", "gate-open"), condition: gateOpen}],
} as World;

describe("getCondition", () => {
	it("returns the condition payload for a stored condition identity", () => {
		expect(getCondition(world, toID("condition", "gate-open"))).toBe(gateOpen);
	});

	it("throws a useful error when the condition is missing", () => {
		expect(() => getCondition(world, toID("condition", "missing"))).toThrow(
			"Missing condition: missing",
		);
	});
});
