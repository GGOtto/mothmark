/** @jest-environment node */

import {resolveCurrentActor} from "@/auth/currentActor";
import {administratorHasPermission} from "@/db/dbal/adminRepository";
import {
	getAdminPlaythrough,
	listAdminPlaythroughs,
	runPlaythroughDiagnostic,
} from "@/db/dbal/adminPlaythroughRepository";

import {GET as list} from "./playthroughs/route";
import {GET as detail} from "./playthroughs/[id]/route";
import {POST as diagnose} from "./playthroughs/[id]/diagnostics/route";

jest.mock("@/auth/currentActor", () => ({resolveCurrentActor: jest.fn()}));
jest.mock("@/db/dbal/adminRepository", () => ({
	AdminControlError: class AdminControlError extends Error {},
	administratorHasPermission: jest.fn(),
}));
jest.mock("@/db/dbal/adminPlaythroughRepository", () => ({
	PlaythroughDiagnosticError: class PlaythroughDiagnosticError extends Error {},
	getAdminPlaythrough: jest.fn(),
	listAdminPlaythroughs: jest.fn(),
	runPlaythroughDiagnostic: jest.fn(),
}));

const adminId = "3e816c4d-b957-45dc-8523-d53ec04c8d0f";
const playthroughId = "8ebc3f3f-b9ca-4f75-898f-e196bae50be4";
const context = {params: Promise.resolve({id: playthroughId})};
const admin = {
	userId: adminId,
	accountType: "registered",
	siteRole: "admin",
	audience: "admin",
} as const;

describe("administrator playthrough routes", () => {
	beforeEach(() => {
		jest.mocked(resolveCurrentActor).mockResolvedValue(admin);
		jest.mocked(administratorHasPermission).mockResolvedValue(true);
	});

	it.each([
		["anonymous", undefined],
		["ordinary user", {...admin, siteRole: "user" as const}],
		["wrong audience", {...admin, audience: "editor" as const}],
	])("rejects %s access across list, detail, and diagnostics", async (_, actor) => {
		jest.mocked(resolveCurrentActor).mockResolvedValue(actor);
		const mutation = new Request(
			`http://localhost/api/admin/playthroughs/${playthroughId}/diagnostics`,
			{
				method: "POST",
				headers: {
					origin: "http://localhost",
					cookie: "mothmark_admin_csrf=csrf",
					"x-csrf-token": "csrf",
					"content-type": "application/json",
				},
				body: JSON.stringify({type: "original"}),
			},
		);
		const responses = await Promise.all([
			list(new Request("http://localhost/api/admin/playthroughs")),
			detail(new Request(`http://localhost/api/admin/playthroughs/${playthroughId}`), context),
			diagnose(mutation, context),
		]);
		expect(responses.map((response) => response.status)).toEqual([401, 401, 401]);
		expect(listAdminPlaythroughs).not.toHaveBeenCalled();
	});

	it("applies operational filters without exposing player credentials", async () => {
		jest.mocked(listAdminPlaythroughs).mockResolvedValue([]);
		const response = await list(
			new Request("http://localhost/api/admin/playthroughs?status=errored&minimumCommands=3"),
		);
		expect(response.status).toBe(200);
		expect(listAdminPlaythroughs).toHaveBeenCalledWith({status: "errored", minimumCommands: 3});
	});

	it("reads detail and runs a bounded diagnostic under the dedicated capability", async () => {
		jest.mocked(getAdminPlaythrough).mockResolvedValue({id: playthroughId} as never);
		jest.mocked(runPlaythroughDiagnostic).mockResolvedValue({available: true} as never);
		expect(
			(await detail(new Request(`http://localhost/api/admin/playthroughs/${playthroughId}`), context))
				.status,
		).toBe(200);
		const response = await diagnose(
			new Request(`http://localhost/api/admin/playthroughs/${playthroughId}/diagnostics`, {
				method: "POST",
				headers: {
					origin: "http://localhost",
					cookie: "mothmark_admin_csrf=csrf",
					"x-csrf-token": "csrf",
					"content-type": "application/json",
				},
				body: JSON.stringify({type: "current_release"}),
			}),
			context,
		);
		expect(response.status).toBe(200);
		expect(getAdminPlaythrough).toHaveBeenCalledWith(adminId, playthroughId);
		expect(runPlaythroughDiagnostic).toHaveBeenCalledWith({
			actorUserId: adminId,
			playthroughId,
			target: {type: "current_release"},
		});
	});
});
