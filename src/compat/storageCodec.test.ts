/** @jest-environment node */

import {world as initialWorld} from "@/data/worlds/initialWorld";

import {PERSISTED_SCHEMA_VERSION} from "./migrations";
import {parseStoredWorld, UnsupportedStorageVersionError} from "./storageCodec";

describe("versioned storage codec", () => {
	it("loads a version-1 editor world through the destructive initial migration", () => {
		const world = parseStoredWorld(initialWorld, 1, {
			id: "world-1",
			name: "A clean slate",
			storage: "editor",
		});
		expect(world.metadata.title).toBe("A clean slate");
		expect(world.rooms).toEqual([]);
		expect(world.items).toEqual([]);
	});

	it("does not run an old migration against a current world", () => {
		expect(parseStoredWorld(initialWorld, PERSISTED_SCHEMA_VERSION)).toEqual(initialWorld);
	});

	it("rejects documents created by a newer unsupported deployment", () => {
		expect(() => parseStoredWorld(initialWorld, PERSISTED_SCHEMA_VERSION + 1)).toThrow(
			UnsupportedStorageVersionError,
		);
	});
});
