/** @jest-environment node */

import {getPublicUserProfile} from "@/db/dbal/publicProfileRepository";

import {GET} from "./route";

jest.mock("@/db/dbal/publicProfileRepository", () => ({getPublicUserProfile: jest.fn()}));

const context = (username: string) => ({params: Promise.resolve({username})});

describe("public user profile API", () => {
	it("returns an active registered profile and its listed publications", async () => {
		jest.mocked(getPublicUserProfile).mockResolvedValue({
			bio: "Makes quiet worlds.",
			createdAt: "2026-08-08T12:00:00.000Z",
			displayName: null,
			publications: [
				{
					authorUsername: "archivekeeper",
					id: "publication-id",
					isOfficial: false,
					release: {id: "release-id", number: 1, publishedAt: "2026-08-09T12:00:00.000Z"},
					slug: "quiet-archive",
					summary: "A compact world.",
					title: "Quiet archive",
					visibility: "listed",
				},
			],
			username: "archivekeeper",
			website: null,
		});
		const response = await GET(
			new Request("http://localhost/api/users/archivekeeper"),
			context("ArchiveKeeper"),
		);
		expect(response.status).toBe(200);
		expect(getPublicUserProfile).toHaveBeenCalledWith("ArchiveKeeper");
		const body = await response.json();
		expect(body.data.username).toBe("archivekeeper");
		expect(body.data).not.toHaveProperty("email");
		expect(response.headers.get("cache-control")).toContain("public");
	});

	it("returns one indistinguishable missing result", async () => {
		jest.mocked(getPublicUserProfile).mockResolvedValue(undefined);
		const response = await GET(new Request("http://localhost/api/users/missing"), context("missing"));
		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({
			error: {code: "NOT_FOUND", message: "This public profile does not exist."},
		});
	});
});
