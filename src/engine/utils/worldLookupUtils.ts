import type {Room, World} from "@/schemas/world/worldSchema";
import {compareIds, type ID, idValue} from "@/utils/idUtils";

/** Finds authored room data without applying runtime state changes. */
export function getRoom(world: World, roomId: ID<"room"> | string): Room {
	const room = world.rooms.find((candidate) =>
		typeof roomId === "string" ? idValue(candidate.id) === roomId : compareIds(candidate.id, roomId),
	);
	if (!room) throw new Error(`Missing room: ${typeof roomId === "string" ? roomId : roomId.id}`);
	return room;
}
