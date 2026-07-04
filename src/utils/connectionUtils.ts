import type {Connection, Point, Direction} from "../schemas/worldSchema";

export function isConnectionFromRoom(
	roomId: string,
	direction: Direction,
	connections: Connection[],
) {
	return connections.some((connection) => {
		return (
			(connection.fromRoomId === roomId &&
				connection.direction === direction &&
				(connection.pathway === "forwards" || connection.pathway === "two-way")) ||
			(connection.toRoomId === roomId &&
				connection.returnDirection === direction &&
				(connection.pathway === "backwards" || connection.pathway === "two-way"))
		);
	});
}
