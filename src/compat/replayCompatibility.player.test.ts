/** @jest-environment node */

import {resolveTurn} from "@/engine/player/resolveTurn";
import {createPlayerTestScenario} from "@/engine/utils/testUtils";

import {replayCompatibilityIssues} from "./replayCompatibility";

describe("stored playthrough compatibility", () => {
	it("replays commands through the same player path and accepts matching history", () => {
		const {world, game} = createPlayerTestScenario("navigation");
		const resultingState = resolveTurn(world, game, "move east");
		const outputMessages = resultingState.messages.slice(game.messages.length);

		expect(
			replayCompatibilityIssues(
				world,
				[{sequence: 1, command: "move east", outputMessages, resultingState}],
				resultingState,
			),
		).toEqual([]);
	});

	it("reports a candidate engine result that differs from retained state", () => {
		const {world, game} = createPlayerTestScenario("navigation");
		const resultingState = resolveTurn(world, game, "move east");
		const incompatibleState = {...resultingState, player: {...resultingState.player, turns: 99}};

		expect(
			replayCompatibilityIssues(
				world,
				[
					{
						sequence: 1,
						command: "move east",
						outputMessages: resultingState.messages.slice(game.messages.length),
						resultingState: incompatibleState,
					},
				],
				incompatibleState,
			),
		).toEqual(
			expect.arrayContaining([
				"turn 1 produced a different game state",
				"current state does not match replayed command history",
			]),
		);
	});
});
