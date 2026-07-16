import type {Direction, Point} from "../schemas/roomSchema";
import {getRoomNodeAnchorVector} from "./mapUtils";

export type PlacementRectangle = {
	center: Point;
	width: number;
	height: number;
};

export type FindConnectionStubPointOptions = {
	room: PlacementRectangle;
	direction: Direction;
	stubSize: {width: number; height: number};
	obstacles: PlacementRectangle[];
	connectorLength: number;
	gap?: number;
	searchStep?: number;
	maxSearchDistance?: number;
};

function rectanglesOverlap(first: PlacementRectangle, second: PlacementRectangle, gap: number) {
	return (
		Math.abs(first.center.x - second.center.x) < (first.width + second.width) / 2 + gap &&
		Math.abs(first.center.y - second.center.y) < (first.height + second.height) / 2 + gap
	);
}

/** Returns the centered point directly outward from a room for a connection direction. */
export function getDefaultConnectionStubPoint({
	room,
	direction,
	stubSize,
	connectorLength,
}: Pick<
	FindConnectionStubPointOptions,
	"room" | "direction" | "stubSize" | "connectorLength"
>): Point {
	const vector = getRoomNodeAnchorVector(direction);
	const horizontalDistance = room.width / 2 + connectorLength + stubSize.width / 2;
	const verticalDistance = room.height / 2 + connectorLength + stubSize.height / 2;
	const isDiagonal = vector.x !== 0 && vector.y !== 0;
	const diagonalDistance = Math.max(horizontalDistance, verticalDistance);

	return {
		x: room.center.x + vector.x * (isDiagonal ? diagonalDistance : horizontalDistance),
		y: room.center.y + vector.y * (isDiagonal ? diagonalDistance : verticalDistance),
	};
}

function remainsInDirection(point: Point, roomPoint: Point, direction: Direction) {
	const vector = getRoomNodeAnchorVector(direction);
	const offset = {x: point.x - roomPoint.x, y: point.y - roomPoint.y};

	return (
		(vector.x === 0 || Math.sign(offset.x) === Math.sign(vector.x)) &&
		(vector.y === 0 || Math.sign(offset.y) === Math.sign(vector.y))
	);
}

/**
 * Finds a nearby, non-overlapping stub point. The bounded search is deterministic and
 * preserves the connection's general direction. If the area is full, it returns the
 * original directional default.
 */
export function findConnectionStubPoint({
	room,
	direction,
	stubSize,
	obstacles,
	connectorLength,
	gap = 8,
	searchStep = 8,
	maxSearchDistance = 160,
}: FindConnectionStubPointOptions): Point {
	const defaultPoint = getDefaultConnectionStubPoint({
		room,
		direction,
		stubSize,
		connectorLength,
	});
	const vector = getRoomNodeAnchorVector(direction);
	const isAvailable = (center: Point) => {
		const stub = {...stubSize, center};
		return obstacles.every((obstacle) => !rectanglesOverlap(stub, obstacle, gap));
	};

	if (isAvailable(defaultPoint)) return defaultPoint;

	const candidates: Point[] = [];
	for (let x = -maxSearchDistance; x <= maxSearchDistance; x += searchStep) {
		for (let y = -maxSearchDistance; y <= maxSearchDistance; y += searchStep) {
			if (x === 0 && y === 0) continue;
			if (Math.hypot(x, y) > maxSearchDistance) continue;
			const point = {x: defaultPoint.x + x, y: defaultPoint.y + y};
			if (remainsInDirection(point, room.center, direction)) candidates.push(point);
		}
	}

	candidates.sort((first, second) => {
		const firstOffset = {x: first.x - defaultPoint.x, y: first.y - defaultPoint.y};
		const secondOffset = {x: second.x - defaultPoint.x, y: second.y - defaultPoint.y};
		const distanceDifference =
			Math.hypot(firstOffset.x, firstOffset.y) - Math.hypot(secondOffset.x, secondOffset.y);
		if (distanceDifference !== 0) return distanceDifference;

		// At the same distance, prefer moving farther outward over moving sideways.
		const firstOutward = firstOffset.x * vector.x + firstOffset.y * vector.y;
		const secondOutward = secondOffset.x * vector.x + secondOffset.y * vector.y;
		return secondOutward - firstOutward || first.y - second.y || first.x - second.x;
	});

	return candidates.find(isAvailable) ?? defaultPoint;
}
