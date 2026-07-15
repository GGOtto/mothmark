import type {Connection, Direction, Point, Room} from "../schemas/worldSchema";
import {ConnectionSchema, RoomSchema} from "../schemas/roomSchema";
import {DIRECTION_VECTORS} from "./mapUtils";
import {
	buildAddConnectionResult,
	connectionUsesNode,
	getConnectionOnNode,
	getConnectionsOnNode,
	getConnectionSide,
	getDuplicateConnectionByShape,
	getNearestNodeInRadius,
	getNextAvailablePathway,
	getNodeSelectionKey,
	getPathwayLabel,
	getPathwayForEditedDrop,
	getPathwayForNewDrop,
	isConnectionFromRoom,
	isSameConnectionShape,
} from "./connectionUtils";
import {createDefaultFieldObject} from "./createDefaultFieldObject";
import {idValue, toID} from "./idUtils";

const ROOM_WIDTH = 72;
const ROOM_HEIGHT = 40;
const CONNECTOR_LENGTH = 40;
const MIN_CONNECTOR_LENGTH = 12;
const CONNECTOR_STEP = 4;

function createDefaultConnection(
	overrides: Partial<Connection> &
		Pick<Connection, "id" | "fromRoomId" | "toRoomId" | "direction" | "returnDirection">,
): Connection {
	return ConnectionSchema.parse({
		...createDefaultFieldObject(ConnectionSchema, {populateArrays: false, useMetadata: false}),
		...overrides,
	});
}

describe("getPathwayLabel", () => {
	it.each([
		["two-way", "Two way"],
		["forwards", "One way"],
		["backwards", "One way"],
		["no-way", "No way"],
	] as const)("labels %s as %s", (pathway, label) => {
		expect(getPathwayLabel(pathway)).toBe(label);
	});
});

function room(id: string, x: number, y: number): Room {
	return generatedRoom(id, id, {x, y});
}

function generatedRoom(id: string, name: string, position: Point): Room {
	return RoomSchema.parse({
		...createDefaultFieldObject(RoomSchema, {populateArrays: false, useMetadata: false}),
		id,
		name,
		metadata: {position},
	});
}

function connection(overrides: Partial<Connection> = {}): Connection {
	return ConnectionSchema.parse({
		...createDefaultFieldObject(ConnectionSchema, {populateArrays: false, useMetadata: false}),
		id: toID("connection", "connection-1"),
		fromRoomId: {type: "room", id: "room-1"},
		toRoomId: {type: "room", id: "room-2"},
		direction: "e",
		returnDirection: "w",
		pathway: "two-way",
		...overrides,
	});
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

function getRoomConnectionPoint(room: Room, direction: Direction): Point {
	const vector = DIRECTION_VECTORS[direction];

	return {
		x: room.metadata.position.x + vector.x * 10,
		y: room.metadata.position.y + vector.y * 10,
	};
}

describe("isConnectionFromRoom", () => {
	it("returns true when a forwards connection leaves the room in the given direction", () => {
		const connections = [
			connection({
				fromRoomId: {type: "room", id: "room-1"},
				toRoomId: {type: "room", id: "room-2"},
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
				fromRoomId: {type: "room", id: "room-1"},
				toRoomId: {type: "room", id: "room-2"},
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
				fromRoomId: {type: "room", id: "room-1"},
				toRoomId: {type: "room", id: "room-2"},
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
				fromRoomId: {type: "room", id: "room-1"},
				toRoomId: {type: "room", id: "room-2"},
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
				fromRoomId: {type: "room", id: "room-1"},
				toRoomId: {type: "room", id: "room-2"},
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
				fromRoomId: {type: "room", id: "room-1"},
				toRoomId: {type: "room", id: "room-2"},
				direction: "e",
				returnDirection: "w",
				pathway: "no-way",
			}),
		];

		expect(isConnectionFromRoom("room-1", "e", connections)).toBe(false);
		expect(isConnectionFromRoom("room-2", "w", connections)).toBe(false);
	});
});

describe("getNextAvailablePathway", () => {
	it("uses the next pathway when neither endpoint node has another outgoing connection", () => {
		const currentConnection = connection();

		expect(getNextAvailablePathway(currentConnection, [currentConnection])).toBe("forwards");
	});

	it("skips a backwards pathway when the destination node already has an outgoing connection", () => {
		const currentConnection = connection({pathway: "forwards"});
		const destinationOutgoing = connection({
			id: toID("connection", "connection-2"),
			fromRoomId: {type: "room", id: "room-2"},
			toRoomId: {type: "room", id: "room-3"},
			direction: "w",
			returnDirection: "e",
			pathway: "forwards",
		});

		expect(getNextAvailablePathway(currentConnection, [currentConnection, destinationOutgoing])).toBe(
			"no-way",
		);
	});

	it("skips pathways that leave a source node which already has an outgoing connection", () => {
		const currentConnection = connection({pathway: "no-way"});
		const sourceOutgoing = connection({
			id: toID("connection", "connection-2"),
			toRoomId: {type: "room", id: "room-3"},
			pathway: "forwards",
		});

		expect(getNextAvailablePathway(currentConnection, [currentConnection, sourceOutgoing])).toBe(
			"backwards",
		);
	});
});

describe("connectionUsesNode", () => {
	it("returns true when the connection starts at the given node", () => {
		const existingConnection = connection({
			fromRoomId: {type: "room", id: "room-1"},
			direction: "e",
		});

		expect(connectionUsesNode(existingConnection, "room-1", "e")).toBe(true);
	});

	it("returns true when the connection ends at the given node", () => {
		const existingConnection = connection({
			toRoomId: {type: "room", id: "room-2"},
			returnDirection: "w",
		});

		expect(connectionUsesNode(existingConnection, "room-2", "w")).toBe(true);
	});

	it("returns false when the room matches but the direction does not", () => {
		const existingConnection = connection({
			fromRoomId: {type: "room", id: "room-1"},
			direction: "e",
		});

		expect(connectionUsesNode(existingConnection, "room-1", "n")).toBe(false);
	});
});

describe("getConnectionOnNode", () => {
	it("returns the first connection that uses the node", () => {
		const matchingConnection = connection({
			id: toID("connection", "connection-1"),
			fromRoomId: {type: "room", id: "room-1"},
			direction: "e",
		});

		const connections = [
			connection({
				id: toID("connection", "connection-2"),
				fromRoomId: {type: "room", id: "room-2"},
				direction: "n",
			}),
			matchingConnection,
		];

		expect(getConnectionOnNode(connections, "room-1", "e")).toBe(matchingConnection);
	});

	it("ignores the connection with the ignored id", () => {
		const ignoredConnection = connection({
			id: toID("connection", "connection-1"),
			fromRoomId: {type: "room", id: "room-1"},
			direction: "e",
		});

		const matchingConnection = connection({
			id: toID("connection", "connection-2"),
			fromRoomId: {type: "room", id: "room-1"},
			direction: "e",
		});

		expect(
			getConnectionOnNode([ignoredConnection, matchingConnection], "room-1", "e", "connection-1"),
		).toBe(matchingConnection);
	});

	it("returns undefined when no connection uses the node", () => {
		const connections = [
			connection({
				fromRoomId: {type: "room", id: "room-1"},
				direction: "e",
			}),
		];

		expect(getConnectionOnNode(connections, "room-1", "n")).toBeUndefined();
	});
});

describe("getConnectionsOnNode", () => {
	it("returns all connections that use the node", () => {
		const firstConnection = connection({
			id: toID("connection", "connection-1"),
			fromRoomId: {type: "room", id: "room-1"},
			direction: "e",
		});

		const secondConnection = connection({
			id: toID("connection", "connection-2"),
			fromRoomId: {type: "room", id: "room-1"},
			direction: "e",
			toRoomId: {type: "room", id: "room-3"},
		});

		const nonMatchingConnection = connection({
			id: toID("connection", "connection-3"),
			fromRoomId: {type: "room", id: "room-1"},
			direction: "n",
		});

		expect(
			getConnectionsOnNode([firstConnection, secondConnection, nonMatchingConnection], "room-1", "e"),
		).toEqual([firstConnection, secondConnection]);
	});

	it("excludes the ignored connection", () => {
		const ignoredConnection = connection({
			id: toID("connection", "connection-1"),
			fromRoomId: {type: "room", id: "room-1"},
			direction: "e",
		});

		const matchingConnection = connection({
			id: toID("connection", "connection-2"),
			fromRoomId: {type: "room", id: "room-1"},
			direction: "e",
		});

		expect(
			getConnectionsOnNode([ignoredConnection, matchingConnection], "room-1", "e", "connection-1"),
		).toEqual([matchingConnection]);
	});
});

describe("getConnectionSide", () => {
	it("returns from when the given node is the connection's from side", () => {
		const existingConnection = connection({
			fromRoomId: {type: "room", id: "room-1"},
			direction: "e",
		});

		expect(getConnectionSide(existingConnection, "room-1", "e")).toBe("from");
	});

	it("returns to when the given node is the connection's to side", () => {
		const existingConnection = connection({
			toRoomId: {type: "room", id: "room-2"},
			returnDirection: "w",
		});

		expect(getConnectionSide(existingConnection, "room-2", "w")).toBe("to");
	});

	it("returns null when the connection does not use the given node", () => {
		const existingConnection = connection({
			fromRoomId: {type: "room", id: "room-1"},
			direction: "e",
		});

		expect(getConnectionSide(existingConnection, "room-1", "n")).toBeNull();
	});
});

describe("isSameConnectionShape", () => {
	it("returns true when room ids and directions match", () => {
		const firstConnection = connection({
			id: toID("connection", "connection-1"),
			pathway: "two-way",
		});

		const secondConnection = connection({
			id: toID("connection", "connection-2"),
			pathway: "forwards",
		});

		expect(isSameConnectionShape(firstConnection, secondConnection)).toBe(true);
	});

	it("returns false when one of the shape fields differs", () => {
		const firstConnection = connection({
			fromRoomId: {type: "room", id: "room-1"},
			toRoomId: {type: "room", id: "room-2"},
			direction: "e",
			returnDirection: "w",
		});

		const secondConnection = connection({
			fromRoomId: {type: "room", id: "room-1"},
			toRoomId: {type: "room", id: "room-3"},
			direction: "e",
			returnDirection: "w",
		});

		expect(isSameConnectionShape(firstConnection, secondConnection)).toBe(false);
	});
});

describe("getDuplicateConnectionByShape", () => {
	it("returns a connection with the same shape", () => {
		const duplicateConnection = connection({
			id: toID("connection", "connection-1"),
			pathway: "two-way",
		});

		const candidate = connection({
			id: toID("connection", "connection-2"),
			pathway: "forwards",
		});

		expect(getDuplicateConnectionByShape([duplicateConnection], candidate)).toBe(duplicateConnection);
	});

	it("ignores the connection with the ignored id", () => {
		const ignoredConnection = connection({
			id: toID("connection", "connection-1"),
		});

		const candidate = connection({
			id: toID("connection", "connection-2"),
		});

		expect(
			getDuplicateConnectionByShape([ignoredConnection], candidate, "connection-1"),
		).toBeUndefined();
	});

	it("returns undefined when no connection has the same shape", () => {
		const existingConnection = connection({
			fromRoomId: {type: "room", id: "room-1"},
			toRoomId: {type: "room", id: "room-2"},
			direction: "e",
			returnDirection: "w",
		});

		const candidate = connection({
			fromRoomId: {type: "room", id: "room-1"},
			toRoomId: {type: "room", id: "room-3"},
			direction: "e",
			returnDirection: "w",
		});

		expect(getDuplicateConnectionByShape([existingConnection], candidate)).toBeUndefined();
	});
});

describe("getNodeSelectionKey", () => {
	it("combines the room id and direction into a stable key", () => {
		expect(getNodeSelectionKey("room-1", "ne")).toBe("room-1:ne");
	});
});

describe("getNearestNodeInRadius", () => {
	it("returns the nearest node within the snap distance", () => {
		const firstRoom = room("room-1", 100, 100);
		const secondRoom = room("room-2", 200, 100);

		const result = getNearestNodeInRadius({
			pointer: {x: 210, y: 100},
			rooms: [firstRoom, secondRoom],
			getRoomConnectionPoint,
			snapDistance: 24,
		});

		expect(result).toMatchObject({
			room: secondRoom,
			direction: "e",
			point: {
				x: 210,
				y: 100,
			},
			distance: 0,
		});
	});

	it("returns null when no node is within the snap distance", () => {
		const firstRoom = room("room-1", 100, 100);

		const result = getNearestNodeInRadius({
			pointer: {x: 300, y: 300},
			rooms: [firstRoom],
			getRoomConnectionPoint,
			snapDistance: 24,
		});

		expect(result).toBeNull();
	});

	it("ignores the ignored room", () => {
		const ignoredRoom = room("room-1", 100, 100);
		const allowedRoom = room("room-2", 200, 100);

		const result = getNearestNodeInRadius({
			pointer: {x: 110, y: 100},
			rooms: [ignoredRoom, allowedRoom],
			getRoomConnectionPoint,
			snapDistance: 24,
			ignoredRoomId: "room-1",
		});

		expect(result).toBeNull();
	});

	it("ignores the locked room", () => {
		const lockedRoom = room("room-1", 100, 100);

		const result = getNearestNodeInRadius({
			pointer: {x: 110, y: 100},
			rooms: [lockedRoom],
			getRoomConnectionPoint,
			snapDistance: 24,
			lockedRoomId: "room-1",
		});

		expect(result).toBeNull();
	});
});

describe("getPathwayForNewDrop", () => {
	it("returns two-way when neither the source nor target node is occupied", () => {
		expect(getPathwayForNewDrop("room-1", "e", "room-2", "w", [])).toBe("two-way");
	});

	it("returns backwards when the source node is occupied", () => {
		const connections = [
			connection({
				fromRoomId: {type: "room", id: "room-1"},
				toRoomId: {type: "room", id: "room-3"},
				direction: "e",
				returnDirection: "w",
			}),
		];

		expect(getPathwayForNewDrop("room-1", "e", "room-2", "w", connections)).toBe("backwards");
	});

	it("returns forwards when the target node is occupied", () => {
		const connections = [
			connection({
				fromRoomId: {type: "room", id: "room-3"},
				toRoomId: {type: "room", id: "room-2"},
				direction: "e",
				returnDirection: "w",
			}),
		];

		expect(getPathwayForNewDrop("room-1", "e", "room-2", "w", connections)).toBe("forwards");
	});

	it("returns no-way when both the source and target nodes are occupied", () => {
		const connections = [
			connection({
				id: toID("connection", "connection-1"),
				fromRoomId: {type: "room", id: "room-1"},
				toRoomId: {type: "room", id: "room-3"},
				direction: "e",
				returnDirection: "w",
			}),
			connection({
				id: toID("connection", "connection-2"),
				fromRoomId: {type: "room", id: "room-4"},
				toRoomId: {type: "room", id: "room-2"},
				direction: "e",
				returnDirection: "w",
			}),
		];

		expect(getPathwayForNewDrop("room-1", "e", "room-2", "w", connections)).toBe("no-way");
	});
});

describe("getPathwayForEditedDrop", () => {
	it("returns two-way when the target node is not occupied by another connection", () => {
		const connections = [
			connection({
				id: toID("connection", "connection-1"),
				toRoomId: {type: "room", id: "room-2"},
				returnDirection: "w",
			}),
		];

		expect(getPathwayForEditedDrop("room-2", "w", connections, "connection-1")).toBe("two-way");
	});

	it("returns forwards when the target node is occupied by another connection", () => {
		const connections = [
			connection({
				id: toID("connection", "connection-1"),
				toRoomId: {type: "room", id: "room-2"},
				returnDirection: "w",
			}),
			connection({
				id: toID("connection", "connection-2"),
				fromRoomId: {type: "room", id: "room-2"},
				toRoomId: {type: "room", id: "room-3"},
				direction: "w",
				returnDirection: "e",
			}),
		];

		expect(getPathwayForEditedDrop("room-2", "w", connections, "connection-1")).toBe("forwards");
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
						fromRoomId: {type: "room", id: "room-1"},
						toRoomId: {type: "room", id: "room-2"},
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

		expect(result?.roomToAdd).toEqual(
			generatedRoom("room-2", "Room 2", {
				x: 100 + ROOM_WIDTH + CONNECTOR_LENGTH,
				y: 100,
			}),
		);

		expect(result?.connection).toEqual(
			createDefaultConnection({
				id: toID("connection", "connection-1"),
				fromRoomId: {type: "room", id: "room-1"},
				toRoomId: {type: "room", id: "room-2"},
				direction: "e",
				returnDirection: "w",
				pathway: "two-way",
			}),
		);
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

		expect(result?.connection).toEqual(
			createDefaultConnection({
				id: toID("connection", "connection-1"),
				fromRoomId: {type: "room", id: "room-1"},
				toRoomId: {type: "room", id: "room-2"},
				direction: "e",
				returnDirection: "w",
				pathway: "two-way",
			}),
		);
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
						id: toID("connection", "connection-1"),
						fromRoomId: {type: "room", id: "room-2"},
						toRoomId: {type: "room", id: "room-3"},
						direction: "w",
						returnDirection: "e",
						pathway: "forwards",
					}),
				],
			}),
		);

		expect(result).not.toBeNull();
		expect(result?.roomToAdd).toBeUndefined();

		expect(result?.connection).toEqual(
			createDefaultConnection({
				id: toID("connection", "connection-2"),
				fromRoomId: {type: "room", id: "room-1"},
				toRoomId: {type: "room", id: "room-2"},
				direction: "e",
				returnDirection: "w",
				pathway: "forwards",
			}),
		);
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
		expect(result?.connection.toRoomId).toEqual({type: "room", id: "room-3"});
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

		expect(result?.connection.toRoomId).toEqual({type: "room", id: "room-2"});

		expect(result?.roomToAdd).toEqual(
			generatedRoom("room-2", "Room 3", {
				x: 100 + ROOM_WIDTH + CONNECTOR_LENGTH,
				y: 100,
			}),
		);
	});

	it("uses the next connection id based on the existing connection count", () => {
		const fromRoom = room("room-1", 100, 100);

		const result = buildAddConnectionResult(
			buildOptions({
				fromRoom,
				direction: "s",
				rooms: [fromRoom],
				connections: [
					connection({id: toID("connection", "connection-1")}),
					connection({
						id: toID("connection", "connection-2"),
						fromRoomId: {type: "room", id: "room-3"},
						toRoomId: {type: "room", id: "room-4"},
					}),
				],
			}),
		);

		expect(result).not.toBeNull();
		expect(idValue(result?.connection.id)).toBe("connection-3");
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
			fromRoomId: {type: "room", id: "room-1"},
			toRoomId: {type: "room", id: "room-2"},
			direction: "ne",
			returnDirection: "sw",
			pathway: "two-way",
		});

		expect(result?.roomToAdd?.metadata.position).toEqual({
			x: 100 + ROOM_WIDTH + CONNECTOR_LENGTH,
			y: 100 - (ROOM_HEIGHT + CONNECTOR_LENGTH),
		});
	});

	it("connects to the overlapping room when the target position is occupied", () => {
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
		expect(result?.connection.toRoomId).toEqual({type: "room", id: "blocking-room"});
	});

	it("creates a new room at the default target position when no nearby room blocks that direction", () => {
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

		expect(result?.roomToAdd).toEqual(
			generatedRoom("room-2", "Room 3", {
				x: 100,
				y: 100 + ROOM_HEIGHT + CONNECTOR_LENGTH,
			}),
		);

		expect(result?.connection).toMatchObject({
			fromRoomId: {type: "room", id: "room-1"},
			toRoomId: {type: "room", id: "room-2"},
			direction: "s",
			returnDirection: "n",
			pathway: "two-way",
		});
	});
});
