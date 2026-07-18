/** @jest-environment node */

import {
	createDefaultWorld,
	createWorld,
	deleteWorld,
	getWorld,
	getWorldBySlug,
	listWorlds,
	updateWorld,
	updateWorldSchemaVersion,
	type WorldRecord,
} from "@/db/dbal/worldsRepository";
import {world as exampleWorld} from "@/data/worlds/exampleWorld";

import {DELETE, GET as getById, PUT} from "./[id]/route";
import {PATCH as updateSchemaVersion} from "./[id]/schema-version/route";
import {POST as createDefault} from "./default/route";
import {GET as list, POST as create} from "./route";
import {GET as getBySlug} from "./slug/[slug]/route";

jest.mock("@/db/dbal/worldsRepository", () => ({
	createDefaultWorld: jest.fn(),
	createWorld: jest.fn(),
	deleteWorld: jest.fn(),
	getWorld: jest.fn(),
	getWorldBySlug: jest.fn(),
	listWorlds: jest.fn(),
	updateWorld: jest.fn(),
	updateWorldSchemaVersion: jest.fn(),
}));

const worldId = "8ebc3f3f-b9ca-4f75-898f-e196bae50be4";

const storedWorld: WorldRecord = {
	id: worldId,
	name: "Main World",
	slug: "main",
	world: exampleWorld,
	schemaVersion: 1,
	createdAt: new Date("2026-07-18T01:00:00.000Z"),
	updatedAt: new Date("2026-07-18T02:00:00.000Z"),
};

const jsonRequest = (url: string, method: string, body: unknown): Request =>
	new Request(url, {
		method,
		headers: {"content-type": "application/json"},
		body: JSON.stringify(body),
	});

describe("world API", () => {
	it("lists worlds", async () => {
		jest.mocked(listWorlds).mockResolvedValue([storedWorld]);

		const response = await list();

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			data: [
				{
					...storedWorld,
					createdAt: storedWorld.createdAt.toISOString(),
					updatedAt: storedWorld.updatedAt.toISOString(),
				},
			],
		});
	});

	it("creates a validated world", async () => {
		jest.mocked(createWorld).mockResolvedValue(storedWorld);

		const response = await create(
			jsonRequest("http://localhost/api/world", "POST", {
				name: storedWorld.name,
				slug: storedWorld.slug,
				world: exampleWorld,
				schemaVersion: 1,
			}),
		);

		expect(response.status).toBe(201);
		expect(createWorld).toHaveBeenCalledWith({
			name: storedWorld.name,
			slug: storedWorld.slug,
			world: exampleWorld,
			schemaVersion: 1,
		});
	});

	it("rejects an invalid world before calling the repository", async () => {
		const response = await create(
			jsonRequest("http://localhost/api/world", "POST", {
				name: "Broken",
				world: {rooms: "not-an-array"},
			}),
		);

		expect(response.status).toBe(400);
		expect(createWorld).not.toHaveBeenCalled();
	});

	it("creates a world populated with schema defaults", async () => {
		jest.mocked(createDefaultWorld).mockResolvedValue(storedWorld);

		const response = await createDefault(
			jsonRequest("http://localhost/api/world/default", "POST", {
				name: storedWorld.name,
				slug: storedWorld.slug,
			}),
		);

		expect(response.status).toBe(201);
		expect(createDefaultWorld).toHaveBeenCalledWith({
			name: storedWorld.name,
			slug: storedWorld.slug,
		});
	});

	it("gets a world by ID", async () => {
		jest.mocked(getWorld).mockResolvedValue(storedWorld);

		const response = await getById(new Request(`http://localhost/api/world/${worldId}`), {
			params: Promise.resolve({id: worldId}),
		});

		expect(response.status).toBe(200);
		expect(getWorld).toHaveBeenCalledWith(worldId);
	});

	it("updates a world by ID", async () => {
		jest.mocked(updateWorld).mockResolvedValue(storedWorld);

		const response = await PUT(
			jsonRequest(`http://localhost/api/world/${worldId}`, "PUT", {world: exampleWorld}),
			{params: Promise.resolve({id: worldId})},
		);

		expect(response.status).toBe(200);
		expect(updateWorld).toHaveBeenCalledWith(worldId, {world: exampleWorld});
	});

	it("deletes a world by ID", async () => {
		jest.mocked(deleteWorld).mockResolvedValue(true);

		const response = await DELETE(new Request(`http://localhost/api/world/${worldId}`), {
			params: Promise.resolve({id: worldId}),
		});

		expect(response.status).toBe(204);
		expect(deleteWorld).toHaveBeenCalledWith(worldId);
	});

	it("gets a world by slug", async () => {
		jest.mocked(getWorldBySlug).mockResolvedValue(storedWorld);

		const response = await getBySlug(new Request("http://localhost/api/world/slug/main"), {
			params: Promise.resolve({slug: "main"}),
		});

		expect(response.status).toBe(200);
		expect(getWorldBySlug).toHaveBeenCalledWith("main");
	});

	it("updates a world's schema version", async () => {
		jest.mocked(updateWorldSchemaVersion).mockResolvedValue({...storedWorld, schemaVersion: 2});

		const response = await updateSchemaVersion(
			jsonRequest(`http://localhost/api/world/${worldId}/schema-version`, "PATCH", {
				schemaVersion: 2,
			}),
			{params: Promise.resolve({id: worldId})},
		);

		expect(response.status).toBe(200);
		expect(updateWorldSchemaVersion).toHaveBeenCalledWith(worldId, 2);
	});
});
