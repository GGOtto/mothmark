/** @jest-environment node */

import {ADMIN_CSRF_COOKIE, EDITOR_CSRF_COOKIE} from "./cookieNames";
import {
	adminAuthRequiredResponse,
	authRequiredResponse,
	mutationSecurityError,
} from "./requestSecurity";

function mutationRequest(
	input: {
		cookieName?: string;
		cookieToken?: string;
		headerToken?: string;
		origin?: string;
	} = {},
) {
	const headers = new Headers();
	if (input.origin !== undefined) headers.set("origin", input.origin);
	if (input.headerToken !== undefined) headers.set("x-csrf-token", input.headerToken);
	if (input.cookieToken !== undefined) {
		headers.set("cookie", `${input.cookieName ?? EDITOR_CSRF_COOKIE}=${input.cookieToken}`);
	}
	return new Request("https://mothmark.test/api/world", {method: "POST", headers});
}

async function errorBody(response: Response | undefined) {
	return response ? response.json() : undefined;
}

describe("mutationSecurityError", () => {
	it("accepts a same-origin editor mutation with matching CSRF tokens", () => {
		expect(
			mutationSecurityError(
				mutationRequest({
					origin: "https://mothmark.test",
					cookieToken: "same-token",
					headerToken: "same-token",
				}),
			),
		).toBeUndefined();
	});

	it.each([undefined, "https://attacker.test"])(
		"rejects missing or foreign origins",
		async (origin) => {
			const response = mutationSecurityError(
				mutationRequest({origin, cookieToken: "same-token", headerToken: "same-token"}),
			);

			expect(response?.status).toBe(403);
			expect(await errorBody(response)).toMatchObject({error: {code: "INVALID_ORIGIN"}});
		},
	);

	it.each([
		{cookieToken: undefined, headerToken: "token"},
		{cookieToken: "token", headerToken: undefined},
		{cookieToken: "cookie-token", headerToken: "header-token"},
	])("rejects missing or mismatched CSRF credentials", async ({cookieToken, headerToken}) => {
		const response = mutationSecurityError(
			mutationRequest({origin: "https://mothmark.test", cookieToken, headerToken}),
		);

		expect(response?.status).toBe(403);
		expect(await errorBody(response)).toMatchObject({error: {code: "INVALID_CSRF_TOKEN"}});
	});

	it("uses the isolated administrator cookie for administrator mutations", () => {
		const adminRequest = mutationRequest({
			origin: "https://mothmark.test",
			cookieName: ADMIN_CSRF_COOKIE,
			cookieToken: "admin-token",
			headerToken: "admin-token",
		});

		expect(mutationSecurityError(adminRequest, "admin")).toBeUndefined();
		expect(mutationSecurityError(adminRequest, "editor")?.status).toBe(403);
	});
});

describe("authentication-required responses", () => {
	it("returns a stable editor authentication error", async () => {
		const response = authRequiredResponse();

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({
			error: {code: "AUTH_REQUIRED", message: "An active editor session is required."},
		});
	});

	it("returns a distinct administrator authentication error", async () => {
		const response = adminAuthRequiredResponse();

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({
			error: {
				code: "ADMIN_AUTH_REQUIRED",
				message: "An active administrator session is required.",
			},
		});
	});
});
