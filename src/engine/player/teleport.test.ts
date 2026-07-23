import {world as exampleWorld} from "@/data/worlds/exampleWorld";
import type {GameState} from "@/schemas/states/gameStateSchemas";
import type {World} from "@/schemas/world/worldSchema";
import {idValue, toID} from "@/utils/idUtils";
import {createInitialGameState} from "../states/createInitialState";
import {teleport} from "./teleport";

describe("teleport", () => {
	it("moves the player, preserves game progress, and marks the destination visited", () => {
		const initialGame = createInitialGameState(exampleWorld, exampleWorld.startRoomId);
		const game: GameState = {
			...initialGame,
			player: {
				currentRoom: {type: "room", id: "guardroom"},
				turns: 7,
				freezeState: {},
			},
			variables: {
				...initialGame.variables,
				flags: [{persisted: true}],
			},
		};

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
		const initialGame = createInitialGameState(exampleWorld, exampleWorld.startRoomId);
		const game: GameState = {
			...initialGame,
			roomStates: initialGame.roomStates.filter((state) => idValue(state.id) !== "guardroom"),
		};

		const nextGame = teleport(exampleWorld, game, toID("room", "guardroom"));
		const roomState = nextGame.roomStates.find((state) => idValue(state.id) === "guardroom");
		const authoredRoom = exampleWorld.rooms.find((room) => idValue(room.id) === "guardroom");

		expect(roomState).toMatchObject({type: "room", flags: {visited: true}});
		expect(roomState?.featureStates.map((state) => idValue(state.id))).toEqual(
			authoredRoom?.features.map((feature) => idValue(feature.id)),
		);
	});

	it("blocks passage-based movement when the runtime active flag is false", () => {
		const world: World = {
			...exampleWorld,
			rooms: exampleWorld.rooms.map((room) =>
				idValue(room.id) === "guardroom"
					? {
							...room,
							flags: {...room.flags, active: true},
						}
					: room,
			),
		};
		const initialGame = createInitialGameState(world, world.startRoomId);
		const game: GameState = {
			...initialGame,
			roomStates: initialGame.roomStates.map((state) =>
				idValue(state.id) === "guardroom" ? {...state, flags: {...state.flags, active: false}} : state,
			),
		};

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
		const world: World = {
			...exampleWorld,
			rooms: exampleWorld.rooms.map((room) =>
				idValue(room.id) === "guardroom" ? {...room, flags: {...room.flags, active: false}} : room,
			),
		};
		const initialGame = createInitialGameState(world, world.startRoomId);
		const game: GameState = {
			...initialGame,
			roomStates: initialGame.roomStates.filter((state) => idValue(state.id) !== "guardroom"),
		};

		const result = teleport(world, game, toID("room", "guardroom"), {
			respectActiveFlag: true,
		});

		expect(result.player.currentRoom).toEqual(game.player.currentRoom);
		expect(result.messages.at(-1)).toMatchObject({type: "system"});
	});
});
