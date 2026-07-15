import {
	ConnectionSchema,
	RoomSchema,
	RoomFeatureSchema,
	type Connection,
	type Direction,
	type Point,
	type Room,
	type RoomFeature,
} from "@/schemas/roomSchema";
import {DefaultObjectStateDefaults} from "@/schemas/objectStateSchema";
import type {ID} from "@/utils/idUtils";

// TODO: add createDefaultFeature when feature creation UI exists.
// TODO: add createDefaultWorld when the starter route moves off ad hoc schema default generation.

export function createDefaultRoom(id: string, name: string, position: Point): Room {
	return RoomSchema.parse({
		id,
		name,
		aliases: [],
		tags: [],
		metadata: {position},
		description: {
			default: "",
			variants: [],
		},
		shortDescription: "",
		features: [],
		activeWhen: [],
		visibleWhen: [],
	});
}

export function createDefaultFeature(id: string, name = "New feature"): RoomFeature {
	return RoomFeatureSchema.parse({
		id,
		name,
		aliases: [],
		tags: [],
		kind: "feature",
		description: {
			default: "",
			variants: [],
		},
		listedInRoom: false,
		activeWhen: [],
		visibleWhen: [],
		usableWhen: [],
		initialItems: [],
		state: DefaultObjectStateDefaults,
	});
}

export function createDefaultConnection({
	id,
	fromRoomId,
	toRoomId,
	direction,
	returnDirection,
	pathway = "two-way",
}: {
	id: ID<"connection"> | string;
	fromRoomId: ID<"room"> | string;
	toRoomId: ID<"room"> | string;
	direction: Direction;
	returnDirection: Direction;
	pathway?: Connection["pathway"];
}): Connection {
	return ConnectionSchema.parse({
		id,
		fromRoomId,
		toRoomId,
		direction,
		returnDirection,
		metadata: {},
		aliases: [],
		pathway,
		description: "",
		blockedMessage: "",
		visibleWhen: [],
		travelAllowedWhen: [],
		lockedWhen: [],
		state: DefaultObjectStateDefaults,
	});
}
