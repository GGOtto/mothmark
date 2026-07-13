import {world} from "./exampleWorld";

describe("example world authoring data", () => {
	it("preserves room and feature aliases, tags, and features after parsing", () => {
		const entrance = world.rooms.find((room) => room.id.id === "dungeon-entrance");

		expect(entrance).toMatchObject({
			aliases: ["entrance", "stairs"],
			tags: ["dungeon", "main-level"],
		});
		expect(entrance?.features).toHaveLength(2);
		expect(entrance?.features[0]).toMatchObject({
			aliases: ["arch", "doorway"],
			tags: ["room-feature"],
		});
	});
});
