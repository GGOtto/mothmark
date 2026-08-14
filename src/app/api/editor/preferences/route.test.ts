/** @jest-environment node */

import {resolveCurrentActor} from "@/auth/currentActor";
import {
	getEditorPreferences,
	getOwnedItemActivity,
	updateEditorPreferences,
} from "@/db/dbal/editorPreferencesRepository";
import {userHasPermission} from "@/db/dbal/permissionRepository";

import {GET, PATCH} from "./route";

jest.mock("@/auth/currentActor", () => ({resolveCurrentActor: jest.fn()}));
jest.mock("@/db/dbal/permissionRepository", () => ({userHasPermission: jest.fn()}));
jest.mock("@/db/dbal/editorPreferencesRepository", () => ({
	getEditorPreferences: jest.fn(),
	getOwnedItemActivity: jest.fn(),
	updateEditorPreferences: jest.fn(),
}));

const userId = "3e816c4d-b957-45dc-8523-d53ec04c8d0f";
const worldId = "8ebc3f3f-b9ca-4f75-898f-e196bae50be4";
const csrf = "csrf-token";
const actor = {userId, accountType: "anonymous", siteRole: "user", audience: "editor"} as const;

const patchRequest = (body: unknown, csrfHeader = csrf) =>
	new Request("http://localhost/api/editor/preferences", {
		method: "PATCH",
		headers: {
			"content-type": "application/json",
			origin: "http://localhost",
			cookie: `mothmark_editor_csrf=${csrf}`,
			"x-csrf-token": csrfHeader,
		},
		body: JSON.stringify(body),
	});

describe("editor preferences API", () => {
	beforeEach(() => {
		jest.mocked(resolveCurrentActor).mockResolvedValue(actor);
		jest.mocked(userHasPermission).mockResolvedValue(true);
		jest.mocked(getEditorPreferences).mockResolvedValue({
			itemListView: "cards",
			itemListSort: "updated-desc",
		});
	});

	it("loads user preferences and owned-world item activity together", async () => {
		jest.mocked(getOwnedItemActivity).mockResolvedValue({
			"order-book": {
				createdAt: "2026-08-12T01:00:00.000Z",
				updatedAt: "2026-08-13T01:00:00.000Z",
			},
		});

		const response = await GET(
			new Request(`http://localhost/api/editor/preferences?worldId=${worldId}`),
		);

		expect(response.status).toBe(200);
		expect(getEditorPreferences).toHaveBeenCalledWith(userId);
		expect(getOwnedItemActivity).toHaveBeenCalledWith(userId, worldId);
		expect(await response.json()).toMatchObject({
			data: {preferences: {itemListView: "cards"}, itemActivity: {"order-book": {}}},
		});
	});

	it("saves only validated page preferences", async () => {
		jest.mocked(updateEditorPreferences).mockResolvedValue({
			itemListView: "marks",
			itemListSort: "name-asc",
		});
		const response = await PATCH(patchRequest({itemListView: "marks", itemListSort: "name-asc"}));
		expect(response.status).toBe(200);
		expect(updateEditorPreferences).toHaveBeenCalledWith(userId, {
			itemListView: "marks",
			itemListSort: "name-asc",
		});
	});

	it("rejects unknown preferences and mismatched CSRF proof", async () => {
		expect((await PATCH(patchRequest({itemListView: "shelves"}))).status).toBe(400);
		expect((await PATCH(patchRequest({itemListView: "rows"}, "wrong"))).status).toBe(403);
		expect(updateEditorPreferences).not.toHaveBeenCalled();
	});

	it("does not reveal another user's world through activity lookup", async () => {
		jest.mocked(getOwnedItemActivity).mockResolvedValue(undefined);
		const response = await GET(
			new Request(`http://localhost/api/editor/preferences?worldId=${worldId}`),
		);
		expect(response.status).toBe(404);
	});
});
