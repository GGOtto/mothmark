/** @jest-environment node */

import {world as exampleWorld} from "@/data/worlds/exampleWorld";

import {loadMainWorld} from "./loadMainWorld";

const jsonResponse = (body: unknown, status = 200): Response =>
	new Response(JSON.stringify(body), {
		status,
		headers: {"content-type": "application/json"},
	});

describe("loadMainWorld", () => {
	it("loads the persisted main world when it exists", async () => {
		const persistedWorld = {
			...exampleWorld,
			metadata: {...exampleWorld.metadata, title: "Persisted Main World"},
		};
		const fetchWorld = jest.fn().mockResolvedValue(
			jsonResponse({
				data: {
					id: "8ebc3f3f-b9ca-4f75-898f-e196bae50be4",
					revision: 4,
					slug: "main",
					world: persistedWorld,
				},
			}),
		);

		await expect(loadMainWorld(fetchWorld)).resolves.toEqual({
			world: persistedWorld,
			worldId: "8ebc3f3f-b9ca-4f75-898f-e196bae50be4",
			revision: 4,
		});
		expect(fetchWorld).toHaveBeenCalledWith("/api/world/slug/main", {signal: undefined});
	});

	it("uses the example world when the main slug does not exist", async () => {
		const fetchWorld = jest.fn().mockResolvedValue(jsonResponse({error: {}}, 404));

		await expect(loadMainWorld(fetchWorld)).resolves.toEqual({
			world: exampleWorld,
			worldId: null,
			revision: null,
		});
	});

	it("uses the example world when the persisted main world fails schema validation", async () => {
		const fetchWorld = jest.fn().mockResolvedValue(
			jsonResponse({
				data: {
					id: "8ebc3f3f-b9ca-4f75-898f-e196bae50be4",
					revision: 4,
					slug: "main",
					world: {},
				},
			}),
		);

		await expect(loadMainWorld(fetchWorld)).resolves.toEqual({
			world: exampleWorld,
			worldId: "8ebc3f3f-b9ca-4f75-898f-e196bae50be4",
			revision: 4,
		});
	});

	it("does not hide server failures behind the example world", async () => {
		const fetchWorld = jest.fn().mockResolvedValue(jsonResponse({error: {}}, 500));

		await expect(loadMainWorld(fetchWorld)).rejects.toThrow("Failed to load the main world (500).");
	});
});
