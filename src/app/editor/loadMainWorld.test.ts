/** @jest-environment node */

import {world as initialWorld} from "@/data/worlds/initialWorld";

import {loadEditorWorld, migrateRoomFeaturesToItems} from "./loadMainWorld";

const worldId = "8ebc3f3f-b9ca-4f75-898f-e196bae50be4";
const userId = "3e816c4d-b957-45dc-8523-d53ec04c8d0f";
const jsonResponse = (body: unknown, status = 200): Response =>
	new Response(JSON.stringify(body), {status, headers: {"content-type": "application/json"}});
const stored = (id = worldId) => ({
	data: {
		editorSlug: "my-world",
		id,
		name: "My world",
		ownerUserId: userId,
		revision: 4,
		world: initialWorld,
	},
});

describe("loadEditorWorld", () => {
	it("prepares CSRF, bootstraps the account, and returns its first private world", async () => {
		const fetchWorld = jest
			.fn()
			.mockResolvedValueOnce(jsonResponse({data: {csrfToken: "csrf"}}))
			.mockResolvedValueOnce(jsonResponse(stored(), 201));

		await expect(loadEditorWorld(fetchWorld)).resolves.toEqual({
			editorSlug: "my-world",
			world: initialWorld,
			worldId,
			worldName: "My world",
			userId,
			revision: 4,
		});
		expect(fetchWorld).toHaveBeenNthCalledWith(1, "/api/auth/csrf", {signal: undefined});
		expect(fetchWorld).toHaveBeenNthCalledWith(2, "/api/editor/bootstrap", {
			method: "POST",
			headers: {"content-type": "application/json", "x-csrf-token": "csrf"},
			body: JSON.stringify({openWorld: true}),
			signal: undefined,
		});
	});

	it("loads an explicitly requested world only through the owner-scoped locator route", async () => {
		const requestedId = "my-world";
		const fetchWorld = jest
			.fn()
			.mockResolvedValueOnce(jsonResponse({data: {csrfToken: "csrf"}}))
			.mockResolvedValueOnce(jsonResponse({data: null, meta: {userId}}))
			.mockResolvedValueOnce(jsonResponse(stored()));

		await expect(loadEditorWorld(fetchWorld, undefined, requestedId)).resolves.toMatchObject({
			worldId,
		});
		expect(fetchWorld).toHaveBeenLastCalledWith(`/api/world/${requestedId}`, {signal: undefined});
		expect(fetchWorld).toHaveBeenNthCalledWith(2, "/api/editor/bootstrap", {
			method: "POST",
			headers: {"content-type": "application/json", "x-csrf-token": "csrf"},
			body: JSON.stringify({openWorld: false}),
			signal: undefined,
		});
	});

	it("falls back to the internal ID during a rolling deployment without editor slugs", async () => {
		const legacyResponse = stored();
		delete (legacyResponse.data as {editorSlug?: string}).editorSlug;
		const fetchWorld = jest
			.fn()
			.mockResolvedValueOnce(jsonResponse({data: {csrfToken: "csrf"}}))
			.mockResolvedValueOnce(jsonResponse(legacyResponse, 201));

		await expect(loadEditorWorld(fetchWorld)).resolves.toMatchObject({
			editorSlug: worldId,
			worldId,
		});
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
