/** @jest-environment node */

import {resolveCurrentActor} from "@/auth/currentActor";
import {revokeAllEditorSessions} from "@/db/dbal/registeredAccountRepository";

import {POST} from "./route";

jest.mock("@/auth/currentActor", () => ({resolveCurrentActor: jest.fn()}));
jest.mock("@/db/dbal/registeredAccountRepository", () => ({
	revokeAllEditorSessions: jest.fn(),
}));

const userId = "3e816c4d-b957-45dc-8523-d53ec04c8d0f";
const request = () =>
	new Request("http://localhost/api/auth/sign-out-all", {
		method: "POST",
		headers: {
			origin: "http://localhost",
			cookie: "mothmark_editor_csrf=csrf",
			"x-csrf-token": "csrf",
		},
	});

describe("sign out all devices", () => {
	it("revokes every editor session and clears the current cookie", async () => {
		jest.mocked(resolveCurrentActor).mockResolvedValue({
			accountType: "registered",
			audience: "editor",
			siteRole: "user",
			userId,
		});
		jest.mocked(revokeAllEditorSessions).mockResolvedValue(3);

		const response = await POST(request());

		expect(response.status).toBe(204);
		expect(revokeAllEditorSessions).toHaveBeenCalledWith(userId);
		expect(response.headers.get("set-cookie")).toContain("mothmark_editor_session=");
		expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
	});

	it("does not expose the action to an anonymous account", async () => {
		jest.mocked(resolveCurrentActor).mockResolvedValue({
			accountType: "anonymous",
			audience: "editor",
			siteRole: "user",
			userId,
		});

		const response = await POST(request());

		expect(response.status).toBe(401);
		expect(revokeAllEditorSessions).not.toHaveBeenCalled();
	});
});
