/** @jest-environment node */

import {produce} from "immer";
import {GameStateSchema} from "@/schemas/states/gameStateSchemas";
import {createPlayerTestEvent, createPlayerTestScenario} from "@/engine/utils/testUtils";
import {replayCompatibilityIssues} from "../replayCompatibility";
import {applyVersionedTransform} from "./types";
import {v10ToV11} from "./v10ToV11";

describe("the v10 to v11 migration through the player path", () => {
	it("rebuilds random-message turns into an exhaustively replayable history", () => {
		const scenario = createPlayerTestScenario("navigation");
		const event = createPlayerTestEvent(
			"random-message",
			[
				{
					type: "message",
					operation: "show-random",
					messages: ["A shutter clicks.", "A dog barks twice.", "A bicycle rattles past."],
				},
			],
			(draft) => {
				draft.disposable = true;
			},
		);
		const world = produce(scenario.world, (draft) => {
			draft.events = [event];
		});
		const initial = {...scenario.game, events: [event]};
		const turn = GameStateSchema.parse(
			applyVersionedTransform(v10ToV11, 10, v10ToV11.gameState, initial, {
				playthroughId: "playthrough-1",
				sequence: 1,
				storage: "turn",
				world,
				command: "help",
				previousState: initial,
			}).value,
		);
		const output = applyVersionedTransform(v10ToV11, 10, v10ToV11.messages, [], {
			playthroughId: "playthrough-1",
			sequence: 1,
			storage: "output",
			gameState: turn,
			previousState: initial,
		}).value as typeof turn.messages;

		expect(
			replayCompatibilityIssues(
				world,
				[{sequence: 1, command: "help", outputMessages: output, resultingState: turn}],
				turn,
			),
		).toEqual([]);
		expect(turn.player.randomState).not.toBe(initial.player.randomState);
	});
});
