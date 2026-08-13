/** @jest-environment node */

import {createPlayerTestScenario} from "@/engine/utils/testUtils";
import {GameStateSchema} from "@/schemas/states/gameStateSchemas";
import {replayCompatibilityIssues} from "../replayCompatibility";
import {applyVersionedTransform} from "./types";
import {v9ToV10} from "./v9ToV10";

describe("the v9 to v10 migration through the player path", () => {
	it("makes retained turns and current state match exhaustive replay", () => {
		const scenario = createPlayerTestScenario("navigation");
		const first = GameStateSchema.parse(
			applyVersionedTransform(v9ToV10, 9, v9ToV10.gameState, scenario.game, {
				playthroughId: "playthrough-1",
				sequence: 1,
				storage: "turn",
				world: scenario.world,
				command: "east",
				previousState: scenario.game,
			}).value,
		);
		const second = GameStateSchema.parse(
			applyVersionedTransform(v9ToV10, 9, v9ToV10.gameState, scenario.game, {
				playthroughId: "playthrough-1",
				sequence: 2,
				storage: "turn",
				world: scenario.world,
				command: "west",
				previousState: first,
			}).value,
		);
		const current = GameStateSchema.parse(
			applyVersionedTransform(v9ToV10, 9, v9ToV10.gameState, scenario.game, {
				playthroughId: "playthrough-1",
				sequence: null,
				storage: "current",
				world: scenario.world,
				previousState: second,
			}).value,
		);
		const firstOutput = applyVersionedTransform(v9ToV10, 9, v9ToV10.messages, [], {
			playthroughId: "playthrough-1",
			sequence: 1,
			storage: "output",
			gameState: first,
			previousState: scenario.game,
		}).value as typeof first.messages;
		const secondOutput = applyVersionedTransform(v9ToV10, 9, v9ToV10.messages, [], {
			playthroughId: "playthrough-1",
			sequence: 2,
			storage: "output",
			gameState: second,
			previousState: first,
		}).value as typeof second.messages;

		expect(
			replayCompatibilityIssues(
				scenario.world,
				[
					{sequence: 1, command: "east", outputMessages: firstOutput, resultingState: first},
					{sequence: 2, command: "west", outputMessages: secondOutput, resultingState: second},
				],
				current,
			),
		).toEqual([]);
		expect(second.messages.at(-1)?.text).toContain("\n A small brass bell hangs beside the doorway.");
	});
});
