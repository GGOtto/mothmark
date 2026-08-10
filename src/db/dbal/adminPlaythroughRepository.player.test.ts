/** @jest-environment node */

import {produce} from "immer";

import {resolveTurn} from "@/engine/player/resolveTurn";
import {createPlayerTestScenario} from "@/engine/utils/testUtils";
import {toID} from "@/utils/idUtils";

import {
	DIAGNOSTIC_COMMAND_LIMIT,
	PlaythroughDiagnosticError,
	replayRecordedTurns,
} from "./adminPlaythroughRepository";

describe("administrator replay through the player path", () => {
	const recordedTurn = () => {
		const {world, game} = createPlayerTestScenario("navigation");
		const resultingState = resolveTurn(world, game, "east");
		return {
			world,
			turn: {
				sequence: 1,
				command: "east",
				outputMessages: resultingState.messages.slice(game.messages.length),
				resultingState,
			},
		};
	};

	it("faithfully reproduces a recorded command through resolveTurn", () => {
		const {world, turn} = recordedTurn();
		const result = replayRecordedTurns(world, [turn]);
		expect(result.firstDifference).toBeNull();
		expect(result.steps[0]).toMatchObject({outputDiffers: false, stateDiffers: false});
	});

	it("locates output-only and state differences at the exact command", () => {
		const {world, turn} = recordedTurn();
		const outputDifference = replayRecordedTurns(world, [
			{
				...turn,
				outputMessages: produce(turn.outputMessages, (messages) => {
					if (messages[0]) messages[0].text = "Different visible output";
				}),
			},
		]);
		expect(outputDifference.firstDifference).toBe(1);
		expect(outputDifference.steps[0]).toMatchObject({outputDiffers: true, stateDiffers: false});

		const stateDifference = replayRecordedTurns(world, [
			{
				...turn,
				resultingState: produce(turn.resultingState, (state) => {
					state.player.currentRoom = toID("room", "foyer");
				}),
			},
		]);
		expect(stateDifference.steps[0]).toMatchObject({stateDiffers: true});
		expect(stateDifference.steps[0]?.stateSummary).toContain("Current room changed");
	});

	it("rejects runs beyond the command and time bounds", () => {
		const {world, turn} = recordedTurn();
		expect(() =>
			replayRecordedTurns(
				world,
				Array.from({length: DIAGNOSTIC_COMMAND_LIMIT + 1}, (_, index) => ({
					...turn,
					sequence: index + 1,
				})),
			),
		).toThrow(PlaythroughDiagnosticError);
		const times = [0, 6_000];
		expect(() => replayRecordedTurns(world, [turn], () => times.shift() ?? 6_000)).toThrow(
			PlaythroughDiagnosticError,
		);
	});
});
