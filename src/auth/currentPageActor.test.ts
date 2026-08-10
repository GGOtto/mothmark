/** @jest-environment node */

import {cookies} from "next/headers";

import {findCurrentActor} from "@/db/dbal/sessionsRepository";

import {resolveCurrentEditorPageActor} from "./currentPageActor";

jest.mock("next/headers", () => ({cookies: jest.fn()}));
jest.mock("@/db/dbal/sessionsRepository", () => ({findCurrentActor: jest.fn()}));

describe("current page actor resolution", () => {
	it("does not query for a session when the editor cookie is absent", async () => {
		jest.mocked(cookies).mockResolvedValue({get: jest.fn()} as never);

		await expect(resolveCurrentEditorPageActor()).resolves.toBeUndefined();
		expect(findCurrentActor).not.toHaveBeenCalled();
	});

	it("resolves the editor actor from the host-only session cookie", async () => {
		const actor = {
			userId: "3e816c4d-b957-45dc-8523-d53ec04c8d0f",
			accountType: "registered",
			siteRole: "user",
			audience: "editor",
		} as const;
		jest.mocked(cookies).mockResolvedValue({
			get: jest.fn(() => ({value: "opaque-token"})),
		} as never);
		jest.mocked(findCurrentActor).mockResolvedValue(actor);

		await expect(resolveCurrentEditorPageActor()).resolves.toEqual(actor);
		expect(findCurrentActor).toHaveBeenCalledWith("opaque-token", "editor");
	});
});
