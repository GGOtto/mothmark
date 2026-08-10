import {createInitialWorld} from "./initialWorld";

describe("initialWorld", () => {
	it("creates a fresh world object for resets", () => {
		const first = createInitialWorld();
		const second = createInitialWorld();

		expect(first).toEqual(second);
		expect(first).not.toBe(second);
		expect(first.commands).not.toBe(second.commands);
	});

	it("keeps the starter example small and purposeful", () => {
		const world = createInitialWorld();
		expect(world.metadata.title).toBe("Corner Shop");
		expect(world.rooms).toHaveLength(4);
		expect(world.items).toHaveLength(2);
		expect(world.connections).toHaveLength(3);
	});
});
