import {z} from "zod";

import {world as exampleWorld} from "@/data/worlds/exampleWorld";
import {WorldSchema, type World} from "@/schemas/world/worldSchema";

const MAIN_WORLD_ENDPOINT = "/api/world/slug/main";

const WorldResponseSchema = z.object({
	data: z.object({
		id: z.uuid(),
		world: z.unknown(),
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
 * Loads the persisted main world, falling back when that record does not exist or
 * its world document no longer matches the current schema.
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

	const result = WorldResponseSchema.parse(await response.json()).data;
	const worldResult = WorldSchema.safeParse(result.world);

	if (!worldResult.success) {
		return {world: exampleWorld, worldId: result.id, revision: result.revision};
	}

	return {world: worldResult.data, worldId: result.id, revision: result.revision};
}
