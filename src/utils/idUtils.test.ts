import {generateUniqueId, type Identifiable} from "./idUtils";

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
