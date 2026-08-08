/** @jest-environment node */

import {world as initialWorld} from "@/data/worlds/initialWorld";
import {
	createAnonymousEditorBootstrap,
	findBootstrapEditorActor,
	getOrCreateFirstOwnedWorld,
} from "@/db/dbal/sessionsRepository";
import type {WorldRecord} from "@/db/dbal/worldsRepository";

import {POST} from "./route";

jest.mock("@/db/dbal/sessionsRepository", () => ({
	createAnonymousEditorBootstrap: jest.fn(),
	findBootstrapEditorActor: jest.fn(),
	getOrCreateFirstOwnedWorld: jest.fn(),
}));

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
	createdAt: new Date("2026-08-08T12:00:00Z"),
	updatedAt: new Date("2026-08-08T12:00:00Z"),
};

const bootstrapRequest = (csrfHeader = "csrf") =>
	new Request("http://localhost/api/editor/bootstrap", {
		method: "POST",
		headers: {
			origin: "http://localhost",
			cookie: "mothmark_editor_csrf=csrf",
			"x-csrf-token": csrfHeader,
		},
	});

describe("editor bootstrap", () => {
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
	});

	it("serially ensures one first world for a returning resolved user", async () => {
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
					origin: "http://localhost",
					cookie: "mothmark_editor_csrf=csrf; mothmark_editor_session=returning-session-token",
					"x-csrf-token": "csrf",
				},
			}),
		);
		expect(response.status).toBe(200);
		expect(findBootstrapEditorActor).toHaveBeenCalledWith("returning-session-token");
		expect(getOrCreateFirstOwnedWorld).toHaveBeenCalledWith(userId);
		expect(createAnonymousEditorBootstrap).not.toHaveBeenCalled();
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
