import {produce} from "immer";
import {idValue} from "@/utils/idUtils";
import {resolveTurn} from "./resolveTurn";
import {createPlayerTestScenario} from "../utils/testUtils";

describe("movement through the player path", () => {
	it.each(["east", "e", "go east", "walk e"])("moves with the player command %s", (command) => {
		const {world, game} = createPlayerTestScenario("navigation");

		const nextGame = resolveTurn(world, game, command);

		expect(idValue(nextGame.player.currentRoom)).toBe("gallery");
		expect(nextGame.messages.at(-1)).toMatchObject({
			type: "room",
			text: expect.stringContaining("A narrow gallery gives movement tests somewhere to go."),
		});
	});

	it("uses the short description when returning to a visited room", () => {
		const {world, game} = createPlayerTestScenario("navigation");

		const inGallery = resolveTurn(world, game, "east");
		const backInFoyer = resolveTurn(world, inGallery, "west");

		expect(backInFoyer.messages.at(-1)).toMatchObject({
			type: "room",
			text: expect.stringContaining("You are back in the test foyer."),
		});
		expect(backInFoyer.messages.at(-1)?.text).not.toContain(
			"A plain foyer provides a dependable starting point.",
		);
	});

	it("honors one-way pathways in both directions", () => {
		const scenario = createPlayerTestScenario("navigation");
		const world = produce(scenario.world, (draft) => {
			draft.connections[0].pathway = "forwards";
		});

		const inGallery = resolveTurn(world, scenario.game, "east");
		const stillInGallery = resolveTurn(world, inGallery, "west");

		expect(idValue(stillInGallery.player.currentRoom)).toBe("gallery");
		expect(stillInGallery.messages.at(-1)).toMatchObject({
			type: "system",
			text: "You can't go that way.",
		});
	});
});
