import {world} from "@/data/worlds/initialWorld";
import type {Effect} from "@/schemas/world/effectSchema";
import {resolveRoomEffect} from "../effects/resolveEffects";
import {createInitialGameState} from "../states/createInitialState";
import {createPlayerTestScenario} from "../utils/testUtils";
import {createRoomMessage} from "./createRoomMessage";

describe("createRoomMessage", () => {
	it("indents every listed item line beneath the room description", () => {
		const scenario = createPlayerTestScenario("navigation");
		const room = scenario.world.rooms[0];

		const message = createRoomMessage(scenario.world, room, scenario.game);

		expect(message.text).toContain(
			"You are back in the test foyer.\n A small brass bell hangs beside the doorway.",
		);
	});

	it("uses the runtime short description for a visited room", () => {
		const initialGame = createInitialGameState(world, world.startRoomId);
		const namedGame = resolveRoomEffect(initialGame, {
			type: "room",
			operation: "set-name",
			roomId: world.startRoomId,
			value: "Changed Entrance",
		} as Effect);
		const fullyDescribedGame = resolveRoomEffect(namedGame, {
			type: "room",
			operation: "set-description",
			roomId: world.startRoomId,
			value: "This full description should not be shown.",
		} as Effect);
		const describedGame = resolveRoomEffect(fullyDescribedGame, {
			type: "room",
			operation: "set-short-description",
			roomId: world.startRoomId,
			value: "The entrance remains cold and dark.",
		} as Effect);
		const room = world.rooms.find((candidate) => candidate.id.id === world.startRoomId.id)!;

		const message = createRoomMessage(world, room, describedGame);

		expect(message.text).toContain("Changed Entrance\n");
		expect(message.text).toContain("The entrance remains cold and dark.\n");
		expect(message.text).not.toContain("This full description should not be shown.");
	});

	it("uses the runtime full description for an unvisited room", () => {
		const initialGame = createInitialGameState(world, world.startRoomId);
		const room = world.rooms.find((candidate) => candidate.id.id === "stockroom")!;
		const game = resolveRoomEffect(initialGame, {
			type: "room",
			operation: "set-description",
			roomId: room.id,
			value: "The guardroom has changed.",
		} as Effect);
		const gameWithShortDescription = resolveRoomEffect(game, {
			type: "room",
			operation: "set-short-description",
			roomId: room.id,
			value: "This short description should not be shown.",
		} as Effect);

		const message = createRoomMessage(world, room, gameWithShortDescription);

		expect(message.text).toContain("The guardroom has changed.\n");
		expect(message.text).not.toContain("This short description should not be shown.");
	});
});
