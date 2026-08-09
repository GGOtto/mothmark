/** @jest-environment node */

import {resolveCurrentActor} from "@/auth/currentActor";
import {
	getAdminUser,
	getAdminWorld,
	listAdminUsers,
	listAdminWorlds,
	recordAdministratorRead,
} from "@/db/dbal/adminRepository";

import {GET as getSession} from "./session/route";
import {GET as listUsers} from "./users/route";
import {GET as getUser} from "./users/[id]/route";
import {GET as listWorlds} from "./worlds/route";
import {GET as getWorld} from "./worlds/[id]/route";

jest.mock("@/auth/currentActor", () => ({resolveCurrentActor: jest.fn()}));
jest.mock("@/db/dbal/adminRepository", () => ({
	getAdminUser: jest.fn(),
	getAdminWorld: jest.fn(),
	listAdminUsers: jest.fn(),
	listAdminWorlds: jest.fn(),
	recordAdministratorRead: jest.fn(),
}));

const adminId = "3e816c4d-b957-45dc-8523-d53ec04c8d0f";
const targetId = "8ebc3f3f-b9ca-4f75-898f-e196bae50be4";
const admin = {
	userId: adminId,
	accountType: "registered",
	siteRole: "admin",
	audience: "admin",
} as const;
const request = (path: string) => new Request(`http://localhost${path}`);

describe("read-only administrator routes", () => {
	beforeEach(() => jest.mocked(resolveCurrentActor).mockResolvedValue(admin));

	it.each([
		["anonymous", undefined],
		["registered non-admin", {...admin, siteRole: "user" as const}],
		["wrong audience", {...admin, audience: "editor" as const}],
	])("rejects %s access to every oversight route", async (_, actor) => {
		jest.mocked(resolveCurrentActor).mockResolvedValue(actor);
		const responses = await Promise.all([
			getSession(request("/api/admin/session")),
			listUsers(request("/api/admin/users")),
			getUser(request(`/api/admin/users/${targetId}`), {params: Promise.resolve({id: targetId})}),
			listWorlds(request("/api/admin/worlds")),
			getWorld(request(`/api/admin/worlds/${targetId}`), {params: Promise.resolve({id: targetId})}),
		]);
		expect(responses.map((response) => response.status)).toEqual([401, 401, 401, 401, 401]);
		expect(listAdminUsers).not.toHaveBeenCalled();
		expect(listAdminWorlds).not.toHaveBeenCalled();
	});

	it("lists users and worlds only after administrator authorization", async () => {
		jest.mocked(listAdminUsers).mockResolvedValue([]);
		jest.mocked(listAdminWorlds).mockResolvedValue([]);
		expect((await listUsers(request("/api/admin/users"))).status).toBe(200);
		expect((await listWorlds(request("/api/admin/worlds"))).status).toBe(200);
		expect(listAdminUsers).toHaveBeenCalledTimes(1);
		expect(listAdminWorlds).toHaveBeenCalledTimes(1);
	});

	it("records successful high-sensitivity detail reads without passing content", async () => {
		jest.mocked(getAdminUser).mockResolvedValue({id: targetId} as never);
		jest.mocked(getAdminWorld).mockResolvedValue({id: targetId} as never);
		expect(
			(
				await getUser(request(`/api/admin/users/${targetId}`), {
					params: Promise.resolve({id: targetId}),
				})
			).status,
		).toBe(200);
		expect(
			(
				await getWorld(request(`/api/admin/worlds/${targetId}`), {
					params: Promise.resolve({id: targetId}),
				})
			).status,
		).toBe(200);
		expect(recordAdministratorRead).toHaveBeenNthCalledWith(1, adminId, "user", targetId);
		expect(recordAdministratorRead).toHaveBeenNthCalledWith(2, adminId, "world", targetId);
	});

	it("returns the same not-found response for malformed and missing records", async () => {
		jest.mocked(getAdminUser).mockResolvedValue(undefined);
		const malformed = await getUser(request("/api/admin/users/not-an-id"), {
			params: Promise.resolve({id: "not-an-id"}),
		});
		const missing = await getUser(request(`/api/admin/users/${targetId}`), {
			params: Promise.resolve({id: targetId}),
		});
		expect(malformed.status).toBe(404);
		expect(missing.status).toBe(404);
		expect(recordAdministratorRead).not.toHaveBeenCalled();
	});
});
