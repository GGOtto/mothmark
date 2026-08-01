import {getHigherPriorityCommand} from "@/engine/commands/getHigherPriorityCommand";
import {findMatchingCommands} from "@/engine/commands/parse";
import {createInitialGameState} from "@/engine/states/createInitialState";
import {idValue} from "@/utils/idUtils";
import {createExampleWorld, world} from "./exampleWorld";

function matchingCommandIds(text: string) {
	const game = createInitialGameState(world, world.startRoomId);
	return findMatchingCommands(text, world, game).map((match) => idValue(match.command.id));
}

function winningCommandId(text: string) {
	const game = createInitialGameState(world, world.startRoomId);
	const matches = findMatchingCommands(text, world, game);
	return matches.length
		? idValue(matches.map((match) => match.command).reduce(getHigherPriorityCommand).id)
		: undefined;
}

describe("exampleWorld", () => {
	it("provides authored commands covering every command block and scope", () => {
		const blockTypes = new Set(
			world.commands.flatMap((command) =>
				command.patterns.flatMap((pattern) => pattern.blocks.map((block) => block.type)),
			),
		);
		const scopes = new Set(world.commands.map((command) => command.scope.scope));

		expect(world.commands).toHaveLength(11);
		expect(blockTypes).toEqual(
			new Set(["phrase", "relation", "target", "number", "direction", "choice", "text"]),
		);
		expect(scopes).toEqual(new Set(["global", "layers", "rooms"]));
	});

	it("includes a structured write command that conflicts with the global text fallback", () => {
		expect(matchingCommandIds("write on torch")).toEqual(
			expect.arrayContaining(["write-text", "write-on-target"]),
		);
		expect(winningCommandId("write on torch")).toBe("write-on-target");
	});

	it("includes an explicitly targeted touch command that conflicts with the general target", () => {
		expect(matchingCommandIds("touch torch")).toEqual(
			expect.arrayContaining(["touch-target", "touch-abandoned-torch"]),
		);
		expect(winningCommandId("touch torch")).toBe("touch-abandoned-torch");
	});

	it("creates a fresh world object for resets", () => {
		const first = createExampleWorld();
		const second = createExampleWorld();

		expect(first).toEqual(second);
		expect(first).not.toBe(second);
		expect(first.commands).not.toBe(second.commands);
	});
});
