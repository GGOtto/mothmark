import type React from "react";
import type {Connection as ConnectionType, Direction, Point, Room} from "../../schemas/worldSchema";
import {DIRECTION_VECTORS, REVERSE_DIRECTION} from "../../types/mapTypes";
import {
	addPoints,
	subtractPoints,
	getMidpoint,
	scalePoint,
	getDistance,
} from "../../utils/pointUtils";
import "./Connection.scss";

type ConnectionProps = {
	connection: ConnectionType;
	fromRoom: Room;
	toRoom: Room;
	selectConnection: (connection?: ConnectionType) => void;
	isEditing?: boolean;
	isSelected?: boolean;
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

export function Connection({
	connection,
	fromRoom,
	toRoom,
	selectConnection,
	isEditing = false,
	isSelected = false,
}: ConnectionProps) {
	const curvePoints = getControlPoints(
		fromRoom.position,
		toRoom.position,
		connection.direction,
		connection.returnDirection,
	);

	const pathPoints = [fromRoom.position, ...curvePoints, toRoom.position];
	const path = getPath(pathPoints);

	const connectionClassNames = [
		"connection",
		isEditing ? "connectionEditing" : "",
		isSelected ? "connectionSelected" : "",
	]
		.filter(Boolean)
		.join(" ");

	function handleSelect(event: React.MouseEvent<SVGPathElement>) {
		event.stopPropagation();
		selectConnection(connection);
	}

	const clickTarget = (
		<path
			d={path}
			fill="none"
			stroke="transparent"
			strokeWidth={18}
			strokeLinecap="round"
			pointerEvents="stroke"
			className="connectionClickTarget"
			onClick={handleSelect}
		/>
	);

	if (connection.pathway === "two-way") {
		return (
			<g className={connectionClassNames}>
				{clickTarget}

				<path
					className="connectionPath"
					d={path}
					fill="none"
					strokeLinecap="round"
					pointerEvents="none"
				/>
			</g>
		);
	}

	if (connection.pathway === "no-way") {
		return (
			<g className={connectionClassNames}>
				{clickTarget}

				<path
					className="connectionPath connectionPathDashed"
					d={path}
					fill="none"
					strokeLinecap="round"
					pointerEvents="none"
				/>
			</g>
		);
	}

	return (
		<g className={connectionClassNames}>
			{clickTarget}

			<path
				className="connectionPath connectionPathDashed"
				d={path}
				fill="none"
				strokeLinecap="round"
				pointerEvents="none"
			/>

			<path
				className="connectionPath connectionPathDirectional"
				d={path}
				pathLength={100}
				fill="none"
				strokeLinecap="round"
				strokeDashoffset={connection.pathway === "backwards" ? -50 : 0}
				pointerEvents="none"
			/>
		</g>
	);
}
