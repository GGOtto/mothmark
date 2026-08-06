import {world as initialWorld} from "@/data/worlds/initialWorld";
import type {World} from "@/schemas/world/worldSchema";
import {
	deleteWorldEntity,
	compareIds,
	generateUniqueId,
	idValue,
	resolveWorldEntityId,
	resolveWorldEntityName,
	updateWorldEntityId,
} from "./idUtils";

function createTestWorld(): World {
	return JSON.parse(JSON.stringify(initialWorld)) as World;
}

describe("generateUniqueId", () => {
	it("returns a typed UUID when there are no existing items", () => {
		const generatedId = generateUniqueId("room");

		expect(generatedId.type).toBe("room");
		expect(generatedId.id).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
		);
	});

	it("returns the first unused numbered id", () => {
		expect(generateUniqueId("room", [{id: "room-1"}, {id: "room-3"}])).toEqual({
			type: "room",
			id: "room-2",
		});
	});
});

describe("ID compatibility", () => {
	it("only compares typed IDs", () => {
		expect(compareIds({type: "room", id: "room-3"}, {type: "room", id: "room-3"})).toBe(true);
		expect(compareIds({type: "room", id: "room-3"}, "room-3")).toBe(false);
		expect(compareIds("room-3", {type: "room", id: "room-3"})).toBe(false);
		expect(compareIds({type: "room", id: "room-3"}, {type: "item", id: "room-3"})).toBe(false);
	});
});

describe("active world entity IDs", () => {
	it("renames rooms and updates room references", () => {
		const world = createTestWorld();
		const originalId = idValue(world.rooms[0].id);
		const updatedWorld = updateWorldEntityId(world, {type: "room", id: originalId}, "renamed-room");

		expect(updatedWorld).not.toBe(world);
		expect(idValue(world.rooms[0].id)).toBe(originalId);
		expect(idValue(updatedWorld.rooms[0].id)).toBe("renamed-room");
		expect(idValue(updatedWorld.startRoomId)).toBe("renamed-room");
		expect(
			updatedWorld.connections.some(
				(connection) =>
					idValue(connection.fromRoomId) === "renamed-room" ||
					idValue(connection.toRoomId) === "renamed-room",
			),
		).toBe(true);
	});

	it("renames and resolves global items", () => {
		const world = createTestWorld();
		const item = world.items[0];
		const oldItemId = idValue(item.id);
		const updatedWorld = updateWorldEntityId(world, {type: "item", id: oldItemId}, "renamed-item");

		expect(idValue(item.id)).toBe(oldItemId);
		expect(idValue(updatedWorld.items[0].id)).toBe("renamed-item");
		expect(resolveWorldEntityName(updatedWorld, {type: "item", id: "renamed-item"})).toBe(item.name);
	});

	it("deletes a room and its connections and chooses a new start room", () => {
		const world = createTestWorld();
		const deletedId = idValue(world.startRoomId);
		const updatedWorld = deleteWorldEntity(world, {type: "room", id: deletedId});

		expect(updatedWorld).not.toBe(world);
		expect(world.rooms.some((room) => idValue(room.id) === deletedId)).toBe(true);
		expect(updatedWorld.rooms.some((room) => idValue(room.id) === deletedId)).toBe(false);
		expect(
			updatedWorld.connections.some(
				(connection) =>
					idValue(connection.fromRoomId) === deletedId || idValue(connection.toRoomId) === deletedId,
			),
		).toBe(false);
		expect(idValue(updatedWorld.startRoomId)).toBe(idValue(updatedWorld.rooms[0].id));
	});

	it("does not resolve dormant item and NPC entity types", () => {
		const world = createTestWorld();
		expect(resolveWorldEntityId({id: {type: "item", id: "key"}}, world)).toBeUndefined();
		expect(resolveWorldEntityId({id: {type: "npc", id: "guard"}}, world)).toBeUndefined();
	});

	it("preserves world identity when an entity cannot be changed", () => {
		const world = createTestWorld();

		expect(deleteWorldEntity(world, {type: "room", id: "missing-room"})).toBe(world);
		expect(updateWorldEntityId(world, {type: "room", id: "missing-room"}, "new-room")).toBe(world);
	});
});
