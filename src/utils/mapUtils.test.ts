import type {Connection} from "../schemas/worldSchema";
import {
	addPoints,
	canTravelBackward,
	canTravelForward,
	getDistance,
	getMidpoint,
	isConnectionFromRoom,
	isOneWay,
	isSpecialOnly,
	isTwoWay,
	multiplyPoints,
	scalePoint,
	subtractPoints,
} from "./mapUtils";

function makeConnection(overrides: Partial<Connection> = {}): Connection {
	return {
		id: "connection-1",
		fromRoomId: "room-1",
		toRoomId: "room-2",
		direction: "e",
		returnDirection: "w",
		pathway: "two-way",
		...overrides,
	} as Connection;
}

describe("mapUtils", () => {
	describe("connection travel helpers", () => {
		test("canTravelForward returns true when direction exists", () => {
			const connection = makeConnection({direction: "e"});

			expect(canTravelForward(connection)).toBe(true);
		});

		test("canTravelForward returns false when direction is missing", () => {
			const connection = makeConnection({direction: undefined});

			expect(canTravelForward(connection)).toBe(false);
		});

		test("canTravelBackward returns true when returnDirection exists", () => {
			const connection = makeConnection({returnDirection: "w"});

			expect(canTravelBackward(connection)).toBe(true);
		});

		test("canTravelBackward returns false when returnDirection is missing", () => {
			const connection = makeConnection({returnDirection: undefined});

			expect(canTravelBackward(connection)).toBe(false);
		});

		test("isTwoWay returns true when connection has both directions", () => {
			const connection = makeConnection({
				direction: "e",
				returnDirection: "w",
			});

			expect(isTwoWay(connection)).toBe(true);
		});

		test("isTwoWay returns false when connection does not have both directions", () => {
			const connection = makeConnection({
				direction: "e",
				returnDirection: undefined,
			});

			expect(isTwoWay(connection)).toBe(false);
		});

		test("isOneWay returns true when only forward travel exists", () => {
			const connection = makeConnection({
				direction: "e",
				returnDirection: undefined,
			});

			expect(isOneWay(connection)).toBe(true);
		});

		test("isOneWay returns true when only backward travel exists", () => {
			const connection = makeConnection({
				direction: undefined,
				returnDirection: "w",
			});

			expect(isOneWay(connection)).toBe(true);
		});

		test("isOneWay returns false when both travel directions exist", () => {
			const connection = makeConnection({
				direction: "e",
				returnDirection: "w",
			});

			expect(isOneWay(connection)).toBe(false);
		});

		test("isOneWay returns false when neither travel direction exists", () => {
			const connection = makeConnection({
				direction: undefined,
				returnDirection: undefined,
			});

			expect(isOneWay(connection)).toBe(false);
		});

		test("isSpecialOnly returns true when neither direction exists", () => {
			const connection = makeConnection({
				direction: undefined,
				returnDirection: undefined,
			});

			expect(isSpecialOnly(connection)).toBe(true);
		});

		test("isSpecialOnly returns false when at least one direction exists", () => {
			const connection = makeConnection({
				direction: "e",
				returnDirection: undefined,
			});

			expect(isSpecialOnly(connection)).toBe(false);
		});
	});

	describe("point math helpers", () => {
		test("addPoints adds x and y values", () => {
			expect(addPoints({x: 2, y: 3}, {x: 4, y: 5})).toEqual({
				x: 6,
				y: 8,
			});
		});

		test("subtractPoints subtracts x and y values", () => {
			expect(subtractPoints({x: 8, y: 6}, {x: 3, y: 2})).toEqual({
				x: 5,
				y: 4,
			});
		});

		test("scalePoint multiplies x and y by a scalar", () => {
			expect(scalePoint({x: 3, y: -4}, 2)).toEqual({
				x: 6,
				y: -8,
			});
		});

		test("multiplyPoints multiplies matching coordinates", () => {
			expect(multiplyPoints({x: 3, y: 4}, {x: 5, y: -2})).toEqual({
				x: 15,
				y: -8,
			});
		});

		test("getMidpoint returns the midpoint between two points", () => {
			expect(getMidpoint({x: 0, y: 0}, {x: 10, y: 20})).toEqual({
				x: 5,
				y: 10,
			});
		});

		test("getDistance returns the distance between two points", () => {
			expect(getDistance({x: 0, y: 0}, {x: 3, y: 4})).toBe(5);
		});

		test("getDistance works with negative coordinates", () => {
			expect(getDistance({x: -1, y: -2}, {x: 2, y: 2})).toBe(5);
		});
	});

	describe("isConnectionFromRoom", () => {
		const connections: Connection[] = [
			makeConnection({
				id: "connection-forward-east",
				fromRoomId: "room-a",
				toRoomId: "room-b",
				direction: "e",
				returnDirection: undefined,
				pathway: "forwards",
			}),
			makeConnection({
				id: "connection-forward-north",
				fromRoomId: "room-a",
				toRoomId: "room-c",
				direction: "n",
				returnDirection: undefined,
				pathway: "forwards",
			}),
			makeConnection({
				id: "connection-backward-west",
				fromRoomId: "room-d",
				toRoomId: "room-e",
				direction: undefined,
				returnDirection: "w",
				pathway: "backwards",
			}),
			makeConnection({
				id: "connection-two-way",
				fromRoomId: "room-f",
				toRoomId: "room-g",
				direction: "s",
				returnDirection: "n",
				pathway: "two-way",
			}),
			makeConnection({
				id: "connection-special",
				fromRoomId: "room-h",
				toRoomId: "room-i",
				direction: undefined,
				returnDirection: undefined,
				pathway: "no-way",
			}),
		];

		test("returns true when room has a forwards connection in the requested direction", () => {
			expect(isConnectionFromRoom("room-a", "e", connections)).toBe(true);
		});

		test("returns false when room has a forwards connection, but not in the requested direction", () => {
			expect(isConnectionFromRoom("room-a", "s", connections)).toBe(false);
		});

		test("returns true when room has another forwards connection in a different requested direction", () => {
			expect(isConnectionFromRoom("room-a", "n", connections)).toBe(true);
		});

		test("returns false when room is the toRoomId of a forwards-only connection", () => {
			expect(isConnectionFromRoom("room-b", "w", connections)).toBe(false);
		});

		test("returns false when room is the fromRoomId of a backwards-only connection", () => {
			expect(isConnectionFromRoom("room-d", "e", connections)).toBe(false);
		});

		test("returns true when room is the toRoomId of a backwards connection in the requested return direction", () => {
			expect(isConnectionFromRoom("room-e", "w", connections)).toBe(true);
		});

		test("returns false when room is the toRoomId of a backwards connection, but not in the requested direction", () => {
			expect(isConnectionFromRoom("room-e", "e", connections)).toBe(false);
		});

		test("returns true when room is the fromRoomId of a two-way connection in the forward direction", () => {
			expect(isConnectionFromRoom("room-f", "s", connections)).toBe(true);
		});

		test("returns false when room is the fromRoomId of a two-way connection, but direction does not match", () => {
			expect(isConnectionFromRoom("room-f", "n", connections)).toBe(false);
		});

		test("returns true when room is the toRoomId of a two-way connection in the return direction", () => {
			expect(isConnectionFromRoom("room-g", "n", connections)).toBe(true);
		});

		test("returns false when room is the toRoomId of a two-way connection, but returnDirection does not match", () => {
			expect(isConnectionFromRoom("room-g", "s", connections)).toBe(false);
		});

		test("returns false for special-only connections", () => {
			expect(isConnectionFromRoom("room-h", "e", connections)).toBe(false);
			expect(isConnectionFromRoom("room-i", "w", connections)).toBe(false);
		});

		test("returns false when the room has no matching connections", () => {
			expect(isConnectionFromRoom("room-z", "e", connections)).toBe(false);
		});

		test("returns false when there are no connections", () => {
			expect(isConnectionFromRoom("room-a", "e", [])).toBe(false);
		});
	});
});
