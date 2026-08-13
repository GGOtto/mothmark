import {world} from "@/data/worlds/initialWorld";
import type {Effect} from "@/schemas/world/effectSchema";
import {idValue} from "@/utils/idUtils";
import {resolveNavigationEffect} from "../effects/resolveEffects";
import {createInitialGameState} from "../states/createInitialState";
import {isExitOpen, move, silentlyMove} from "./move";

describe("move", () => {
	it("reports whether a directional exit can currently be used", () => {
		const game = createInitialGameState(world, world.startRoomId);

		expect(isExitOpen(world, game, "e")).toBe(true);
		expect(isExitOpen(world, game, "w")).toBe(false);
	});

	it("moves silently and leaves blocked movement completely unchanged", () => {
		const game = createInitialGameState(world, world.startRoomId);

		const moved = silentlyMove(world, game, "e");
		const blocked = silentlyMove(world, game, "w");

		expect(idValue(moved.player.currentRoom)).toBe("stockroom");
		expect(moved.player.facing).toBe("e");
		expect(moved.messages).toEqual(game.messages);
		expect(blocked).toBe(game);
	});

	it("blocks a locked exit and leaves the player in the current room", () => {
		const game = createInitialGameState(world, world.startRoomId);
		const lockedGame = resolveNavigationEffect(world, game, {
			type: "navigation",
			operation: "lock-exit",
			roomId: world.startRoomId,
			direction: "e",
		} as Effect);

		const result = move(world, lockedGame, "e");

		expect(result.player.currentRoom).toEqual(game.player.currentRoom);
		expect(result.player.facing).toBe("n");
		expect(result.messages.at(-1)).toMatchObject({
			type: "system",
			text: "You can't go that way.",
		});
	});

	it("allows movement after the exit is unlocked", () => {
		const game = createInitialGameState(world, world.startRoomId);
		const lockedGame = resolveNavigationEffect(world, game, {
			type: "navigation",
			operation: "lock-exit",
			roomId: world.startRoomId,
			direction: "e",
		} as Effect);
		const unlockedGame = resolveNavigationEffect(world, lockedGame, {
			type: "navigation",
			operation: "unlock-exit",
			roomId: world.startRoomId,
			direction: "e",
		} as Effect);

		const result = move(world, unlockedGame, "e");

		expect(idValue(result.player.currentRoom)).toBe("stockroom");
		expect(result.player.facing).toBe("e");
		expect(result.messages.at(-1)).toMatchObject({type: "room"});
	});

	it("blocks every connection after all exits are locked", () => {
		const game = createInitialGameState(world, world.startRoomId);
		const lockedGame = resolveNavigationEffect(world, game, {
			type: "navigation",
			operation: "lock-all-exits",
			roomId: world.startRoomId,
		} as Effect);

		for (const direction of ["up", "e", "down"] as const) {
			const result = move(world, lockedGame, direction);
			expect(result.player.currentRoom).toEqual(game.player.currentRoom);
			expect(result.messages.at(-1)).toMatchObject({type: "system"});
		}
	});

	it("preserves horizontal facing for successful contextual movement", () => {
		const game = createInitialGameState(world, world.startRoomId);
		const moved = silentlyMove(world, game, "up");

		expect(moved).not.toBe(game);
		expect(moved.player.facing).toBe("n");
	});
});
