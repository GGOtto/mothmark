/** @jest-environment node */

import {toID} from "@/utils/idUtils";
import {PERSISTED_SCHEMA_VERSION, migrationFrom} from ".";
import {applyVersionedTransform} from "./types";
import {v8ToV9} from "./v8ToV9";

describe("the v8 to v9 saved-condition name migration", () => {
	it("adds a neutral name to legacy saved conditions and preserves authored data", () => {
		const retained = {
			metadata: {preserved: true},
			conditions: [
				{
					identity: toID("condition", "legacy-condition"),
					condition: {type: "world", operation: "flag-is", flag: "gate.open", value: true},
				},
				{
					identity: toID("condition", "named-condition"),
					name: "Gate is open",
					condition: {type: "world", operation: "flag-is", flag: "gate.open", value: true},
				},
			],
		};

		const result = applyVersionedTransform(v8ToV9, 8, v8ToV9.world, retained, {
			id: "world-1",
			storage: "editor",
		});

		expect(result).toEqual({
			applied: true,
			schemaVersion: 9,
			value: {
				...retained,
				conditions: [{...retained.conditions[0], name: ""}, retained.conditions[1]],
			},
		});
	});

	it("is the final adjacent migration and only applies at v8", () => {
		const value = {retained: true};
		const applied = applyVersionedTransform(v8ToV9, 8, v8ToV9.world, value, {
			id: "world-1",
			storage: "editor",
		});
		const skipped = applyVersionedTransform(v8ToV9, 9, v8ToV9.world, value, {
			id: "world-1",
			storage: "editor",
		});

		expect(PERSISTED_SCHEMA_VERSION).toBe(9);
		expect(migrationFrom(8)).toBe(v8ToV9);
		expect(migrationFrom(9)).toBeUndefined();
		expect(applied).toEqual({applied: true, schemaVersion: 9, value});
		expect(skipped).toEqual({applied: false, schemaVersion: 9, value});
	});
});
