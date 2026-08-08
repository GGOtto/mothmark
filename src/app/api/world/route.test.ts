/** @jest-environment node */

import {resolveCurrentActor} from "@/auth/currentActor";
import {world as initialWorld} from "@/data/worlds/initialWorld";
import {
	deleteOwnedWorld,
	getOwnedWorld,
	listOwnedWorlds,
	updateOwnedWorld,
	type WorldRecord,
} from "@/db/dbal/worldsRepository";

import {DELETE, GET as getById, PUT} from "./[id]/route";
import {PATCH as updateSchemaVersion} from "./[id]/schema-version/route";
import {POST as createDefault} from "./default/route";
import {GET as list, POST as create} from "./route";
import {GET as getBySlug} from "./slug/[slug]/route";

jest.mock("@/auth/currentActor", () => ({resolveCurrentActor: jest.fn()}));
jest.mock("@/db/dbal/worldsRepository", () => ({
	deleteOwnedWorld: jest.fn(),
	getOwnedWorld: jest.fn(),
	listOwnedWorlds: jest.fn(),
	updateOwnedWorld: jest.fn(),
}));

const worldId = "8ebc3f3f-b9ca-4f75-898f-e196bae50be4";
const userId = "3e816c4d-b957-45dc-8523-d53ec04c8d0f";
const csrf = "csrf-token";
const actor = {userId, accountType: "anonymous", siteRole: "user", audience: "editor"} as const;

const storedWorld: WorldRecord = {
	id: worldId,
	name: "Main World",
	slug: null,
	world: initialWorld,
	revision: 1,
	schemaVersion: 1,
	ownerUserId: userId,
	kind: "editor",
	updatedByUserId: userId,
	deletedAt: null,
	createdAt: new Date("2026-07-18T01:00:00.000Z"),
	updatedAt: new Date("2026-07-18T02:00:00.000Z"),
};

const request = (path: string, method = "GET", body?: unknown): Request =>
	new Request(`http://localhost${path}`, {
		method,
		headers: {
			...(body === undefined ? {} : {"content-type": "application/json"}),
			...(method === "GET"
				? {}
				: {origin: "http://localhost", cookie: `mothmark_editor_csrf=${csrf}`, "x-csrf-token": csrf}),
		},
		body: body === undefined ? undefined : JSON.stringify(body),
	});

describe("private world API", () => {
	beforeEach(() => jest.mocked(resolveCurrentActor).mockResolvedValue(actor));

	it("requires an active editor session", async () => {
		jest.mocked(resolveCurrentActor).mockResolvedValue(undefined);
		const response = await list(request("/api/world"));
		expect(response.status).toBe(401);
		expect(listOwnedWorlds).not.toHaveBeenCalled();
	});

	it("lists only the current owner's active worlds", async () => {
		jest.mocked(listOwnedWorlds).mockResolvedValue([storedWorld]);
		const response = await list(request("/api/world"));
		expect(response.status).toBe(200);
		expect(listOwnedWorlds).toHaveBeenCalledWith(userId);
	});

	it("scopes reads to the current owner", async () => {
		jest.mocked(getOwnedWorld).mockResolvedValue(storedWorld);
		const response = await getById(request(`/api/world/${worldId}`), {
			params: Promise.resolve({id: worldId}),
		});
		expect(response.status).toBe(200);
		expect(getOwnedWorld).toHaveBeenCalledWith(userId, worldId);
	});

	it("does not distinguish another user's world from a missing world", async () => {
		jest.mocked(getOwnedWorld).mockResolvedValue(undefined);
		const response = await getById(request(`/api/world/${worldId}`), {
			params: Promise.resolve({id: worldId}),
		});
		expect(response.status).toBe(404);
	});

	it("requires same-origin CSRF proof for updates", async () => {
		const response = await PUT(
			new Request(`http://localhost/api/world/${worldId}`, {
				method: "PUT",
				headers: {"content-type": "application/json", origin: "https://attacker.example"},
				body: JSON.stringify({world: initialWorld}),
			}),
			{params: Promise.resolve({id: worldId})},
		);
		expect(response.status).toBe(403);
		expect(updateOwnedWorld).not.toHaveBeenCalled();
	});

	it("updates by owner and retains stale-revision conflict behavior", async () => {
		jest.mocked(updateOwnedWorld).mockResolvedValue(undefined);
		const response = await PUT(
			request(`/api/world/${worldId}`, "PUT", {world: initialWorld, expectedRevision: 3}),
			{params: Promise.resolve({id: worldId})},
		);
		expect(response.status).toBe(409);
		expect(updateOwnedWorld).toHaveBeenCalledWith(userId, worldId, {world: initialWorld}, 3);
	});

	it("soft-deletes only within the owner scope", async () => {
		jest.mocked(deleteOwnedWorld).mockResolvedValue(true);
		const response = await DELETE(request(`/api/world/${worldId}`, "DELETE"), {
			params: Promise.resolve({id: worldId}),
		});
		expect(response.status).toBe(204);
		expect(deleteOwnedWorld).toHaveBeenCalledWith(userId, worldId);
	});

	it("closes generic creation and template/destructive legacy routes", async () => {
		expect(create().status).toBe(405);
		expect(createDefault().status).toBe(404);
		expect(
			(
				await getBySlug(request("/api/world/slug/main"), {
					params: Promise.resolve({slug: "main"}),
				})
			).status,
		).toBe(404);
		expect(
			(
				await updateSchemaVersion(request(`/api/world/${worldId}/schema-version`, "PATCH"), {
					params: Promise.resolve({id: worldId}),
				})
			).status,
		).toBe(404);
	});
});
