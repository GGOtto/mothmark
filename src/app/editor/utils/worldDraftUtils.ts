/**
 * Helpers for reading and mutating world entities inside an active Immer producer.
 *
 * Mutation helpers return whether their target existed or an insertion occurred so callers can
 * handle missing entities without repeating collection traversal. Unless explicitly documented,
 * helpers affect only their named collection and do not perform cascading world cleanup.
 */
import {castDraft, type Draft} from "immer";
import type {
	Connection,
	Layer,
	Room,
	RoomFeature,
	Viewport,
	World,
} from "@/schemas/world/worldSchema";
import {compareIds, idValue, type ID} from "@/utils/idUtils";

/** A callback that mutates an entity while it belongs to an active Immer draft. */
type DraftRecipe<T> = (draft: Draft<T>) => void;

/** A room's typed ID or unwrapped string ID. */
type RoomReference = string | ID<"room">;

/** A connection's typed ID or unwrapped string ID. */
type ConnectionReference = string | ID<"connection">;

/** A room feature's typed ID or unwrapped string ID. */
type FeatureReference = string | ID<"feature">;

/** The mutable room and feature drafts returned by a room-feature lookup. */
export type LocatedRoomFeatureDraft = {
	/** The room that owns the feature. */
	room: Draft<Room>;
	/** The feature found within the room. */
	feature: Draft<RoomFeature>;
};

/**
 * Finds a room in a world draft by typed or string ID.
 *
 * @returns The mutable room draft, or `undefined` when the room does not exist.
 */
export function findRoomDraft(
	world: Draft<World>,
	reference: RoomReference,
): Draft<Room> | undefined {
	const roomId = idValue(reference);
	return world.rooms.find((room) => idValue(room.id) === roomId);
}

/**
 * Adds a room to a world draft when its ID is not already present.
 *
 * @returns `true` when the room was added, or `false` for a duplicate ID.
 */
export function addRoomDraft(world: Draft<World>, room: Room): boolean {
	if (findRoomDraft(world, room.id)) return false;
	world.rooms.push(castDraft(room));
	return true;
}

/**
 * Replaces the room identified by `reference` with a complete room value.
 *
 * The replacement may have a different ID, which is useful while coordinating an ID rename.
 * This helper does not update references elsewhere in the world.
 *
 * @returns `true` when a room was replaced, or `false` when no room matched.
 */
export function replaceRoomDraft(
	world: Draft<World>,
	reference: RoomReference,
	room: Room,
): boolean {
	const roomIndex = world.rooms.findIndex(
		(candidate) => idValue(candidate.id) === idValue(reference),
	);
	if (roomIndex === -1) return false;
	world.rooms[roomIndex] = castDraft(room);
	return true;
}

/**
 * Runs a mutation recipe against a room in the world draft.
 *
 * @returns `true` when the recipe ran, or `false` when the room does not exist.
 */
export function updateRoomDraft(
	world: Draft<World>,
	reference: RoomReference,
	update: DraftRecipe<Room>,
): boolean {
	const room = findRoomDraft(world, reference);
	if (!room) return false;
	update(room);
	return true;
}

/**
 * Removes a room from the world draft's room collection.
 *
 * This collection-level helper does not remove connections or other room references.
 *
 * @returns `true` when a room was removed, or `false` when no room matched.
 */
export function removeRoomDraft(world: Draft<World>, reference: RoomReference): boolean {
	const roomIndex = world.rooms.findIndex(
		(candidate) => idValue(candidate.id) === idValue(reference),
	);
	if (roomIndex === -1) return false;
	world.rooms.splice(roomIndex, 1);
	return true;
}

/**
 * Finds a connection in a world draft by typed or string ID.
 *
 * @returns The mutable connection draft, or `undefined` when it does not exist.
 */
export function findConnectionDraft(
	world: Draft<World>,
	reference: ConnectionReference,
): Draft<Connection> | undefined {
	const connectionId = idValue(reference);
	return world.connections.find((connection) => idValue(connection.id) === connectionId);
}

/**
 * Adds a connection to a world draft when its ID is not already present.
 *
 * @returns `true` when the connection was added, or `false` for a duplicate ID.
 */
export function addConnectionDraft(world: Draft<World>, connection: Connection): boolean {
	if (findConnectionDraft(world, connection.id)) return false;
	world.connections.push(castDraft(connection));
	return true;
}

/**
 * Replaces the connection identified by `reference` with a complete connection value.
 *
 * The replacement may have a different ID. This helper does not update references elsewhere.
 *
 * @returns `true` when a connection was replaced, or `false` when none matched.
 */
export function replaceConnectionDraft(
	world: Draft<World>,
	reference: ConnectionReference,
	connection: Connection,
): boolean {
	const connectionIndex = world.connections.findIndex(
		(candidate) => idValue(candidate.id) === idValue(reference),
	);
	if (connectionIndex === -1) return false;
	world.connections[connectionIndex] = castDraft(connection);
	return true;
}

/**
 * Runs a mutation recipe against a connection in the world draft.
 *
 * @returns `true` when the recipe ran, or `false` when the connection does not exist.
 */
export function updateConnectionDraft(
	world: Draft<World>,
	reference: ConnectionReference,
	update: DraftRecipe<Connection>,
): boolean {
	const connection = findConnectionDraft(world, reference);
	if (!connection) return false;
	update(connection);
	return true;
}

/**
 * Removes a connection from the world draft's connection collection.
 *
 * @returns `true` when a connection was removed, or `false` when none matched.
 */
export function removeConnectionDraft(
	world: Draft<World>,
	reference: ConnectionReference,
): boolean {
	const connectionIndex = world.connections.findIndex(
		(candidate) => idValue(candidate.id) === idValue(reference),
	);
	if (connectionIndex === -1) return false;
	world.connections.splice(connectionIndex, 1);
	return true;
}

/**
 * Finds a feature inside a specific room in the world draft.
 *
 * @returns Both mutable drafts when found, or `undefined` if the room or feature is missing.
 */
export function findRoomFeatureDraft(
	world: Draft<World>,
	roomReference: RoomReference,
	featureReference: FeatureReference,
): LocatedRoomFeatureDraft | undefined {
	const room = findRoomDraft(world, roomReference);
	if (!room) return;
	const featureId = idValue(featureReference);
	const feature = room.features.find((candidate) => idValue(candidate.id) === featureId);
	return feature ? {room, feature} : undefined;
}

/**
 * Adds a feature to a room when both the room exists and the feature ID is unused there.
 *
 * @returns `true` when the feature was added, or `false` for a missing room or duplicate ID.
 */
export function addRoomFeatureDraft(
	world: Draft<World>,
	roomReference: RoomReference,
	feature: RoomFeature,
): boolean {
	const room = findRoomDraft(world, roomReference);
	if (!room || room.features.some((candidate) => compareIds(candidate.id, feature.id))) return false;
	room.features.push(castDraft(feature));
	return true;
}

/**
 * Replaces a feature inside a specific room with a complete feature value.
 *
 * @returns `true` when a feature was replaced, or `false` when the room or feature is missing.
 */
export function replaceRoomFeatureDraft(
	world: Draft<World>,
	roomReference: RoomReference,
	featureReference: FeatureReference,
	feature: RoomFeature,
): boolean {
	const room = findRoomDraft(world, roomReference);
	if (!room) return false;
	const featureIndex = room.features.findIndex(
		(candidate) => idValue(candidate.id) === idValue(featureReference),
	);
	if (featureIndex === -1) return false;
	room.features[featureIndex] = castDraft(feature);
	return true;
}

/**
 * Runs a mutation recipe against a feature inside a specific room.
 *
 * @returns `true` when the recipe ran, or `false` when the room or feature is missing.
 */
export function updateRoomFeatureDraft(
	world: Draft<World>,
	roomReference: RoomReference,
	featureReference: FeatureReference,
	update: DraftRecipe<RoomFeature>,
): boolean {
	const located = findRoomFeatureDraft(world, roomReference, featureReference);
	if (!located) return false;
	update(located.feature);
	return true;
}

/**
 * Removes a feature from a specific room's feature collection.
 *
 * @returns `true` when a feature was removed, or `false` when the room or feature is missing.
 */
export function removeRoomFeatureDraft(
	world: Draft<World>,
	roomReference: RoomReference,
	featureReference: FeatureReference,
): boolean {
	const room = findRoomDraft(world, roomReference);
	if (!room) return false;
	const featureIndex = room.features.findIndex(
		(candidate) => idValue(candidate.id) === idValue(featureReference),
	);
	if (featureIndex === -1) return false;
	room.features.splice(featureIndex, 1);
	return true;
}

/**
 * Finds a map layer in a world draft by its numeric layer index.
 *
 * @returns The mutable layer draft, or `undefined` when the layer does not exist.
 */
export function findLayerDraft(world: Draft<World>, layerIndex: number): Draft<Layer> | undefined {
	return world.metadata.layers.find((layer) => layer.layer === layerIndex);
}

/**
 * Replaces an existing layer or inserts a new layer in numeric stack order.
 *
 * @returns The mutable draft for the persisted layer.
 */
export function upsertLayerDraft(world: Draft<World>, layer: Layer): Draft<Layer> {
	const existingIndex = world.metadata.layers.findIndex(
		(candidate) => candidate.layer === layer.layer,
	);
	if (existingIndex === -1) {
		world.metadata.layers.push(castDraft(layer));
		world.metadata.layers.sort((left, right) => left.layer - right.layer);
	} else {
		world.metadata.layers[existingIndex] = castDraft(layer);
	}
	return findLayerDraft(world, layer.layer)!;
}

/**
 * Runs a mutation recipe against a map layer.
 *
 * @returns `true` when the recipe ran, or `false` when the layer does not exist.
 */
export function updateLayerDraft(
	world: Draft<World>,
	layerIndex: number,
	update: DraftRecipe<Layer>,
): boolean {
	const layer = findLayerDraft(world, layerIndex);
	if (!layer) return false;
	update(layer);
	return true;
}

/**
 * Removes a map layer by its numeric layer index.
 *
 * This helper does not remove rooms assigned to the layer from the world.
 *
 * @returns `true` when a layer was removed, or `false` when it does not exist.
 */
export function removeLayerDraft(world: Draft<World>, layerIndex: number): boolean {
	const index = world.metadata.layers.findIndex((layer) => layer.layer === layerIndex);
	if (index === -1) return false;
	world.metadata.layers.splice(index, 1);
	return true;
}

/**
 * Replaces the saved viewport for an existing map layer.
 *
 * @returns `true` when the viewport was set, or `false` when the layer does not exist.
 */
export function setLayerViewportDraft(
	world: Draft<World>,
	layerIndex: number,
	viewport: Viewport,
): boolean {
	return updateLayerDraft(world, layerIndex, (layer) => {
		layer.viewport = castDraft(viewport);
	});
}

/**
 * Adds an existing room's ID to an existing layer unless it is already assigned there.
 *
 * This helper does not remove the room from other layers.
 *
 * @returns `true` when the assignment was added, or `false` when it could not be added.
 */
export function addRoomToLayerDraft(
	world: Draft<World>,
	layerIndex: number,
	roomReference: RoomReference,
): boolean {
	const layer = findLayerDraft(world, layerIndex);
	const room = findRoomDraft(world, roomReference);
	if (!layer || !room || layer.rooms.some((roomId) => compareIds(roomId, room.id))) return false;
	layer.rooms.push(castDraft(room.id));
	return true;
}

/**
 * Removes a room ID from a specific layer without removing the room from the world.
 *
 * @returns `true` when an assignment was removed, or `false` when none matched.
 */
export function removeRoomFromLayerDraft(
	world: Draft<World>,
	layerIndex: number,
	roomReference: RoomReference,
): boolean {
	const layer = findLayerDraft(world, layerIndex);
	if (!layer) return false;
	const roomIndex = layer.rooms.findIndex((roomId) => idValue(roomId) === idValue(roomReference));
	if (roomIndex === -1) return false;
	layer.rooms.splice(roomIndex, 1);
	return true;
}

/**
 * Moves an existing room to one existing target layer, removing all prior layer assignments.
 *
 * @returns `true` when the room was moved, or `false` when the room or target layer is missing.
 */
export function moveRoomToLayerDraft(
	world: Draft<World>,
	roomReference: RoomReference,
	targetLayerIndex: number,
): boolean {
	const room = findRoomDraft(world, roomReference);
	const targetLayer = findLayerDraft(world, targetLayerIndex);
	if (!room || !targetLayer) return false;

	for (const layer of world.metadata.layers) {
		for (let index = layer.rooms.length - 1; index >= 0; index -= 1) {
			if (compareIds(layer.rooms[index], room.id)) layer.rooms.splice(index, 1);
		}
	}
	targetLayer.rooms.push(castDraft(room.id));
	return true;
}
