import {produce} from "immer";
import {resolveTurn} from "@/engine/player/resolveTurn";
import {createPlayerTestScenario} from "@/engine/utils/testUtils";
import {lookCommand} from "./initialCommands";

function scenarioWithLook() {
	const scenario = createPlayerTestScenario("navigation");
	return {
		...scenario,
		world: produce(scenario.world, (draft) => void draft.commands.push(lookCommand)),
	};
}

describe("the initial look command through the player path", () => {
	it.each(["look", "look around", "l", "look about"])("supports look syntax: %s", (input) => {
		const {world, game} = scenarioWithLook();
		const next = resolveTurn(world, game, input);
		expect(next.messages.at(-1)).toMatchObject({
			type: "room",
			text: expect.stringContaining("A plain foyer provides a dependable starting point."),
		});
	});

	it("always shows the full current-room description even after revisiting", () => {
		const {world, game} = scenarioWithLook();
		const revisited = resolveTurn(world, resolveTurn(world, game, "east"), "west");
		expect(revisited.messages.at(-1)?.text).toContain("You are back in the test foyer.");

		const looked = resolveTurn(world, revisited, "look");
		expect(looked.messages.at(-1)?.text).toContain(
			"A plain foyer provides a dependable starting point.",
		);
		expect(looked.messages.at(-1)?.text).not.toContain("You are back in the test foyer.");
	});
});
