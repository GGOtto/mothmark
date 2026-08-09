/** @jest-environment node */

import {resolveCurrentActor} from "@/auth/currentActor";
import {
	bootstrapHostedPlay,
	getPublicPublication,
	listPublications,
	submitHostedCommand,
} from "@/db/dbal/publicationRepository";
import {findBootstrapPlayActor} from "@/db/dbal/sessionsRepository";

import {GET as catalog} from "./publications/route";
import {GET as publication} from "./publications/[slug]/route";
import {POST as bootstrap} from "./publications/[slug]/bootstrap/route";
import {POST as command} from "./publications/[slug]/command/route";

jest.mock("@/auth/currentActor", () => ({resolveCurrentActor: jest.fn()}));
jest.mock("@/db/dbal/sessionsRepository", () => ({findBootstrapPlayActor: jest.fn()}));
jest.mock("@/db/dbal/publicationRepository", () => ({
	HOSTED_COMMAND_MAX_LENGTH: 500,
	PublicationError: class PublicationError extends Error {},
	bootstrapHostedPlay: jest.fn(),
	getPublicPublication: jest.fn(),
	listPublications: jest.fn(),
	submitHostedCommand: jest.fn(),
}));

const userId = "3e816c4d-b957-45dc-8523-d53ec04c8d0f";
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
			session: {token: "opaque-token", expiresAt: new Date("2026-09-01T00:00:00.000Z")},
		});
		const response = await bootstrap(
			playRequest("/api/play/publications/quiet-archive/bootstrap"),
			context,
		);
		expect(response.status).toBe(201);
		expect(bootstrapHostedPlay).toHaveBeenCalledWith("quiet-archive", undefined);
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
});
