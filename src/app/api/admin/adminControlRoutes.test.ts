/** @jest-environment node */

import {resolveCurrentActor} from "@/auth/currentActor";
import {
	administratorHasPermission,
	applyAdminWorldAction,
	revokeUserSessions,
	setUserPermissionOverride,
	setUserSuspension,
	setUserWorldLimit,
	updateWorldAdministratively,
} from "@/db/dbal/adminRepository";

import {PUT as permissions} from "./users/[id]/permissions/route";
import {DELETE as sessions} from "./users/[id]/sessions/route";
import {PUT as status} from "./users/[id]/status/route";
import {PUT as limit} from "./users/[id]/limit/route";
import {POST as worldControl} from "./worlds/[id]/control/route";
import {PUT as worldEdit} from "./worlds/[id]/edit/route";

jest.mock("@/auth/currentActor", () => ({resolveCurrentActor: jest.fn()}));
jest.mock("@/db/dbal/adminRepository", () => ({
	AdminControlError: class AdminControlError extends Error {},
	PERMISSIONS: ["editor.access", "admin.users.manage"],
	administratorHasPermission: jest.fn(),
	applyAdminWorldAction: jest.fn(),
	revokeUserSessions: jest.fn(),
	setUserPermissionOverride: jest.fn(),
	setUserSuspension: jest.fn(),
	setUserWorldLimit: jest.fn(),
	updateWorldAdministratively: jest.fn(),
}));

const actorId = "3e816c4d-b957-45dc-8523-d53ec04c8d0f";
const targetId = "8ebc3f3f-b9ca-4f75-898f-e196bae50be4";
const actor = {
	accountType: "registered",
	audience: "admin",
	siteRole: "admin",
	userId: actorId,
} as const;
const context = {params: Promise.resolve({id: targetId})};
const request = (path: string, method: string, body: unknown, csrf = true) =>
	new Request(`http://localhost${path}`, {
		body: JSON.stringify(body),
		headers: {
			"content-type": "application/json",
			origin: "http://localhost",
			...(csrf && {cookie: "mothmark_admin_csrf=proof", "x-csrf-token": "proof"}),
		},
		method,
	});

describe("administrator control routes", () => {
	beforeEach(() => {
		jest.mocked(resolveCurrentActor).mockResolvedValue(actor);
		jest.mocked(administratorHasPermission).mockResolvedValue(true);
	});

	it("requires admin CSRF proof before any mutation", async () => {
		const response = await limit(
			request(`/api/admin/users/${targetId}/limit`, "PUT", {maxWorlds: 8}, false),
			context,
		);
		expect(response.status).toBe(403);
		expect(setUserWorldLimit).not.toHaveBeenCalled();
	});

	it("checks the specific capability for user and world operations", async () => {
		jest.mocked(administratorHasPermission).mockResolvedValue(false);
		const userResponse = await sessions(
			request(`/api/admin/users/${targetId}/sessions`, "DELETE", {}),
			context,
		);
		const worldResponse = await worldControl(
			request(`/api/admin/worlds/${targetId}/control`, "POST", {action: "archive"}),
			context,
		);
		expect([userResponse.status, worldResponse.status]).toEqual([403, 403]);
		expect(administratorHasPermission).toHaveBeenNthCalledWith(1, actorId, "admin.users.manage");
		expect(administratorHasPermission).toHaveBeenNthCalledWith(2, actorId, "admin.worlds.manage");
	});

	it("requires reasons for suspension, transfer, deletion, and administrative editing", async () => {
		const responses = await Promise.all([
			status(
				request(`/api/admin/users/${targetId}/status`, "PUT", {status: "suspended", reason: ""}),
				context,
			),
			worldControl(
				request(`/api/admin/worlds/${targetId}/control`, "POST", {
					action: "transfer",
					targetUserId: actorId,
					reason: "",
				}),
				context,
			),
			worldControl(
				request(`/api/admin/worlds/${targetId}/control`, "POST", {action: "delete", reason: ""}),
				context,
			),
			worldEdit(
				request(`/api/admin/worlds/${targetId}/edit`, "PUT", {
					expectedRevision: 1,
					reason: "",
					world: {},
				}),
				context,
			),
		]);
		expect(responses.map(({status}) => status)).toEqual([400, 400, 400, 400]);
		expect(setUserSuspension).not.toHaveBeenCalled();
		expect(applyAdminWorldAction).not.toHaveBeenCalled();
		expect(updateWorldAdministratively).not.toHaveBeenCalled();
	});

	it("passes explicit permission state and selective session revocation to the service", async () => {
		jest.mocked(setUserPermissionOverride).mockResolvedValue([]);
		jest.mocked(revokeUserSessions).mockResolvedValue(1);
		expect(
			(
				await permissions(
					request(`/api/admin/users/${targetId}/permissions`, "PUT", {
						permission: "editor.access",
						state: "deny",
					}),
					context,
				)
			).status,
		).toBe(200);
		expect(
			(
				await sessions(
					request(`/api/admin/users/${targetId}/sessions`, "DELETE", {sessionId: actorId}),
					context,
				)
			).status,
		).toBe(200);
		expect(setUserPermissionOverride).toHaveBeenCalledWith(
			expect.objectContaining({allowed: false, permission: "editor.access", targetUserId: targetId}),
		);
		expect(revokeUserSessions).toHaveBeenCalledWith(
			expect.objectContaining({sessionId: actorId, targetUserId: targetId}),
		);
	});
});
