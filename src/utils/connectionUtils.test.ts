import type {Connection, Direction, Room} from "../schemas/worldSchema";
import {buildAddConnectionResult, isConnectionFromRoom} from "./connectionUtils";

const ROOM_WIDTH = 72;
const ROOM_HEIGHT = 40;
const CONNECTOR_LENGTH = 40;
const MIN_CONNECTOR_LENGTH = 12;
const CONNECTOR_STEP = 4;

function room(id: string, x: number, y: number): Room {
	return {
		id,
		name: id,
		position: {x, y},
	};
}

function connection(overrides: Partial<Connection> = {}): Connection {
	return {
		id: "connection-1",
		fromRoomId: "room-1",
		toRoomId: "room-2",
		direction: "e",
		returnDirection: "w",
		pathway: "two-way",
		...overrides,
	};
}

function buildOptions({
	fromRoom = room("room-1", 100, 100),
	direction = "e",
	rooms = [fromRoom],
	connections = [],
}: {
	fromRoom?: Room;
	direction?: Direction;
	rooms?: Room[];
	connections?: Connection[];
} = {}) {
	return {
		fromRoom,
		direction,
		rooms,
		connections,
		roomWidth: ROOM_WIDTH,
		roomHeight: ROOM_HEIGHT,
		connectorLength: CONNECTOR_LENGTH,
		minConnectorLength: MIN_CONNECTOR_LENGTH,
		connectorStep: CONNECTOR_STEP,
	};
}

describe("isConnectionFromRoom", () => {
	it("returns true when a forwards connection leaves the room in the given direction", () => {
		const connections = [
			connection({
				fromRoomId: "room-1",
				toRoomId: "room-2",
				direction: "e",
				returnDirection: "w",
				pathway: "forwards",
			}),
		];

		expect(isConnectionFromRoom("room-1", "e", connections)).toBe(true);
	});

	it("returns false when a forwards connection leaves the room in a different direction", () => {
		const connections = [
			connection({
				fromRoomId: "room-1",
				toRoomId: "room-2",
				direction: "e",
				returnDirection: "w",
				pathway: "forwards",
			}),
		];

		expect(isConnectionFromRoom("room-1", "n", connections)).toBe(false);
	});

	it("returns true when a two-way connection enters the room through the given return direction", () => {
		const connections = [
			connection({
				fromRoomId: "room-1",
				toRoomId: "room-2",
				direction: "e",
				returnDirection: "w",
				pathway: "two-way",
			}),
		];

		expect(isConnectionFromRoom("room-2", "w", connections)).toBe(true);
	});

	it("returns true when a backwards connection enters the room through the given return direction", () => {
		const connections = [
			connection({
				fromRoomId: "room-1",
				toRoomId: "room-2",
				direction: "e",
				returnDirection: "w",
				pathway: "backwards",
			}),
		];

		expect(isConnectionFromRoom("room-2", "w", connections)).toBe(true);
	});

	it("returns false when a backwards connection is checked from the original fromRoom direction", () => {
		const connections = [
			connection({
				fromRoomId: "room-1",
				toRoomId: "room-2",
				direction: "e",
				returnDirection: "w",
				pathway: "backwards",
			}),
		];

		expect(isConnectionFromRoom("room-1", "e", connections)).toBe(false);
	});

	it("returns false for no-way connections", () => {
		const connections = [
			connection({
				fromRoomId: "room-1",
				toRoomId: "room-2",
				direction: undefined,
				returnDirection: undefined,
				pathway: "no-way",
			}),
		];

		expect(isConnectionFromRoom("room-1", "e", connections)).toBe(false);
		expect(isConnectionFromRoom("room-2", "w", connections)).toBe(false);
	});
});

describe("buildAddConnectionResult", () => {
	it("returns null when the source room already has a usable connection in that direction", () => {
		const fromRoom = room("room-1", 100, 100);

		const result = buildAddConnectionResult(
			buildOptions({
				fromRoom,
				rooms: [fromRoom, room("room-2", 212, 100)],
				direction: "e",
				connections: [
					connection({
						fromRoomId: "room-1",
						toRoomId: "room-2",
						direction: "e",
						returnDirection: "w",
						pathway: "two-way",
					}),
				],
			}),
		);

		expect(result).toBeNull();
	});

	it("creates a new room and a two-way connection when no overlapping room exists", () => {
		const fromRoom = room("room-1", 100, 100);

		const result = buildAddConnectionResult(
			buildOptions({
				fromRoom,
				direction: "e",
				rooms: [fromRoom],
				connections: [],
			}),
		);

		expect(result).not.toBeNull();

		expect(result?.roomToAdd).toEqual({
			id: "room-2",
			name: "Room 2",
			position: {
				x: 100 + ROOM_WIDTH + CONNECTOR_LENGTH,
				y: 100,
			},
		});

		expect(result?.connection).toEqual({
			id: "connection-1",
			fromRoomId: "room-1",
			toRoomId: "room-2",
			direction: "e",
			returnDirection: "w",
			pathway: "two-way",
		});
	});

	it("connects to an overlapping room instead of creating a new room", () => {
		const fromRoom = room("room-1", 100, 100);
		const existingTargetRoom = room("room-2", 212, 100);

		const result = buildAddConnectionResult(
			buildOptions({
				fromRoom,
				direction: "e",
				rooms: [fromRoom, existingTargetRoom],
				connections: [],
			}),
		);

		expect(result).not.toBeNull();
		expect(result?.roomToAdd).toBeUndefined();

		expect(result?.connection).toEqual({
			id: "connection-1",
			fromRoomId: "room-1",
			toRoomId: "room-2",
			direction: "e",
			returnDirection: "w",
			pathway: "two-way",
		});
	});

	it("makes the new connection forwards-only when the target room already has a connection from the return direction", () => {
		const fromRoom = room("room-1", 100, 100);
		const existingTargetRoom = room("room-2", 212, 100);
		const otherRoom = room("room-3", 300, 100);

		const result = buildAddConnectionResult(
			buildOptions({
				fromRoom,
				direction: "e",
				rooms: [fromRoom, existingTargetRoom, otherRoom],
				connections: [
					connection({
						id: "connection-1",
						fromRoomId: "room-2",
						toRoomId: "room-3",
						direction: "w",
						returnDirection: "e",
						pathway: "forwards",
					}),
				],
			}),
		);

		expect(result).not.toBeNull();
		expect(result?.roomToAdd).toBeUndefined();

		expect(result?.connection).toEqual({
			id: "connection-2",
			fromRoomId: "room-1",
			toRoomId: "room-2",
			direction: "e",
			returnDirection: "w",
			pathway: "forwards",
		});
	});

	it("chooses the best aligned overlapping room when multiple rooms overlap the target area", () => {
		const fromRoom = room("room-1", 100, 100);

		const badlyAlignedRoom = room("room-2", 212, 135);
		const wellAlignedRoom = room("room-3", 212, 100);

		const result = buildAddConnectionResult(
			buildOptions({
				fromRoom,
				direction: "e",
				rooms: [fromRoom, badlyAlignedRoom, wellAlignedRoom],
				connections: [],
			}),
		);

		expect(result).not.toBeNull();
		expect(result?.roomToAdd).toBeUndefined();
		expect(result?.connection.toRoomId).toBe("room-3");
	});

	it("does not connect to a room that is behind the source direction", () => {
		const fromRoom = room("room-1", 100, 100);
		const behindRoom = room("behind-room", 20, 100);

		const result = buildAddConnectionResult(
			buildOptions({
				fromRoom,
				direction: "e",
				rooms: [fromRoom, behindRoom],
				connections: [],
			}),
		);

		expect(result).not.toBeNull();

		expect(result?.connection.toRoomId).toBe("room-3");

		expect(result?.roomToAdd).toEqual({
			id: "room-3",
			name: "Room 3",
			position: {
				x: 100 + ROOM_WIDTH + CONNECTOR_LENGTH,
				y: 100,
			},
		});
	});

	it("uses the next connection id based on the existing connection count", () => {
		const fromRoom = room("room-1", 100, 100);

		const result = buildAddConnectionResult(
			buildOptions({
				fromRoom,
				direction: "s",
				rooms: [fromRoom],
				connections: [
					connection({id: "connection-1"}),
					connection({
						id: "connection-2",
						fromRoomId: "room-3",
						toRoomId: "room-4",
					}),
				],
			}),
		);

		expect(result).not.toBeNull();
		expect(result?.connection.id).toBe("connection-3");
	});

	it("sets the correct return direction for diagonal connections", () => {
		const fromRoom = room("room-1", 100, 100);

		const result = buildAddConnectionResult(
			buildOptions({
				fromRoom,
				direction: "ne",
				rooms: [fromRoom],
				connections: [],
			}),
		);

		expect(result).not.toBeNull();

		expect(result?.connection).toMatchObject({
			fromRoomId: "room-1",
			toRoomId: "room-2",
			direction: "ne",
			returnDirection: "sw",
			pathway: "two-way",
		});

		expect(result?.roomToAdd?.position).toEqual({
			x: 100 + ROOM_WIDTH + CONNECTOR_LENGTH,
			y: 100 - (ROOM_HEIGHT + CONNECTOR_LENGTH),
		});
	});

	it("shrinks the connector length when the original target position overlaps but a shorter position is free", () => {
		const fromRoom = room("room-1", 100, 100);

		const blockingRoom = room("blocking-room", 212, 100);

		const result = buildAddConnectionResult(
			buildOptions({
				fromRoom,
				direction: "e",
				rooms: [fromRoom, blockingRoom],
				connections: [],
			}),
		);

		expect(result).not.toBeNull();

		expect(result?.roomToAdd).toBeUndefined();
		expect(result?.connection.toRoomId).toBe("blocking-room");
	});

	it("creates a new room at the first shorter free position when nearby rooms block the longer target", () => {
		const fromRoom = room("room-1", 100, 100);

		const blockingRoom = room("blocking-room", 212, 100);

		const result = buildAddConnectionResult(
			buildOptions({
				fromRoom,
				direction: "s",
				rooms: [fromRoom, blockingRoom],
				connections: [],
			}),
		);

		expect(result).not.toBeNull();

		expect(result?.roomToAdd).toEqual({
			id: "room-3",
			name: "Room 3",
			position: {
				x: 100,
				y: 100 + ROOM_HEIGHT + CONNECTOR_LENGTH,
			},
		});

		expect(result?.connection).toMatchObject({
			fromRoomId: "room-1",
			toRoomId: "room-3",
			direction: "s",
			returnDirection: "n",
			pathway: "two-way",
		});
	});
});
