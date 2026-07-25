import {produce} from "immer";
import {idValue, toID} from "@/utils/idUtils";
import {resolveTurn} from "./resolveTurn";
import {createPlayerTestEvent, createPlayerTestScenario} from "../testUtils";

describe("teleportation through the player path", () => {
	it("uses room move effects as a real arrival, including room output and visited state", () => {
		const scenario = createPlayerTestScenario("navigation");
		const event = createPlayerTestEvent(
			"room-move",
			[{type: "room", operation: "move-player-to", roomId: toID("room", "gallery")}],
			(draft) => {
				draft.disposable = true;
			},
		);
		const world = produce(scenario.world, (draft) => {
			draft.events = [event];
		});
		const game = {...scenario.game, events: [event]};

		const nextGame = resolveTurn(world, game, "help");

		expect(idValue(nextGame.player.currentRoom)).toBe("gallery");
		expect(nextGame.messages.at(-1)).toMatchObject({
			type: "room",
			text: expect.stringContaining("Test Gallery"),
		});
		expect(nextGame.roomStates.find((room) => idValue(room.id) === "gallery")?.flags.visited).toBe(
			true,
		);
	});

	it("preserves destroyed features across later room visits", () => {
		const scenario = createPlayerTestScenario("navigation");
		const event = createPlayerTestEvent(
			"destroy-bell",
			[
				{
					type: "feature",
					operation: "destroy",
					roomId: toID("room", "foyer"),
					featureId: toID("feature", "brass-bell"),
				},
			],
			(draft) => {
				draft.disposable = true;
			},
		);
		const world = produce(scenario.world, (draft) => {
			draft.events = [event];
		});
		const game = {...scenario.game, events: [event]};

		const destroyedGame = resolveTurn(world, game, "help");
		const galleryGame = resolveTurn(world, destroyedGame, "east");
		const returnedGame = resolveTurn(world, galleryGame, "west");

		expect(returnedGame.messages.at(-1)?.text).not.toContain("brass bell");
		expect(
			returnedGame.roomStates
				.find((room) => idValue(room.id) === "foyer")
				?.featureStates.some((feature) => idValue(feature.id) === "brass-bell"),
		).toBe(false);
	});
});
