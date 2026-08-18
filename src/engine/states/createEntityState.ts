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
	const flags = {...item.initialState.flags};
	const behaviorAmounts: Record<string, number> = {};
	let writtenText: string | undefined;
	for (const behavior of item.behaviors) {
		switch (behavior.type) {
			case "switchable":
				flags["behavior.on"] ??= behavior.startsOn;
				break;
			case "lightable":
				flags["behavior.lit"] ??= behavior.startsLit;
				break;
			case "breakable":
			case "repairable":
				flags["behavior.broken"] ??= behavior.startsBroken;
				break;
			case "cleanable":
				flags["behavior.dirty"] ??= behavior.startsDirty;
				break;
			case "liquid-container":
				behaviorAmounts.liquid = Math.min(behavior.capacity, behavior.startingAmount);
				break;
			case "writable":
				writtenText = behavior.startingText.trim() || undefined;
				break;
		}
	}
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
		flags,
		...(Object.keys(behaviorAmounts).length > 0 ? {behaviorAmounts} : {}),
		...(writtenText ? {writtenText} : {}),
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
