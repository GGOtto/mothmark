import {
	createDefaultConnection,
	createDefaultFeature,
	createDefaultRoom,
} from "./createDefaultWorld";

describe("map metadata defaults", () => {
	it("stores room positions in required metadata", () => {
		const room = createDefaultRoom("room-1", "Room", {x: 12, y: 34});
		expect(room.metadata.position).toEqual({x: 12, y: 34});
		expect(room).not.toHaveProperty("position");
	});

	it("creates connections with optional stub metadata", () => {
		const connection = createDefaultConnection({
			id: "connection-1",
			fromRoomId: "room-1",
			toRoomId: "room-2",
			direction: "e",
			returnDirection: "w",
		});
		expect(connection.metadata).toEqual({});
	});
});

describe("createDefaultFeature", () => {
	it("creates a valid room feature with editable blank content", () => {
		expect(createDefaultFeature("feature-1")).toMatchObject({
			id: {type: "feature", id: "feature-1"},
			name: "New feature",
			aliases: [],
			tags: [],
			kind: "feature",
			description: {
				default: "",
				variants: [],
			},
			activeWhen: [],
			visibleWhen: [],
			usableWhen: [],
			initialItems: [],
		});
	});
});
