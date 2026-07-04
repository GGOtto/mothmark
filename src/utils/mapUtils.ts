import type {Connection, Point} from "../schemas/worldSchema";

export function canTravelForward(connection: Connection) {
	return Boolean(connection.direction);
}

export function canTravelBackward(connection: Connection) {
	return Boolean(connection.returnDirection);
}

export function isTwoWay(connection: Connection) {
	return canTravelForward(connection) && canTravelBackward(connection);
}

export function isOneWay(connection: Connection) {
	return canTravelForward(connection) !== canTravelBackward(connection);
}

export function isSpecialOnly(connection: Connection) {
	return !canTravelForward(connection) && !canTravelBackward(connection);
}

export function addPoints(p1: Point, p2: Point): Point {
	return {
		x: p1.x + p2.x,
		y: p1.y + p2.y,
	};
}

export function subtractPoints(p1: Point, p2: Point): Point {
	return {
		x: p1.x - p2.x,
		y: p1.y - p2.y,
	};
}

export function scalePoint(p1: Point, scale: number): Point {
	return {
		x: p1.x * scale,
		y: p1.y * scale,
	};
}

export function multiplyPoints(p1: Point, p2: Point): Point {
	return {
		x: p1.x * p2.x,
		y: p1.y * p2.y,
	};
}

export function getMidpoint(p1: Point, p2: Point): Point {
	return scalePoint(addPoints(p1, p2), 0.5);
}

export function getDistance(a: Point, b: Point) {
	return Math.hypot(b.x - a.x, b.y - a.y);
}

export function isConnectionFromRoom(roomId: string, connections: Connection[]) {
	return connections.some((connection) => {
		return (
			(connection.fromRoomId === roomId &&
				(connection.pathway === "forwards" || connection.pathway === "two-way")) ||
			(connection.toRoomId === roomId &&
				(connection.pathway === "backwards" || connection.pathway === "two-way"))
		);
	});
}
