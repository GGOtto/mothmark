import {world} from "./exampleWorld";

describe("exampleWorld", () => {
	it("defaults rooms to active", () => {
		expect(world.rooms).toHaveLength(11);
		expect(world.rooms.every((room) => room.flags.active)).toBe(true);
	});
});
