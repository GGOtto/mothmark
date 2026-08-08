import type {ItemState, RoomState} from "@/schemas/states/entityStateSchemas";
import type {Item, Room} from "@/schemas/world/worldSchema";

function copyItemLocation(location: Item["initialState"]["location"]): ItemState["location"] {
	switch (location.type) {
		case "room":
			return {type: "room", roomId: {...location.roomId}};
		case "item":
			return {type: "item", itemId: {...location.itemId}, placement: location.placement};
		case "hidden":
			return location.roomId ? {type: "hidden", roomId: {...location.roomId}} : {type: "hidden"};
		default:
			return {...location};
	}
}

export function createItemState(item: Item): ItemState {
	return {
		type: "item",
		id: item.id,
		name: item.name,
		description: item.examine.text,
		aliases: [...item.aliases],
		tags: [...item.tags],
		behaviorTags: item.behaviors.map((behavior) => behavior.type),
		listedInRoom: item.presentation.listedInRoom,
		listingText: item.presentation.listingText,
		location: copyItemLocation(item.initialState.location),
		open: item.initialState.open,
		locked: item.initialState.locked,
		flags: {...item.initialState.flags},
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
	};
}
