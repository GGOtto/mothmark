import {world} from "@/data/worlds/initialWorld";
import {EventSchema} from "@/schemas/world/eventSchema";
import {EffectGroupSchema} from "@/schemas/world/effectSchema";
import {WorldSchema} from "@/schemas/world/worldSchema";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {idValue, toID} from "@/utils/idUtils";
import {produce} from "immer";
import {createInitialGameState} from "../states/createInitialState";
import {resolveTurn} from "./resolveTurn";

describe("resolveTurn", () => {
	it("reports an unknown command without mutating the initial game", () => {
		const game = createInitialGameState(world, world.startRoomId);
		const nextGame = resolveTurn(world, game, "help");

		expect(game.player.turns).toBe(0);
		expect(game.messages).toHaveLength(1);
		expect(game.messages[0]).toMatchObject({type: "room"});
		expect(nextGame.player.turns).toBe(1);
		expect(nextGame.messages.at(-2)).toMatchObject({type: "command", text: "help"});
		expect(nextGame.messages.at(-1)).toMatchObject({
			type: "error",
			text: "I don't know what that means.",
		});
	});

	it("moves the player and marks the destination as visited", () => {
		const game = createInitialGameState(world, world.startRoomId);
		const nextGame = resolveTurn(world, game, "east");

		expect(idValue(nextGame.player.currentRoom)).toBe("stockroom");
		expect(
			nextGame.roomStates.find((roomState) => idValue(roomState.id) === "stockroom")?.flags.visited,
		).toBe(true);
		expect(nextGame.messages.at(-1)).toMatchObject({type: "room"});
	});

	it("resolves events after the player's command and its immediate output", () => {
		const eventEffect = produce(createDefaultFieldObject(EffectGroupSchema), (draft) => {
			draft.effects = [
				{
					type: "message",
					operation: "show",
					message: "The event resolves.",
				},
			];
		});
		const event = produce(createDefaultFieldObject(EventSchema), (draft) => {
			draft.id = toID("event", "turn-event");
			draft.name = "Turn event";
			draft.disposable = true;
			draft.branch.always = eventEffect;
		});
		const configuredWorld = produce(world, (draft) => {
			draft.events = [event];
		});
		const worldWithEvent = {
			...createDefaultFieldObject(WorldSchema),
			...configuredWorld,
		};
		const game = createInitialGameState(worldWithEvent, worldWithEvent.startRoomId);

		const nextGame = resolveTurn(worldWithEvent, game, "help");

		expect(nextGame.messages.slice(1)).toEqual([
			expect.objectContaining({type: "command", text: "help"}),
			expect.objectContaining({type: "error", text: "I don't know what that means."}),
			expect.objectContaining({type: "system", text: "The event resolves."}),
		]);
		expect(nextGame.events).toEqual([]);
		expect(nextGame.player.turns).toBe(1);
		expect(game.events).toEqual([event]);
	});
});
