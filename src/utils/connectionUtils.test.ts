import type {Connection} from "../schemas/worldSchema";
import {isConnectionFromRoom} from "./connectionUtils";

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

describe("connectionUtils", () => {
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
