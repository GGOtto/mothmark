import {ArrowLeftRight, ArrowRight, X} from "lucide-react";
import type React from "react";
import type {Connection as ConnectionType, Direction, Point, Room} from "../../schemas/roomSchema";
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
	changePathway: (connection: ConnectionType) => void;
	isEditing?: boolean;
	isSelected?: boolean;
};

type CubicBezierSegment = {
	start: Point;
	control1: Point;
	control2: Point;
	end: Point;
};

type ConnectionPathPlacement = {
	point: Point;
	angle: number;
};

function getCubicBezierPoint(
	start: Point,
	control1: Point,
	control2: Point,
	end: Point,
	t: number,
): Point {
	const oneMinusT = 1 - t;

	const a = oneMinusT ** 3;
	const b = 3 * oneMinusT ** 2 * t;
	const c = 3 * oneMinusT * t ** 2;
	const d = t ** 3;

	return {
		x: a * start.x + b * control1.x + c * control2.x + d * end.x,
		y: a * start.y + b * control1.y + c * control2.y + d * end.y,
	};
}

function getCubicBezierLength(segment: CubicBezierSegment, samples = 24) {
	let length = 0;
	let previousPoint = segment.start;

	for (let i = 1; i <= samples; i++) {
		const t = i / samples;
		const point = getCubicBezierPoint(
			segment.start,
			segment.control1,
			segment.control2,
			segment.end,
			t,
		);

		length += getDistance(previousPoint, point);
		previousPoint = point;
	}

	return length;
}

function getConnectionPathSegments(points: Point[]): CubicBezierSegment[] {
	if (points.length < 2) return [];

	const segments: CubicBezierSegment[] = [];

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

		segments.push({start: p1, control1, control2, end: p2});
	}

	return segments;
}

function getPointOnCubicBezierAtDistance(
	segment: CubicBezierSegment,
	targetDistance: number,
	samples = 48,
): Point {
	let walkedDistance = 0;
	let previousPoint = segment.start;

	for (let i = 1; i <= samples; i++) {
		const t = i / samples;
		const point = getCubicBezierPoint(
			segment.start,
			segment.control1,
			segment.control2,
			segment.end,
			t,
		);

		const stepDistance = getDistance(previousPoint, point);

		if (walkedDistance + stepDistance >= targetDistance) {
			const remainingDistance = targetDistance - walkedDistance;
			const ratio = stepDistance === 0 ? 0 : remainingDistance / stepDistance;

			return {
				x: previousPoint.x + (point.x - previousPoint.x) * ratio,
				y: previousPoint.y + (point.y - previousPoint.y) * ratio,
			};
		}

		walkedDistance += stepDistance;
		previousPoint = point;
	}

	return segment.end;
}

function getPointOnConnectionPathAtDistance(
	segments: CubicBezierSegment[],
	segmentLengths: number[],
	targetDistance: number,
): Point {
	if (segments.length === 0) return {x: 0, y: 0};

	const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0);
	const clampedDistance = Math.max(0, Math.min(targetDistance, totalLength));
	let walkedDistance = 0;

	for (let i = 0; i < segments.length; i++) {
		const segmentLength = segmentLengths[i];

		if (walkedDistance + segmentLength >= clampedDistance) {
			return getPointOnCubicBezierAtDistance(segments[i], clampedDistance - walkedDistance);
		}

		walkedDistance += segmentLength;
	}

	return segments[segments.length - 1].end;
}

function getConnectionPathMidpointPlacement(pathPoints: Point[]): ConnectionPathPlacement {
	const segments = getConnectionPathSegments(pathPoints);

	if (segments.length === 0) return {point: pathPoints[0] ?? {x: 0, y: 0}, angle: 0};

	const segmentLengths = segments.map((segment) => getCubicBezierLength(segment));
	const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0);
	const midpointDistance = totalLength / 2;
	const tangentSampleDistance = Math.min(8, totalLength / 2);
	const point = getPointOnConnectionPathAtDistance(segments, segmentLengths, midpointDistance);
	const beforePoint = getPointOnConnectionPathAtDistance(
		segments,
		segmentLengths,
		midpointDistance - tangentSampleDistance,
	);
	const afterPoint = getPointOnConnectionPathAtDistance(
		segments,
		segmentLengths,
		midpointDistance + tangentSampleDistance,
	);

	return {
		point,
		angle: Math.atan2(afterPoint.y - beforePoint.y, afterPoint.x - beforePoint.x) * (180 / Math.PI),
	};
}

function getPath(points: Point[]) {
	if (points.length < 2) return "";

	const segments = getConnectionPathSegments(points);
	if (segments.length === 0) return "";

	let path = `M ${points[0].x} ${points[0].y}`;

	for (const segment of segments) {
		path += ` C ${segment.control1.x} ${segment.control1.y} ${segment.control2.x} ${segment.control2.y} ${segment.end.x} ${segment.end.y}`;
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
	const handleLength = Math.min(15, getDistance(startPoint, endPoint) * (15 / 80));
	const startHandle = scalePoint(startDirectionVector, handleLength);
	const endHandle = scalePoint(endDirectionVector, -handleLength);

	return [
		addPoints(startPoint, startHandle),
		addPoints(getMidpoint(startPoint, endPoint), addPoints(startHandle, endHandle)),
		addPoints(endPoint, endHandle),
	];
}

function getMidpointGlyphRotation(pathway: ConnectionType["pathway"], angle: number) {
	if (pathway === "backwards") {
		return angle + 180;
	}

	return angle;
}

function getMidpointGlyphIcon(pathway: ConnectionType["pathway"]) {
	const iconProps = {
		className: "connectionMidpointGlyphIcon",
		x: -4.75,
		y: -4.75,
		width: 9.5,
		height: 9.5,
		strokeWidth: 3,
	};

	if (pathway === "two-way") {
		return <ArrowLeftRight {...iconProps} />;
	}

	if (pathway === "no-way") {
		return <X {...iconProps} />;
	}

	return <ArrowRight {...iconProps} />;
}

export function Connection({
	connection,
	fromRoom,
	toRoom,
	selectConnection,
	changePathway,
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
	const midpointPlacement = getConnectionPathMidpointPlacement(pathPoints);
	const midpointIcon = getMidpointGlyphIcon(connection.pathway);
	const midpointGlyphRotation = getMidpointGlyphRotation(
		connection.pathway,
		midpointPlacement.angle,
	);

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

	function cyclePathway() {
		changePathway(connection);
	}

	function handleGlyphClick(event: React.MouseEvent<SVGGElement>) {
		event.stopPropagation();
		cyclePathway();
	}

	function handleGlyphKeyDown(event: React.KeyboardEvent<SVGGElement>) {
		if (event.key !== "Enter" && event.key !== " ") return;

		event.preventDefault();
		event.stopPropagation();
		cyclePathway();
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

	const selectedPathUnderlay = isSelected ? (
		<>
			<path
				className={`connectionPathUnderlay ${connection.pathway === "two-way" ? "" : "connectionPathDashed"}`}
				d={path}
				fill="none"
				strokeLinecap="round"
				pointerEvents="none"
			/>
			{connection.pathway === "forwards" || connection.pathway === "backwards" ? (
				<path
					className="connectionPathUnderlay connectionPathDirectional"
					d={path}
					pathLength={100}
					fill="none"
					strokeLinecap="round"
					strokeDashoffset={connection.pathway === "backwards" ? -50 : 0}
					pointerEvents="none"
				/>
			) : null}
		</>
	) : null;

	const glyphOutlineRadius = isSelected ? 9.75 : 7.5;
	const glyphBodyRadius = isSelected ? 8.5 : 6.25;
	const glyphFaceRadius = 6.25;

	const midpointGlyphTransform = `translate(${midpointPlacement.point.x} ${midpointPlacement.point.y}) rotate(${midpointGlyphRotation})`;

	const midpointGlyphBase = (
		<g
			className="connectionMidpointGlyph connectionMidpointGlyphBase"
			transform={midpointGlyphTransform}
			pointerEvents="none"
		>
			<g className="connectionMidpointGlyphInner">
				<circle className="connectionMidpointGlyphOutline" cx={0} cy={0} r={glyphOutlineRadius} />
				<circle className="connectionMidpointGlyphBody" cx={0} cy={0} r={glyphBodyRadius} />
			</g>
		</g>
	);

	const midpointGlyphFace = (
		<g
			className="connectionMidpointGlyph connectionMidpointGlyphFaceLayer"
			transform={midpointGlyphTransform}
			pointerEvents="none"
		>
			<g className="connectionMidpointGlyphInner">
				<circle className="connectionMidpointGlyphFace" cx={0} cy={0} r={glyphFaceRadius} />

				{midpointIcon}
			</g>
		</g>
	);

	const midpointGlyphControl = (
		<g
			className="connectionMidpointGlyphControl"
			transform={`translate(${midpointPlacement.point.x} ${midpointPlacement.point.y})`}
			role="button"
			tabIndex={0}
			aria-label={`Change pathway from ${connection.pathway}`}
			onClick={handleGlyphClick}
			onKeyDown={handleGlyphKeyDown}
		>
			<circle cx={0} cy={0} r={12} />
		</g>
	);

	if (connection.pathway === "two-way") {
		return (
			<g className={connectionClassNames}>
				{clickTarget}
				{selectedPathUnderlay}
				{midpointGlyphBase}

				<path
					className="connectionPath"
					d={path}
					fill="none"
					strokeLinecap="round"
					pointerEvents="none"
				/>

				{midpointGlyphFace}
				{midpointGlyphControl}
			</g>
		);
	}

	if (connection.pathway === "no-way") {
		return (
			<g className={connectionClassNames}>
				{clickTarget}
				{selectedPathUnderlay}
				{midpointGlyphBase}

				<path
					className="connectionPath connectionPathDashed"
					d={path}
					fill="none"
					strokeLinecap="round"
					pointerEvents="none"
				/>

				{midpointGlyphFace}
				{midpointGlyphControl}
			</g>
		);
	}

	return (
		<g className={connectionClassNames}>
			{clickTarget}
			{selectedPathUnderlay}
			{midpointGlyphBase}

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

			{midpointGlyphFace}
			{midpointGlyphControl}
		</g>
	);
}
