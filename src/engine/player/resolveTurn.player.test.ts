import {resolveTurn} from "./resolveTurn";
import {createPlayerTestScenario} from "../testUtils";

describe("turn resolution through the player path", () => {
	it("does not spend a turn or add output for blank input", () => {
		const {world, game} = createPlayerTestScenario("navigation");

		const nextGame = resolveTurn(world, game, "   ");

		expect(nextGame).toEqual(game);
		expect(nextGame.player.turns).toBe(0);
		expect(nextGame.messages).toHaveLength(1);
	});

	it("echoes the player's original command while matching it case-insensitively", () => {
		const {world, game} = createPlayerTestScenario("navigation");

		const nextGame = resolveTurn(world, game, "  LoOk  ");

		expect(nextGame.messages.at(-2)).toMatchObject({
			type: "command",
			text: "  LoOk  ",
		});
		expect(nextGame.messages.at(-1)).toMatchObject({type: "room"});
	});

	it("increments one turn per accepted command without mutating prior state", () => {
		const {world, game} = createPlayerTestScenario("navigation");

		const firstTurn = resolveTurn(world, game, "help");
		const secondTurn = resolveTurn(world, firstTurn, "look");

		expect(game.player.turns).toBe(0);
		expect(game.messages).toHaveLength(1);
		expect(firstTurn.player.turns).toBe(1);
		expect(secondTurn.player.turns).toBe(2);
	});
});
