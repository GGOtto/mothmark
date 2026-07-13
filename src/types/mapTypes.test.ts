import {getRoomNodeAnchorVector, getRoomNodePosition, ROOM_DIRECTIONS} from "./mapTypes";

describe("map room nodes", () => {
	it("includes the four special directions", () => {
		expect(ROOM_DIRECTIONS).toEqual(expect.arrayContaining(["u", "d", "in", "out"]));
	});

	it("places out and up across the top edge", () => {
		expect(getRoomNodePosition("out", 128, 80)).toEqual({x: -32, y: -40});
		expect(getRoomNodePosition("u", 128, 80)).toEqual({x: 32, y: -40});
	});

	it("places in and down across the bottom edge", () => {
		expect(getRoomNodePosition("in", 128, 80)).toEqual({x: -32, y: 40});
		expect(getRoomNodePosition("d", 128, 80)).toEqual({x: 32, y: 40});
	});

	it("routes special connections outward from their edge", () => {
		expect(getRoomNodeAnchorVector("out")).toEqual({x: 0, y: -1});
		expect(getRoomNodeAnchorVector("u")).toEqual({x: 0, y: -1});
		expect(getRoomNodeAnchorVector("in")).toEqual({x: 0, y: 1});
		expect(getRoomNodeAnchorVector("d")).toEqual({x: 0, y: 1});
	});
});
