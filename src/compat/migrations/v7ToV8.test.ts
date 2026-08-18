/** @jest-environment node */

import {resolveTurn} from "@/engine/player/resolveTurn";
import {createPlayerTestScenario} from "@/engine/utils/testUtils";
import {GameStateSchema} from "@/schemas/states/gameStateSchemas";
import {PERSISTED_SCHEMA_VERSION, migrationFrom} from ".";
import {observableState} from "../replayCompatibility";
import {applyVersionedTransform} from "./types";
import {v7ToV8} from "./v7ToV8";

describe("the v7 to v8 retained game-state replay migration", () => {
	it("replaces a stale turn snapshot with the state produced by its command history", () => {
		const scenario = createPlayerTestScenario("navigation");
		const expected = resolveTurn(scenario.world, scenario.game, "east");
		const stale = structuredClone(expected) as unknown as Record<string, unknown>;
		const player = stale.player as Record<string, unknown>;
		player.turns = 999;
		player.lastCommandSucceeded = false;

		const result = applyVersionedTransform(v7ToV8, 7, v7ToV8.gameState, stale, {
			playthroughId: "playthrough-1",
			sequence: 1,
			storage: "turn",
			world: scenario.world,
			command: "east",
			previousState: scenario.game,
		});

		expect(result.schemaVersion).toBe(8);
		expect(observableState(GameStateSchema.parse(result.value))).toEqual(observableState(expected));
	});

	it("uses the final replayed turn as current state", () => {
		const scenario = createPlayerTestScenario("navigation");
		const replayed = resolveTurn(scenario.world, scenario.game, "east");
		const stale = {...scenario.game, messages: []};
		const result = applyVersionedTransform(v7ToV8, 7, v7ToV8.gameState, stale, {
			playthroughId: "playthrough-1",
			sequence: null,
			storage: "current",
			world: scenario.world,
			previousState: replayed,
		});

		expect(observableState(GameStateSchema.parse(result.value))).toEqual(observableState(replayed));
	});

	it("rebuilds turn output and the final transcript from replayed states", () => {
		const scenario = createPlayerTestScenario("navigation");
		const replayed = resolveTurn(scenario.world, scenario.game, "east");
		const parsedReplay = GameStateSchema.parse(replayed);
		const output = applyVersionedTransform(v7ToV8, 7, v7ToV8.messages, [], {
			playthroughId: "playthrough-1",
			sequence: 1,
			storage: "output",
			gameState: replayed,
			previousState: scenario.game,
		});
		const transcript = applyVersionedTransform(v7ToV8, 7, v7ToV8.messages, [], {
			playthroughId: "playthrough-1",
			sequence: null,
			storage: "transcript",
			gameState: replayed,
		});

		expect(output.value).toEqual(parsedReplay.messages.slice(scenario.game.messages.length));
		expect(transcript.value).toEqual(parsedReplay.messages);
	});

	it("remains adjacent and only applies at v7", () => {
		const value = {retained: true};
		const applied = applyVersionedTransform(v7ToV8, 7, v7ToV8.world, value, {
			id: "world-1",
			storage: "editor",
		});
		const skipped = applyVersionedTransform(v7ToV8, 8, v7ToV8.world, value, {
			id: "world-1",
			storage: "editor",
		});

		expect(PERSISTED_SCHEMA_VERSION).toBe(14);
		expect(migrationFrom(7)).toBe(v7ToV8);
		expect(migrationFrom(8)).toBeDefined();
		expect(applied).toEqual({applied: true, schemaVersion: 8, value});
		expect(skipped).toEqual({applied: false, schemaVersion: 8, value});
	});
});
