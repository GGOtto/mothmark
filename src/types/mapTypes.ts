import type {Direction, Point, Room} from "../schemas/worldSchema";

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
