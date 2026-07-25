import {world as exampleWorld} from "@/data/worlds/exampleWorld";
import {GameStateSchema, type GameState} from "@/schemas/states/gameStateSchemas";
import {WorldSchema, type World} from "@/schemas/world/worldSchema";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {idValue, toID} from "@/utils/idUtils";
import {produce, type Draft} from "immer";
import {createInitialGameState} from "../states/createInitialState";
import {teleport} from "./teleport";

function createGame(recipe: (draft: Draft<GameState>) => void): GameState {
	const initialGame = createInitialGameState(exampleWorld, exampleWorld.startRoomId);
	const configuredGame = produce(initialGame, recipe);
	return {...createDefaultFieldObject(GameStateSchema), ...configuredGame};
}

function createWorld(recipe: (draft: Draft<World>) => void): World {
	const configuredWorld = produce(exampleWorld, recipe);
	return {...createDefaultFieldObject(WorldSchema), ...configuredWorld};
}

describe("teleport", () => {
	it("moves the player, preserves game progress, and marks the destination visited", () => {
		const game = createGame((draft) => {
			draft.player.currentRoom = toID("room", "guardroom");
			draft.player.turns = 7;
			draft.variables.flags = [{persisted: true}];
		});

		const nextGame = teleport(exampleWorld, game, toID("room", "guardroom"));

		expect(idValue(nextGame.player.currentRoom)).toBe("guardroom");
		expect(nextGame.player.turns).toBe(7);
		expect(nextGame.variables.flags).toEqual([{persisted: true}]);
		expect(
			nextGame.roomStates.find((roomState) => idValue(roomState.id) === "guardroom")?.flags.visited,
		).toBe(true);
		expect(nextGame.messages.at(-1)).toMatchObject({
			type: "room",
			roomId: toID("room", "guardroom"),
		});
	});

	it("reconciles missing destination and feature state from the authored world", () => {
		const game = createGame((draft) => {
			draft.roomStates = draft.roomStates.filter((state) => idValue(state.id) !== "guardroom");
		});

		const nextGame = teleport(exampleWorld, game, toID("room", "guardroom"));
		const roomState = nextGame.roomStates.find((state) => idValue(state.id) === "guardroom");
		const authoredRoom = exampleWorld.rooms.find((room) => idValue(room.id) === "guardroom");

		expect(roomState).toMatchObject({type: "room", flags: {visited: true}});
		expect(roomState?.featureStates.map((state) => idValue(state.id))).toEqual(
			authoredRoom?.features.map((feature) => idValue(feature.id)),
		);
	});

	it("blocks passage-based movement when the runtime active flag is false", () => {
		const world = createWorld((draft) => {
			const guardroom = draft.rooms.find((room) => idValue(room.id) === "guardroom");
			if (guardroom) guardroom.flags.active = true;
		});
		const initialGame = createInitialGameState(world, world.startRoomId);
		const configuredGame = produce(initialGame, (draft) => {
			const guardroom = draft.roomStates.find((state) => idValue(state.id) === "guardroom");
			if (guardroom) guardroom.flags.active = false;
		});
		const game = {...createDefaultFieldObject(GameStateSchema), ...configuredGame};

		const blockedGame = teleport(world, game, toID("room", "guardroom"), {
			respectActiveFlag: true,
		});
		const teleportedGame = teleport(world, game, toID("room", "guardroom"));

		expect(idValue(blockedGame.player.currentRoom)).toBe(idValue(game.player.currentRoom));
		expect(blockedGame.messages.at(-1)).toMatchObject({
			type: "system",
			text: "You can't go that way.",
		});
		expect(idValue(teleportedGame.player.currentRoom)).toBe("guardroom");
	});

	it("falls back to the authored active flag when runtime room state is missing", () => {
		const world = createWorld((draft) => {
			const guardroom = draft.rooms.find((room) => idValue(room.id) === "guardroom");
			if (guardroom) guardroom.flags.active = false;
		});
		const initialGame = createInitialGameState(world, world.startRoomId);
		const configuredGame = produce(initialGame, (draft) => {
			draft.roomStates = draft.roomStates.filter((state) => idValue(state.id) !== "guardroom");
		});
		const game = {...createDefaultFieldObject(GameStateSchema), ...configuredGame};

		const result = teleport(world, game, toID("room", "guardroom"), {
			respectActiveFlag: true,
		});

		expect(result.player.currentRoom).toEqual(game.player.currentRoom);
		expect(result.messages.at(-1)).toMatchObject({type: "system"});
	});
});
