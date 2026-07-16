import type {Direction} from "../schemas/roomSchema";
import {
	DEFAULT_STUB_CONNECTOR_LENGTH,
	findConnectionStubPoint,
	getDefaultConnectionStubPoint,
	type PlacementRectangle,
} from "./connectionStubPlacement";

const room: PlacementRectangle = {
	center: {x: 100, y: 100},
	width: 128,
	height: 80,
};
const stubSize = {width: 84, height: 26};
const connectorLength = DEFAULT_STUB_CONNECTOR_LENGTH;

function getDefault(direction: Direction) {
	return getDefaultConnectionStubPoint({room, direction, stubSize, connectorLength});
}

describe("default connection stub points", () => {
	it.each([
		["n", {x: 100, y: -13}],
		["ne", {x: 213, y: -13}],
		["e", {x: 266, y: 100}],
		["se", {x: 213, y: 213}],
		["s", {x: 100, y: 213}],
		["sw", {x: -13, y: 213}],
		["w", {x: -66, y: 100}],
		["nw", {x: -13, y: -13}],
	] as const)("places %s in its compass direction", (direction, expected) => {
		expect(getDefault(direction)).toEqual(expected);
	});

	it("centers up and out above the room", () => {
		expect(getDefault("up")).toEqual({x: 100, y: -13});
		expect(getDefault("out")).toEqual({x: 100, y: -13});
	});

	it("centers down and in below the room", () => {
		expect(getDefault("down")).toEqual({x: 100, y: 213});
		expect(getDefault("in")).toEqual({x: 100, y: 213});
	});

	it("moves diagonally by the same amount on both axes", () => {
		const northeast = getDefault("ne");
		expect(northeast.x - room.center.x).toBe(room.center.y - northeast.y);
	});

	it("keeps diagonal center distance no longer than the horizontal cardinal default", () => {
		const northeast = getDefault("ne");
		const east = getDefault("e");
		expect(Math.hypot(northeast.x - room.center.x, northeast.y - room.center.y)).toBeLessThanOrEqual(
			east.x - room.center.x,
		);
	});
});

describe("findConnectionStubPoint", () => {
	it("uses the directional default when it is clear", () => {
		expect(
			findConnectionStubPoint({
				room,
				direction: "n",
				stubSize,
				connectorLength,
				obstacles: [room],
			}),
		).toEqual(getDefault("n"));
	});

	it("finds a nearby point when another stub occupies the default", () => {
		const defaultPoint = getDefault("n");
		const result = findConnectionStubPoint({
			room,
			direction: "n",
			stubSize,
			connectorLength,
			obstacles: [room, {center: defaultPoint, ...stubSize}],
		});

		expect(result).not.toEqual(defaultPoint);
		expect(result.y).toBeLessThan(room.center.y);
		expect(Math.hypot(result.x - defaultPoint.x, result.y - defaultPoint.y)).toBeLessThanOrEqual(160);
	});

	it("prefers the available point with the shorter connection", () => {
		const defaultPoint = getDefault("n");
		const result = findConnectionStubPoint({
			room,
			direction: "n",
			stubSize,
			connectorLength,
			obstacles: [{center: defaultPoint, ...stubSize}],
		});

		// Moving inward and outward both clear the blocker after 40px; inward is shorter.
		expect(result).toEqual({x: 100, y: 35});
	});

	it("avoids rooms that occupy the default area", () => {
		const blockingRoom = {center: getDefault("e"), width: 128, height: 80};
		const result = findConnectionStubPoint({
			room,
			direction: "e",
			stubSize,
			connectorLength,
			obstacles: [room, blockingRoom],
		});

		expect(result).not.toEqual(blockingRoom.center);
		expect(result.x).toBeGreaterThan(room.center.x);
		const overlapsBlockingRoom =
			Math.abs(result.x - blockingRoom.center.x) < (stubSize.width + blockingRoom.width) / 2 + 8 &&
			Math.abs(result.y - blockingRoom.center.y) < (stubSize.height + blockingRoom.height) / 2 + 8;
		expect(overlapsBlockingRoom).toBe(false);
	});

	it("falls back to the original default when the bounded area is full", () => {
		const defaultPoint = getDefault("se");
		expect(
			findConnectionStubPoint({
				room,
				direction: "se",
				stubSize,
				connectorLength,
				obstacles: [{center: defaultPoint, width: 1_000, height: 1_000}],
				maxSearchDistance: 32,
			}),
		).toEqual(defaultPoint);
	});
});
