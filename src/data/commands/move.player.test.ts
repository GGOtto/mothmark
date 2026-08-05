import {resolveTurn} from "@/engine/player/resolveTurn";
import {createPlayerTestScenario} from "@/engine/utils/testUtils";
import {idValue} from "@/utils/idUtils";

describe("the initial move command through the player path", () => {
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
});
