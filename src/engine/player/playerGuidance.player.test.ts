import {produce} from "immer";
import {
	helpCommand,
	listExitsCommand,
	moveCommand,
	rawInitialCommands,
} from "@/data/commands/initialCommands";
import {idValue} from "@/utils/idUtils";
import {createPlayerTestScenario} from "../utils/testUtils";
import {resolveTurn} from "./resolveTurn";

function guidanceScenario(commands = [helpCommand, listExitsCommand, moveCommand]) {
	const scenario = createPlayerTestScenario("navigation");
	return {
		...scenario,
		world: produce(scenario.world, (draft) => {
			draft.commands = commands;
		}),
	};
}

describe("player guidance through the player path", () => {
	it.each([
		"help",
		"commands",
		"list commands",
		"show commands",
		"instructions",
		"how do I play",
		"what can I do",
		"?",
	])("shows help with the player alias %s", (input) => {
		const {world, game} = guidanceScenario(rawInitialCommands);
		const next = resolveTurn(world, game, input);

		expect(next.messages.at(-1)).toMatchObject({
			type: "system",
			text: expect.stringContaining("help — Show useful commands."),
		});
		expect(next.messages.at(-1)?.text).toContain(
			"list exits — Show directions you can currently travel.",
		);
	});

	it.each([
		"list exits",
		"exits",
		"show exits",
		"available exits",
		"where can I go",
		"which way can I go",
		"ways out",
	])("lists exits with the player alias %s", (input) => {
		const {world, game} = guidanceScenario();
		expect(resolveTurn(world, game, input).messages.at(-1)).toMatchObject({
			type: "system",
			text: "Available exits: east.",
		});
	});

	it("reports no exits when the only destination becomes unavailable", () => {
		const {world, game} = guidanceScenario();
		const locked = produce(game, (draft) => {
			draft.roomStates.find((room) => room.id.id === "foyer")?.lockedExits.push("e");
		});

		expect(resolveTurn(world, locked, "exits").messages.at(-1)).toMatchObject({
			type: "system",
			text: "There are no visible exits.",
		});
	});

	it("does not reveal an inactive destination as an exit", () => {
		const {world, game} = guidanceScenario();
		const hiddenDestination = produce(game, (draft) => {
			const gallery = draft.roomStates.find((room) => room.id.id === "gallery");
			if (gallery) gallery.flags.active = false;
		});

		expect(resolveTurn(world, hiddenDestination, "list exits").messages.at(-1)?.text).toBe(
			"There are no visible exits.",
		);
	});

	it("keeps singular exit as movement while plural exits requests guidance", () => {
		const scenario = guidanceScenario();
		const world = produce(scenario.world, (draft) => {
			draft.connections[0].direction = "out";
			draft.connections[0].returnDirection = "in";
		});

		const moved = resolveTurn(world, scenario.game, "exit");
		expect(idValue(moved.player.currentRoom)).toBe("gallery");
		expect(resolveTurn(world, scenario.game, "exits").messages.at(-1)?.text).toBe(
			"Available exits: out.",
		);
	});

	it("shows the no-opt-in help state through the saved help command", () => {
		const hiddenHelp = produce(helpCommand, (command) => {
			command.showInHelp = false;
		});
		const {world, game} = guidanceScenario([hiddenHelp]);

		expect(resolveTurn(world, game, "help").messages.at(-1)?.text).toBe(
			"No commands are currently listed. Try commands again when your surroundings change.",
		);
	});

	it("does not run a disabled guidance command", () => {
		const disabledHelp = produce(helpCommand, (command) => {
			command.enabled = false;
		});
		const {world, game} = guidanceScenario([disabledHelp]);

		expect(resolveTurn(world, game, "help").messages.at(-1)).toMatchObject({
			type: "error",
			text: "I don't know what that means.",
		});
	});
});
