import {z} from "zod";

import {WorldSchema, type World} from "@/schemas/world/worldSchema";

const WorldResponseSchema = z.object({
	data: z.object({
		id: z.uuid(),
		name: z.string(),
		world: z.unknown(),
		revision: z.number().int().positive(),
	}),
});

type FetchWorld = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Converts the former room-local feature documents before Zod strips unknown room fields. */
export function migrateRoomFeaturesToItems(value: unknown): unknown {
	if (!isRecord(value) || !Array.isArray(value.rooms)) return value;
	const legacyRooms = value.rooms.filter(isRecord);
	if (!legacyRooms.some((room) => Array.isArray(room.features) && room.features.length > 0))
		return value;

	const migrated = JSON.parse(JSON.stringify(value)) as JsonRecord;
	const rooms = (migrated.rooms as unknown[]).filter(isRecord);
	const usedIds = new Set<string>();
	const featureIds = new Map<string, string>();
	const items: JsonRecord[] = Array.isArray(migrated.items)
		? (migrated.items.filter(isRecord) as JsonRecord[])
		: [];
	for (const item of items) {
		if (isRecord(item.id) && typeof item.id.id === "string") usedIds.add(item.id.id);
	}

	for (const room of rooms) {
		const roomId = isRecord(room.id) && typeof room.id.id === "string" ? room.id.id : "room";
		const features = Array.isArray(room.features) ? room.features.filter(isRecord) : [];
		for (const feature of features) {
			const localId =
				isRecord(feature.id) && typeof feature.id.id === "string" ? feature.id.id : "item";
			let globalId = localId;
			if (usedIds.has(globalId)) globalId = `${roomId}-${localId}`;
			let suffix = 2;
			while (usedIds.has(globalId)) globalId = `${roomId}-${localId}-${suffix++}`;
			usedIds.add(globalId);
			featureIds.set(`${roomId}.${localId}`, globalId);
			if (!featureIds.has(localId)) featureIds.set(localId, globalId);

			const legacyKind = typeof feature.kind === "string" ? feature.kind : "feature";
			const structuralBehavior =
				legacyKind === "container"
					? [{type: "container", capacity: {capacity: 8, maximumItemSize: "medium"}}]
					: legacyKind === "surface"
						? [{type: "surface", capacity: {capacity: 8, maximumItemSize: "medium"}}]
						: [];
			items.push({
				id: {type: "item", id: globalId},
				name: feature.name,
				aliases: Array.isArray(feature.aliases) ? feature.aliases : [],
				tags: [
					...(Array.isArray(feature.tags) ? feature.tags : []),
					...(legacyKind !== "feature" && !["container", "surface"].includes(legacyKind)
						? [legacyKind]
						: []),
				],
				presentation: {listedInRoom: feature.listedInRoom === true, listingText: ""},
				examine: {text: typeof feature.description === "string" ? feature.description : ""},
				behaviors: structuralBehavior,
				initialState: {
					location: {type: "room", roomId: {type: "room", id: roomId}},
					open: false,
					locked: false,
					flags: isRecord(feature.flags) ? feature.flags : {examined: false},
				},
			});
		}
		delete room.features;
	}
	migrated.items = items;

	function rewriteReferences(node: unknown, roomContext?: string): void {
		if (Array.isArray(node)) {
			for (const child of node) rewriteReferences(child, roomContext);
			return;
		}
		if (!isRecord(node)) return;
		const nodeRoomId =
			isRecord(node.roomId) && typeof node.roomId.id === "string" ? node.roomId.id : roomContext;
		if (node.type === "feature") node.type = "item";
		if (node["flag-type"] === "feature") node["flag-type"] = "item";
		if (Array.isArray(node.entityTypes)) {
			node.entityTypes = [
				...new Set(node.entityTypes.map((type) => (type === "feature" ? "item" : type))),
			];
		}
		if (isRecord(node.featureId)) {
			const oldId = typeof node.featureId.id === "string" ? node.featureId.id : "";
			const mappedId = featureIds.get(`${nodeRoomId}.${oldId}`) ?? featureIds.get(oldId) ?? oldId;
			node.itemId = {type: "item", id: mappedId};
			delete node.featureId;
			delete node.roomId;
		}
		if (node.type === "item" && typeof node.id === "string") {
			const mappedId = featureIds.get(node.id) ?? featureIds.get(`${nodeRoomId}.${node.id}`);
			if (mappedId) node.id = mappedId;
		}
		for (const child of Object.values(node)) rewriteReferences(child, nodeRoomId);
	}

	rewriteReferences(migrated);
	return migrated;
}

export type LoadedEditorWorld = {
	world: World;
	worldId: string;
	worldName: string;
	revision: number;
};

const readWorldResponse = async (response: Response): Promise<LoadedEditorWorld> => {
	if (!response.ok) {
		throw new Error(`Failed to load the editor world (${response.status}).`);
	}

	const result = WorldResponseSchema.parse(await response.json()).data;
	const world = WorldSchema.parse(migrateRoomFeaturesToItems(result.world));
	return {world, worldId: result.id, worldName: result.name, revision: result.revision};
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
		headers: {"x-csrf-token": csrfBody.data.csrfToken},
		signal,
	});
	const bootstrapWorld = await readWorldResponse(bootstrapResponse);

	if (!requestedWorldId || requestedWorldId === bootstrapWorld.worldId) return bootstrapWorld;

	return readWorldResponse(await fetchWorld(`/api/world/${requestedWorldId}`, {signal}));
}
