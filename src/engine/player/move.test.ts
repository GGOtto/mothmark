import {world} from "@/data/worlds/exampleWorld";
import type {Effect} from "@/schemas/world/effectSchema";
import {idValue} from "@/utils/idUtils";
import {resolveRoomEffect} from "../effects/resolveSingleEffect";
import {createInitialGameState} from "../states/createInitialState";
import {move} from "./move";

describe("move", () => {
	it("blocks a locked exit and leaves the player in the current room", () => {
		const game = createInitialGameState(world, world.startRoomId);
		const lockedGame = resolveRoomEffect(game, {
			type: "room",
			operation: "lock-exit",
			roomId: world.startRoomId,
			direction: "e",
		} as Effect);

		const result = move(world, lockedGame, "e");

		expect(result.player.currentRoom).toEqual(game.player.currentRoom);
		expect(result.messages.at(-1)).toMatchObject({
			type: "system",
			text: "You can't go that way.",
		});
	});

	it("allows movement after the exit is unlocked", () => {
		const game = createInitialGameState(world, world.startRoomId);
		const lockedGame = resolveRoomEffect(game, {
			type: "room",
			operation: "lock-exit",
			roomId: world.startRoomId,
			direction: "e",
		} as Effect);
		const unlockedGame = resolveRoomEffect(lockedGame, {
			type: "room",
			operation: "unlock-exit",
			roomId: world.startRoomId,
			direction: "e",
		} as Effect);

		const result = move(world, unlockedGame, "e");

		expect(idValue(result.player.currentRoom)).toBe("guardroom");
		expect(result.messages.at(-1)).toMatchObject({type: "room"});
	});

	it("blocks every connection after all exits are locked", () => {
		const game = createInitialGameState(world, world.startRoomId);
		const lockedGame = resolveRoomEffect(game, {
			type: "room",
			operation: "lock-all-exits",
			roomId: world.startRoomId,
		} as Effect);

		for (const direction of ["up", "e", "s"] as const) {
			const result = move(world, lockedGame, direction);
			expect(result.player.currentRoom).toEqual(game.player.currentRoom);
			expect(result.messages.at(-1)).toMatchObject({type: "system"});
		}
	});
});
