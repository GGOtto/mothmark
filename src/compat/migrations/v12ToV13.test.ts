/** @jest-environment node */

import {createPlayerTestScenario} from "@/engine/utils/testUtils";
import {GameMessageSchema, GameStateSchema} from "@/schemas/states/gameStateSchemas";
import {WorldSchema} from "@/schemas/world/worldSchema";

import {migrationFrom, PERSISTED_SCHEMA_VERSION} from ".";
import {applyVersionedTransform} from "./types";
import {v12ToV13} from "./v12ToV13";

describe("the v12 to v13 item-behavior discovery contract migration", () => {
	it("preserves retained world JSON while advancing its version", () => {
		const value = structuredClone(createPlayerTestScenario("navigation").world);
		const result = applyVersionedTransform(v12ToV13, 12, v12ToV13.world, value, {
			id: "world-1",
			storage: "editor",
		});

		expect(result).toEqual({applied: true, schemaVersion: 13, value});
		expect(WorldSchema.safeParse(result.value).success).toBe(true);
	});

	it("preserves retained game-state JSON while advancing its version", () => {
		const value = structuredClone(createPlayerTestScenario("navigation").game);
		const result = applyVersionedTransform(v12ToV13, 12, v12ToV13.gameState, value, {
			playthroughId: "playthrough-1",
			sequence: null,
			storage: "current",
		});

		expect(result).toEqual({applied: true, schemaVersion: 13, value});
		expect(GameStateSchema.safeParse(result.value).success).toBe(true);
	});

	it("preserves retained message JSON while advancing its version", () => {
		const value = structuredClone(createPlayerTestScenario("navigation").game.messages);
		const result = applyVersionedTransform(v12ToV13, 12, v12ToV13.messages, value, {
			playthroughId: "playthrough-1",
			sequence: null,
			storage: "transcript",
		});

		expect(result).toEqual({applied: true, schemaVersion: 13, value});
		expect(GameMessageSchema.array().safeParse(result.value).success).toBe(true);
	});

	it("is the final adjacent migration and cannot run twice", () => {
		const value = {retained: true};
		const result = applyVersionedTransform(
			v12ToV13,
			PERSISTED_SCHEMA_VERSION,
			v12ToV13.world,
			value,
			{id: "world-1", storage: "editor"},
		);

		expect(PERSISTED_SCHEMA_VERSION).toBe(13);
		expect(migrationFrom(12)).toBe(v12ToV13);
		expect(migrationFrom(PERSISTED_SCHEMA_VERSION)).toBeUndefined();
		expect(result).toEqual({
			applied: false,
			schemaVersion: PERSISTED_SCHEMA_VERSION,
			value,
		});
	});
});
