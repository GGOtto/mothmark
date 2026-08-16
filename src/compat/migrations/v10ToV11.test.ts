/** @jest-environment node */

import {createPlayerTestScenario} from "@/engine/utils/testUtils";
import {GameStateSchema} from "@/schemas/states/gameStateSchemas";
import {PERSISTED_SCHEMA_VERSION, migrationFrom} from ".";
import {observableState} from "../replayCompatibility";
import {applyVersionedTransform} from "./types";
import {v10ToV11} from "./v10ToV11";

describe("the v10 to v11 deterministic-random-message replay migration", () => {
	it("uses the final replayed turn as current state and rebuilds its transcript", () => {
		const scenario = createPlayerTestScenario("navigation");
		const current = applyVersionedTransform(v10ToV11, 10, v10ToV11.gameState, scenario.game, {
			playthroughId: "playthrough-1",
			sequence: null,
			storage: "current",
			world: scenario.world,
			previousState: scenario.game,
		});
		const transcript = applyVersionedTransform(v10ToV11, 10, v10ToV11.messages, [], {
			playthroughId: "playthrough-1",
			sequence: null,
			storage: "transcript",
			gameState: current.value,
			previousState: scenario.game,
		});
		const parsed = GameStateSchema.parse(current.value);

		expect(current.schemaVersion).toBe(11);
		expect(observableState(parsed)).toEqual(observableState(scenario.game));
		expect(transcript.value).toEqual(parsed.messages);
	});

	it("is the final adjacent migration and applies only at v10", () => {
		const value = {retained: true};
		const applied = applyVersionedTransform(v10ToV11, 10, v10ToV11.world, value, {
			id: "world-1",
			storage: "editor",
		});
		const skipped = applyVersionedTransform(v10ToV11, 11, v10ToV11.world, value, {
			id: "world-1",
			storage: "editor",
		});

		expect(PERSISTED_SCHEMA_VERSION).toBe(13);
		expect(migrationFrom(10)).toBe(v10ToV11);
		expect(migrationFrom(11)).toBeDefined();
		expect(applied).toEqual({applied: true, schemaVersion: 11, value});
		expect(skipped).toEqual({applied: false, schemaVersion: 11, value});
	});
});
