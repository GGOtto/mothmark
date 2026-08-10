/** @jest-environment node */

import {createPlayerTestScenario} from "@/engine/utils/testUtils";

import {resolveHostedCommand} from "./publicationRepository";

describe("hosted play through the player path", () => {
	it("resolves the exact submitted command through resolveTurn and captures only its output", () => {
		const {world, game} = createPlayerTestScenario("navigation");
		const turn = resolveHostedCommand(world, game, "", "east");

		expect(turn.commands).toBe("east");
		expect(turn.nextState.player.currentRoom).toEqual({type: "room", id: "gallery"});
		expect(turn.outputMessages[0]).toMatchObject({type: "command", text: "east"});
		expect(JSON.parse(turn.transcript)).toEqual(turn.nextState.messages);
	});

	it("preserves newline-delimited aggregate command boundaries", () => {
		const {world, game} = createPlayerTestScenario("navigation");
		const first = resolveHostedCommand(world, game, "", "east");
		const second = resolveHostedCommand(world, first.nextState, first.commands, "west");
		expect(second.commands).toBe("east\nwest");
		expect(second.nextState.player.currentRoom).toEqual({type: "room", id: "foyer"});
	});
});
