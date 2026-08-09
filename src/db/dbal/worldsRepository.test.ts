/** @jest-environment node */

import {WorldSchema} from "@/schemas/world/worldSchema";
import {
	createBlankWorldDocument,
	createWorldExportDocument,
	remainingWorldCapacity,
} from "./worldsRepository";

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

describe("world export", () => {
	it("emits a current schema-backed world document with recovery metadata", () => {
		const exportedAt = new Date("2026-08-08T12:00:00.000Z");
		const exported = createWorldExportDocument(
			{
				editorSlug: "the-archive",
				id: "8ebc3f3f-b9ca-4f75-898f-e196bae50be4",
				name: "Quiet beginning",
				revision: 4,
				schemaVersion: 1,
				world: createBlankWorldDocument("Quiet beginning"),
			},
			exportedAt,
		);
		expect(WorldSchema.parse(exported.world)).toEqual(exported.world);
		expect(exported).toMatchObject({
			exportedAt: exportedAt.toISOString(),
			format: "mothmark-world",
			worldName: "Quiet beginning",
			worldRevision: 4,
		});
	});
});
