import {z} from "zod";

import {world as exampleWorld} from "@/data/worlds/exampleWorld";
import {WorldSchema, type World} from "@/schemas/worldSchema";

const MAIN_WORLD_ENDPOINT = "/api/world/slug/main";

const WorldResponseSchema = z.object({
	data: z.object({
		world: WorldSchema,
		revision: z.number().int().positive(),
	}),
});

type FetchWorld = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type LoadedMainWorld = {
	world: World;
	worldId: string | null;
	revision: number | null;
};

/**
 * Loads the persisted main world, falling back only when that record does not exist.
 */
export async function loadMainWorld(
	fetchWorld: FetchWorld = fetch,
	signal?: AbortSignal,
): Promise<LoadedMainWorld> {
	const response = await fetchWorld(MAIN_WORLD_ENDPOINT, {signal});

	if (response.status === 404) {
		return {world: exampleWorld, worldId: null, revision: null};
	}

	if (!response.ok) {
		throw new Error(`Failed to load the main world (${response.status}).`);
	}

	const result = WorldResponseSchema.extend({
		data: WorldResponseSchema.shape.data.extend({id: z.uuid()}),
	}).parse(await response.json()).data;

	return {world: result.world, worldId: result.id, revision: result.revision};
}
