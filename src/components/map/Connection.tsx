import {ArrowLeftRight, ArrowRight, X} from "lucide-react";
import type React from "react";
import type {Connection as ConnectionType, Direction, Point, Room} from "../../schemas/roomSchema";
import {getRoomNodeAnchorVector} from "../../utils/mapUtils";
import {getPathwayLabel} from "../../utils/connectionUtils";
import {addPoints, scalePoint, getDistance} from "../../utils/pointUtils";
import type {ToolBarStatus, UpdateStatus} from "../studio/ToolBar";
import "./Connection.scss";

type ConnectionProps = {
	connection: ConnectionType;
	fromRoom: Room;
	toRoom: Room;
	selectConnection: (connection?: ConnectionType) => void;
	changePathway: (connection: ConnectionType) => ConnectionType["pathway"];
	updateStatus: UpdateStatus;
	currentLayerIndex: number;
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

function normalizeSvgNumber(value: number) {
	return Math.round(value * 1_000_000) / 1_000_000;
}

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

function getConnectionPathMidpointPlacement(segment: CubicBezierSegment): ConnectionPathPlacement {
	const segments = [segment];
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
		point: {
			x: normalizeSvgNumber(point.x),
			y: normalizeSvgNumber(point.y),
		},
		angle: normalizeSvgNumber(
			Math.atan2(afterPoint.y - beforePoint.y, afterPoint.x - beforePoint.x) * (180 / Math.PI),
		),
	};
}

function getPath(segment: CubicBezierSegment) {
	return `M ${segment.start.x} ${segment.start.y} C ${segment.control1.x} ${segment.control1.y} ${segment.control2.x} ${segment.control2.y} ${segment.end.x} ${segment.end.y}`;
}

function getConnectionCurve(
	startPoint: Point,
	endPoint: Point,
	startDirection: Direction,
	endDirection: Direction,
): CubicBezierSegment {
	const startDirectionVector = getRoomNodeAnchorVector(startDirection);
	const endDirectionVector = getRoomNodeAnchorVector(endDirection);
	const handleLength = Math.min(40, Math.max(15, getDistance(startPoint, endPoint) * 0.25));

	return {
		start: startPoint,
		control1: addPoints(startPoint, scalePoint(startDirectionVector, handleLength)),
		control2: addPoints(endPoint, scalePoint(endDirectionVector, handleLength)),
		end: endPoint,
	};
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

export function getPathwayStatus(pathway: ConnectionType["pathway"]): ToolBarStatus {
	return {
		kind: "pathway",
		label: `${getPathwayLabel(pathway)} pathway · Click to change`,
	};
}

export function Connection({
	connection,
	fromRoom,
	toRoom,
	selectConnection,
	changePathway,
	updateStatus,
	currentLayerIndex,
	isEditing = false,
	isSelected = false,
}: ConnectionProps) {
	const curve = getConnectionCurve(
		fromRoom.position,
		toRoom.position,
		connection.direction,
		connection.returnDirection,
	);
	const path = getPath(curve);
	const midpointPlacement = getConnectionPathMidpointPlacement(curve);
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
		const pathway = changePathway(connection);
		updateStatus(getPathwayStatus(pathway));
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
			aria-label={`Change ${getPathwayLabel(connection.pathway)} pathway`}
			onPointerEnter={() => updateStatus(getPathwayStatus(connection.pathway))}
			onPointerLeave={() => updateStatus(null)}
			onFocus={() => updateStatus(getPathwayStatus(connection.pathway))}
			onBlur={() => updateStatus(null)}
			onClick={handleGlyphClick}
			onKeyDown={handleGlyphKeyDown}
		>
			<title>{`${getPathwayLabel(connection.pathway)} pathway`}</title>
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
