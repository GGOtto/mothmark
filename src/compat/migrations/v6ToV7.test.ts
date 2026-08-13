/** @jest-environment node */

import {toID} from "@/utils/idUtils";
import {PERSISTED_SCHEMA_VERSION, migrationFrom} from ".";
import {applyVersionedTransform} from "./types";
import {LEGACY_EMPTY_FLAG_KEY, v6ToV7} from "./v6ToV7";

describe("the v6 to v7 empty logic flag migration", () => {
	it("renames blank condition and effect flag references without changing unrelated fields", () => {
		const retained = {
			metadata: {preserved: true},
			conditions: [
				{
					identity: toID("condition", "legacy-empty"),
					condition: {type: "world", operation: "flag-is", flag: "", value: true},
				},
			],
			effects: [
				{
					type: "group",
					id: toID("effect", "legacy-empty"),
					name: "Legacy empty flag",
					allowMultipleUsesInWorld: true,
					effects: [{type: "world", operation: "set-flag", flag: "", value: true}],
				},
			],
		};
		const result = applyVersionedTransform(v6ToV7, 6, v6ToV7.world, retained, {
			id: "world-1",
			storage: "editor",
		});

		expect(result.schemaVersion).toBe(7);
		expect(result.value).toEqual({
			...retained,
			conditions: [
				{
					...retained.conditions[0],
					condition: {
						...retained.conditions[0].condition,
						flag: LEGACY_EMPTY_FLAG_KEY,
					},
				},
			],
			effects: [
				{
					...retained.effects[0],
					effects: [
						{
							...retained.effects[0].effects[0],
							flag: LEGACY_EMPTY_FLAG_KEY,
						},
					],
				},
			],
		});
	});

	it("is the final adjacent migration and only applies at v6", () => {
		const value = {retained: true};
		const applied = applyVersionedTransform(v6ToV7, 6, v6ToV7.world, value, {
			id: "world-1",
			storage: "editor",
		});
		const skipped = applyVersionedTransform(v6ToV7, 7, v6ToV7.world, value, {
			id: "world-1",
			storage: "editor",
		});

		expect(PERSISTED_SCHEMA_VERSION).toBe(12);
		expect(migrationFrom(6)).toBe(v6ToV7);
		expect(migrationFrom(7)).toBeDefined();
		expect(applied).toEqual({applied: true, schemaVersion: 7, value});
		expect(skipped).toEqual({applied: false, schemaVersion: 7, value});
	});
});
