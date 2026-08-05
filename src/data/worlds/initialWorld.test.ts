import {createInitialWorld} from "./initialWorld";

describe("initialWorld", () => {
	it("creates a fresh world object for resets", () => {
		const first = createInitialWorld();
		const second = createInitialWorld();

		expect(first).toEqual(second);
		expect(first).not.toBe(second);
		expect(first.commands).not.toBe(second.commands);
	});
});
