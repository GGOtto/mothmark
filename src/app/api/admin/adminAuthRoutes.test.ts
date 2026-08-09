/** @jest-environment node */

import {resolveCurrentActor} from "@/auth/currentActor";
import {
	beginAdministratorSignIn,
	completeAdministratorSignIn,
	revokeAdministratorSession,
} from "@/db/dbal/adminAuthRepository";

import {POST as submitPassword} from "./auth/password/route";
import {POST as submitSecondFactor} from "./auth/second-factor/route";
import {POST as signOut} from "./auth/sign-out/route";

jest.mock("@/auth/currentActor", () => ({resolveCurrentActor: jest.fn()}));
jest.mock("@/db/dbal/adminAuthRepository", () => ({
	beginAdministratorSignIn: jest.fn(),
	completeAdministratorSignIn: jest.fn(),
	revokeAdministratorSession: jest.fn(),
}));

const admin = {
	accountType: "registered",
	audience: "admin",
	siteRole: "admin",
	userId: "3e816c4d-b957-45dc-8523-d53ec04c8d0f",
} as const;

const mutationRequest = (url: string, body: object, cookie = "mothmark_admin_csrf=csrf") =>
	new Request(url, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			cookie,
			origin: "http://localhost",
			"x-csrf-token": "csrf",
		},
		body: JSON.stringify(body),
	});

describe("administrator authentication routes", () => {
	beforeEach(() => jest.mocked(resolveCurrentActor).mockResolvedValue(admin));

	it("requires a valid password but issues only a short-lived MFA challenge", async () => {
		jest.mocked(beginAdministratorSignIn).mockResolvedValue({
			status: "second_factor_required",
			challengeToken: "opaque-challenge",
			expiresAt: new Date("2026-08-08T12:05:00.000Z"),
		});
		const response = await submitPassword(
			mutationRequest("http://localhost/api/admin/auth/password", {
				email: "administrator@example.com",
				password: "a-valid-password",
			}),
		);
		expect(response.status).toBe(200);
		const cookies = response.headers.getSetCookie().join("\n");
		expect(cookies).toContain("mothmark_admin_challenge=opaque-challenge");
		expect(cookies).toContain("HttpOnly");
		expect(cookies).not.toContain("mothmark_admin_session=");
	});

	it("issues an admin-audience session only after the second factor", async () => {
		jest.mocked(completeAdministratorSignIn).mockResolvedValue({
			status: "authenticated",
			expiresAt: new Date("2026-08-09T12:00:00.000Z"),
			sessionToken: "opaque-admin-session",
			userId: admin.userId,
		});
		const response = await submitSecondFactor(
			mutationRequest(
				"http://localhost/api/admin/auth/second-factor",
				{secondFactor: "123456"},
				"mothmark_admin_csrf=csrf; mothmark_admin_challenge=opaque-challenge",
			),
		);
		expect(completeAdministratorSignIn).toHaveBeenCalledWith({
			challengeToken: "opaque-challenge",
			network: "unavailable",
			secondFactor: "123456",
		});
		const cookies = response.headers.getSetCookie().join("\n");
		expect(cookies).toContain("mothmark_admin_session=opaque-admin-session");
		expect(cookies).toContain("mothmark_admin_challenge=; Path=/api/admin/auth; Max-Age=0");
	});

	it("requires admin CSRF proof and revokes only the presented admin session on sign-out", async () => {
		expect(
			(await signOut(new Request("http://localhost/api/admin/auth/sign-out", {method: "POST"})))
				.status,
		).toBe(403);
		jest.mocked(revokeAdministratorSession).mockResolvedValue(true);
		const response = await signOut(
			mutationRequest(
				"http://localhost/api/admin/auth/sign-out",
				{},
				"mothmark_admin_session=session-token; mothmark_admin_csrf=csrf",
			),
		);
		expect(response.status).toBe(204);
		expect(revokeAdministratorSession).toHaveBeenCalledWith("session-token");
		expect(response.headers.get("set-cookie")).toContain("mothmark_admin_session=");
	});
});
