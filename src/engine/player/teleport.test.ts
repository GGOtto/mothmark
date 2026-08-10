import {world as initialWorld} from "@/data/worlds/initialWorld";
import {GameStateSchema, type GameState} from "@/schemas/states/gameStateSchemas";
import {WorldSchema, type World} from "@/schemas/world/worldSchema";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {idValue, toID} from "@/utils/idUtils";
import {produce, type Draft} from "immer";
import {createInitialGameState} from "../states/createInitialState";
import {teleport} from "./teleport";

function createGame(recipe: (draft: Draft<GameState>) => void): GameState {
	const initialGame = createInitialGameState(initialWorld, initialWorld.startRoomId);
	const configuredGame = produce(initialGame, recipe);
	return {...createDefaultFieldObject(GameStateSchema), ...configuredGame};
}

function createWorld(recipe: (draft: Draft<World>) => void): World {
	const configuredWorld = produce(initialWorld, recipe);
	return {...createDefaultFieldObject(WorldSchema), ...configuredWorld};
}

describe("teleport", () => {
	it("moves the player, preserves game progress, and marks the destination visited", () => {
		const game = createGame((draft) => {
			draft.player.currentRoom = toID("room", "stockroom");
			draft.player.turns = 7;
			draft.variables.flags = [{persisted: true}];
		});

		const nextGame = teleport(initialWorld, game, toID("room", "stockroom"));

		expect(idValue(nextGame.player.currentRoom)).toBe("stockroom");
		expect(nextGame.player.turns).toBe(7);
		expect(nextGame.variables.flags).toEqual([{persisted: true}]);
		expect(
			nextGame.roomStates.find((roomState) => idValue(roomState.id) === "stockroom")?.flags.visited,
		).toBe(true);
		expect(nextGame.messages.at(-1)).toMatchObject({
			type: "room",
			roomId: toID("room", "stockroom"),
		});
	});

	it("reconciles missing destination state without rebuilding global item state", () => {
		const game = createGame((draft) => {
			draft.roomStates = draft.roomStates.filter((state) => idValue(state.id) !== "stockroom");
		});

		const nextGame = teleport(initialWorld, game, toID("room", "stockroom"));
		const roomState = nextGame.roomStates.find((state) => idValue(state.id) === "stockroom");

		expect(roomState).toMatchObject({type: "room", flags: {visited: true}});
		expect(nextGame.itemStates).toEqual(game.itemStates);
	});

	it("blocks passage-based movement when the runtime active flag is false", () => {
		const world = createWorld((draft) => {
			const guardroom = draft.rooms.find((room) => idValue(room.id) === "stockroom");
			if (guardroom) guardroom.flags.active = true;
		});
		const initialGame = createInitialGameState(world, world.startRoomId);
		const configuredGame = produce(initialGame, (draft) => {
			const guardroom = draft.roomStates.find((state) => idValue(state.id) === "stockroom");
			if (guardroom) guardroom.flags.active = false;
		});
		const game = {...createDefaultFieldObject(GameStateSchema), ...configuredGame};

		const blockedGame = teleport(world, game, toID("room", "stockroom"), {
			respectActiveFlag: true,
		});
		const teleportedGame = teleport(world, game, toID("room", "stockroom"));

		expect(idValue(blockedGame.player.currentRoom)).toBe(idValue(game.player.currentRoom));
		expect(blockedGame.messages.at(-1)).toMatchObject({
			type: "system",
			text: "You can't go that way.",
		});
		expect(idValue(teleportedGame.player.currentRoom)).toBe("stockroom");
	});

	it("falls back to the authored active flag when runtime room state is missing", () => {
		const world = createWorld((draft) => {
			const guardroom = draft.rooms.find((room) => idValue(room.id) === "stockroom");
			if (guardroom) guardroom.flags.active = false;
		});
		const initialGame = createInitialGameState(world, world.startRoomId);
		const configuredGame = produce(initialGame, (draft) => {
			draft.roomStates = draft.roomStates.filter((state) => idValue(state.id) !== "stockroom");
		});
		const game = {...createDefaultFieldObject(GameStateSchema), ...configuredGame};

		const result = teleport(world, game, toID("room", "stockroom"), {
			respectActiveFlag: true,
		});

		expect(result.player.currentRoom).toEqual(game.player.currentRoom);
		expect(result.messages.at(-1)).toMatchObject({type: "system"});
	});
});
