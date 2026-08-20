/** @jest-environment node */

import {resolveCurrentActor} from "@/auth/currentActor";
import {userHasPermission} from "@/db/dbal/permissionRepository";
import {suggestFromWordNet} from "@/features/item-suggestions/wordnetLexicon.server";
import {POST} from "./route";

jest.mock("@/auth/currentActor", () => ({resolveCurrentActor: jest.fn()}));
jest.mock("@/db/dbal/permissionRepository", () => ({userHasPermission: jest.fn()}));
jest.mock("@/features/item-suggestions/wordnetLexicon.server", () => ({
	suggestFromWordNet: jest.fn(),
}));

const csrf = "csrf-token";
const actor = {
	userId: "3e816c4d-b957-45dc-8523-d53ec04c8d0f",
	accountType: "anonymous",
	siteRole: "user",
	audience: "editor",
} as const;

function request(body: unknown, csrfHeader = csrf) {
	return new Request("http://localhost/api/editor/item-icon-suggestions", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: "http://localhost",
			cookie: `mothmark_editor_csrf=${csrf}`,
			"x-csrf-token": csrfHeader,
		},
		body: JSON.stringify(body),
	});
}

describe("item icon suggestions API", () => {
	beforeEach(() => {
		jest.mocked(resolveCurrentActor).mockResolvedValue(actor);
		jest.mocked(userHasPermission).mockResolvedValue(true);
		jest.mocked(suggestFromWordNet).mockImplementation(async ({name}) => ({
			aliases: [],
			concepts:
				name === "Sardines"
					? [
							{tag: "fish", label: "fish", depth: 1, evidence: "Food class.", synsetId: "n:1"},
							{tag: "food", label: "food", depth: 2, evidence: "Food class.", synsetId: "n:2"},
						]
					: [{tag: "food", label: "food", depth: 1, evidence: "Food class.", synsetId: "n:3"}],
			version: "test",
		}));
	});

	it("batches tag-system classifications into cosmetic icon categories", async () => {
		const response = await POST(
			request({
				items: [
					{name: "Toast", aliases: [], tags: [], iconCategory: "generic"},
					{name: "Sardines", aliases: [], tags: [], iconCategory: "generic"},
				],
			}),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({data: {categories: ["food", "meal"]}});
		expect(suggestFromWordNet).toHaveBeenCalledTimes(2);
	});

	it("rejects malformed input, failed CSRF proof, and unauthorized access", async () => {
		expect((await POST(request({items: []}))).status).toBe(400);
		expect((await POST(request({items: [{name: "Toast"}]}, "wrong"))).status).toBe(403);
		jest.mocked(resolveCurrentActor).mockResolvedValue(undefined);
		expect((await POST(request({items: [{name: "Toast"}]}))).status).toBe(401);
	});
});
