import {ArrowLeftRight, ArrowRight, Layers, X} from "lucide-react";
import type React from "react";
import {useRef, useState} from "react";
import type {Connection as ConnectionType, Direction, Point, Room} from "../../schemas/roomSchema";
import type {World, Layer} from "../../schemas/worldSchema";
import {getRoomNodeAnchorVector, getRoomNodePosition} from "../../utils/mapUtils";
import {findLayerForRoomId} from "../../utils/layerUtils";
import {idValue} from "../../utils/idUtils";
import {getPathwayLabel} from "../../utils/connectionUtils";
import {addPoints, scalePoint, getDistance} from "../../utils/pointUtils";
import type {ToolBarStatus, UpdateStatus} from "../studio/ToolBar";
import "./Connection.scss";

type ConnectionProps = {
	world: World;
	connection: ConnectionType;
	fromRoom: Room;
	toRoom: Room;
	selectConnection: (connection?: ConnectionType) => void;
	changePathway: (connection: ConnectionType) => ConnectionType["pathway"];
	updateStatus: UpdateStatus;
	currentLayer: Layer;
	onStubPointChange: (connection: ConnectionType, point: Point) => void;
	isEditing?: boolean;
	isSelected?: boolean;
	isInteractive?: boolean;
};

type ConnectionStubProps = {
	world: World;
	connection: ConnectionType;
	fromRoom: Room;
	direction: Direction;
	selectConnection: (connection?: ConnectionType) => void;
	changePathway: (connection: ConnectionType) => ConnectionType["pathway"];
	updateStatus: UpdateStatus;
	destinationLayer: Layer;
	onStubPointChange: (connection: ConnectionType, point: Point) => void;
	isEditing?: boolean;
	isSelected?: boolean;
	isInteractive?: boolean;
};

type StubSide = "top" | "right" | "bottom" | "left";

type StubLayoutItem = {
	connectionId: string;
	direction: Direction;
	side: StubSide;
	tagWidth: number;
};

const ROOM_WIDTH = 128;
const ROOM_HEIGHT = 80;
const STUB_LENGTH = 52;
const TAG_HEIGHT = 26;
const TAG_GAP = 8;

const DIRECTIONS_BY_SIDE: Record<StubSide, Direction[]> = {
	top: ["out", "n", "up"],
	right: ["ne", "e", "se"],
	bottom: ["in", "s", "down"],
	left: ["nw", "w", "sw"],
};

function getStubSide(direction: Direction): StubSide {
	for (const [side, directions] of Object.entries(DIRECTIONS_BY_SIDE)) {
		if (directions.includes(direction)) return side as StubSide;
	}
	return "right";
}

function getLayerTagWidth(name: string) {
	return Math.max(84, name.length * 7 + 46);
}

export function getStubTagAnchorOffset(direction: Direction, tagWidth: number): Point {
	if (direction === "up" || direction === "out") {
		return {x: 0, y: TAG_HEIGHT / 2};
	}
	if (direction === "down" || direction === "in") {
		return {x: 0, y: -TAG_HEIGHT / 2};
	}

	const roomAnchor = getRoomNodeAnchorVector(direction);
	return {
		x: roomAnchor.x === 0 ? 0 : (-roomAnchor.x * tagWidth) / 2,
		y: roomAnchor.y === 0 ? 0 : (-roomAnchor.y * TAG_HEIGHT) / 2,
	};
}

function getStubTagPoint(world: World, connection: ConnectionType, localRoomId: string): Point {
	const room = world.rooms.find((candidate) => idValue(candidate.id) === localRoomId);
	if (!room) return {x: 0, y: 0};
	if (connection.metadata.stubPoint) return connection.metadata.stubPoint;

	const localLayer = findLayerForRoomId(world, room.id);
	const items: StubLayoutItem[] = [];

	for (const candidate of world.connections) {
		const isFromRoom = idValue(candidate.fromRoomId) === localRoomId;
		const isToRoom = idValue(candidate.toRoomId) === localRoomId;
		if (!isFromRoom && !isToRoom) continue;

		const otherRoomId = isFromRoom ? candidate.toRoomId : candidate.fromRoomId;
		const otherLayer = findLayerForRoomId(world, otherRoomId);
		if (otherLayer.layer === localLayer.layer) continue;

		const direction = isFromRoom ? candidate.direction : candidate.returnDirection;
		items.push({
			connectionId: idValue(candidate.id),
			direction,
			side: getStubSide(direction),
			tagWidth: getLayerTagWidth(otherLayer.name),
		});
	}

	const item = items.find((candidate) => candidate.connectionId === idValue(connection.id));
	if (!item) return room.metadata.position;

	const sideItems = items
		.filter((candidate) => candidate.side === item.side)
		.sort((a, b) => {
			const directionOrder =
				DIRECTIONS_BY_SIDE[item.side].indexOf(a.direction) -
				DIRECTIONS_BY_SIDE[item.side].indexOf(b.direction);
			return directionOrder || a.connectionId.localeCompare(b.connectionId);
		});
	const itemIndex = sideItems.findIndex((candidate) => candidate.connectionId === item.connectionId);

	if (item.side === "top" || item.side === "bottom") {
		const totalWidth =
			sideItems.reduce((total, candidate) => total + candidate.tagWidth, 0) +
			Math.max(0, sideItems.length - 1) * TAG_GAP;
		const precedingWidth = sideItems
			.slice(0, itemIndex)
			.reduce((total, candidate) => total + candidate.tagWidth + TAG_GAP, 0);
		const x = room.metadata.position.x - totalWidth / 2 + precedingWidth + item.tagWidth / 2;
		const yOffset = ROOM_HEIGHT / 2 + STUB_LENGTH + TAG_HEIGHT / 2;
		return {x, y: room.metadata.position.y + (item.side === "top" ? -yOffset : yOffset)};
	}

	const totalHeight = sideItems.length * TAG_HEIGHT + Math.max(0, sideItems.length - 1) * TAG_GAP;
	const y =
		room.metadata.position.y - totalHeight / 2 + itemIndex * (TAG_HEIGHT + TAG_GAP) + TAG_HEIGHT / 2;
	const xOffset = ROOM_WIDTH / 2 + STUB_LENGTH + item.tagWidth / 2;
	return {x: room.metadata.position.x + (item.side === "left" ? -xOffset : xOffset), y};
}

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

export type ConnectionVisualBounds = {
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
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
	return getConnectionCurveFromVectors(
		startPoint,
		endPoint,
		getRoomNodeAnchorVector(startDirection),
		getRoomNodeAnchorVector(endDirection),
	);
}

function getConnectionCurveFromVectors(
	startPoint: Point,
	endPoint: Point,
	startDirectionVector: Point,
	endDirectionVector: Point,
): CubicBezierSegment {
	const handleLength = Math.min(40, Math.max(15, getDistance(startPoint, endPoint) * 0.25));

	return {
		start: startPoint,
		control1: addPoints(startPoint, scalePoint(startDirectionVector, handleLength)),
		control2: addPoints(endPoint, scalePoint(endDirectionVector, handleLength)),
		end: endPoint,
	};
}

function getCurveBounds(curve: CubicBezierSegment, margin = 14): ConnectionVisualBounds {
	const points = [curve.start, curve.control1, curve.control2, curve.end];
	return {
		minX: Math.min(...points.map((point) => point.x)) - margin,
		maxX: Math.max(...points.map((point) => point.x)) + margin,
		minY: Math.min(...points.map((point) => point.y)) - margin,
		maxY: Math.max(...points.map((point) => point.y)) + margin,
	};
}

function mergeVisualBounds(
	left: ConnectionVisualBounds | null,
	right: ConnectionVisualBounds,
): ConnectionVisualBounds {
	if (!left) return right;
	return {
		minX: Math.min(left.minX, right.minX),
		maxX: Math.max(left.maxX, right.maxX),
		minY: Math.min(left.minY, right.minY),
		maxY: Math.max(left.maxY, right.maxY),
	};
}

/** Returns the complete rendered extent of connections visible on a layer, including stub tags. */
export function getConnectionVisualBounds(
	world: World,
	currentLayer: Layer,
): ConnectionVisualBounds | null {
	let bounds: ConnectionVisualBounds | null = null;

	for (const connection of world.connections) {
		const fromRoom = world.rooms.find((room) => idValue(room.id) === idValue(connection.fromRoomId));
		const toRoom = world.rooms.find((room) => idValue(room.id) === idValue(connection.toRoomId));
		if (!fromRoom || !toRoom) continue;

		const startLayer = findLayerForRoomId(world, fromRoom.id);
		const endLayer = findLayerForRoomId(world, toRoom.id);
		if (startLayer.layer !== currentLayer.layer && endLayer.layer !== currentLayer.layer) continue;

		if (startLayer.layer !== endLayer.layer) {
			const isStartLocal = startLayer.layer === currentLayer.layer;
			const localRoom = isStartLocal ? fromRoom : toRoom;
			const direction = isStartLocal ? connection.direction : connection.returnDirection;
			const destinationLayer = isStartLocal ? endLayer : startLayer;
			const tagWidth = getLayerTagWidth(destinationLayer.name);
			const tagPoint = getStubTagPoint(world, connection, idValue(localRoom.id));
			const fromPoint = addPoints(
				localRoom.metadata.position,
				getRoomNodePosition(direction, ROOM_WIDTH, ROOM_HEIGHT),
			);
			const pathEnd = addPoints(tagPoint, getStubTagAnchorOffset(direction, tagWidth));
			const curve = getConnectionCurveFromVectors(
				fromPoint,
				pathEnd,
				getRoomNodeAnchorVector(direction),
				scalePoint(getRoomNodeAnchorVector(direction), -1),
			);

			bounds = mergeVisualBounds(bounds, getCurveBounds(curve));
			bounds = mergeVisualBounds(bounds, {
				minX: tagPoint.x - tagWidth / 2 - 5,
				maxX: tagPoint.x + tagWidth / 2 + 5,
				minY: tagPoint.y - TAG_HEIGHT / 2 - 5,
				maxY: tagPoint.y + TAG_HEIGHT / 2 + 5,
			});
			continue;
		}

		const fromPoint = addPoints(
			fromRoom.metadata.position,
			getRoomNodePosition(connection.direction, ROOM_WIDTH, ROOM_HEIGHT),
		);
		const toPoint = addPoints(
			toRoom.metadata.position,
			getRoomNodePosition(connection.returnDirection, ROOM_WIDTH, ROOM_HEIGHT),
		);
		bounds = mergeVisualBounds(
			bounds,
			getCurveBounds(
				getConnectionCurve(fromPoint, toPoint, connection.direction, connection.returnDirection),
			),
		);
	}

	return bounds;
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

type ConnectionPathProps = {
	connection: ConnectionType;
	curve: CubicBezierSegment;
	selectConnection: (connection?: ConnectionType) => void;
	changePathway: (connection: ConnectionType) => ConnectionType["pathway"];
	updateStatus: UpdateStatus;
	isEditing?: boolean;
	isSelected?: boolean;
	className?: string;
	dataRoomId?: string;
	children?: React.ReactNode;
	isInteractive?: boolean;
};

function ConnectionPath({
	connection,
	curve,
	selectConnection,
	changePathway,
	updateStatus,
	isEditing = false,
	isSelected = false,
	className,
	dataRoomId,
	children,
	isInteractive = true,
}: ConnectionPathProps) {
	const path = getPath(curve);
	const midpointPlacement = getConnectionPathMidpointPlacement(curve);
	const midpointIcon = getMidpointGlyphIcon(connection.pathway);
	const midpointGlyphRotation = getMidpointGlyphRotation(
		connection.pathway,
		midpointPlacement.angle,
	);
	const connectionClassNames = [
		"connection",
		className,
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

	const glyphOutlineRadius = isSelected ? 9.75 : 7.5;
	const glyphBodyRadius = isSelected ? 8.5 : 6.25;
	const midpointGlyphTransform = `translate(${midpointPlacement.point.x} ${midpointPlacement.point.y}) rotate(${midpointGlyphRotation})`;
	const isDirectional = connection.pathway === "forwards" || connection.pathway === "backwards";

	return (
		<g className={connectionClassNames} data-room-id={dataRoomId}>
			{isInteractive ? (
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
			) : null}

			{isSelected ? (
				<>
					<path
						className={`connectionPathUnderlay ${connection.pathway === "two-way" ? "" : "connectionPathDashed"}`}
						d={path}
						fill="none"
						strokeLinecap="round"
						pointerEvents="none"
					/>
					{isDirectional ? (
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
			) : null}

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

			<path
				className={`connectionPath ${connection.pathway === "two-way" ? "" : "connectionPathDashed"}`}
				d={path}
				fill="none"
				strokeLinecap="round"
				pointerEvents="none"
			/>
			{isDirectional ? (
				<path
					className="connectionPath connectionPathDirectional"
					d={path}
					pathLength={100}
					fill="none"
					strokeLinecap="round"
					strokeDashoffset={connection.pathway === "backwards" ? -50 : 0}
					pointerEvents="none"
				/>
			) : null}

			<g
				className="connectionMidpointGlyph connectionMidpointGlyphFaceLayer"
				transform={midpointGlyphTransform}
				pointerEvents="none"
			>
				<g className="connectionMidpointGlyphInner">
					<circle className="connectionMidpointGlyphFace" cx={0} cy={0} r={6.25} />
					{midpointIcon}
				</g>
			</g>

			{isInteractive ? (
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
			) : null}

			{children}
		</g>
	);
}

export function ConnectionStub({
	world,
	connection,
	fromRoom,
	direction,
	selectConnection,
	changePathway,
	updateStatus,
	destinationLayer,
	onStubPointChange,
	isEditing = false,
	isSelected = false,
	isInteractive = true,
}: ConnectionStubProps) {
	const tagWidth = getLayerTagWidth(destinationLayer.name);
	const persistedTagPoint = getStubTagPoint(world, connection, idValue(fromRoom.id));
	const [dragPoint, setDragPoint] = useState<Point | null>(null);
	const tagPoint = dragPoint ?? persistedTagPoint;
	const fromPoint = addPoints(
		fromRoom.metadata.position,
		getRoomNodePosition(direction, ROOM_WIDTH, ROOM_HEIGHT),
	);
	const pathEnd = addPoints(tagPoint, getStubTagAnchorOffset(direction, tagWidth));
	const stubAnchorDirection = scalePoint(getRoomNodeAnchorVector(direction), -1);
	const curve = getConnectionCurveFromVectors(
		fromPoint,
		pathEnd,
		getRoomNodeAnchorVector(direction),
		stubAnchorDirection,
	);
	const dragPointerId = useRef<number | null>(null);
	const dragOffset = useRef<Point>({x: 0, y: 0});
	const latestDragPoint = useRef<Point | null>(null);
	const didDrag = useRef(false);
	const [isDragging, setIsDragging] = useState(false);

	function clientToSvgPoint(event: React.PointerEvent<SVGGElement>) {
		const svg = event.currentTarget.ownerSVGElement;
		const matrix = svg?.getScreenCTM();
		if (!svg || !matrix) return null;
		const point = svg.createSVGPoint();
		point.x = event.clientX;
		point.y = event.clientY;
		return point.matrixTransform(matrix.inverse());
	}

	function handlePointerDown(event: React.PointerEvent<SVGGElement>) {
		if (event.button !== 0) return;
		const pointer = clientToSvgPoint(event);
		if (!pointer) return;
		event.preventDefault();
		event.stopPropagation();
		dragPointerId.current = event.pointerId;
		dragOffset.current = {x: pointer.x - tagPoint.x, y: pointer.y - tagPoint.y};
		latestDragPoint.current = tagPoint;
		didDrag.current = false;
		setIsDragging(true);
		event.currentTarget.setPointerCapture(event.pointerId);
	}

	function handlePointerMove(event: React.PointerEvent<SVGGElement>) {
		if (dragPointerId.current !== event.pointerId) return;
		const point = clientToSvgPoint(event);
		if (!point) return;
		const nextPoint = {
			x: point.x - dragOffset.current.x,
			y: point.y - dragOffset.current.y,
		};
		didDrag.current = true;
		latestDragPoint.current = nextPoint;
		setDragPoint(nextPoint);
	}

	function handlePointerUp(event: React.PointerEvent<SVGGElement>) {
		if (dragPointerId.current !== event.pointerId) return;
		event.stopPropagation();
		dragPointerId.current = null;
		setIsDragging(false);
		if (didDrag.current && latestDragPoint.current) {
			onStubPointChange(connection, latestDragPoint.current);
		}
		setDragPoint(null);
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
	}

	function handlePointerCancel(event: React.PointerEvent<SVGGElement>) {
		if (dragPointerId.current !== event.pointerId) return;
		dragPointerId.current = null;
		latestDragPoint.current = null;
		setIsDragging(false);
		setDragPoint(null);
	}

	function handleClick(event: React.MouseEvent<SVGElement>) {
		event.stopPropagation();
		if (!didDrag.current) selectConnection(connection);
		didDrag.current = false;
	}

	return (
		<ConnectionPath
			connection={connection}
			curve={curve}
			selectConnection={selectConnection}
			changePathway={changePathway}
			updateStatus={updateStatus}
			isEditing={isEditing}
			isSelected={isSelected}
			isInteractive={isInteractive}
			className="connectionStub"
			dataRoomId={idValue(fromRoom.id)}
		>
			<g
				className={`connectionLayerTag ${isDragging ? "connectionLayerTagDragging" : ""}`}
				transform={`translate(${tagPoint.x} ${tagPoint.y})`}
				role={isInteractive ? "button" : undefined}
				tabIndex={isInteractive ? 0 : undefined}
				aria-label={isInteractive ? `Connection to ${destinationLayer.name}` : undefined}
				onPointerDown={isInteractive ? handlePointerDown : undefined}
				onPointerMove={isInteractive ? handlePointerMove : undefined}
				onPointerUp={isInteractive ? handlePointerUp : undefined}
				onPointerCancel={isInteractive ? handlePointerCancel : undefined}
				onClick={isInteractive ? handleClick : undefined}
				onKeyDown={
					isInteractive
						? (event) => {
								if (event.key !== "Enter" && event.key !== " ") return;
								event.preventDefault();
								selectConnection(connection);
							}
						: undefined
				}
			>
				<rect
					className="connectionLayerTagSelectionOutline"
					x={-tagWidth / 2}
					y={-TAG_HEIGHT / 2}
					width={tagWidth}
					height={TAG_HEIGHT}
				/>
				<rect x={-tagWidth / 2} y={-TAG_HEIGHT / 2} width={tagWidth} height={TAG_HEIGHT} />
				<Layers
					className="connectionLayerTagIcon"
					x={-tagWidth / 2 + 9}
					y={-7}
					width={14}
					height={14}
					strokeWidth={2}
				/>
				<text x={7} textAnchor="middle" dominantBaseline="central">
					{destinationLayer.name}
				</text>
			</g>
		</ConnectionPath>
	);
}

export function Connection({
	world,
	connection,
	fromRoom,
	toRoom,
	selectConnection,
	changePathway,
	updateStatus,
	currentLayer,
	onStubPointChange,
	isEditing = false,
	isSelected = false,
	isInteractive = true,
}: ConnectionProps) {
	const startLayer = findLayerForRoomId(world, fromRoom.id);
	const endLayer = findLayerForRoomId(world, toRoom.id);

	// Skip connections that do not touch the current layer.
	if (startLayer.layer !== currentLayer.layer && endLayer.layer !== currentLayer.layer) {
		return null;
	}

	// create a stub for connections that are split between layers
	if (startLayer.layer !== endLayer.layer && startLayer.layer === currentLayer.layer) {
		return (
			<ConnectionStub
				world={world}
				connection={connection}
				fromRoom={fromRoom}
				direction={connection.direction}
				selectConnection={selectConnection}
				changePathway={changePathway}
				updateStatus={updateStatus}
				destinationLayer={findLayerForRoomId(world, toRoom.id)}
				onStubPointChange={onStubPointChange}
				isEditing={isEditing}
				isSelected={isSelected}
				isInteractive={isInteractive}
			/>
		);
	}
	if (startLayer.layer !== endLayer.layer && endLayer.layer === currentLayer.layer) {
		return (
			<ConnectionStub
				world={world}
				connection={connection}
				fromRoom={toRoom}
				direction={connection.returnDirection}
				selectConnection={selectConnection}
				changePathway={changePathway}
				updateStatus={updateStatus}
				destinationLayer={findLayerForRoomId(world, fromRoom.id)}
				onStubPointChange={onStubPointChange}
				isEditing={isEditing}
				isSelected={isSelected}
				isInteractive={isInteractive}
			/>
		);
	}

	// proceed to build a curved connection
	const fromPoint = addPoints(
		fromRoom.metadata.position,
		getRoomNodePosition(connection.direction, ROOM_WIDTH, ROOM_HEIGHT),
	);
	const toPoint = addPoints(
		toRoom.metadata.position,
		getRoomNodePosition(connection.returnDirection, ROOM_WIDTH, ROOM_HEIGHT),
	);
	const curve = getConnectionCurve(
		fromPoint,
		toPoint,
		connection.direction,
		connection.returnDirection,
	);

	return (
		<ConnectionPath
			connection={connection}
			curve={curve}
			selectConnection={selectConnection}
			changePathway={changePathway}
			updateStatus={updateStatus}
			isEditing={isEditing}
			isSelected={isSelected}
			isInteractive={isInteractive}
		/>
	);
}
