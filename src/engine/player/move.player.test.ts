import {produce} from "immer";
import {idValue} from "@/utils/idUtils";
import {resolveTurn} from "./resolveTurn";
import {createPlayerTestScenario} from "../utils/testUtils";
import {faceCommand, lookCommand} from "@/data/commands/initialCommands";

function relativeScenario() {
	const scenario = createPlayerTestScenario("navigation");
	return {
		...scenario,
		world: produce(scenario.world, (draft) => {
			draft.commands.push(faceCommand, lookCommand);
		}),
	};
}

describe("movement through the player path", () => {
	it.each(["east", "e", "go east", "walk e"])("moves with the player command %s", (command) => {
		const {world, game} = createPlayerTestScenario("navigation");

		const nextGame = resolveTurn(world, game, command);

		expect(idValue(nextGame.player.currentRoom)).toBe("gallery");
		expect(nextGame.player.facing).toBe("e");
		expect(nextGame.messages.at(-1)).toMatchObject({
			type: "room",
			text: expect.stringContaining("A narrow gallery gives movement tests somewhere to go."),
		});
	});

	it.each(["forwards", "forward", "straight", "ahead"])(
		"moves through Travel with the forward alias %s",
		(command) => {
			const {world, game} = relativeScenario();
			const facingEast = resolveTurn(world, game, "face east");
			const moved = resolveTurn(world, facingEast, command);

			expect(idValue(moved.player.currentRoom)).toBe("gallery");
			expect(moved.player.facing).toBe("e");
		},
	);

	it.each(["backwards", "backward", "back"])(
		"moves through Travel with the backward alias %s",
		(command) => {
			const {world, game} = relativeScenario();
			const facingWest = resolveTurn(world, game, "turn west");
			const moved = resolveTurn(world, facingWest, command);

			expect(idValue(moved.player.currentRoom)).toBe("gallery");
			expect(moved.player.facing).toBe("e");
		},
	);

	it.each(["right", "go right", "walk right", "travel to the right"])(
		"keeps every existing Travel pattern for relative input: %s",
		(command) => {
			const {world, game} = relativeScenario();
			const moved = resolveTurn(world, game, command);

			expect(idValue(moved.player.currentRoom)).toBe("gallery");
			expect(moved.player.facing).toBe("e");
		},
	);

	it("resolves left from the current facing", () => {
		const {world, game} = relativeScenario();
		const facingSouth = resolveTurn(world, game, "face south");
		const moved = resolveTurn(world, facingSouth, "go left");

		expect(idValue(moved.player.currentRoom)).toBe("gallery");
		expect(moved.player.facing).toBe("e");
	});

	it("does not change facing after failed absolute or relative movement or look", () => {
		const {world, game} = relativeScenario();
		const failedAbsolute = resolveTurn(world, game, "west");
		const failedRelative = resolveTurn(world, failedAbsolute, "forward");
		const looked = resolveTurn(world, failedRelative, "look");

		expect(idValue(looked.player.currentRoom)).toBe("foyer");
		expect(failedAbsolute.player.facing).toBe("n");
		expect(failedRelative.player.facing).toBe("n");
		expect(looked.player.facing).toBe("n");
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
