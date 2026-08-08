/** @jest-environment node */

import {world as initialWorld} from "@/data/worlds/initialWorld";

import {loadEditorWorld, migrateRoomFeaturesToItems} from "./loadMainWorld";

const worldId = "8ebc3f3f-b9ca-4f75-898f-e196bae50be4";
const jsonResponse = (body: unknown, status = 200): Response =>
	new Response(JSON.stringify(body), {status, headers: {"content-type": "application/json"}});
const stored = (id = worldId) => ({
	data: {id, name: "My world", revision: 4, world: initialWorld},
});

describe("loadEditorWorld", () => {
	it("prepares CSRF, bootstraps the account, and returns its first private world", async () => {
		const fetchWorld = jest
			.fn()
			.mockResolvedValueOnce(jsonResponse({data: {csrfToken: "csrf"}}))
			.mockResolvedValueOnce(jsonResponse(stored(), 201));

		await expect(loadEditorWorld(fetchWorld)).resolves.toEqual({
			world: initialWorld,
			worldId,
			worldName: "My world",
			revision: 4,
		});
		expect(fetchWorld).toHaveBeenNthCalledWith(1, "/api/auth/csrf", {signal: undefined});
		expect(fetchWorld).toHaveBeenNthCalledWith(2, "/api/editor/bootstrap", {
			method: "POST",
			headers: {"x-csrf-token": "csrf"},
			signal: undefined,
		});
	});

	it("loads an explicitly requested world only through the owner-scoped ID route", async () => {
		const requestedId = "f76f909d-5c82-4b04-aec6-85c9a175e1a2";
		const fetchWorld = jest
			.fn()
			.mockResolvedValueOnce(jsonResponse({data: {csrfToken: "csrf"}}))
			.mockResolvedValueOnce(jsonResponse(stored()))
			.mockResolvedValueOnce(jsonResponse(stored(requestedId)));

		await expect(loadEditorWorld(fetchWorld, undefined, requestedId)).resolves.toMatchObject({
			worldId: requestedId,
		});
		expect(fetchWorld).toHaveBeenLastCalledWith(`/api/world/${requestedId}`, {signal: undefined});
	});

	it("does not replace an authorization or server failure with shared fallback data", async () => {
		const fetchWorld = jest
			.fn()
			.mockResolvedValueOnce(jsonResponse({data: {csrfToken: "csrf"}}))
			.mockResolvedValueOnce(jsonResponse({error: {}}, 401));
		await expect(loadEditorWorld(fetchWorld)).rejects.toThrow(
			"Failed to load the editor world (401)",
		);
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
		});
	});
});
