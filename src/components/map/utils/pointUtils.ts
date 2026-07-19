import type {Point} from "@/schemas/world/roomSchema";

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
