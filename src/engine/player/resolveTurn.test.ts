import {world} from "@/data/worlds/exampleWorld";
import {idValue} from "@/utils/idUtils";
import {createInitialGameState} from "../states/createInitialState";
import {resolveTurn} from "./resolveTurn";

describe("resolveTurn", () => {
	it("creates output for the initial room and resolves commands immutably", () => {
		const game = createInitialGameState(world, world.startRoomId);
		const nextGame = resolveTurn(world, game, "help");

		expect(game.player.turns).toBe(0);
		expect(game.messages).toHaveLength(1);
		expect(game.messages[0]).toMatchObject({type: "room"});
		expect(nextGame.player.turns).toBe(1);
		expect(nextGame.messages.at(-2)).toMatchObject({type: "command", text: "help"});
		expect(nextGame.messages.at(-1)).toMatchObject({type: "system"});
	});

	it("moves the player and marks the destination as visited", () => {
		const game = createInitialGameState(world, world.startRoomId);
		const nextGame = resolveTurn(world, game, "east");

		expect(idValue(nextGame.player.currentRoom)).toBe("guardroom");
		expect(
			nextGame.roomStates.find((roomState) => idValue(roomState.id) === "guardroom")?.flags.visited,
		).toBe(true);
		expect(nextGame.messages.at(-1)).toMatchObject({type: "room"});
	});
});
