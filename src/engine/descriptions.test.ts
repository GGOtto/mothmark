import type {Description} from "@/schemas/descriptionSchema";
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
