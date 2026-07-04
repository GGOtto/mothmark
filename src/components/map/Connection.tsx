import type {Connection as ConnectionType, Direction, Point, Room} from "../../schemas/worldSchema";
import {DIRECTION_VECTORS, REVERSE_DIRECTION} from "../../types/mapTypes";
import {
	addPoints,
	subtractPoints,
	getMidpoint,
	scalePoint,
	getDistance,
} from "../../utils/pointUtils";

type ConnectionProps = {
	connection: ConnectionType;
	fromRoom: Room;
	toRoom: Room;
	isEditing?: boolean;
};

function getPath(points: Point[]) {
	if (points.length < 2) return "";

	let path = `M ${points[0].x} ${points[0].y}`;

	for (let i = 0; i < points.length - 1; i++) {
		const p0 = points[i - 1] ?? points[i];
		const p1 = points[i];
		const p2 = points[i + 1];
		const p3 = points[i + 2] ?? p2;

		const segmentLength = getDistance(p1, p2);

		const tension = 1 / 6;
		const maxControlLength = Math.min(segmentLength * 0.45, 40);

		const incoming = subtractPoints(p2, p0);
		const outgoing = subtractPoints(p3, p1);

		const incomingLength = Math.hypot(incoming.x, incoming.y) || 1;
		const outgoingLength = Math.hypot(outgoing.x, outgoing.y) || 1;

		const control1Length = Math.min(incomingLength * tension, maxControlLength);
		const control2Length = Math.min(outgoingLength * tension, maxControlLength);

		const control1 = addPoints(p1, scalePoint(incoming, control1Length / incomingLength));
		const control2 = subtractPoints(p2, scalePoint(outgoing, control2Length / outgoingLength));

		path += ` C ${control1.x} ${control1.y} ${control2.x} ${control2.y} ${p2.x} ${p2.y}`;
	}

	return path;
}

function getControlPoints(
	startPoint: Point,
	endPoint: Point,
	startDirection: Direction,
	endDirection: Direction,
): Point[] {
	const startDirectionVector = DIRECTION_VECTORS[startDirection];
	const endDirectionVector = DIRECTION_VECTORS[REVERSE_DIRECTION[endDirection]];
	const handleLength = 15;

	const startHandle: Point = scalePoint(startDirectionVector, handleLength);
	const endHandle: Point = scalePoint(endDirectionVector, -handleLength);

	return [
		addPoints(startPoint, startHandle),
		addPoints(getMidpoint(startPoint, endPoint), addPoints(startHandle, endHandle)),
		addPoints(endPoint, endHandle),
	];
}

export function Connection({connection, fromRoom, toRoom, isEditing = false}: ConnectionProps) {
	const curvePoints = getControlPoints(
		fromRoom.position,
		toRoom.position,
		connection.direction,
		connection.returnDirection,
	);

	const pathPoints = [fromRoom.position, ...curvePoints, toRoom.position];

	const path = getPath(pathPoints);

	const stroke = isEditing ? "#8f8a80" : "#2f2920";
	const strokeWidth = isEditing ? 3 : 2;

	if (connection.pathway === "two-way") {
		return (
			<path d={path} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
		);
	}

	if (connection.pathway === "no-way") {
		return (
			<path
				d={path}
				fill="none"
				stroke={stroke}
				strokeWidth={strokeWidth}
				strokeLinecap="round"
				strokeDasharray="4 5"
			/>
		);
	}

	return (
		<>
			<path
				d={path}
				fill="none"
				stroke={stroke}
				strokeWidth={strokeWidth}
				strokeLinecap="round"
				strokeDasharray="4 5"
			/>

			<path
				d={path}
				pathLength={100}
				fill="none"
				stroke={stroke}
				strokeWidth={strokeWidth}
				strokeLinecap="round"
				strokeDasharray="50 50"
				strokeDashoffset={connection.pathway === "backwards" ? -50 : 0}
			/>
		</>
	);
}
