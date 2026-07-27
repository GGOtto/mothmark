import {createExampleWorld, world} from "./exampleWorld";

describe("exampleWorld", () => {
	it("provides authored commands covering every command block and scope", () => {
		const blockTypes = new Set(
			world.commands.flatMap((command) =>
				command.patterns.flatMap((pattern) => pattern.blocks.map((block) => block.type)),
			),
		);
		const scopes = new Set(world.commands.map((command) => command.scope.scope));

		expect(world.commands).toHaveLength(7);
		expect(blockTypes).toEqual(
			new Set(["phrase", "relation", "target", "number", "direction", "choice", "text"]),
		);
		expect(scopes).toEqual(new Set(["global", "layers", "rooms"]));
	});

	it("creates a fresh world object for resets", () => {
		const first = createExampleWorld();
		const second = createExampleWorld();

		expect(first).toEqual(second);
		expect(first).not.toBe(second);
		expect(first.commands).not.toBe(second.commands);
	});
});
