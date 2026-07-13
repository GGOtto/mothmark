import type {Direction, Point, Room} from "../schemas/roomSchema";

export const DIRECTION_VECTORS: Record<Direction, Point> = {
	n: {x: 0, y: -1},
	ne: {x: 1, y: -1},
	e: {x: 1, y: 0},
	se: {x: 1, y: 1},
	s: {x: 0, y: 1},
	sw: {x: -1, y: 1},
	w: {x: -1, y: 0},
	nw: {x: -1, y: -1},
	// TODO: replace these fallback vectors when floor/contextual exit layout is implemented.
	up: {x: 0, y: -1},
	down: {x: 0, y: 1},
	in: {x: 1, y: 0},
	out: {x: -1, y: 0},
};

export const ROOM_DIRECTIONS: Direction[] = [
	"n",
	"ne",
	"e",
	"se",
	"s",
	"sw",
	"w",
	"nw",
	"up",
	"down",
	"in",
	"out",
];

export const DIRECTION_LABELS: Record<Direction, string> = {
	n: "North",
	ne: "Northeast",
	e: "East",
	se: "Southeast",
	s: "South",
	sw: "Southwest",
	w: "West",
	nw: "Northwest",
	up: "Up",
	down: "Down",
	in: "In",
	out: "Out",
};

export function getRoomNodePosition(direction: Direction, width: number, height: number): Point {
	if (direction === "in" || direction === "out" || direction === "up" || direction === "down") {
		const isTopNode = direction === "out" || direction === "up";
		const isLeftNode = direction === "out" || direction === "in";

		return {
			x: (isLeftNode ? -width : width) / 4,
			y: (isTopNode ? -height : height) / 2,
		};
	}

	const vector = DIRECTION_VECTORS[direction];
	return {
		x: (vector.x * width) / 2,
		y: (vector.y * height) / 2,
	};
}

export function getRoomNodeAnchorVector(direction: Direction): Point {
	if (direction === "out" || direction === "up") return {x: 0, y: -1};
	if (direction === "in" || direction === "down") return {x: 0, y: 1};

	return DIRECTION_VECTORS[direction];
}

export const REVERSE_DIRECTION: Record<Direction, Direction> = {
	n: "s",
	ne: "sw",
	e: "w",
	se: "nw",
	s: "n",
	sw: "ne",
	w: "e",
	nw: "se",
	up: "down",
	down: "up",
	in: "out",
	out: "in",
};

export type RoomNode = {
	room: Room;
	direction: Direction;
	position: Point;
	isConnected?: boolean;
};
