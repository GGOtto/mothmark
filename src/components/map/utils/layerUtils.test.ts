import {world} from "@/data/worlds/exampleWorld";
import {DefaultViewport, type Layer} from "@/schemas/world/worldSchema";
import {findLayerForRoomId} from "./layerUtils";

describe("findLayerForRoom", () => {
	const layers: Layer[] = [
		{
			name: "Lower 1",
			layer: -1,
			viewport: DefaultViewport,
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
			viewport: DefaultViewport,
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
			viewport: DefaultViewport,
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
	const worldWithLayers = {...world, metadata: {...world.metadata, layers}};

	it("if layer list is empty, return true for any room (this means we only have the ground floor layer)", () => {
		expect(
			findLayerForRoomId(
				{...world, metadata: {...world.metadata, layers: []}},
				{type: "room", id: "room-1"},
			).layer,
		).toEqual(0);
		expect(
			findLayerForRoomId(
				{...world, metadata: {...world.metadata, layers: []}},
				{type: "room", id: "room-2"},
			).layer,
		).toEqual(0);
	});

	it("return the layer that references the room", () => {
		expect(findLayerForRoomId(worldWithLayers, {type: "room", id: "room-1"}).layer).toEqual(-1);
		expect(findLayerForRoomId(worldWithLayers, {type: "room", id: "room-2"}).layer).toEqual(-1);
		expect(findLayerForRoomId(worldWithLayers, {type: "room", id: "room-3"}).layer).toEqual(0);
		expect(findLayerForRoomId(worldWithLayers, {type: "room", id: "room-4"}).layer).toEqual(0);
		expect(findLayerForRoomId(worldWithLayers, {type: "room", id: "room-5"}).layer).toEqual(1);
		expect(findLayerForRoomId(worldWithLayers, {type: "room", id: "room-6"}).layer).toEqual(1);
	});

	it("return 0 if no reference is found", () => {
		expect(findLayerForRoomId(worldWithLayers, {type: "room", id: "room-7"}).layer).toEqual(0);
		expect(findLayerForRoomId(worldWithLayers, {type: "room", id: "room-8"}).layer).toEqual(0);
	});
});
