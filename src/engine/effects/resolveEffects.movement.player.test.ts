import {produce} from "immer";
import {
	MessageEffectSchema,
	NavigationEffectSchema,
	type Effect,
} from "@/schemas/world/effectSchema";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {idValue} from "@/utils/idUtils";
import {resolveTurn} from "../player/resolveTurn";
import {createPlayerTestEvent, createPlayerTestScenario} from "../utils/testUtils";

function scenarioWithEffects(effects: Effect[]) {
	const scenario = createPlayerTestScenario("navigation");
	const event = createPlayerTestEvent("movement-effect", effects, (draft) => {
		draft.disposable = true;
	});
	const world = produce(scenario.world, (draft) => {
		draft.events = [event];
	});
	return {world, game: {...scenario.game, events: [event]}};
}

function currentRoomDescriptionEffect(): Effect {
	return MessageEffectSchema.parse({
		...createDefaultFieldObject(MessageEffectSchema),
		operation: "describe-current-room",
		allowShorten: false,
	});
}

function moveInDirectionEffect(direction: "e" | "w"): Effect {
	return NavigationEffectSchema.parse({
		...createDefaultFieldObject(NavigationEffectSchema),
		operation: "move-in-direction",
		direction,
	});
}

describe("movement-related effects through the player path", () => {
	it("shows the current room description with its listed features", () => {
		const {world, game} = scenarioWithEffects([currentRoomDescriptionEffect()]);

		const nextGame = resolveTurn(world, game, "help");

		expect(nextGame.messages.at(-1)).toMatchObject({
			type: "room",
			text: expect.stringContaining("A plain foyer provides a dependable starting point."),
		});
		expect(nextGame.messages.at(-1)?.text).toContain("A small brass bell hangs beside the doorway.");
		expect(nextGame.messages.at(-1)?.text).toContain(
			"A plain foyer provides a dependable starting point.\n A small brass bell hangs beside the doorway.",
		);
	});

	it("moves in a direction without producing movement output", () => {
		const {world, game} = scenarioWithEffects([moveInDirectionEffect("e")]);

		const nextGame = resolveTurn(world, game, "help");

		expect(idValue(nextGame.player.currentRoom)).toBe("gallery");
		expect(
			nextGame.messages.slice(game.messages.length).some((message) => message.type === "room"),
		).toBe(false);
	});

	it("silently ignores movement when no exit is open", () => {
		const {world, game} = scenarioWithEffects([moveInDirectionEffect("w")]);

		const nextGame = resolveTurn(world, game, "help");

		expect(idValue(nextGame.player.currentRoom)).toBe("foyer");
		expect(nextGame.messages.some((message) => message.text === "You can't go that way.")).toBe(
			false,
		);
	});
});
