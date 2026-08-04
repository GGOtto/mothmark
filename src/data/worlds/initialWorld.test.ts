import {getHigherPriorityCommand} from "@/engine/commands/getHigherPriorityCommand";
import {findMatchingCommands} from "@/engine/commands/parse";
import {createInitialGameState} from "@/engine/states/createInitialState";
import {idValue} from "@/utils/idUtils";
import {createInitialWorld, world} from "./initialWorld";

describe("initialWorld", () => {
	it("creates a fresh world object for resets", () => {
		const first = createInitialWorld();
		const second = createInitialWorld();

		expect(first).toEqual(second);
		expect(first).not.toBe(second);
		expect(first.commands).not.toBe(second.commands);
	});
});
