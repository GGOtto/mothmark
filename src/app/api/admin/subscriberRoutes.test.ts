/** @jest-environment node */

import {resolveCurrentActor} from "@/auth/currentActor";
import {administratorHasPermission} from "@/db/dbal/adminRepository";
import {listAdminSubscribers} from "@/db/dbal/subscriberRepository";
import {GET} from "./subscribers/route";

jest.mock("@/auth/currentActor", () => ({resolveCurrentActor: jest.fn()}));
jest.mock("@/db/dbal/adminRepository", () => ({
	AdminControlError: class AdminControlError extends Error {},
	administratorHasPermission: jest.fn(),
}));
jest.mock("@/db/dbal/subscriberRepository", () => ({listAdminSubscribers: jest.fn()}));

const actor = {
	accountType: "registered",
	audience: "admin",
	siteRole: "admin",
	userId: "3e816c4d-b957-45dc-8523-d53ec04c8d0f",
} as const;

describe("administrator subscriber route", () => {
	it("requires subscriber-view permission and returns the active list", async () => {
		jest.mocked(resolveCurrentActor).mockResolvedValue(actor);
		jest.mocked(administratorHasPermission).mockResolvedValue(true);
		jest.mocked(listAdminSubscribers).mockResolvedValue([
			{
				email: "reader@example.com",
				source: "registration",
				subscribedAt: "2026-08-13T12:00:00.000Z",
			},
		]);

		const response = await GET(new Request("http://localhost/api/admin/subscribers"));
		expect(response.status).toBe(200);
		expect(administratorHasPermission).toHaveBeenCalledWith(actor.userId, "admin.subscribers.view");
		expect(listAdminSubscribers).toHaveBeenCalledWith(actor.userId);
		expect(await response.json()).toEqual({
			data: {
				subscribers: [
					{
						email: "reader@example.com",
						source: "registration",
						subscribedAt: "2026-08-13T12:00:00.000Z",
					},
				],
			},
		});
	});

	it("rejects a non-administrator before reading subscriber data", async () => {
		jest.mocked(resolveCurrentActor).mockResolvedValue({...actor, siteRole: "user"});
		const response = await GET(new Request("http://localhost/api/admin/subscribers"));
		expect(response.status).toBe(401);
		expect(listAdminSubscribers).not.toHaveBeenCalled();
	});
});
