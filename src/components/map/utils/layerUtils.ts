import {DefaultViewport, type Layer, type World} from "@/schemas/world/worldSchema";
import {compareIds, type ID} from "@/utils/idUtils";

/** Returns a default layer */
export function getDefaultLayer(world: World, layerIndex: number): Layer {
	const viewport = {...DefaultViewport};
	if (layerIndex === 0) {
		return {
			name: "Ground",
			layer: 0,
			rooms: world.rooms.map((room) => room.id),
			viewport,
		};
	}
	return {
		name: layerIndex > 0 ? `Upper ${layerIndex}` : `Lower ${Math.abs(layerIndex)}`,
		layer: layerIndex,
		rooms: [],
		viewport,
	};
}

/** Get a layer from its id */
export function getLayer(world: World, layerIndex: number): Layer {
	for (const layer of world.metadata.layers) {
		if (layer.layer === layerIndex) {
			return layer;
		}
	}
	return getDefaultLayer(world, layerIndex);
}

/** Replaces a persisted layer, or inserts a newly created layer in stack order. */
export function upsertLayer(layers: Layer[], nextLayer: Layer): Layer[] {
	const existingIndex = layers.findIndex((layer) => layer.layer === nextLayer.layer);
	if (existingIndex === -1) {
		return [...layers, nextLayer].sort((left, right) => left.layer - right.layer);
	}

	return layers.map((layer, index) => (index === existingIndex ? nextLayer : layer));
}

/** Search a layer and return true or false if a room id has been found in that layer */
export function isRoomInLayer(layer: Layer, roomId: ID<"room">): boolean {
	for (const room of layer.rooms) {
		if (compareIds(room, roomId)) {
			return true;
		}
	}
	return false;
}

/** Return which later a room ID is on in the world metadata. Returns 0 if the room isn't referenced in a layer. */
export function findLayerForRoomId(world: World, roomId: ID<"room">): Layer {
	for (const layer of world.metadata.layers) {
		if (isRoomInLayer(layer, roomId)) {
			return layer;
		}
	}
	return getDefaultLayer(world, 0);
}
