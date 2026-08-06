/** @jest-environment node */

import {world as initialWorld} from "@/data/worlds/initialWorld";

import {loadMainWorld, migrateRoomFeaturesToItems} from "./loadMainWorld";

const jsonResponse = (body: unknown, status = 200): Response =>
	new Response(JSON.stringify(body), {
		status,
		headers: {"content-type": "application/json"},
	});

describe("loadMainWorld", () => {
	it("loads the persisted main world when it exists", async () => {
		const persistedWorld = {
			...initialWorld,
			metadata: {...initialWorld.metadata, title: "Persisted Main World"},
		};
		const fetchWorld = jest.fn().mockResolvedValue(
			jsonResponse({
				data: {
					id: "8ebc3f3f-b9ca-4f75-898f-e196bae50be4",
					revision: 4,
					slug: "main",
					world: persistedWorld,
				},
			}),
		);

		await expect(loadMainWorld(fetchWorld)).resolves.toEqual({
			world: persistedWorld,
			worldId: "8ebc3f3f-b9ca-4f75-898f-e196bae50be4",
			revision: 4,
		});
		expect(fetchWorld).toHaveBeenCalledWith("/api/world/slug/main", {signal: undefined});
	});

	it("uses the initial world when the main slug does not exist", async () => {
		const fetchWorld = jest.fn().mockResolvedValue(jsonResponse({error: {}}, 404));

		await expect(loadMainWorld(fetchWorld)).resolves.toEqual({
			world: initialWorld,
			worldId: null,
			revision: null,
		});
	});

	it("uses the initial world when the persisted main world fails schema validation", async () => {
		const fetchWorld = jest.fn().mockResolvedValue(
			jsonResponse({
				data: {
					id: "8ebc3f3f-b9ca-4f75-898f-e196bae50be4",
					revision: 4,
					slug: "main",
					world: {},
				},
			}),
		);

		await expect(loadMainWorld(fetchWorld)).resolves.toEqual({
			world: initialWorld,
			worldId: "8ebc3f3f-b9ca-4f75-898f-e196bae50be4",
			revision: 4,
		});
	});

	it("migrates room-local features into non-takeable global items", () => {
		const legacyWorld = JSON.parse(JSON.stringify(initialWorld)) as Record<string, unknown>;
		delete legacyWorld.items;
		const rooms = legacyWorld.rooms as Array<Record<string, unknown>>;
		rooms[0].features = [
			{
				id: {type: "feature", id: "old-table"},
				name: "Old table",
				aliases: ["table"],
				tags: ["wooden"],
				kind: "surface",
				description: "Its boards are scarred.",
				listedInRoom: true,
				flags: {examined: false},
			},
		];

		const migrated = migrateRoomFeaturesToItems(legacyWorld) as typeof initialWorld;

		expect((migrated.rooms[0] as unknown as {features?: unknown}).features).toBeUndefined();
		expect(migrated.items[0]).toMatchObject({
			id: {type: "item", id: "old-table"},
			name: "Old table",
			behaviors: [{type: "surface"}],
			initialState: {location: {type: "room", roomId: migrated.rooms[0].id}},
		});
		expect(migrated.items[0].behaviors).not.toEqual(expect.arrayContaining([{type: "takeable"}]));
	});

	it("does not hide server failures behind the initial world", async () => {
		const fetchWorld = jest.fn().mockResolvedValue(jsonResponse({error: {}}, 500));

		await expect(loadMainWorld(fetchWorld)).rejects.toThrow("Failed to load the main world (500).");
	});
});
