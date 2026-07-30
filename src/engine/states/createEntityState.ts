import type {FeatureState, RoomState} from "@/schemas/states/entityStateSchemas";
import type {Room, RoomFeature} from "@/schemas/world/worldSchema";

export function createFeatureState(feature: RoomFeature): FeatureState {
	return {
		type: "feature",
		id: feature.id,
		name: feature.name,
		description: feature.description,
		aliases: [...feature.aliases],
		tags: [...feature.tags],
		kind: feature.kind,
		listedInRoom: feature.listedInRoom,
		flags: {...feature.flags},
	};
}

export function createRoomState(room: Room): RoomState {
	return {
		type: "room",
		id: room.id,
		name: room.name,
		description: room.description,
		shortDescription: room.shortDescription,
		aliases: [...room.aliases],
		tags: [...room.tags],
		lockedExits: [],
		flags: {...room.flags},
		featureStates: room.features.map(createFeatureState),
	};
}
