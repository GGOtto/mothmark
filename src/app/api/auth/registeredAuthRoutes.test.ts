/** @jest-environment node */

import {resolveCurrentActor} from "@/auth/currentActor";
import {authenticationEmailIsConfigured, sendAuthenticationEmail} from "@/auth/email";
import {
	authenticateEditor,
	beginPasswordReset,
	beginRegistration,
	completeRegistration,
	UsernameUnavailableError,
} from "@/db/dbal/registeredAccountRepository";

import {POST as forgotPassword} from "./forgot-password/route";
import {POST as register} from "./register/route";
import {POST as signIn} from "./sign-in/route";
import {POST as verifyEmail} from "./verify-email/route";

jest.mock("@/auth/currentActor", () => ({resolveCurrentActor: jest.fn()}));
jest.mock("@/auth/email", () => ({
	authenticationEmailIsConfigured: jest.fn(() => true),
	sendAuthenticationEmail: jest.fn(),
}));
jest.mock("@/db/dbal/registeredAccountRepository", () => ({
	UsernameUnavailableError: class UsernameUnavailableError extends Error {
		constructor() {
			super("That username is already in use.");
		}
	},
	authenticateEditor: jest.fn(),
	beginPasswordReset: jest.fn(),
	beginRegistration: jest.fn(),
	completeRegistration: jest.fn(),
}));

const userId = "3e816c4d-b957-45dc-8523-d53ec04c8d0f";
const request = (path: string, body: object) =>
	new Request(`http://localhost${path}`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			cookie: "mothmark_editor_csrf=csrf; mothmark_editor_session=editor-session",
			origin: "http://localhost",
			"x-csrf-token": "csrf",
			"x-forwarded-for": "192.0.2.5",
		},
		body: JSON.stringify(body),
	});

describe("registered account routes", () => {
	beforeEach(() => jest.mocked(authenticationEmailIsConfigured).mockReturnValue(true));

	it("reports missing environment-wide email configuration before creating a registration", async () => {
		jest.mocked(authenticationEmailIsConfigured).mockReturnValue(false);
		const response = await register(
			request("/api/auth/register", {
				email: "author@example.com",
				password: "a durable registration password",
				username: "ArchiveKeeper",
			}),
		);
		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({
			error: {
				code: "EMAIL_UNAVAILABLE",
				message: "Email delivery is not configured for this environment.",
			},
		});
		expect(beginRegistration).not.toHaveBeenCalled();
	});

	it("binds an anonymous registration to the current user without accepting a role", async () => {
		jest.mocked(resolveCurrentActor).mockResolvedValue({
			accountType: "anonymous",
			audience: "editor",
			siteRole: "user",
			userId,
		});
		jest
			.mocked(beginRegistration)
			.mockResolvedValue({email: "author@example.com", token: "secret-token"});
		const response = await register(
			request("/api/auth/register", {
				email: "author@example.com",
				password: "a durable registration password",
				siteRole: "admin",
				username: "ArchiveKeeper",
			}),
		);
		expect(response.status).toBe(202);
		expect(beginRegistration).toHaveBeenCalledWith({
			email: "author@example.com",
			network: "192.0.2.5",
			password: "a durable registration password",
			username: "ArchiveKeeper",
			userId,
		});
		expect(sendAuthenticationEmail).toHaveBeenCalledWith({
			email: "author@example.com",
			kind: "verify_email",
			token: "secret-token",
		});
		expect(JSON.stringify(await response.json())).not.toContain("secret-token");
	});

	it("reports a public username conflict without starting email delivery", async () => {
		jest.mocked(beginRegistration).mockRejectedValue(new UsernameUnavailableError());
		const response = await register(
			request("/api/auth/register", {
				email: "author@example.com",
				password: "a durable registration password",
				username: "archivekeeper",
			}),
		);
		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({
			error: {code: "USERNAME_UNAVAILABLE", message: "That username is already in use."},
		});
		expect(sendAuthenticationEmail).not.toHaveBeenCalled();
	});

	it("uses the same recovery response for an unknown address", async () => {
		jest.mocked(beginPasswordReset).mockResolvedValue({throttled: false});
		const response = await forgotPassword(
			request("/api/auth/forgot-password", {email: "missing@example.com"}),
		);
		expect(response.status).toBe(202);
		expect(await response.json()).toEqual({
			data: {message: "If the address belongs to an account, a recovery message is on its way."},
		});
		expect(sendAuthenticationEmail).not.toHaveBeenCalled();
	});

	it("creates an editor session after password authentication, never an admin session", async () => {
		jest.mocked(authenticateEditor).mockResolvedValue({
			status: "authenticated",
			siteRole: "admin",
			signIn: {
				expiresAt: new Date("2027-02-04T12:00:00.000Z"),
				sessionToken: "opaque-editor-session",
				userId,
			},
		});
		const response = await signIn(
			request("/api/auth/sign-in", {email: "admin@example.com", password: "a durable admin password"}),
		);
		const cookies = response.headers.getSetCookie().join("\n");
		expect(cookies).toContain("mothmark_editor_session=opaque-editor-session");
		expect(cookies).not.toContain("mothmark_admin_session");
	});

	it("reports expired verification and signs in a successfully verified account", async () => {
		jest.mocked(completeRegistration).mockResolvedValue({status: "expired"});
		expect(
			(await verifyEmail(request("/api/auth/verify-email", {token: "expired-token"}))).status,
		).toBe(410);
		jest.mocked(completeRegistration).mockResolvedValue({
			status: "verified",
			signIn: {
				expiresAt: new Date("2027-02-04T12:00:00.000Z"),
				sessionToken: "verified-editor-session",
				userId,
			},
			upgradedAnonymous: true,
			userId,
		});
		const response = await verifyEmail(request("/api/auth/verify-email", {token: "valid-token"}));
		expect(response.status).toBe(200);
		expect(response.headers.getSetCookie().join("\n")).toContain(
			"mothmark_editor_session=verified-editor-session",
		);
	});
});
