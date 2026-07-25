import {resolveTurn} from "../player/resolveTurn";
import {createPlayerTestScenario} from "../utils/testUtils";

describe("room messages through the player path", () => {
	it("introduces the starting room with its full description and visible features", () => {
		const {game} = createPlayerTestScenario("navigation");

		expect(game.messages).toEqual([
			expect.objectContaining({
				type: "room",
				text: expect.stringContaining(
					"Test Foyer\nA plain foyer provides a dependable starting point.",
				),
			}),
		]);
		expect(game.messages[0].text).toContain("A small brass bell hangs beside the doorway.");
	});

	it("does not leak a feature from one room into another room's description", () => {
		const {world, game} = createPlayerTestScenario("navigation");

		const galleryGame = resolveTurn(world, game, "east");

		expect(galleryGame.messages.at(-1)?.text).not.toContain("brass bell");
	});
});
