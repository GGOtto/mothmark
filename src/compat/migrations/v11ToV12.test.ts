/** @jest-environment node */

import {createPlayerTestScenario} from "@/engine/utils/testUtils";
import {GameStateSchema} from "@/schemas/states/gameStateSchemas";
import {PERSISTED_SCHEMA_VERSION, migrationFrom} from ".";
import {observableState} from "../replayCompatibility";
import {applyVersionedTransform} from "./types";
import {v11ToV12} from "./v11ToV12";
import {v12ToV13} from "./v12ToV13";

describe("the v11 to v12 parent-item-listing replay migration", () => {
	it("uses the final replayed turn as current state and rebuilds its transcript", () => {
		const scenario = createPlayerTestScenario("navigation");
		const current = applyVersionedTransform(v11ToV12, 11, v11ToV12.gameState, scenario.game, {
			playthroughId: "playthrough-1",
			sequence: null,
			storage: "current",
			world: scenario.world,
			previousState: scenario.game,
		});
		const transcript = applyVersionedTransform(v11ToV12, 11, v11ToV12.messages, [], {
			playthroughId: "playthrough-1",
			sequence: null,
			storage: "transcript",
			gameState: current.value,
			previousState: scenario.game,
		});
		const parsed = GameStateSchema.parse(current.value);

		expect(current.schemaVersion).toBe(12);
		expect(observableState(parsed)).toEqual(observableState(scenario.game));
		expect(transcript.value).toEqual(parsed.messages);
	});

	it("is the final adjacent migration and applies only at v11", () => {
		const value = {retained: true};
		const applied = applyVersionedTransform(v11ToV12, 11, v11ToV12.world, value, {
			id: "world-1",
			storage: "editor",
		});
		const skipped = applyVersionedTransform(v11ToV12, 12, v11ToV12.world, value, {
			id: "world-1",
			storage: "editor",
		});

		expect(PERSISTED_SCHEMA_VERSION).toBe(13);
		expect(migrationFrom(11)).toBe(v11ToV12);
		expect(migrationFrom(12)).toBe(v12ToV13);
		expect(applied).toEqual({applied: true, schemaVersion: 12, value});
		expect(skipped).toEqual({applied: false, schemaVersion: 12, value});
	});
});
