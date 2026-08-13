/** @jest-environment node */

import {createBlankWorldDocument} from "@/data/worlds/createBlankWorld";
import {WorldSchema} from "@/schemas/world/worldSchema";

import {PERSISTED_SCHEMA_VERSION, migrationFrom} from ".";
import {applyVersionedTransform} from "./types";
import {v2ToV3} from "./v2ToV3";

describe("the v2 to v3 reviewed-contract migration", () => {
	it("preserves a retained v2 world while advancing its version", () => {
		const legacyWorld = createBlankWorldDocument("Retained v2 world");
		const result = applyVersionedTransform(v2ToV3, 2, v2ToV3.world, legacyWorld, {
			id: "world-1",
			name: "Retained v2 world",
			storage: "editor",
		});

		expect(result).toEqual({
			applied: true,
			schemaVersion: 3,
			value: legacyWorld,
		});
		expect(WorldSchema.parse(result.value)).toEqual(legacyWorld);
	});

	it("preserves retained game-state JSON while advancing its version", () => {
		const value = {retained: true, nested: [{authored: "unchanged"}]};
		const result = applyVersionedTransform(v2ToV3, 2, v2ToV3.gameState, value, {
			playthroughId: "playthrough-1",
			sequence: null,
			storage: "current",
		});

		expect(result).toEqual({applied: true, schemaVersion: 3, value});
	});

	it("preserves retained message JSON while advancing its version", () => {
		const value = {retained: true, nested: [{authored: "unchanged"}]};
		const result = applyVersionedTransform(v2ToV3, 2, v2ToV3.messages, value, {
			playthroughId: "playthrough-1",
			sequence: null,
			storage: "transcript",
		});

		expect(result).toEqual({applied: true, schemaVersion: 3, value});
	});

	it("remains the registered migration from version 2", () => {
		const value = {retained: true};
		const result = applyVersionedTransform(v2ToV3, 3, v2ToV3.world, value, {
			id: "world-1",
			storage: "editor",
		});

		expect(PERSISTED_SCHEMA_VERSION).toBe(9);
		expect(migrationFrom(2)).toBe(v2ToV3);
		expect(result).toEqual({
			applied: false,
			schemaVersion: 3,
			value,
		});
	});
});
