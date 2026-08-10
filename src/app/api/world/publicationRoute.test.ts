/** @jest-environment node */

import {resolveCurrentActor} from "@/auth/currentActor";
import {userHasPermission} from "@/db/dbal/permissionRepository";
import {
	getOwnedPublication,
	publishOwnedWorld,
	publishOwnedWorldUpdate,
	updateOwnedPublication,
} from "@/db/dbal/publicationRepository";

import {GET, PATCH, POST, PUT} from "./[id]/publication/route";

jest.mock("@/auth/currentActor", () => ({resolveCurrentActor: jest.fn()}));
jest.mock("@/db/dbal/permissionRepository", () => ({userHasPermission: jest.fn()}));
jest.mock("@/db/dbal/publicationRepository", () => ({
	PUBLICATION_SUMMARY_MAX_LENGTH: 280,
	PUBLICATION_TITLE_MAX_LENGTH: 80,
	PublicationError: class PublicationError extends Error {},
	getOwnedPublication: jest.fn(),
	publishOwnedWorld: jest.fn(),
	publishOwnedWorldUpdate: jest.fn(),
	updateOwnedPublication: jest.fn(),
}));

const worldId = "8ebc3f3f-b9ca-4f75-898f-e196bae50be4";
const userId = "3e816c4d-b957-45dc-8523-d53ec04c8d0f";
const csrf = "csrf-token";
const context = {params: Promise.resolve({id: worldId})};
const request = (method = "GET", body?: unknown) =>
	new Request(`http://localhost/api/world/${worldId}/publication`, {
		method,
		headers:
			method === "GET"
				? {}
				: {
						origin: "http://localhost",
						cookie: `mothmark_editor_csrf=${csrf}`,
						"x-csrf-token": csrf,
						"content-type": "application/json",
					},
		body: body === undefined ? undefined : JSON.stringify(body),
	});

describe("owner publication route", () => {
	beforeEach(() => jest.mocked(userHasPermission).mockResolvedValue(true));

	it("hides publishing completely from anonymous owners", async () => {
		jest
			.mocked(resolveCurrentActor)
			.mockResolvedValue({userId, accountType: "anonymous", siteRole: "user", audience: "editor"});
		expect((await GET(request(), context)).status).toBe(404);
		expect(
			(
				await POST(
					request("POST", {
						expectedRevision: 1,
						title: "Title",
						slug: "title",
						summary: "Summary",
						visibility: "listed",
					}),
					context,
				)
			).status,
		).toBe(403);
		expect(publishOwnedWorld).not.toHaveBeenCalled();
	});

	it("publishes only through the registered owner scope", async () => {
		jest
			.mocked(resolveCurrentActor)
			.mockResolvedValue({userId, accountType: "registered", siteRole: "user", audience: "editor"});
		jest.mocked(publishOwnedWorld).mockResolvedValue({id: "publication-id"} as never);
		const response = await POST(
			request("POST", {
				expectedRevision: 4,
				title: " Quiet archive ",
				slug: "Quiet Archive",
				summary: " A small world. ",
				visibility: "unlisted",
			}),
			context,
		);
		expect(response.status).toBe(201);
		expect(publishOwnedWorld).toHaveBeenCalledWith({
			ownerUserId: userId,
			worldId,
			expectedRevision: 4,
			title: "Quiet archive",
			slug: "Quiet Archive",
			summary: "A small world.",
			visibility: "unlisted",
		});
	});

	it("reads only the current owner's publication", async () => {
		jest
			.mocked(resolveCurrentActor)
			.mockResolvedValue({userId, accountType: "registered", siteRole: "admin", audience: "editor"});
		jest.mocked(getOwnedPublication).mockResolvedValue(undefined);
		const response = await GET(request(), context);
		expect(response.status).toBe(200);
		expect(getOwnedPublication).toHaveBeenCalledWith(userId, worldId);
	});

	it("publishes a newer saved revision without changing the slug", async () => {
		jest
			.mocked(resolveCurrentActor)
			.mockResolvedValue({userId, accountType: "registered", siteRole: "user", audience: "editor"});
		jest.mocked(publishOwnedWorldUpdate).mockResolvedValue({id: "publication-id"} as never);
		const response = await PUT(
			request("PUT", {expectedRevision: 5, title: "Second release", summary: "Updated."}),
			context,
		);
		expect(response.status).toBe(200);
		expect(publishOwnedWorldUpdate).toHaveBeenCalledWith({
			ownerUserId: userId,
			worldId,
			expectedRevision: 5,
			title: "Second release",
			summary: "Updated.",
		});
	});

	it("keeps owner lifecycle changes scoped to the owned publication", async () => {
		jest
			.mocked(resolveCurrentActor)
			.mockResolvedValue({userId, accountType: "registered", siteRole: "user", audience: "editor"});
		jest.mocked(updateOwnedPublication).mockResolvedValue({id: "publication-id"} as never);
		const response = await PATCH(request("PATCH", {action: "unpublish"}), context);
		expect(response.status).toBe(200);
		expect(updateOwnedPublication).toHaveBeenCalledWith({
			ownerUserId: userId,
			worldId,
			action: "unpublish",
		});
	});
});
