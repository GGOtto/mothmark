import {resolveTurn} from "@/engine/player/resolveTurn";
import {createPlayerTestScenario} from "@/engine/utils/testUtils";
import {idValue} from "@/utils/idUtils";

describe("the initial move command through the player path", () => {
	it.each([
		"east",
		"e",
		"go east",
		"walk east",
		"move east",
		"travel east",
		"head east",
		"proceed east",
		"run east",
		"go to east",
		"go to the east",
	])("supports travel syntax: %s", (input) => {
		const {world, game} = createPlayerTestScenario("navigation");
		const next = resolveTurn(world, game, input);
		expect(idValue(next.player.currentRoom)).toBe("gallery");
		expect(next.messages.at(-1)).toMatchObject({type: "room"});
	});

	it("shows a full description on first arrival and a short description on return", () => {
		const {world, game} = createPlayerTestScenario("navigation");

		const firstArrival = resolveTurn(world, game, "east");
		const returned = resolveTurn(world, resolveTurn(world, firstArrival, "west"), "east");

		expect(idValue(firstArrival.player.currentRoom)).toBe("gallery");
		expect(firstArrival.messages.at(-1)).toMatchObject({
			type: "room",
			text: expect.stringContaining("A narrow gallery gives movement tests somewhere to go."),
		});
		expect(firstArrival.messages.at(-1)?.text).not.toContain("You are back in the test gallery.");

		expect(idValue(returned.player.currentRoom)).toBe("gallery");
		expect(returned.messages.at(-1)).toMatchObject({
			type: "room",
			text: expect.stringContaining("You are back in the test gallery."),
		});
		expect(returned.messages.at(-1)?.text).not.toContain(
			"A narrow gallery gives movement tests somewhere to go.",
		);
	});

	it("distinguishes an invalid direction from a valid but unavailable exit", () => {
		const {world, game} = createPlayerTestScenario("navigation");
		const invalid = resolveTurn(world, game, "go sideways");
		expect(invalid.messages.at(-1)).toMatchObject({
			type: "system",
			text: "That's not a direction you can go.",
		});
		expect(idValue(invalid.player.currentRoom)).toBe("foyer");

		const unavailable = resolveTurn(world, game, "north");
		expect(unavailable.messages.at(-1)).toMatchObject({
			type: "system",
			text: "You can't go that way.",
		});
		expect(idValue(unavailable.player.currentRoom)).toBe("foyer");
	});
});
