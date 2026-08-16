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
	return new Request("http://localhost/api/editor/item-suggestions", {
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

describe("item suggestions API", () => {
	beforeEach(() => {
		jest.mocked(resolveCurrentActor).mockResolvedValue(actor);
		jest.mocked(userHasPermission).mockResolvedValue(true);
		jest.mocked(suggestFromWordNet).mockResolvedValue({
			aliases: [{value: "fruit", relation: "broader", evidence: "WordNet category."}],
			concepts: [
				{tag: "fruit", label: "fruit", depth: 2, evidence: "WordNet category.", synsetId: "n:1"},
			],
			version: "test",
		});
	});

	it("returns deterministic lexical candidates for an authorized editor", async () => {
		const response = await POST(request({name: "Apple", aliases: [], tags: []}));
		expect(response.status).toBe(200);
		expect(suggestFromWordNet).toHaveBeenCalledWith({
			name: "Apple",
			aliases: [],
			tags: [],
		});
		expect(await response.json()).toMatchObject({data: {concepts: [{tag: "fruit"}]}});
	});

	it("rejects malformed input, failed CSRF proof, and unauthorized access", async () => {
		expect((await POST(request({name: ""}))).status).toBe(400);
		expect((await POST(request({name: "Apple"}, "wrong"))).status).toBe(403);
		jest.mocked(resolveCurrentActor).mockResolvedValue(undefined);
		expect((await POST(request({name: "Apple"}))).status).toBe(401);
	});
});
