/** @jest-environment node */

import {world as initialWorld} from "@/data/worlds/initialWorld";
import {userHasPermission} from "@/db/dbal/permissionRepository";
import {
	createAnonymousEditorBootstrap,
	findBootstrapEditorActor,
	getOrCreateFirstOwnedWorld,
	getRecentOwnedWorld,
} from "@/db/dbal/sessionsRepository";
import type {WorldRecord} from "@/db/dbal/worldsRepository";

import {POST} from "./route";

jest.mock("@/db/dbal/sessionsRepository", () => ({
	createAnonymousEditorBootstrap: jest.fn(),
	findBootstrapEditorActor: jest.fn(),
	getOrCreateFirstOwnedWorld: jest.fn(),
	getRecentOwnedWorld: jest.fn(),
}));
jest.mock("@/db/dbal/permissionRepository", () => ({userHasPermission: jest.fn()}));

const userId = "3e816c4d-b957-45dc-8523-d53ec04c8d0f";
const world: WorldRecord = {
	id: "8ebc3f3f-b9ca-4f75-898f-e196bae50be4",
	name: "My world",
	slug: null,
	world: initialWorld,
	revision: 1,
	schemaVersion: 1,
	ownerUserId: userId,
	kind: "editor",
	updatedByUserId: userId,
	deletedAt: null,
	editorSlug: "main-world",
	trashPurgeAfter: null,
	createdAt: new Date("2026-08-08T12:00:00Z"),
	updatedAt: new Date("2026-08-08T12:00:00Z"),
	lastOpenedAt: new Date("2026-08-08T12:00:00Z"),
};

const bootstrapRequest = (csrfHeader = "csrf") =>
	new Request("http://localhost/api/editor/bootstrap", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: "http://localhost",
			cookie: "mothmark_editor_csrf=csrf",
			"x-csrf-token": csrfHeader,
		},
		body: JSON.stringify({openWorld: true}),
	});

describe("editor bootstrap", () => {
	beforeEach(() => jest.mocked(userHasPermission).mockResolvedValue(true));
	it("atomically provisions the first anonymous editor path and sets a hardened session cookie", async () => {
		jest.mocked(createAnonymousEditorBootstrap).mockResolvedValue({
			userId,
			sessionToken: "secret-session-token",
			expiresAt: new Date("2027-02-04T12:00:00Z"),
			world,
		});

		const response = await POST(bootstrapRequest());
		expect(response.status).toBe(201);
		expect(response.headers.get("set-cookie")).toContain(
			"mothmark_editor_session=secret-session-token",
		);
		expect(response.headers.get("set-cookie")).toContain("HttpOnly");
		expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
		expect(JSON.stringify(await response.json())).not.toContain("secret-session-token");
		expect(createAnonymousEditorBootstrap).toHaveBeenCalledWith(true);
	});

	it("returns a recent world without recreating a returning user's empty library", async () => {
		jest.mocked(findBootstrapEditorActor).mockResolvedValue({
			userId,
			accountType: "anonymous",
			siteRole: "user",
			audience: "editor",
		});
		jest.mocked(getRecentOwnedWorld).mockResolvedValue(world);

		const response = await POST(
			new Request("http://localhost/api/editor/bootstrap", {
				method: "POST",
				headers: {
					origin: "http://localhost",
					cookie: "mothmark_editor_csrf=csrf; mothmark_editor_session=returning-session-token",
					"x-csrf-token": "csrf",
				},
			}),
		);
		expect(response.status).toBe(200);
		expect(findBootstrapEditorActor).toHaveBeenCalledWith("returning-session-token");
		expect(getRecentOwnedWorld).toHaveBeenCalledWith(userId);
		expect(getOrCreateFirstOwnedWorld).not.toHaveBeenCalled();
		expect(createAnonymousEditorBootstrap).not.toHaveBeenCalled();
	});

	it("keeps an intentionally empty returning library empty", async () => {
		jest.mocked(findBootstrapEditorActor).mockResolvedValue({
			userId,
			accountType: "anonymous",
			siteRole: "user",
			audience: "editor",
		});
		jest.mocked(getRecentOwnedWorld).mockResolvedValue(undefined);
		const response = await POST(
			new Request("http://localhost/api/editor/bootstrap", {
				method: "POST",
				headers: {
					origin: "http://localhost",
					cookie: "mothmark_editor_csrf=csrf; mothmark_editor_session=returning-session-token",
					"x-csrf-token": "csrf",
				},
			}),
		);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({data: null, meta: {userId}});
		expect(getOrCreateFirstOwnedWorld).not.toHaveBeenCalled();
	});

	it("records an editor opening only when the caller is entering that world", async () => {
		jest.mocked(findBootstrapEditorActor).mockResolvedValue({
			userId,
			accountType: "anonymous",
			siteRole: "user",
			audience: "editor",
		});
		jest.mocked(getOrCreateFirstOwnedWorld).mockResolvedValue(world);
		const response = await POST(
			new Request("http://localhost/api/editor/bootstrap", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					origin: "http://localhost",
					cookie: "mothmark_editor_csrf=csrf; mothmark_editor_session=returning-session-token",
					"x-csrf-token": "csrf",
				},
				body: JSON.stringify({openWorld: true}),
			}),
		);
		expect(response.status).toBe(200);
		expect(getOrCreateFirstOwnedWorld).toHaveBeenCalledWith(userId, true);
	});

	it("rejects bootstrap without matching same-origin CSRF proof", async () => {
		const response = await POST(bootstrapRequest("wrong"));
		expect(response.status).toBe(403);
		expect(findBootstrapEditorActor).not.toHaveBeenCalled();
	});

	it("does not let a suspended session bootstrap a replacement account", async () => {
		jest.mocked(findBootstrapEditorActor).mockResolvedValue("blocked");
		const response = await POST(
			new Request("http://localhost/api/editor/bootstrap", {
				method: "POST",
				headers: {
					origin: "http://localhost",
					cookie: "mothmark_editor_csrf=csrf; mothmark_editor_session=suspended-session",
					"x-csrf-token": "csrf",
				},
			}),
		);
		expect(response.status).toBe(401);
		expect(createAnonymousEditorBootstrap).not.toHaveBeenCalled();
	});
});
