/** @jest-environment node */

import {world as initialWorld} from "@/data/worlds/initialWorld";
import {PERSISTED_SCHEMA_VERSION} from "@/compat/migrations";

import {loadEditorWorld} from "./loadMainWorld";

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
		schemaVersion: PERSISTED_SCHEMA_VERSION,
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

	it("loads a version-1 editor world through the one-time blanking migration", async () => {
		const legacyResponse = stored();
		legacyResponse.data.schemaVersion = 1;
		const fetchWorld = jest
			.fn()
			.mockResolvedValueOnce(jsonResponse({data: {csrfToken: "csrf"}}))
			.mockResolvedValueOnce(jsonResponse(legacyResponse, 201));

		const result = await loadEditorWorld(fetchWorld);
		expect(result.world.metadata.title).toBe("My world");
		expect(result.world.rooms).toEqual([]);
		expect(result.world.items).toEqual([]);
		expect(result.world.connections).toEqual([]);
	});
});
