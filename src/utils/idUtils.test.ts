import {world as exampleWorld} from "@/data/worlds/exampleWorld";
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
	return JSON.parse(JSON.stringify(exampleWorld)) as World;
}

describe("generateUniqueId", () => {
	it("returns the first unused numbered id", () => {
		expect(generateUniqueId("room", [{id: "room-1"}, {id: "room-3"}])).toBe("room-2");
	});
});

describe("ID compatibility", () => {
	it("only compares typed IDs", () => {
		expect(compareIds({type: "room", id: "room-3"}, {type: "room", id: "room-3"})).toBe(true);
		expect(compareIds({type: "room", id: "room-3"}, "room-3")).toBe(false);
		expect(compareIds("room-3", {type: "room", id: "room-3"})).toBe(false);
		expect(compareIds({type: "room", id: "room-3"}, {type: "feature", id: "room-3"})).toBe(false);
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

	it("renames and resolves room features", () => {
		const world = createTestWorld();
		const roomId = idValue(world.rooms[0].id);
		const feature = world.rooms[0].features[0];
		const oldFeatureId = idValue(feature.id);
		const updatedWorld = updateWorldEntityId(
			world,
			{type: "feature", id: `${roomId}.${oldFeatureId}`},
			"renamed-feature",
		);

		expect(idValue(feature.id)).toBe(oldFeatureId);
		expect(idValue(updatedWorld.rooms[0].features[0].id)).toBe("renamed-feature");
		expect(
			resolveWorldEntityName(updatedWorld, {type: "feature", id: `${roomId}.renamed-feature`}),
		).toBe(feature.name);
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
