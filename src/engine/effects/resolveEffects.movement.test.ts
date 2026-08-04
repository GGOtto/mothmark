import {MessageEffectSchema, PlayerEffectSchema} from "@/schemas/world/effectSchema";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {idValue} from "@/utils/idUtils";
import {createPlayerTestScenario} from "../utils/testUtils";
import {resolveMessageEffect, resolvePlayerEffect} from "./resolveEffects";

describe("movement-related effects", () => {
	it("shows the current room's full description and listed features", () => {
		const {world, game} = createPlayerTestScenario("navigation");
		const effect = MessageEffectSchema.parse({
			...createDefaultFieldObject(MessageEffectSchema),
			operation: "current-room-description",
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
		const openEffect = PlayerEffectSchema.parse({
			...createDefaultFieldObject(PlayerEffectSchema),
			operation: "move-in-direction",
			direction: "e",
		});
		const blockedEffect = PlayerEffectSchema.parse({
			...createDefaultFieldObject(PlayerEffectSchema),
			operation: "move-in-direction",
			direction: "w",
		});

		const moved = resolvePlayerEffect(world, game, openEffect);
		const blocked = resolvePlayerEffect(world, game, blockedEffect);

		expect(idValue(moved.player.currentRoom)).toBe("gallery");
		expect(moved.messages).toEqual(game.messages);
		expect(blocked).toBe(game);
	});
});
