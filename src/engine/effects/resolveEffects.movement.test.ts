import {MessageEffectSchema, NavigationEffectSchema} from "@/schemas/world/effectSchema";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {idValue} from "@/utils/idUtils";
import {createPlayerTestScenario} from "../utils/testUtils";
import {resolveMessageEffect, resolveNavigationEffect} from "./resolveEffects";

describe("movement-related effects", () => {
	it("shows the current room's full description and listed features", () => {
		const {world, game} = createPlayerTestScenario("navigation");
		const effect = MessageEffectSchema.parse({
			...createDefaultFieldObject(MessageEffectSchema),
			operation: "describe-current-room",
			allowShorten: false,
		});

		const result = resolveMessageEffect(world, game, effect);

		expect(result.messages.at(-1)).toMatchObject({
			type: "room",
			text: expect.stringContaining("A plain foyer provides a dependable starting point."),
		});
		expect(result.messages.at(-1)?.text).toContain("A small brass bell hangs beside the doorway.");
	});

	it("moves in an open direction without adding output and ignores blocked movement", () => {
		const {world, game} = createPlayerTestScenario("navigation");
		const openEffect = NavigationEffectSchema.parse({
			...createDefaultFieldObject(NavigationEffectSchema),
			operation: "move-in-direction",
			direction: "e",
		});
		const blockedEffect = NavigationEffectSchema.parse({
			...createDefaultFieldObject(NavigationEffectSchema),
			operation: "move-in-direction",
			direction: "w",
		});

		const moved = resolveNavigationEffect(world, game, openEffect);
		const blocked = resolveNavigationEffect(world, game, blockedEffect);

		expect(idValue(moved.player.currentRoom)).toBe("gallery");
		expect(moved.messages).toEqual(game.messages);
		expect(blocked).toBe(game);
	});

	it("sets facing without moving the player", () => {
		const {world, game} = createPlayerTestScenario("navigation");
		const effect = NavigationEffectSchema.parse({
			...createDefaultFieldObject(NavigationEffectSchema),
			operation: "set-facing",
			direction: "sw",
		});

		const result = resolveNavigationEffect(world, game, effect);

		expect(result.player.currentRoom).toEqual(game.player.currentRoom);
		expect(result.player.facing).toBe("sw");
		expect(result.messages).toEqual(game.messages);
	});
});
