import {
	getRoomNodeAnchorVector,
	getRoomNodePosition,
	ROOM_DIRECTIONS,
	findLayerForRoomId,
} from "./mapUtils";
import type {Layer} from "@/schemas/worldSchema";

describe("map room nodes", () => {
	it("includes the four special directions", () => {
		expect(ROOM_DIRECTIONS).toEqual(expect.arrayContaining(["u", "d", "in", "out"]));
	});

	it("places out and up across the top edge", () => {
		expect(getRoomNodePosition("out", 128, 80)).toEqual({x: -32, y: -40});
		expect(getRoomNodePosition("up", 128, 80)).toEqual({x: 32, y: -40});
	});

	it("places in and down across the bottom edge", () => {
		expect(getRoomNodePosition("in", 128, 80)).toEqual({x: -32, y: 40});
		expect(getRoomNodePosition("down", 128, 80)).toEqual({x: 32, y: 40});
	});

	it("routes special connections outward from their edge", () => {
		expect(getRoomNodeAnchorVector("out")).toEqual({x: 0, y: -1});
		expect(getRoomNodeAnchorVector("up")).toEqual({x: 0, y: -1});
		expect(getRoomNodeAnchorVector("in")).toEqual({x: 0, y: 1});
		expect(getRoomNodeAnchorVector("down")).toEqual({x: 0, y: 1});
	});
});

describe("findLayerForRoom", () => {
	const layers: Layer[] = [
		{
			name: "Lower 1",
			layer: -1,
			rooms: [
				{
					type: "room",
					id: "room-1",
				},
				{
					type: "room",
					id: "room-2",
				},
			],
		},
		{
			name: "Ground",
			layer: 0,
			rooms: [
				{
					type: "room",
					id: "room-3",
				},
				{
					type: "room",
					id: "room-4",
				},
			],
		},
		{
			name: "Upper 1",
			layer: 1,
			rooms: [
				{
					type: "room",
					id: "room-5",
				},
				{
					type: "room",
					id: "room-6",
				},
			],
		},
	];

	it("if layer list is empty, return true for any room (this means we only have the ground floor layer)", () => {
		expect(findLayerForRoomId([], {type: "room", id: "room-1"})).toEqual(0);
		expect(findLayerForRoomId([], {type: "room", id: "room-2"})).toEqual(0);
	});

	it("return the layer that references the room", () => {
		expect(findLayerForRoomId(layers, {type: "room", id: "room-1"})).toEqual(-1);
		expect(findLayerForRoomId(layers, {type: "room", id: "room-2"})).toEqual(-1);
		expect(findLayerForRoomId(layers, {type: "room", id: "room-3"})).toEqual(0);
		expect(findLayerForRoomId(layers, {type: "room", id: "room-4"})).toEqual(0);
		expect(findLayerForRoomId(layers, {type: "room", id: "room-5"})).toEqual(1);
		expect(findLayerForRoomId(layers, {type: "room", id: "room-6"})).toEqual(1);
	});

	it("return 0 if no reference is found", () => {
		expect(findLayerForRoomId(layers, {type: "room", id: "room-7"})).toEqual(0);
		expect(findLayerForRoomId(layers, {type: "room", id: "room-8"})).toEqual(0);
	});
});
