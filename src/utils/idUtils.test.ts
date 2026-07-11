import type {World} from "@/schemas/worldSchema";
import {
	deleteWorldEntity,
	generateUniqueId,
	resolveWorldEntityName,
	updateWorldEntityId,
	type Identifiable,
} from "./idUtils";

describe("generateUniqueId", () => {
	it("returns the first id when no existing items are provided", () => {
		expect(generateUniqueId("connection", [])).toBe("connection-1");
	});

	it("returns the first missing numbered id", () => {
		const existingItems: Identifiable[] = [{id: "connection-1"}, {id: "connection-2"}];

		expect(generateUniqueId("connection", existingItems)).toBe("connection-3");
	});

	it("reuses gaps left by deleted ids", () => {
		const existingItems: Identifiable[] = [{id: "connection-1"}, {id: "connection-3"}];

		expect(generateUniqueId("connection", existingItems)).toBe("connection-2");
	});

	it("ignores ids with a different prefix", () => {
		const existingItems: Identifiable[] = [{id: "room-1"}, {id: "room-2"}];

		expect(generateUniqueId("connection", existingItems)).toBe("connection-1");
	});

	it("works with room ids too", () => {
		const existingItems: Identifiable[] = [{id: "room-1"}, {id: "room-2"}, {id: "room-3"}];

		expect(generateUniqueId("room", existingItems)).toBe("room-4");
	});

	it("does not treat partial prefix matches as collisions", () => {
		const existingItems: Identifiable[] = [{id: "roommate-1"}, {id: "roommate-2"}];

		expect(generateUniqueId("room", existingItems)).toBe("room-1");
	});

	it("handles unsorted existing ids", () => {
		const existingItems: Identifiable[] = [
			{id: "connection-4"},
			{id: "connection-2"},
			{id: "connection-1"},
		];

		expect(generateUniqueId("connection", existingItems)).toBe("connection-3");
	});

	it("handles duplicate existing ids", () => {
		const existingItems: Identifiable[] = [
			{id: "connection-1"},
			{id: "connection-1"},
			{id: "connection-2"},
		];

		expect(generateUniqueId("connection", existingItems)).toBe("connection-3");
	});

	it("works with richer objects that have an id", () => {
		const existingItems = [
			{id: "connection-1", fromRoomId: "room-1", toRoomId: "room-2"},
			{id: "connection-2", fromRoomId: "room-2", toRoomId: "room-3"},
		];

		expect(generateUniqueId("connection", existingItems)).toBe("connection-3");
	});
});

describe("updateWorldEntityId", () => {
	it("updates a room id and known room references", () => {
		const world = createTestWorld();

		expect(updateWorldEntityId(world, "room", "foyer", "atrium")).toBe(true);

		expect(world.rooms[0].id).toBe("atrium");
		expect(world.startRoomId).toBe("atrium");
		expect(world.connections[0].fromRoomId).toBe("atrium");
		expect(world.items[0].initialLocation).toMatchObject({type: "room", roomId: "atrium"});
		expect(world.npcs[0].initialRoomId).toBe("atrium");
		expect(world.npcs[0].schedule[0].roomId).toBe("atrium");
	});

	it("returns false and leaves the world unchanged when the new id is a duplicate", () => {
		const world = createTestWorld();

		expect(updateWorldEntityId(world, "room", "foyer", "library")).toBe(false);

		expect(world.rooms.map((room) => room.id)).toEqual(["foyer", "library"]);
		expect(world.startRoomId).toBe("foyer");
		expect(world.connections[0].fromRoomId).toBe("foyer");
	});

	it("updates item id references in scalar and list fields", () => {
		const world = createTestWorld();

		expect(updateWorldEntityId(world, "item", "brass-key", "iron-key")).toBe(true);

		expect(world.items[0].id).toBe("iron-key");
		expect(world.rooms[0].features[0].initialItems).toEqual(["iron-key"]);
		expect(world.npcs[0].initialInventory).toEqual(["iron-key"]);
		expect(world.initialState.inventory).toEqual(["iron-key"]);
	});

	it("updates feature id references and scoped object references", () => {
		const world = createTestWorld();

		expect(updateWorldEntityId(world, "feature", "foyer.table", "desk")).toBe(true);

		expect(world.rooms[0].features[0].id).toBe("desk");
		expect(world.initialState.objectStates[0].objectId).toBe("foyer.desk");
		expect(
			(world.conditions[0] as unknown as {checks: Array<Record<string, unknown>>}).checks[0],
		).toMatchObject({featureId: "desk"});
	});

	it("resolves entity ids to display names", () => {
		const world = createTestWorld();

		expect(resolveWorldEntityName(world, "room", "foyer")).toBe("Foyer");
		expect(resolveWorldEntityName(world, "feature", "foyer.table")).toBe("Oak Table");
		expect(resolveWorldEntityName(world, "item", "missing")).toBeUndefined();
	});
});

describe("deleteWorldEntity", () => {
	it("deletes an entity and required dependents that reference it", () => {
		const world = createTestWorld();

		expect(deleteWorldEntity(world, "room", "foyer")).toBe(true);

		expect(world.rooms.map((room) => room.id)).toEqual(["library"]);
		expect(world.startRoomId).toBe("library");
		expect(world.connections).toEqual([]);
		expect(world.items).toEqual([]);
		expect(world.npcs[0].initialRoomId).toBeUndefined();
		expect(world.npcs[0].schedule).toEqual([]);
		expect((world.conditions[0] as unknown as {checks: unknown[]}).checks).toEqual([]);
		expect(world.initialState.objectStates).toEqual([]);
	});

	it("removes optional and list references without deleting surviving parents", () => {
		const world = createTestWorld();

		expect(deleteWorldEntity(world, "item", "brass-key")).toBe(true);

		expect(world.rooms.map((room) => room.id)).toEqual(["foyer", "library"]);
		expect(world.rooms[0].features[0].initialItems).toEqual([]);
		expect(world.npcs[0].initialInventory).toEqual([]);
		expect(world.initialState.inventory).toEqual([]);
	});

	it("returns false when the entity does not exist", () => {
		const world = createTestWorld();

		expect(deleteWorldEntity(world, "room", "missing")).toBe(false);
		expect(world.rooms.map((room) => room.id)).toEqual(["foyer", "library"]);
	});
});

function createTestWorld() {
	return {
		startRoomId: "foyer",
		rooms: [
			{
				id: "foyer",
				name: "Foyer",
				features: [
					{
						id: "table",
						name: "Oak Table",
						kind: "surface",
						initialItems: ["brass-key"],
					},
				],
			},
			{id: "library", name: "Library", features: []},
		],
		connections: [
			{
				id: "foyer-library",
				fromRoomId: "foyer",
				toRoomId: "library",
			},
		],
		conditions: [
			{
				id: "saw-table",
				name: "Saw Table",
				checks: [{type: "feature-examined", roomId: "foyer", featureId: "table"}],
			},
		],
		effects: [],
		items: [
			{
				id: "brass-key",
				name: "Brass Key",
				initialLocation: {type: "room", roomId: "foyer"},
			},
		],
		npcs: [
			{
				id: "cook",
				name: "Cook",
				initialRoomId: "foyer",
				initialInventory: ["brass-key"],
				knownTopics: ["rats"],
				schedule: [{id: "morning", roomId: "foyer"}],
			},
		],
		topics: [{id: "rats", name: "Rats"}],
		quests: [{id: "quest", name: "Quest", objectives: [{id: "objective", name: "Objective"}]}],
		authoredCommands: [],
		authoredEvents: [],
		initialState: {
			inventory: ["brass-key"],
			knownTopics: ["rats"],
			objectStates: [{objectId: "foyer.table", state: {}}],
		},
	} as unknown as World;
}
