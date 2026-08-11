/** @jest-environment node */

import {resolveCurrentActor} from "@/auth/currentActor";
import {
	exportOwnedAccount,
	getOwnedAccountSummary,
	permanentlyDeleteOwnedAccount,
	updateOwnedPublicProfile,
} from "@/db/dbal/accountRepository";
import {deleteRegisteredAccount} from "@/db/dbal/registeredAccountRepository";

import {DELETE, GET, PATCH} from "./route";
import {GET as exportAccount} from "./export/route";

jest.mock("@/auth/currentActor", () => ({resolveCurrentActor: jest.fn()}));
jest.mock("@/db/dbal/accountRepository", () => ({
	exportOwnedAccount: jest.fn(),
	getOwnedAccountSummary: jest.fn(),
	permanentlyDeleteOwnedAccount: jest.fn(),
	updateOwnedPublicProfile: jest.fn(),
}));
jest.mock("@/db/dbal/registeredAccountRepository", () => ({deleteRegisteredAccount: jest.fn()}));

const userId = "3e816c4d-b957-45dc-8523-d53ec04c8d0f";
const actor = {userId, accountType: "anonymous", siteRole: "user", audience: "editor"} as const;
const request = (method = "GET") =>
	new Request("http://localhost/api/account", {
		method,
		headers:
			method === "GET"
				? {}
				: {
						origin: "http://localhost",
						cookie: "mothmark_editor_csrf=csrf",
						"x-csrf-token": "csrf",
					},
	});

describe("temporary account API", () => {
	beforeEach(() => jest.mocked(resolveCurrentActor).mockResolvedValue(actor));

	it("does not create or expose an account to a public visitor", async () => {
		jest.mocked(resolveCurrentActor).mockResolvedValue(undefined);
		const response = await GET(request());
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({data: null});
		expect(getOwnedAccountSummary).not.toHaveBeenCalled();
	});

	it("returns account status and limits only to the current actor", async () => {
		jest.mocked(getOwnedAccountSummary).mockResolvedValue({
			accountType: "anonymous",
			cleanupAfter: null,
			cleanupCancelledAt: null,
			cleanupWasRecentlyCancelled: false,
			cleanupScheduledAt: null,
			createdAt: "2026-08-08T12:00:00.000Z",
			displayName: null,
			email: null,
			profileBio: null,
			profileWebsite: null,
			retentionClass: "untouched_editor",
			sessions: [],
			siteRole: "user",
			status: "active",
			usage: {activeWorlds: 1, maxWorlds: 5, trashedWorlds: 0},
			userId,
			username: null,
		});
		const response = await GET(request());
		expect(response.status).toBe(200);
		expect(getOwnedAccountSummary).toHaveBeenCalledWith(userId);
	});

	it("exports all owned data through a download response", async () => {
		jest.mocked(exportOwnedAccount).mockResolvedValue({
			account: {
				accountType: "anonymous",
				createdAt: "2026-08-08T12:00:00.000Z",
				displayName: null,
				email: null,
				profileBio: null,
				profileWebsite: null,
				userId,
				username: null,
			},
			exportedAt: "2026-08-08T12:00:00.000Z",
			format: "mothmark-account",
			worlds: [],
		});
		const response = await exportAccount(request());
		expect(response.status).toBe(200);
		expect(response.headers.get("content-disposition")).toContain("attachment");
	});

	it("updates explicit public profile fields for a registered account", async () => {
		jest.mocked(resolveCurrentActor).mockResolvedValue({...actor, accountType: "registered"});
		jest.mocked(updateOwnedPublicProfile).mockResolvedValue({
			accountType: "registered",
			cleanupAfter: null,
			cleanupCancelledAt: null,
			cleanupWasRecentlyCancelled: false,
			cleanupScheduledAt: null,
			createdAt: "2026-08-08T12:00:00.000Z",
			displayName: null,
			email: "author@example.com",
			profileBio: "Makes quiet worlds.",
			profileWebsite: "https://github.com/archivekeeper",
			retentionClass: "authored_editor",
			sessions: [],
			siteRole: "user",
			status: "active",
			usage: {activeWorlds: 1, maxWorlds: 5, trashedWorlds: 0},
			userId,
			username: "archivekeeper",
		});
		const response = await PATCH(
			new Request("http://localhost/api/account", {
				method: "PATCH",
				headers: {
					"content-type": "application/json",
					origin: "http://localhost",
					cookie: "mothmark_editor_csrf=csrf",
					"x-csrf-token": "csrf",
				},
				body: JSON.stringify({
					bio: "Makes quiet worlds.",
					displayName: " ",
					website: "github.com/archivekeeper",
				}),
			}),
		);
		expect(response.status).toBe(200);
		expect(updateOwnedPublicProfile).toHaveBeenCalledWith(userId, {
			bio: "Makes quiet worlds.",
			displayName: null,
			website: "https://github.com/archivekeeper",
		});
	});

	it("rejects unsafe public profile websites", async () => {
		jest.mocked(resolveCurrentActor).mockResolvedValue({...actor, accountType: "registered"});
		const response = await PATCH(
			new Request("http://localhost/api/account", {
				method: "PATCH",
				headers: {
					"content-type": "application/json",
					origin: "http://localhost",
					cookie: "mothmark_editor_csrf=csrf",
					"x-csrf-token": "csrf",
				},
				body: JSON.stringify({bio: "", displayName: "", website: "javascript:alert(1)"}),
			}),
		);
		expect(response.status).toBe(400);
		expect(updateOwnedPublicProfile).not.toHaveBeenCalled();
	});

	it("requires CSRF proof, deletes cascading private data, and expires the browser session", async () => {
		expect(
			(await DELETE(new Request("http://localhost/api/account", {method: "DELETE"}))).status,
		).toBe(403);
		jest.mocked(permanentlyDeleteOwnedAccount).mockResolvedValue(true);
		const response = await DELETE(request("DELETE"));
		expect(response.status).toBe(200);
		expect(permanentlyDeleteOwnedAccount).toHaveBeenCalledWith(userId);
		expect(response.headers.get("set-cookie")).toContain("mothmark_editor_session=");
		expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
	});

	it("requires password confirmation for registered deletion and rejects the sole administrator", async () => {
		jest.mocked(resolveCurrentActor).mockResolvedValue({...actor, accountType: "registered"});
		jest.mocked(deleteRegisteredAccount).mockResolvedValue("sole_administrator");
		const adminResponse = await DELETE(
			new Request("http://localhost/api/account", {
				method: "DELETE",
				headers: {
					"content-type": "application/json",
					origin: "http://localhost",
					cookie: "mothmark_editor_csrf=csrf",
					"x-csrf-token": "csrf",
				},
				body: JSON.stringify({password: "current password value"}),
			}),
		);
		expect(adminResponse.status).toBe(409);
		expect(deleteRegisteredAccount).toHaveBeenCalledWith({
			password: "current password value",
			userId,
		});

		jest.mocked(deleteRegisteredAccount).mockResolvedValue("deleted");
		const response = await DELETE(
			new Request("http://localhost/api/account", {
				method: "DELETE",
				headers: {
					"content-type": "application/json",
					origin: "http://localhost",
					cookie: "mothmark_editor_csrf=csrf",
					"x-csrf-token": "csrf",
				},
				body: JSON.stringify({password: "current password value"}),
			}),
		);
		expect(response.status).toBe(200);
		expect(permanentlyDeleteOwnedAccount).not.toHaveBeenCalled();
	});
});
