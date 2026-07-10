import type {Description} from "@/schemas/descriptionSchema";
import type {World} from "@/schemas/worldSchema";
import type {GameState} from "./gameState";
import {resolveDescription} from "./descriptions";

function createGameState(flags: Record<string, boolean> = {}): GameState {
	return {
		currentRoomId: "gate",
		flags,
		inventory: [],
		messages: [],
	};
}

describe("resolveDescription", () => {
	it("resolves description conditions through world condition references", () => {
		const description = {
			default: "The gate is closed.",
			variants: [
				{
					text: "The gate is open.",
					when: [{type: "condition-ref", conditionId: "gate-is-open"}],
				},
			],
		} as unknown as Description;
		const world = {
			conditions: [
				{
					id: "gate-is-open",
					name: "Gate is open",
					type: "flag",
					operation: "equals",
					flag: "gate.open",
					value: true,
				},
			],
		} as unknown as World;

		expect(resolveDescription(description, createGameState({"gate.open": true}), world)).toBe(
			"The gate is open.",
		);
		expect(resolveDescription(description, createGameState({"gate.open": false}), world)).toBe(
			"The gate is closed.",
		);
	});

	it("accepts legacy single-condition variant values without crashing", () => {
		const description = {
			default: "The gate is closed.",
			variants: [
				{
					text: "The gate is open.",
					when: {
						type: "flag",
						operation: "equals",
						flag: "gate.open",
						value: true,
					},
				},
			],
		} as unknown as Description;

		expect(resolveDescription(description, createGameState({"gate.open": true}))).toBe(
			"The gate is open.",
		);
		expect(resolveDescription(description, createGameState({"gate.open": false}))).toBe(
			"The gate is closed.",
		);
	});
});
