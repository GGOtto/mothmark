import {produce} from "immer";
import type {Effect} from "@/schemas/world/effectSchema";
import {idValue, toID} from "@/utils/idUtils";
import {resolveTurn} from "../player/resolveTurn";
import {
	createPlayerTestEffectGroup,
	createPlayerTestEvent,
	createPlayerTestScenario,
} from "../utils/testUtils";

function scenarioWithEffects(effects: Effect[]) {
	const scenario = createPlayerTestScenario("navigation");
	const event = createPlayerTestEvent("player-effect", effects, (draft) => {
		draft.disposable = true;
	});
	const world = produce(scenario.world, (draft) => {
		draft.events = [event];
	});
	return {world, game: {...scenario.game, events: [event]}};
}

describe("effects through the player path", () => {
	it("changes feature presentation used by room output and examination", () => {
		const {world, game} = scenarioWithEffects([
			{
				type: "feature",
				operation: "change-name",
				roomId: toID("room", "foyer"),
				featureId: toID("feature", "brass-bell"),
				value: "Silver Bell",
			},
			{
				type: "feature",
				operation: "change-description",
				roomId: toID("room", "foyer"),
				featureId: toID("feature", "brass-bell"),
				value: "The newly silver bell gleams beside the doorway.",
			},
		]);

		const changedGame = resolveTurn(world, game, "help");
		const lookedGame = resolveTurn(world, changedGame, "look");
		const examinedGame = resolveTurn(world, lookedGame, "examine silver bell");

		expect(lookedGame.messages.at(-1)?.text).toContain(
			"The newly silver bell gleams beside the doorway.",
		);
		expect(examinedGame.messages.at(-1)).toMatchObject({
			type: "system",
			text: "The newly silver bell gleams beside the doorway.",
		});
	});

	it("hides and destroys features so the player can no longer see or examine them", () => {
		for (const operation of ["hide-from-player", "destroy"] as const) {
			const {world, game} = scenarioWithEffects([
				{
					type: "feature",
					operation,
					roomId: toID("room", "foyer"),
					featureId: toID("feature", "brass-bell"),
				},
			]);

			const changedGame = resolveTurn(world, game, "help");
			const lookedGame = resolveTurn(world, changedGame, "look");
			const examinedGame = resolveTurn(world, lookedGame, "examine bell");

			expect(lookedGame.messages.at(-1)?.text).not.toContain("small brass bell");
			expect(examinedGame.messages.at(-1)).toMatchObject({
				type: "system",
				text: "You don't see that here.",
			});
		}
	});

	it("moves a feature into another room, including its player-facing description", () => {
		const {world, game} = scenarioWithEffects([
			{
				type: "feature",
				operation: "move-to-room",
				roomId: toID("room", "foyer"),
				newRoomId: toID("room", "gallery"),
				featureId: toID("feature", "brass-bell"),
			},
		]);

		const movedGame = resolveTurn(world, game, "help");
		const galleryGame = resolveTurn(world, movedGame, "east");

		expect(galleryGame.messages.at(-1)?.text).toContain(
			"A small brass bell hangs beside the doorway.",
		);
		expect(resolveTurn(world, galleryGame, "examine bell").messages.at(-1)).toMatchObject({
			type: "system",
			text: "A small brass bell hangs beside the doorway.",
		});
	});

	it("changes room text used for a deliberate look and later revisit", () => {
		const {world, game} = scenarioWithEffects([
			{
				type: "room",
				operation: "set-name",
				roomId: toID("room", "foyer"),
				variantId: "Darkened Foyer",
			},
			{
				type: "room",
				operation: "set-description",
				roomId: toID("room", "foyer"),
				variantId: "Every lamp in the foyer has gone out.",
			},
			{
				type: "room",
				operation: "set-short-description",
				roomId: toID("room", "foyer"),
				variantId: "The foyer remains dark.",
			},
		]);

		const changedGame = resolveTurn(world, game, "help");
		const lookedGame = resolveTurn(world, changedGame, "look");
		const galleryGame = resolveTurn(world, lookedGame, "east");
		const returnedGame = resolveTurn(world, galleryGame, "west");

		expect(lookedGame.messages.at(-1)?.text).toContain(
			"Darkened Foyer\nEvery lamp in the foyer has gone out.",
		);
		expect(returnedGame.messages.at(-1)?.text).toContain("Darkened Foyer\nThe foyer remains dark.");
	});

	it("locks an exit before the player's next attempt to use it", () => {
		const {world, game} = scenarioWithEffects([
			{
				type: "room",
				operation: "lock-exit",
				roomId: toID("room", "foyer"),
				direction: "e",
			},
		]);

		const lockedGame = resolveTurn(world, game, "help");
		const blockedGame = resolveTurn(world, lockedGame, "east");

		expect(idValue(blockedGame.player.currentRoom)).toBe("foyer");
		expect(blockedGame.messages.at(-1)).toMatchObject({
			type: "system",
			text: "You can't go that way.",
		});
	});

	it("teleports the player with the destination room description", () => {
		const {world, game} = scenarioWithEffects([
			{type: "player", operation: "teleport", roomId: toID("room", "gallery")},
		]);

		const nextGame = resolveTurn(world, game, "help");

		expect(idValue(nextGame.player.currentRoom)).toBe("gallery");
		expect(nextGame.messages.at(-1)).toMatchObject({
			type: "room",
			text: expect.stringContaining("Test Gallery"),
		});
	});

	it("uses a kill effect's custom death message and ignores later commands", () => {
		const {world, game} = scenarioWithEffects([
			{
				type: "player",
				operation: "kill",
				customDeathMessage: "The bell tolls once, for you.",
			},
		]);

		const deadGame = resolveTurn(world, game, "help");
		const afterCommand = resolveTurn(world, deadGame, "look");

		expect(deadGame.messages.at(-1)).toMatchObject({
			type: "death",
			text: "The bell tolls once, for you.",
		});
		expect(afterCommand).toBe(deadGame);
	});

	it("freezes exactly the requested future turns, then accepts commands again", () => {
		const {world, game} = scenarioWithEffects([
			{
				type: "player",
				operation: "freeze",
				freezeMessage: "The clock holds you still.",
				turns: 2,
			},
		]);

		const frozenGame = resolveTurn(world, game, "help");
		const firstBlocked = resolveTurn(world, frozenGame, "look");
		const secondBlocked = resolveTurn(world, firstBlocked, "look");
		const releasedGame = resolveTurn(world, secondBlocked, "look");

		expect(firstBlocked.messages.at(-1)).toMatchObject({
			type: "error",
			text: "The clock holds you still.",
		});
		expect(secondBlocked.messages.at(-1)).toMatchObject({type: "error"});
		expect(releasedGame.messages.at(-1)).toMatchObject({type: "room"});
		expect(releasedGame.player.freezeState).toEqual({});
	});

	it("resolves saved effect references during a player turn", () => {
		const scenario = createPlayerTestScenario("navigation");
		const savedEffect = createPlayerTestEffectGroup("saved-chime", [
			{type: "message", operation: "show", message: "A saved chime rings."},
		]);
		const event = createPlayerTestEvent(
			"reference-event",
			[{type: "effect-ref", effectId: savedEffect.id}],
			(draft) => {
				draft.disposable = true;
			},
		);
		const world = produce(scenario.world, (draft) => {
			draft.effects = [savedEffect];
			draft.events = [event];
		});
		const game = {...scenario.game, events: [event]};

		const nextGame = resolveTurn(world, game, "help");

		expect(nextGame.messages.at(-1)).toMatchObject({
			type: "system",
			text: "A saved chime rings.",
		});
	});
});
