import {z} from "zod";

import {parseStoredWorld} from "@/compat/storageCodec";
import type {World} from "@/schemas/world/worldSchema";

const WorldResponseSchema = z.object({
	data: z.object({
		editorSlug: z.string().min(1).nullable().optional(),
		id: z.uuid(),
		name: z.string(),
		ownerUserId: z.uuid(),
		world: z.unknown(),
		schemaVersion: z.number().int().positive().default(1),
		revision: z.number().int().positive(),
	}),
});

type FetchWorld = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type LoadedEditorWorld = {
	editorSlug: string;
	world: World;
	worldId: string;
	worldName: string;
	userId: string;
	revision: number;
};

const readWorldResponse = async (response: Response): Promise<LoadedEditorWorld> => {
	if (!response.ok) {
		throw new Error(`Failed to load the editor world (${response.status}).`);
	}

	const result = WorldResponseSchema.parse(await response.json()).data;
	const world = parseStoredWorld(result.world, result.schemaVersion, {
		id: result.id,
		name: result.name,
		storage: "editor",
	});
	return {
		editorSlug: result.editorSlug ?? result.id,
		world,
		worldId: result.id,
		worldName: result.name,
		userId: result.ownerUserId,
		revision: result.revision,
	};
};

/** Establishes the private editor session and loads only a world authorized for that actor. */
export async function loadEditorWorld(
	fetchWorld: FetchWorld = fetch,
	signal?: AbortSignal,
	requestedWorldId?: string,
): Promise<LoadedEditorWorld> {
	const csrfResponse = await fetchWorld("/api/auth/csrf", {signal});
	if (!csrfResponse.ok) throw new Error(`Failed to prepare the editor (${csrfResponse.status}).`);
	const csrfBody = (await csrfResponse.json()) as {data?: {csrfToken?: unknown}};
	if (typeof csrfBody.data?.csrfToken !== "string") {
		throw new Error("The editor security response was invalid.");
	}

	const bootstrapResponse = await fetchWorld("/api/editor/bootstrap", {
		method: "POST",
		headers: {"content-type": "application/json", "x-csrf-token": csrfBody.data.csrfToken},
		body: JSON.stringify({openWorld: !requestedWorldId}),
		signal,
	});
	if (!bootstrapResponse.ok) {
		throw new Error(`Failed to load the editor world (${bootstrapResponse.status}).`);
	}
	if (requestedWorldId) {
		return readWorldResponse(await fetchWorld(`/api/world/${requestedWorldId}`, {signal}));
	}
	return readWorldResponse(bootstrapResponse);
}
