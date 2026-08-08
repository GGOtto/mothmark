/** @jest-environment node */

import {WorldSchema} from "@/schemas/world/worldSchema";
import {createBlankWorldDocument, remainingWorldCapacity} from "./worldsRepository";

describe("owned-world capacity", () => {
	it.each([
		[5, 5, 0],
		[4, 5, 1],
		[0, 5, 5],
		[7, 5, 0],
	])("reports capacity for %i active worlds under a limit of %i", (active, max, remaining) => {
		expect(remainingWorldCapacity(active, max)).toBe(remaining);
	});
});

describe("blank world creation", () => {
	it("creates a schema-valid minimal world without starter scenery", () => {
		const world = createBlankWorldDocument("Quiet beginning");
		expect(WorldSchema.parse(world)).toEqual(world);
		expect(world.metadata.title).toBe("Quiet beginning");
		expect(world.rooms).toEqual([]);
		expect(world.metadata.layers).toEqual([]);
		expect(world.items).toEqual([]);
		expect(world.connections).toEqual([]);
	});
});
