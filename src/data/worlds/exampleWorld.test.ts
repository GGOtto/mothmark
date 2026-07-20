import {world} from "./exampleWorld";

describe("exampleWorld", () => {
	it("defaults room conditions to an empty all group", () => {
		expect(world.rooms).toHaveLength(11);
		expect(
			world.rooms.every(
				(room) =>
					room.activeWhen.type === "group" &&
					room.activeWhen.operation === "all" &&
					room.activeWhen.conditions.length === 0,
			),
		).toBe(true);
	});
});
