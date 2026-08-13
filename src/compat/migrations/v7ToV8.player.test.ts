/** @jest-environment node */

import {resolveTurn} from "@/engine/player/resolveTurn";
import {createPlayerTestScenario} from "@/engine/utils/testUtils";
import {GameStateSchema} from "@/schemas/states/gameStateSchemas";
import {replayCompatibilityIssues} from "../replayCompatibility";
import {applyVersionedTransform} from "./types";
import {v7ToV8} from "./v7ToV8";

describe("the v7 to v8 migration through the player path", () => {
	it("makes every retained turn and current state match exhaustive replay", () => {
		const scenario = createPlayerTestScenario("navigation");
		const firstReplay = resolveTurn(scenario.world, scenario.game, "east");
		const first = GameStateSchema.parse(
			applyVersionedTransform(v7ToV8, 7, v7ToV8.gameState, scenario.game, {
				playthroughId: "playthrough-1",
				sequence: 1,
				storage: "turn",
				world: scenario.world,
				command: "east",
				previousState: scenario.game,
			}).value,
		);
		const secondReplay = resolveTurn(scenario.world, first, "west");
		const second = GameStateSchema.parse(
			applyVersionedTransform(v7ToV8, 7, v7ToV8.gameState, scenario.game, {
				playthroughId: "playthrough-1",
				sequence: 2,
				storage: "turn",
				world: scenario.world,
				command: "west",
				previousState: first,
			}).value,
		);
		const current = GameStateSchema.parse(
			applyVersionedTransform(v7ToV8, 7, v7ToV8.gameState, scenario.game, {
				playthroughId: "playthrough-1",
				sequence: null,
				storage: "current",
				world: scenario.world,
				previousState: second,
			}).value,
		);

		expect(
			replayCompatibilityIssues(
				scenario.world,
				[
					{
						sequence: 1,
						command: "east",
						outputMessages: firstReplay.messages.slice(scenario.game.messages.length),
						resultingState: first,
					},
					{
						sequence: 2,
						command: "west",
						outputMessages: secondReplay.messages.slice(first.messages.length),
						resultingState: second,
					},
				],
				current,
			),
		).toEqual([]);
	});
});
