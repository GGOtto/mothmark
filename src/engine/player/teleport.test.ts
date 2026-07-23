import {world as exampleWorld} from "@/data/worlds/exampleWorld";
import type {GameState} from "@/schemas/states/gameStateSchema";
import type {World} from "@/schemas/world/worldSchema";
import {idValue, toID} from "@/utils/idUtils";
import {createInitialGameState} from "../states/createInitialState";
import {teleport} from "./teleport";

describe("teleport", () => {
	it("moves the player, preserves game progress, and marks the destination visited", () => {
		const initialGame = createInitialGameState(exampleWorld, exampleWorld.startRoomId);
		const game: GameState = {
			...initialGame,
			turns: 7,
			variables: {
				...initialGame.variables,
				flags: [{persisted: true}],
			},
		};

		const nextGame = teleport(exampleWorld, game, toID("room", "guardroom"));

		expect(idValue(nextGame.currentRoom)).toBe("guardroom");
		expect(nextGame.turns).toBe(7);
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

	it("can respect activeWhen for passage-based movement", () => {
		const world: World = {
			...exampleWorld,
			rooms: exampleWorld.rooms.map((room) =>
				idValue(room.id) === "guardroom"
					? {
							...room,
							activeWhen: {
								type: "group",
								operation: "all",
								conditions: [{type: "flag", operation: "true", flag: "guardroom.unlocked"}],
							},
						}
					: room,
			),
		};
		const game = createInitialGameState(world, world.startRoomId);

		const blockedGame = teleport(world, game, toID("room", "guardroom"), {
			respectActiveWhen: true,
		});
		const teleportedGame = teleport(world, game, toID("room", "guardroom"));

		expect(idValue(blockedGame.currentRoom)).toBe(idValue(game.currentRoom));
		expect(blockedGame.messages.at(-1)).toMatchObject({
			type: "system",
			text: "You can't go that way.",
		});
		expect(idValue(teleportedGame.currentRoom)).toBe("guardroom");
	});
});
