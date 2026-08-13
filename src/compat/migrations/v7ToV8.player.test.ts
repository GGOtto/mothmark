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
		const firstOutput = applyVersionedTransform(v7ToV8, 7, v7ToV8.messages, [], {
			playthroughId: "playthrough-1",
			sequence: 1,
			storage: "output",
			gameState: first,
			previousState: scenario.game,
		}).value as typeof first.messages;
		const secondOutput = applyVersionedTransform(v7ToV8, 7, v7ToV8.messages, [], {
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
					{
						sequence: 1,
						command: "east",
						outputMessages: firstOutput,
						resultingState: first,
					},
					{
						sequence: 2,
						command: "west",
						outputMessages: secondOutput,
						resultingState: second,
					},
				],
				current,
			),
		).toEqual([]);
		expect(firstOutput.map(({text, type}) => ({text, type}))).toEqual(
			firstReplay.messages.slice(scenario.game.messages.length).map(({text, type}) => ({text, type})),
		);
		expect(secondOutput.map(({text, type}) => ({text, type}))).toEqual(
			secondReplay.messages.slice(first.messages.length).map(({text, type}) => ({text, type})),
		);
	});
});
