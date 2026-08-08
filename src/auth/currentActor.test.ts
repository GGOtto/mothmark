/** @jest-environment node */

import {findCurrentActor} from "@/db/dbal/sessionsRepository";

import {resolveCurrentActor} from "./currentActor";

jest.mock("@/db/dbal/sessionsRepository", () => ({findCurrentActor: jest.fn()}));

describe("current actor resolution", () => {
	it("does not resolve an absent or malformed editor cookie", async () => {
		await expect(
			resolveCurrentActor(new Request("http://localhost"), "editor"),
		).resolves.toBeUndefined();
		await expect(
			resolveCurrentActor(
				new Request("http://localhost", {
					headers: {cookie: "mothmark_editor_session=%not-uri"},
				}),
				"editor",
			),
		).resolves.toBeUndefined();
		expect(findCurrentActor).not.toHaveBeenCalled();
	});

	it("passes the opaque credential and expected audience to active-session lookup", async () => {
		const actor = {
			userId: "3e816c4d-b957-45dc-8523-d53ec04c8d0f",
			accountType: "anonymous",
			siteRole: "user",
			audience: "editor",
		} as const;
		jest.mocked(findCurrentActor).mockResolvedValue(actor);
		const request = new Request("http://localhost", {
			headers: {cookie: "mothmark_editor_session=opaque-token"},
		});

		await expect(resolveCurrentActor(request, "editor")).resolves.toEqual(actor);
		expect(findCurrentActor).toHaveBeenCalledWith("opaque-token", "editor");
	});
});
