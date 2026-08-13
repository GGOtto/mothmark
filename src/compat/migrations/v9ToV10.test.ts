/** @jest-environment node */

import {resolveTurn} from "@/engine/player/resolveTurn";
import {createPlayerTestScenario} from "@/engine/utils/testUtils";
import {GameStateSchema} from "@/schemas/states/gameStateSchemas";
import {PERSISTED_SCHEMA_VERSION, migrationFrom} from ".";
import {observableState} from "../replayCompatibility";
import {applyVersionedTransform} from "./types";
import {v9ToV10} from "./v9ToV10";

describe("the v9 to v10 indented-room-listing replay migration", () => {
	it("replays retained state and messages without changing the pinned world", () => {
		const scenario = createPlayerTestScenario("navigation");
		const previous = resolveTurn(scenario.world, scenario.game, "east");
		const expected = resolveTurn(scenario.world, previous, "west");
		const stale = structuredClone(expected) as unknown as Record<string, unknown>;
		const player = stale.player as Record<string, unknown>;
		player.turns = 999;

		const state = applyVersionedTransform(v9ToV10, 9, v9ToV10.gameState, stale, {
			playthroughId: "playthrough-1",
			sequence: 2,
			storage: "turn",
			world: scenario.world,
			command: "west",
			previousState: previous,
		});
		const parsed = GameStateSchema.parse(state.value);
		const output = applyVersionedTransform(v9ToV10, 9, v9ToV10.messages, [], {
			playthroughId: "playthrough-1",
			sequence: 2,
			storage: "output",
			gameState: parsed,
			previousState: previous,
		});

		expect(state.schemaVersion).toBe(10);
		expect(observableState(parsed)).toEqual(observableState(expected));
		expect(output.value).toEqual(parsed.messages.slice(previous.messages.length));
		expect(parsed.messages.at(-1)?.text).toContain("\n A small brass bell hangs beside the doorway.");
		expect(v9ToV10.world).toBeDefined();
	});

	it("is the final adjacent migration and applies only at v9", () => {
		const value = {retained: true};
		const applied = applyVersionedTransform(v9ToV10, 9, v9ToV10.world, value, {
			id: "world-1",
			storage: "editor",
		});
		const skipped = applyVersionedTransform(v9ToV10, 10, v9ToV10.world, value, {
			id: "world-1",
			storage: "editor",
		});

		expect(PERSISTED_SCHEMA_VERSION).toBe(10);
		expect(migrationFrom(9)).toBe(v9ToV10);
		expect(migrationFrom(10)).toBeUndefined();
		expect(applied).toEqual({applied: true, schemaVersion: 10, value});
		expect(skipped).toEqual({applied: false, schemaVersion: 10, value});
	});
});
