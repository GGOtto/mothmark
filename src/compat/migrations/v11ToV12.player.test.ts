/** @jest-environment node */

import {lookCommand, openCommand} from "@/data/commands/initialCommands";
import {createInitialGameState} from "@/engine/states/createInitialState";
import {createPlayerTestItem, createPlayerTestScenario} from "@/engine/utils/testUtils";
import {GameStateSchema} from "@/schemas/states/gameStateSchemas";
import {ContainerBehaviorSchema, OpenableBehaviorSchema} from "@/schemas/world/itemSchema";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {toID} from "@/utils/idUtils";
import {produce} from "immer";
import {replayCompatibilityIssues} from "../replayCompatibility";
import {applyVersionedTransform} from "./types";
import {v11ToV12} from "./v11ToV12";

describe("the v11 to v12 migration through the player path", () => {
	it("replays a container opening into nested parent-listing output", () => {
		const scenario = createPlayerTestScenario("navigation");
		const chest = produce(
			createPlayerTestItem("chest", "Chest", "A chest rests here.", "foyer"),
			(draft) => {
				draft.behaviors = [
					createDefaultFieldObject(ContainerBehaviorSchema),
					createDefaultFieldObject(OpenableBehaviorSchema),
				];
			},
		);
		const key = produce(
			createPlayerTestItem("key", "Key", "A small key lies inside.", "foyer"),
			(draft) => {
				draft.initialState.location = {
					type: "item",
					itemId: toID("item", "chest"),
					placement: "inside",
				};
			},
		);
		const world = produce(scenario.world, (draft) => {
			draft.items = [key, chest];
			draft.commands.push(lookCommand, openCommand);
		});
		const initial = createInitialGameState(world, world.startRoomId);

		const commands = ["look", "open chest", "look"];
		const turns: Array<{
			sequence: number;
			command: string;
			outputMessages: typeof initial.messages;
			resultingState: typeof initial;
		}> = [];
		let previous = initial;
		for (const [index, command] of commands.entries()) {
			const sequence = index + 1;
			const resultingState = GameStateSchema.parse(
				applyVersionedTransform(v11ToV12, 11, v11ToV12.gameState, previous, {
					playthroughId: "playthrough-1",
					sequence,
					storage: "turn",
					world,
					command,
					previousState: previous,
				}).value,
			);
			const outputMessages = applyVersionedTransform(v11ToV12, 11, v11ToV12.messages, [], {
				playthroughId: "playthrough-1",
				sequence,
				storage: "output",
				gameState: resultingState,
				previousState: previous,
			}).value as typeof initial.messages;
			turns.push({sequence, command, outputMessages, resultingState});
			previous = resultingState;
		}

		expect(turns[0].resultingState.messages.at(-1)?.text).not.toContain("A small key lies inside.");
		expect(turns[2].resultingState.messages.at(-1)?.text).toContain(
			" A chest rests here.\n  A small key lies inside.",
		);
		expect(replayCompatibilityIssues(world, turns, previous)).toEqual([]);
	});
});
