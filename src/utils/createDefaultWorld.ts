import {
	ConnectionSchema,
	RoomSchema,
	type Connection,
	type Direction,
	type Point,
	type Room,
} from "@/schemas/roomSchema";
import {DefaultObjectStateDefaults} from "@/schemas/objectStateSchema";

// TODO: add createDefaultFeature when feature creation UI exists.
// TODO: add createDefaultWorld when the starter route moves off ad hoc schema default generation.

export function createDefaultRoom(id: string, name: string, position: Point): Room {
	return RoomSchema.parse({
		id,
		name,
		aliases: [],
		tags: [],
		position,
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

export function createDefaultConnection({
	id,
	fromRoomId,
	toRoomId,
	direction,
	returnDirection,
	pathway = "two-way",
}: {
	id: string;
	fromRoomId: string;
	toRoomId: string;
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

// TODO: weird place to put this, but we need a button that can pull up another unversal editor. Example: list of connections in room, click on one and it replaces the room universal editor with the connection
