import {idValue} from "@/utils/idUtils";
import {resolveTurn} from "./player/resolveTurn";
import {createPlayerTestScenario} from "./testUtils";

describe("maintained engine player-test scenarios", () => {
	it("supports moving between rooms in the navigation scenario", () => {
		const {world, game} = createPlayerTestScenario("navigation");

		const nextGame = resolveTurn(world, game, "east");

		expect(idValue(nextGame.player.currentRoom)).toBe("gallery");
		expect(nextGame.messages.at(-1)).toMatchObject({type: "room"});
	});

	it("supports blocked movement in the conditional-travel scenario", () => {
		const {world, game} = createPlayerTestScenario("conditional-travel");

		const nextGame = resolveTurn(world, game, "north");

		expect(idValue(nextGame.player.currentRoom)).toBe("courtyard");
		expect(nextGame.messages.at(-1)).toMatchObject({
			type: "system",
			text: "You can't go that way.",
		});
	});

	it("resolves a disposable event from a player command in the turn-event scenario", () => {
		const {world, game} = createPlayerTestScenario("turn-event");

		const nextGame = resolveTurn(world, game, "help");

		expect(nextGame.messages).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "system",
					text: "The clockwork instrument chimes.",
				}),
				expect.objectContaining({type: "command", text: "help"}),
			]),
		);
		expect(nextGame.events).toEqual([]);
	});
});
