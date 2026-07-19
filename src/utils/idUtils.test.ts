import {world as exampleWorld} from "@/data/worlds/exampleWorld";
import type {World} from "@/schemas/world/worldSchema";
import {
	deleteWorldEntity,
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

describe("active world entity IDs", () => {
	it("renames rooms and updates room references", () => {
		const world = createTestWorld();
		const originalId = idValue(world.rooms[0].id);

		expect(updateWorldEntityId(world, {type: "room", id: originalId}, "renamed-room")).toBe(true);
		expect(idValue(world.rooms[0].id)).toBe("renamed-room");
		expect(idValue(world.startRoomId)).toBe("renamed-room");
		expect(
			world.connections.some(
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

		expect(
			updateWorldEntityId(
				world,
				{type: "feature", id: `${roomId}.${oldFeatureId}`},
				"renamed-feature",
			),
		).toBe(true);
		expect(idValue(feature.id)).toBe("renamed-feature");
		expect(resolveWorldEntityName(world, {type: "feature", id: `${roomId}.renamed-feature`})).toBe(
			feature.name,
		);
	});

	it("deletes a room and its connections and chooses a new start room", () => {
		const world = createTestWorld();
		const deletedId = idValue(world.startRoomId);

		expect(deleteWorldEntity(world, {type: "room", id: deletedId})).toBe(true);
		expect(world.rooms.some((room) => idValue(room.id) === deletedId)).toBe(false);
		expect(
			world.connections.some(
				(connection) =>
					idValue(connection.fromRoomId) === deletedId || idValue(connection.toRoomId) === deletedId,
			),
		).toBe(false);
		expect(idValue(world.startRoomId)).toBe(idValue(world.rooms[0].id));
	});

	it("does not resolve dormant item and NPC entity types", () => {
		const world = createTestWorld();
		expect(resolveWorldEntityId({id: {type: "item", id: "key"}}, world)).toBeUndefined();
		expect(resolveWorldEntityId({id: {type: "npc", id: "guard"}}, world)).toBeUndefined();
	});
});
