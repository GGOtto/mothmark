import type {Connection, Direction, Point, Room} from "../schemas/worldSchema";
import {DIRECTION_VECTORS, REVERSE_DIRECTION} from "../types/mapTypes";
import {subtractPoints} from "./pointUtils";

type BuildAddConnectionResultOptions = {
	fromRoom: Room;
	direction: Direction;
	rooms: Room[];
	connections: Connection[];
	roomWidth: number;
	roomHeight: number;
	connectorLength: number;
	minConnectorLength: number;
	connectorStep: number;
};

type BuildAddConnectionResult = {
	connection: Connection;
	roomToAdd?: Room;
};

export type SnapTarget = {
	room: Room;
	direction: Direction;
	point: Point;
	distance: number;
};

export type MovingConnectionSide = "from" | "to";

const DIRECTIONS: Direction[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];

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

export function connectionUsesNode(connection: Connection, roomId: string, direction: Direction) {
	return (
		(connection.fromRoomId === roomId && connection.direction === direction) ||
		(connection.toRoomId === roomId && connection.returnDirection === direction)
	);
}

export function getConnectionOnNode(
	connections: Connection[],
	roomId: string,
	direction: Direction,
	ignoredConnectionId?: string,
) {
	return connections.find((connection) => {
		if (connection.id === ignoredConnectionId) return false;

		return connectionUsesNode(connection, roomId, direction);
	});
}

export function getConnectionsOnNode(
	connections: Connection[],
	roomId: string,
	direction: Direction,
	ignoredConnectionId?: string,
) {
	return connections.filter((connection) => {
		if (connection.id === ignoredConnectionId) return false;

		return connectionUsesNode(connection, roomId, direction);
	});
}

export function getConnectionSide(
	connection: Connection,
	roomId: string,
	direction: Direction,
): MovingConnectionSide | null {
	if (connection.fromRoomId === roomId && connection.direction === direction) {
		return "from";
	}

	if (connection.toRoomId === roomId && connection.returnDirection === direction) {
		return "to";
	}

	return null;
}

export function isSameConnectionShape(connection: Connection, candidate: Connection) {
	return (
		connection.fromRoomId === candidate.fromRoomId &&
		connection.toRoomId === candidate.toRoomId &&
		connection.direction === candidate.direction &&
		connection.returnDirection === candidate.returnDirection
	);
}

export function getDuplicateConnectionByShape(
	connections: Connection[],
	candidate: Connection,
	ignoredConnectionId?: string,
) {
	return connections.find((connection) => {
		if (connection.id === ignoredConnectionId) return false;

		return isSameConnectionShape(connection, candidate);
	});
}

export function getNodeSelectionKey(roomId: string, direction: Direction) {
	return `${roomId}:${direction}`;
}

export function getNearestNodeInRadius({
	pointer,
	rooms,
	getRoomConnectionPoint,
	snapDistance,
	ignoredRoomId,
	lockedRoomId,
}: {
	pointer: Point;
	rooms: Room[];
	getRoomConnectionPoint: (room: Room, direction: Direction) => Point;
	snapDistance: number;
	ignoredRoomId?: string;
	lockedRoomId?: string;
}): SnapTarget | null {
	let nearestTarget: SnapTarget | null = null;

	for (const room of rooms) {
		if (room.id === ignoredRoomId) continue;
		if (room.id === lockedRoomId) continue;

		for (const direction of DIRECTIONS) {
			const point = getRoomConnectionPoint(room, direction);
			const distance = Math.hypot(pointer.x - point.x, pointer.y - point.y);

			if (distance > snapDistance) continue;

			if (!nearestTarget || distance < nearestTarget.distance) {
				nearestTarget = {
					room,
					direction,
					point,
					distance,
				};
			}
		}
	}

	return nearestTarget;
}

export function getPathwayForNewDrop(
	sourceRoomId: string,
	sourceDirection: Direction,
	targetRoomId: string,
	targetDirection: Direction,
	currentConnections: Connection[],
): Connection["pathway"] {
	const sourceConnection = getConnectionOnNode(currentConnections, sourceRoomId, sourceDirection);

	const targetConnection = getConnectionOnNode(currentConnections, targetRoomId, targetDirection);

	if (sourceConnection && targetConnection) {
		return "no-way";
	}

	if (sourceConnection || targetConnection) {
		return "forwards";
	}

	return "two-way";
}

export function getPathwayForEditedDrop(
	targetRoomId: string,
	targetDirection: Direction,
	currentConnections: Connection[],
	ignoredConnectionId: string,
): Connection["pathway"] {
	const targetConnection = getConnectionOnNode(
		currentConnections,
		targetRoomId,
		targetDirection,
		ignoredConnectionId,
	);

	return targetConnection ? "forwards" : "two-way";
}

function getTargetPosition(
	sourceRoom: Room,
	direction: Direction,
	length: number,
	roomWidth: number,
	roomHeight: number,
): Point {
	const vector = DIRECTION_VECTORS[direction];

	return {
		x: sourceRoom.position.x + vector.x * (length + roomWidth),
		y: sourceRoom.position.y + vector.y * (length + roomHeight),
	};
}

function getDirectionAlignmentScore(sourceRoom: Room, direction: Direction, room: Room) {
	const vector = DIRECTION_VECTORS[direction];
	const roomOffset = subtractPoints(room.position, sourceRoom.position);

	const vectorLength = Math.hypot(vector.x, vector.y);
	const unitDirection = {
		x: vector.x / vectorLength,
		y: vector.y / vectorLength,
	};

	const forwardDistance = roomOffset.x * unitDirection.x + roomOffset.y * unitDirection.y;

	if (forwardDistance <= 0) {
		return Number.POSITIVE_INFINITY;
	}

	const perpendicularDistance = Math.abs(
		roomOffset.x * unitDirection.y - roomOffset.y * unitDirection.x,
	);

	return perpendicularDistance;
}

function getBestOverlappingRoom({
	position,
	sourceRoom,
	direction,
	rooms,
	roomWidth,
	roomHeight,
	minConnectorLength,
}: {
	position: Point;
	sourceRoom: Room;
	direction: Direction;
	rooms: Room[];
	roomWidth: number;
	roomHeight: number;
	minConnectorLength: number;
}) {
	const candidates = rooms
		.filter((room) => room.id !== sourceRoom.id)
		.map((room) => {
			const dx = Math.abs(room.position.x - position.x);
			const dy = Math.abs(room.position.y - position.y);

			const overlapsTargetArea =
				dx < roomWidth + minConnectorLength && dy < roomHeight + minConnectorLength;

			if (!overlapsTargetArea) return null;

			const distanceFromTarget = Math.hypot(
				room.position.x - position.x,
				room.position.y - position.y,
			);
			const directionAlignment = getDirectionAlignmentScore(sourceRoom, direction, room);

			if (!Number.isFinite(directionAlignment)) return null;

			return {
				room,
				score: directionAlignment * 2 + distanceFromTarget,
			};
		})
		.filter((candidate): candidate is {room: Room; score: number} => candidate !== null)
		.sort((a, b) => a.score - b.score);

	return candidates[0]?.room;
}

function findTargetRoomOrPosition({
	fromRoom,
	direction,
	rooms,
	roomWidth,
	roomHeight,
	connectorLength,
	minConnectorLength,
	connectorStep,
}: Pick<
	BuildAddConnectionResultOptions,
	| "fromRoom"
	| "direction"
	| "rooms"
	| "roomWidth"
	| "roomHeight"
	| "connectorLength"
	| "minConnectorLength"
	| "connectorStep"
>) {
	let targetPosition = getTargetPosition(
		fromRoom,
		direction,
		connectorLength,
		roomWidth,
		roomHeight,
	);
	let overlappingRoom: Room | undefined = getBestOverlappingRoom({
		position: targetPosition,
		sourceRoom: fromRoom,
		direction,
		rooms,
		roomWidth,
		roomHeight,
		minConnectorLength,
	});

	for (let length = connectorLength; length >= minConnectorLength; length -= connectorStep) {
		const position = getTargetPosition(fromRoom, direction, length, roomWidth, roomHeight);

		const overlap = getBestOverlappingRoom({
			position,
			sourceRoom: fromRoom,
			direction,
			rooms,
			roomWidth,
			roomHeight,
			minConnectorLength,
		});

		if (!overlap) {
			targetPosition = position;
			overlappingRoom = undefined;
			break;
		}

		targetPosition = position;
		overlappingRoom = overlap;
	}

	return {
		targetPosition,
		overlappingRoom,
	};
}

function connectionAlreadyExists(connectionToAdd: Connection, connections: Connection[]) {
	return connections.some((connection) => {
		return (
			connection.fromRoomId === connectionToAdd.fromRoomId &&
			connection.toRoomId === connectionToAdd.toRoomId &&
			connection.direction === connectionToAdd.direction
		);
	});
}

export function buildAddConnectionResult({
	fromRoom,
	direction,
	rooms,
	connections,
	roomWidth,
	roomHeight,
	connectorLength,
	minConnectorLength,
	connectorStep,
}: BuildAddConnectionResultOptions): BuildAddConnectionResult | null {
	if (isConnectionFromRoom(fromRoom.id, direction, connections)) {
		return null;
	}

	const {targetPosition, overlappingRoom} = findTargetRoomOrPosition({
		fromRoom,
		direction,
		rooms,
		roomWidth,
		roomHeight,
		connectorLength,
		minConnectorLength,
		connectorStep,
	});

	const roomToAdd =
		overlappingRoom === undefined
			? ({
					id: `room-${rooms.length + 1}`,
					name: `Room ${rooms.length + 1}`,
					position: targetPosition,
				} satisfies Room)
			: undefined;
	const toRoom = overlappingRoom ?? roomToAdd;

	if (!toRoom) {
		return null;
	}

	const targetReturnDirection = REVERSE_DIRECTION[direction];
	const targetCanReturn =
		!overlappingRoom || !isConnectionFromRoom(overlappingRoom.id, targetReturnDirection, connections);

	const connection = {
		id: `connection-${connections.length + 1}`,
		fromRoomId: fromRoom.id,
		toRoomId: toRoom.id,
		direction,
		returnDirection: targetReturnDirection,
		pathway: targetCanReturn ? "two-way" : "forwards",
	} satisfies Connection;

	if (connectionAlreadyExists(connection, connections)) {
		return null;
	}

	return {
		connection,
		roomToAdd,
	};
}
