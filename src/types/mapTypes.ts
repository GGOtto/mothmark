export type Direction = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

export const DIRECTION_VECTORS: Record<Direction, {x: number; y: number}> = {
	n: {x: 0, y: -1},
	ne: {x: 1, y: -1},
	e: {x: 1, y: 0},
	se: {x: 1, y: 1},
	s: {x: 0, y: 1},
	sw: {x: -1, y: 1},
	w: {x: -1, y: 0},
	nw: {x: -1, y: -1},
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
};

export type Point = {
	x: number;
	y: number;
};

export type Room = {
	id: string;
	name: string;
	position: Point;
	description?: string;
};

export type RoomNode = {
	room: Room;
	direction: Direction;
	position: Point;
	isConnected?: boolean;
};

export type Connection = {
	id: string;
	fromRoomId: string;
	toRoomId: string;
	direction: Direction;
	returnDirection: Direction;
	pathway: "forward" | "backward" | "two-way";
	controlPoints?: Point[];
	specialCommands?: string[];
	returnSpecialCommands?: string[];
};
