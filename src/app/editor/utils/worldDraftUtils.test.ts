import {produce} from "immer";
import {world as initialWorld} from "@/data/worlds/initialWorld";
import type {World} from "@/schemas/world/worldSchema";
import {idValue, toID} from "@/utils/idUtils";
import {
	addConnectionDraft,
	addItemDraft,
	addRoomDraft,
	addRoomToLayerDraft,
	findConnectionDraft,
	findLayerDraft,
	findItemDraft,
	findRoomDraft,
	moveRoomToLayerDraft,
	removeConnectionDraft,
	removeLayerDraft,
	removeItemDraft,
	removeRoomDraft,
	removeRoomFromLayerDraft,
	replaceConnectionDraft,
	replaceItemDraft,
	replaceRoomDraft,
	setLayerViewportDraft,
	updateConnectionDraft,
	updateLayerDraft,
	updateItemDraft,
	updateRoomDraft,
	upsertLayerDraft,
} from "./worldDraftUtils";

function createWorld(): World {
	return JSON.parse(JSON.stringify(initialWorld)) as World;
}

describe("world room draft helpers", () => {
	it("finds and updates rooms without mutating the source world", () => {
		const world = createWorld();
		const roomId = world.rooms[0].id;
		let found = false;

		const updatedWorld = produce(world, (draft) => {
			found = findRoomDraft(draft, roomId) !== undefined;
			expect(
				updateRoomDraft(draft, roomId, (room) => {
					room.name = "Updated room";
				}),
			).toBe(true);
			expect(updateRoomDraft(draft, "missing-room", () => undefined)).toBe(false);
		});

		expect(found).toBe(true);
		expect(world.rooms[0].name).not.toBe("Updated room");
		expect(updatedWorld.rooms[0].name).toBe("Updated room");
	});

	it("adds, replaces, and removes rooms", () => {
		const world = createWorld();
		const addedRoom = {...world.rooms[0], id: toID("room", "added-room"), name: "Added"};
		const replacement = {...world.rooms[1], name: "Replacement"};

		const updatedWorld = produce(world, (draft) => {
			expect(addRoomDraft(draft, addedRoom)).toBe(true);
			expect(addRoomDraft(draft, addedRoom)).toBe(false);
			expect(replaceRoomDraft(draft, replacement.id, replacement)).toBe(true);
			expect(replaceRoomDraft(draft, "missing-room", replacement)).toBe(false);
			expect(removeRoomDraft(draft, addedRoom.id)).toBe(true);
			expect(removeRoomDraft(draft, addedRoom.id)).toBe(false);
		});

		expect(updatedWorld.rooms).toHaveLength(world.rooms.length);
		expect(
			updatedWorld.rooms.find((room) => idValue(room.id) === idValue(replacement.id))?.name,
		).toBe("Replacement");
	});
});

describe("world connection draft helpers", () => {
	it("finds, adds, replaces, updates, and removes connections", () => {
		const world = createWorld();
		const connection = world.connections[0];
		const addedConnection = {
			...connection,
			id: toID("connection", "added-connection"),
		};

		const updatedWorld = produce(world, (draft) => {
			expect(findConnectionDraft(draft, connection.id)).toBeDefined();
			expect(addConnectionDraft(draft, addedConnection)).toBe(true);
			expect(addConnectionDraft(draft, addedConnection)).toBe(false);
			expect(
				updateConnectionDraft(draft, connection.id, (candidate) => {
					candidate.pathway = "no-way";
				}),
			).toBe(true);
			expect(updateConnectionDraft(draft, "missing-connection", () => undefined)).toBe(false);
			expect(
				replaceConnectionDraft(draft, addedConnection.id, {
					...addedConnection,
					pathway: "forwards",
				}),
			).toBe(true);
			expect(replaceConnectionDraft(draft, "missing-connection", connection)).toBe(false);
			expect(removeConnectionDraft(draft, addedConnection.id)).toBe(true);
			expect(removeConnectionDraft(draft, addedConnection.id)).toBe(false);
		});

		expect(world.connections[0].pathway).not.toBe("no-way");
		expect(updatedWorld.connections[0].pathway).toBe("no-way");
	});
});

describe("world item draft helpers", () => {
	it("finds, adds, replaces, updates, and removes global items", () => {
		const world = createWorld();
		const item = world.items[0];
		const addedItem = {...item, id: toID("item", "added-item"), name: "Added"};

		const updatedWorld = produce(world, (draft) => {
			expect(findItemDraft(draft, item.id)).toBeDefined();
			expect(addItemDraft(draft, addedItem)).toBe(true);
			expect(addItemDraft(draft, addedItem)).toBe(false);
			expect(
				updateItemDraft(draft, item.id, (candidate) => {
					candidate.name = "Updated item";
				}),
			).toBe(true);
			expect(updateItemDraft(draft, "missing-item", () => undefined)).toBe(false);
			expect(
				replaceItemDraft(draft, addedItem.id, {
					...addedItem,
					name: "Replacement item",
				}),
			).toBe(true);
			expect(replaceItemDraft(draft, "missing-item", item)).toBe(false);
			expect(removeItemDraft(draft, addedItem.id)).toBe(true);
			expect(removeItemDraft(draft, addedItem.id)).toBe(false);
		});

		expect(world.items[0].name).not.toBe("Updated item");
		expect(updatedWorld.items[0].name).toBe("Updated item");
	});
});

describe("world layer draft helpers", () => {
	it("finds, upserts, updates, and removes layers", () => {
		const world = createWorld();
		const addedLayer = {
			name: "Upper 2",
			layer: 2,
			rooms: [],
			viewport: {x: 1, y: 2, zoom: 1},
		};

		const updatedWorld = produce(world, (draft) => {
			expect(findLayerDraft(draft, 0)).toBeDefined();
			expect(upsertLayerDraft(draft, addedLayer).name).toBe("Upper 2");
			expect(updateLayerDraft(draft, 2, (layer) => (layer.name = "Renamed"))).toBe(true);
			expect(updateLayerDraft(draft, 99, () => undefined)).toBe(false);
			expect(setLayerViewportDraft(draft, 2, {x: 20, y: 30, zoom: 1.5})).toBe(true);
			expect(setLayerViewportDraft(draft, 99, {x: 0, y: 0, zoom: 1})).toBe(false);
			expect(upsertLayerDraft(draft, {...addedLayer, name: "Replaced"}).name).toBe("Replaced");
			expect(removeLayerDraft(draft, 2)).toBe(true);
			expect(removeLayerDraft(draft, 2)).toBe(false);
		});

		expect(updatedWorld.metadata.layers.map((layer) => layer.layer)).toEqual([-1, 0, 1]);
		expect(world.metadata.layers).toHaveLength(3);
	});

	it("adds, removes, and moves rooms between layers", () => {
		const world = createWorld();
		const roomId = world.rooms[0].id;

		const updatedWorld = produce(world, (draft) => {
			expect(addRoomToLayerDraft(draft, -1, roomId)).toBe(true);
			expect(addRoomToLayerDraft(draft, -1, roomId)).toBe(false);
			expect(removeRoomFromLayerDraft(draft, -1, roomId)).toBe(true);
			expect(removeRoomFromLayerDraft(draft, -1, roomId)).toBe(false);
			expect(moveRoomToLayerDraft(draft, roomId, 1)).toBe(true);
			expect(moveRoomToLayerDraft(draft, "missing-room", 1)).toBe(false);
			expect(moveRoomToLayerDraft(draft, roomId, 99)).toBe(false);
		});

		const containingLayers = updatedWorld.metadata.layers.filter((layer) =>
			layer.rooms.some((candidate) => idValue(candidate) === idValue(roomId)),
		);
		expect(containingLayers.map((layer) => layer.layer)).toEqual([1]);
	});
});
