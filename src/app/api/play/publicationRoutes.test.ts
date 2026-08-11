/** @jest-environment node */

import {resolveCurrentActor} from "@/auth/currentActor";
import {
	bootstrapHostedPlay,
	deleteHostedPlaythrough,
	getPublicPublication,
	listPublications,
	PublicationError,
	restartHostedPlay,
	submitHostedCommand,
} from "@/db/dbal/publicationRepository";
import {findBootstrapPlayActor} from "@/db/dbal/sessionsRepository";

import {GET as catalog} from "./publications/route";
import {GET as publication} from "./publications/[slug]/route";
import {POST as bootstrap} from "./publications/[slug]/bootstrap/route";
import {POST as command} from "./publications/[slug]/command/route";
import {POST as restart} from "./publications/[slug]/restart/route";
import {DELETE as deletePlaythrough} from "./publications/[slug]/playthrough/route";

jest.mock("@/auth/currentActor", () => ({resolveCurrentActor: jest.fn()}));
jest.mock("@/db/dbal/sessionsRepository", () => ({findBootstrapPlayActor: jest.fn()}));
jest.mock("@/db/dbal/publicationRepository", () => ({
	HOSTED_COMMAND_MAX_LENGTH: 500,
	PublicationError: class PublicationError extends Error {
		constructor(
			readonly code: string,
			message: string,
		) {
			super(message);
		}
	},
	bootstrapHostedPlay: jest.fn(),
	deleteHostedPlaythrough: jest.fn(),
	getPublicPublication: jest.fn(),
	listPublications: jest.fn(),
	restartHostedPlay: jest.fn(),
	submitHostedCommand: jest.fn(),
}));

const userId = "3e816c4d-b957-45dc-8523-d53ec04c8d0f";
const sourcePlaythroughId = "0fd07c45-9c37-44b7-b197-dc2e0fcdcb9d";
const targetReleaseId = "66d79031-600d-49cf-b7b0-85bc7bbf1fb2";
const restartRequestId = "ad5aa7cd-af4d-46df-bbcd-2e7daed47fd9";
const csrf = "play-csrf";
const context = {params: Promise.resolve({slug: "quiet-archive"})};
const playRequest = (path: string, body?: unknown) =>
	new Request(`http://localhost${path}`, {
		method: "POST",
		headers: {
			origin: "http://localhost",
			cookie: `mothmark_play_csrf=${csrf}`,
			"x-csrf-token": csrf,
			...(body === undefined ? {} : {"content-type": "application/json"}),
		},
		body: body === undefined ? undefined : JSON.stringify(body),
	});

describe("public publication routes", () => {
	it("browses the listed catalog without resolving or creating a play account", async () => {
		jest.mocked(listPublications).mockResolvedValue([]);
		const response = await catalog(new Request("http://localhost/api/play/publications"));
		expect(response.status).toBe(200);
		expect(resolveCurrentActor).not.toHaveBeenCalled();
		expect(bootstrapHostedPlay).not.toHaveBeenCalled();
	});

	it("does not expose playable world data from the metadata endpoint", async () => {
		jest.mocked(getPublicPublication).mockResolvedValue({
			authorUsername: "archivekeeper",
			id: "publication-id",
			slug: "quiet-archive",
			title: "Quiet archive",
			summary: "A small test world.",
			visibility: "unlisted",
			release: {id: "release-id", number: 1, publishedAt: new Date().toISOString()},
			world: {secret: "snapshot"} as never,
			worldVersionId: "version-id",
			engineVersion: "engine-id",
		});
		const response = await publication(new Request("http://localhost"), context);
		const body = await response.json();
		expect(response.status).toBe(200);
		expect(body.data.world).toBeUndefined();
		expect(body.data.worldVersionId).toBeUndefined();
	});

	it("creates a play-only identity only when a valid world is opened", async () => {
		jest.mocked(findBootstrapPlayActor).mockResolvedValue(undefined);
		jest.mocked(bootstrapHostedPlay).mockResolvedValue({
			publication: {id: "publication-id"} as never,
			playthrough: {id: "playthrough-id"} as never,
			newerReleaseAvailable: false,
			restartAvailability: {allowed: true, targetRelease: {id: targetReleaseId, number: 1}},
			session: {token: "opaque-token", expiresAt: new Date("2026-09-01T00:00:00.000Z")},
		});
		const response = await bootstrap(
			playRequest("/api/play/publications/quiet-archive/bootstrap"),
			context,
		);
		expect(response.status).toBe(201);
		expect(bootstrapHostedPlay).toHaveBeenCalledWith("quiet-archive", undefined, "unavailable");
		expect(response.headers.get("set-cookie")).toContain("mothmark_play_session=opaque-token");
	});

	it("does not replace a suspended play identity with a new anonymous account", async () => {
		jest.mocked(findBootstrapPlayActor).mockResolvedValue("blocked");
		const response = await bootstrap(
			new Request("http://localhost/api/play/publications/quiet-archive/bootstrap", {
				method: "POST",
				headers: {
					origin: "http://localhost",
					cookie: `mothmark_play_csrf=${csrf}; mothmark_play_session=suspended-token`,
					"x-csrf-token": csrf,
				},
			}),
			context,
		);
		expect(response.status).toBe(403);
		expect(bootstrapHostedPlay).not.toHaveBeenCalled();
	});

	it("personalizes the catalog from an existing play session without bootstrapping", async () => {
		jest.mocked(findBootstrapPlayActor).mockResolvedValue({userId} as never);
		jest.mocked(listPublications).mockResolvedValue([]);
		const response = await catalog(
			new Request("http://localhost/api/play/publications", {
				headers: {cookie: "mothmark_play_session=existing-token"},
			}),
		);
		expect(response.status).toBe(200);
		expect(listPublications).toHaveBeenCalledWith("", userId);
		expect(bootstrapHostedPlay).not.toHaveBeenCalled();
		expect(response.headers.get("cache-control")).toBe("private, no-store");
	});

	it("requires a play-audience actor and optimistic revision for commands", async () => {
		jest.mocked(resolveCurrentActor).mockResolvedValue({
			userId,
			accountType: "anonymous",
			siteRole: "user",
			audience: "play",
		});
		jest.mocked(submitHostedCommand).mockResolvedValue({id: "playthrough-id", revision: 3} as never);
		const response = await command(
			playRequest("/api/play/publications/quiet-archive/command", {
				command: "look",
				expectedRevision: 2,
			}),
			context,
		);
		expect(response.status).toBe(200);
		expect(submitHostedCommand).toHaveBeenCalledWith({
			playerUserId: userId,
			slug: "quiet-archive",
			command: "look",
			expectedRevision: 2,
			network: "unavailable",
		});
	});

	it("rejects embedded command line breaks before persistence", async () => {
		jest
			.mocked(resolveCurrentActor)
			.mockResolvedValue({userId, accountType: "anonymous", siteRole: "user", audience: "play"});
		const response = await command(
			playRequest("/api/play/publications/quiet-archive/command", {
				command: "look\nnorth",
				expectedRevision: 1,
			}),
			context,
		);
		expect(response.status).toBe(400);
		expect(submitHostedCommand).not.toHaveBeenCalled();
	});

	it("restarts through the play actor and returns the newly pinned release", async () => {
		jest
			.mocked(resolveCurrentActor)
			.mockResolvedValue({userId, accountType: "anonymous", siteRole: "user", audience: "play"});
		jest.mocked(restartHostedPlay).mockResolvedValue({
			publication: {id: "publication-id"} as never,
			playthrough: {id: "new-playthrough"} as never,
			newerReleaseAvailable: false,
			restartAvailability: {allowed: true, targetRelease: {id: targetReleaseId, number: 2}},
		});
		const response = await restart(
			playRequest("/api/play/publications/quiet-archive/restart", {
				sourcePlaythroughId,
				expectedTargetReleaseId: targetReleaseId,
				restartRequestId,
				source: "release_notice",
			}),
			context,
		);
		expect(response.status).toBe(200);
		expect(restartHostedPlay).toHaveBeenCalledWith({
			playerUserId: userId,
			slug: "quiet-archive",
			sourcePlaythroughId,
			expectedTargetReleaseId: targetReleaseId,
			restartRequestId,
			source: "release_notice",
			network: "unavailable",
		});
	});

	it("rejects incomplete restart lineage before calling the repository", async () => {
		jest
			.mocked(resolveCurrentActor)
			.mockResolvedValue({userId, accountType: "anonymous", siteRole: "user", audience: "play"});
		const response = await restart(
			playRequest("/api/play/publications/quiet-archive/restart", {
				sourcePlaythroughId,
			}),
			context,
		);
		expect(response.status).toBe(400);
		expect(restartHostedPlay).not.toHaveBeenCalled();
	});

	it("surfaces a changed restart target as a conflict", async () => {
		jest
			.mocked(resolveCurrentActor)
			.mockResolvedValue({userId, accountType: "anonymous", siteRole: "user", audience: "play"});
		jest
			.mocked(restartHostedPlay)
			.mockRejectedValue(
				new PublicationError("RESTART_CONFLICT", "A different release is now available."),
			);
		const response = await restart(
			playRequest("/api/play/publications/quiet-archive/restart", {
				sourcePlaythroughId,
				expectedTargetReleaseId: targetReleaseId,
				restartRequestId,
				source: "release_notice",
			}),
			context,
		);
		expect(response.status).toBe(409);
		expect((await response.json()).error.message).toBe("A different release is now available.");
	});

	it("deletes only the current play actor's saved playthrough", async () => {
		jest
			.mocked(resolveCurrentActor)
			.mockResolvedValue({userId, accountType: "anonymous", siteRole: "user", audience: "play"});
		jest.mocked(deleteHostedPlaythrough).mockResolvedValue(true);
		const response = await deletePlaythrough(
			new Request("http://localhost/api/play/publications/quiet-archive/playthrough", {
				method: "DELETE",
				headers: {
					origin: "http://localhost",
					cookie: `mothmark_play_csrf=${csrf}`,
					"x-csrf-token": csrf,
				},
			}),
			context,
		);
		expect(response.status).toBe(204);
		expect(deleteHostedPlaythrough).toHaveBeenCalledWith({
			playerUserId: userId,
			slug: "quiet-archive",
			network: "unavailable",
		});
	});
});
