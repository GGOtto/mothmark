import {idValue} from "@/utils/idUtils";
import {resolveTurn} from "../player/resolveTurn";
import {createPlayerTestScenario} from "../utils/testUtils";

describe("commands through the player path", () => {
	it("shows the full room description when the player explicitly looks", () => {
		const {world, game} = createPlayerTestScenario("navigation");

		const nextGame = resolveTurn(world, game, "look");

		expect(nextGame.messages.slice(-2)).toEqual([
			expect.objectContaining({type: "command", text: "look"}),
			expect.objectContaining({
				type: "room",
				text: expect.stringContaining("A plain foyer provides a dependable starting point."),
			}),
		]);
		expect(nextGame.messages.at(-1)?.text).not.toContain("You are back in the test foyer.");
	});

	it("examines a visible feature by name, alias, or leading article", () => {
		const {world, game} = createPlayerTestScenario("navigation");

		for (const command of ["examine brass bell", "inspect bell", "x the bell"]) {
			const nextGame = resolveTurn(world, game, command);
			const bellState = nextGame.roomStates
				.find((room) => idValue(room.id) === "foyer")
				?.featureStates.find((feature) => idValue(feature.id) === "brass-bell");

			expect(nextGame.messages.at(-1)).toMatchObject({
				type: "system",
				text: "A small brass bell hangs beside the doorway.",
			});
			expect(bellState?.flags.examined).toBe(true);
		}
	});

	it("does not pretend an unknown feature exists", () => {
		const {world, game} = createPlayerTestScenario("navigation");

		const nextGame = resolveTurn(world, game, "examine moon");

		expect(nextGame.messages.at(-1)).toMatchObject({
			type: "system",
			text: "You don't see that here.",
		});
	});

	it("prompts for incomplete commands and explains unknown commands", () => {
		const {world, game} = createPlayerTestScenario("navigation");

		expect(resolveTurn(world, game, "examine").messages.at(-1)).toMatchObject({
			type: "system",
			text: "Examine what?",
		});
		expect(resolveTurn(world, game, "go").messages.at(-1)).toMatchObject({
			type: "system",
			text: "Go where?",
		});
		expect(resolveTurn(world, game, "sing").messages.at(-1)).toMatchObject({
			type: "system",
			text: "I don't understand that command.",
		});
	});

	it("lists only commands the player can currently use", () => {
		const {world, game} = createPlayerTestScenario("navigation");

		const nextGame = resolveTurn(world, game, "help");

		expect(nextGame.messages.at(-1)).toMatchObject({
			type: "system",
			text: [
				"look (look, l): Look around the current room.",
				"examine (examine, inspect, look at, x): Examine something more closely.",
				"go (go, walk, move, go to): Move in a direction.",
				"help (help, h, ?): Show available commands.",
			].join("\n"),
		});
	});
});
