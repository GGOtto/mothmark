/** @jest-environment node */

import {resolveCurrentActor} from "@/auth/currentActor";
import {PERSISTED_SCHEMA_VERSION} from "@/compat/migrations";
import {world as initialWorld} from "@/data/worlds/initialWorld";
import {userHasPermission} from "@/db/dbal/permissionRepository";
import {
	createOwnedWorld,
	deleteOwnedWorld,
	duplicateOwnedWorld,
	exportOwnedWorld,
	getOwnedWorld,
	getOwnedWorldBySlug,
	getOwnedWorldLibrary,
	listOwnedTrashedWorlds,
	permanentlyDeleteOwnedWorld,
	restoreOwnedWorld,
	updateOwnedWorld,
	type WorldRecord,
} from "@/db/dbal/worldsRepository";

import {DELETE, GET as getById, PUT} from "./[id]/route";
import {POST as duplicate} from "./[id]/duplicate/route";
import {GET as exportWorld} from "./[id]/export/route";
import {POST as restore} from "./[id]/restore/route";
import {PATCH as updateSchemaVersion} from "./[id]/schema-version/route";
import {POST as createDefault} from "./default/route";
import {GET as list, POST as create} from "./route";
import {GET as getBySlug} from "./slug/[slug]/route";

jest.mock("@/auth/currentActor", () => ({resolveCurrentActor: jest.fn()}));
jest.mock("@/db/dbal/permissionRepository", () => ({userHasPermission: jest.fn()}));
jest.mock("@/db/dbal/worldsRepository", () => ({
	deleteOwnedWorld: jest.fn(),
	duplicateOwnedWorld: jest.fn(),
	exportOwnedWorld: jest.fn(),
	createOwnedWorld: jest.fn(),
	getOwnedWorld: jest.fn(),
	getOwnedWorldBySlug: jest.fn(),
	getOwnedWorldLibrary: jest.fn(),
	listOwnedTrashedWorlds: jest.fn(),
	permanentlyDeleteOwnedWorld: jest.fn(),
	restoreOwnedWorld: jest.fn(),
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
	schemaVersion: PERSISTED_SCHEMA_VERSION,
	ownerUserId: userId,
	kind: "editor",
	updatedByUserId: userId,
	deletedAt: null,
	editorSlug: "main-world",
	trashPurgeAfter: null,
	createdAt: new Date("2026-07-18T01:00:00.000Z"),
	updatedAt: new Date("2026-07-18T02:00:00.000Z"),
	lastOpenedAt: new Date("2026-07-18T03:00:00.000Z"),
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
	beforeEach(() => {
		jest.mocked(resolveCurrentActor).mockResolvedValue(actor);
		jest.mocked(userHasPermission).mockResolvedValue(true);
	});

	it("keeps ownership authorization separate from capability denial", async () => {
		jest.mocked(userHasPermission).mockResolvedValue(false);
		const response = await PUT(request(`/api/world/${worldId}`, "PUT", {name: "Denied"}), {
			params: Promise.resolve({id: worldId}),
		});
		expect(response.status).toBe(403);
		expect(updateOwnedWorld).not.toHaveBeenCalled();
	});

	it("requires an active editor session", async () => {
		jest.mocked(resolveCurrentActor).mockResolvedValue(undefined);
		const response = await list(request("/api/world"));
		expect(response.status).toBe(401);
		expect(getOwnedWorldLibrary).not.toHaveBeenCalled();
	});

	it("lists only the current owner's active worlds", async () => {
		jest.mocked(getOwnedWorldLibrary).mockResolvedValue({
			worlds: [storedWorld],
			usage: {count: 1, max: 5},
		});
		const response = await list(request("/api/world"));
		expect(response.status).toBe(200);
		expect(getOwnedWorldLibrary).toHaveBeenCalledWith(userId);
		expect(await response.json()).toMatchObject({data: {usage: {count: 1, max: 5}}});
	});

	it("lists only the current owner's trashed worlds", async () => {
		jest.mocked(listOwnedTrashedWorlds).mockResolvedValue([{...storedWorld, deletedAt: new Date()}]);
		const response = await list(request("/api/world?view=trash"));
		expect(response.status).toBe(200);
		expect(listOwnedTrashedWorlds).toHaveBeenCalledWith(userId);
	});

	it("creates a validated starter or blank world within the current owner scope", async () => {
		jest.mocked(createOwnedWorld).mockResolvedValue(storedWorld);
		const response = await create(
			request("/api/world", "POST", {name: "  North archive  ", source: "blank"}),
		);
		expect(response.status).toBe(201);
		expect(createOwnedWorld).toHaveBeenCalledWith(userId, {
			name: "North archive",
			source: "blank",
		});
	});

	it("creates a world from a current schema-backed JSON import", async () => {
		jest.mocked(createOwnedWorld).mockResolvedValue(storedWorld);
		const response = await create(
			request("/api/world", "POST", {
				name: "Imported archive",
				source: "import",
				world: initialWorld,
			}),
		);
		expect(response.status).toBe(201);
		expect(createOwnedWorld).toHaveBeenCalledWith(userId, {
			name: "Imported archive",
			source: "import",
			world: initialWorld,
		});
	});

	it("rejects an invalid imported world before repository access", async () => {
		const response = await create(
			request("/api/world", "POST", {
				name: "Broken import",
				source: "import",
				world: {rooms: []},
			}),
		);
		expect(response.status).toBe(400);
		expect(createOwnedWorld).not.toHaveBeenCalled();
	});

	it("returns the same finite-limit rejection when the UI is bypassed", async () => {
		jest.mocked(createOwnedWorld).mockRejectedValue(
			Object.assign(new Error("This account has reached its limit of 5 worlds."), {
				code: "WORLD_LIMIT_REACHED",
			}),
		);
		const response = await create(
			request("/api/world", "POST", {name: "Too many", source: "starter"}),
		);
		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({
			error: {
				code: "WORLD_LIMIT_REACHED",
				message: "This account has reached its limit of 5 worlds.",
			},
		});
	});

	it("scopes reads to the current owner", async () => {
		jest.mocked(getOwnedWorld).mockResolvedValue(storedWorld);
		const response = await getById(request(`/api/world/${worldId}`), {
			params: Promise.resolve({id: worldId}),
		});
		expect(response.status).toBe(200);
		expect(getOwnedWorld).toHaveBeenCalledWith(userId, worldId);
	});

	it("resolves readable editor slugs only within the current owner scope", async () => {
		jest.mocked(getOwnedWorldBySlug).mockResolvedValue(storedWorld);
		const response = await getById(request("/api/world/main-world"), {
			params: Promise.resolve({id: "main-world"}),
		});
		expect(response.status).toBe(200);
		expect(getOwnedWorldBySlug).toHaveBeenCalledWith(userId, "main-world");
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

	it("permanently deletes only through the owner-scoped trash operation", async () => {
		jest.mocked(permanentlyDeleteOwnedWorld).mockResolvedValue(true);
		const response = await DELETE(request(`/api/world/${worldId}?permanent=1`, "DELETE"), {
			params: Promise.resolve({id: worldId}),
		});
		expect(response.status).toBe(204);
		expect(permanentlyDeleteOwnedWorld).toHaveBeenCalledWith(userId, worldId);
		expect(deleteOwnedWorld).not.toHaveBeenCalled();
	});

	it("duplicates and restores within the owner scope", async () => {
		jest.mocked(duplicateOwnedWorld).mockResolvedValue({...storedWorld, id: crypto.randomUUID()});
		jest.mocked(restoreOwnedWorld).mockResolvedValue(storedWorld);
		expect(
			(
				await duplicate(request(`/api/world/${worldId}/duplicate`, "POST"), {
					params: Promise.resolve({id: worldId}),
				})
			).status,
		).toBe(201);
		expect(
			(
				await restore(request(`/api/world/${worldId}/restore`, "POST"), {
					params: Promise.resolve({id: worldId}),
				})
			).status,
		).toBe(200);
		expect(duplicateOwnedWorld).toHaveBeenCalledWith(userId, worldId);
		expect(restoreOwnedWorld).toHaveBeenCalledWith(userId, worldId);
	});

	it("rejects duplicate and restore when the active-world limit is full", async () => {
		const limitError = Object.assign(new Error("This account has reached its limit of 5 worlds."), {
			code: "WORLD_LIMIT_REACHED",
		});
		jest.mocked(duplicateOwnedWorld).mockRejectedValue(limitError);
		jest.mocked(restoreOwnedWorld).mockRejectedValue(limitError);
		expect(
			(
				await duplicate(request(`/api/world/${worldId}/duplicate`, "POST"), {
					params: Promise.resolve({id: worldId}),
				})
			).status,
		).toBe(409);
		expect(
			(
				await restore(request(`/api/world/${worldId}/restore`, "POST"), {
					params: Promise.resolve({id: worldId}),
				})
			).status,
		).toBe(409);
	});

	it("exports the current schema-backed world without exposing another owner", async () => {
		jest.mocked(exportOwnedWorld).mockResolvedValue({
			editorSlug: "main-world",
			exportedAt: new Date().toISOString(),
			format: "mothmark-world",
			schemaVersion: PERSISTED_SCHEMA_VERSION,
			world: initialWorld,
			worldId,
			worldName: storedWorld.name,
			worldRevision: 1,
		});
		const response = await exportWorld(request(`/api/world/${worldId}/export`), {
			params: Promise.resolve({id: worldId}),
		});
		expect(response.status).toBe(200);
		expect(response.headers.get("content-disposition")).toContain("main-world.mothmark.json");
		expect((await response.json()).world).toEqual(initialWorld);
		expect(exportOwnedWorld).toHaveBeenCalledWith(userId, worldId);
	});

	it("closes template/destructive legacy routes", async () => {
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
