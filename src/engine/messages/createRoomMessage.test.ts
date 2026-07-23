import {world} from "@/data/worlds/exampleWorld";
import type {Effect} from "@/schemas/world/effectSchema";
import {resolveRoomEffect} from "../effects/resolveSingleEffect";
import {createInitialGameState} from "../states/createInitialState";
import {createRoomMessage} from "./createRoomMessage";

describe("createRoomMessage", () => {
	it("uses the runtime short description for a visited room", () => {
		const initialGame = createInitialGameState(world, world.startRoomId);
		const namedGame = resolveRoomEffect(initialGame, {
			type: "room",
			operation: "set-name",
			roomId: world.startRoomId,
			variantId: "Changed Entrance",
		} as Effect);
		const fullyDescribedGame = resolveRoomEffect(namedGame, {
			type: "room",
			operation: "set-description",
			roomId: world.startRoomId,
			variantId: "This full description should not be shown.",
		} as Effect);
		const describedGame = resolveRoomEffect(fullyDescribedGame, {
			type: "room",
			operation: "set-short-description",
			roomId: world.startRoomId,
			variantId: "The entrance remains cold and dark.",
		} as Effect);
		const room = world.rooms.find((candidate) => candidate.id.id === world.startRoomId.id)!;

		const message = createRoomMessage(world, room, describedGame);

		expect(message.text).toContain("Changed Entrance\n");
		expect(message.text).toContain("The entrance remains cold and dark.\n");
		expect(message.text).not.toContain("This full description should not be shown.");
	});

	it("uses the runtime full description for an unvisited room", () => {
		const initialGame = createInitialGameState(world, world.startRoomId);
		const room = world.rooms.find((candidate) => candidate.id.id === "guardroom")!;
		const game = resolveRoomEffect(initialGame, {
			type: "room",
			operation: "set-description",
			roomId: room.id,
			variantId: "The guardroom has changed.",
		} as Effect);
		const gameWithShortDescription = resolveRoomEffect(game, {
			type: "room",
			operation: "set-short-description",
			roomId: room.id,
			variantId: "This short description should not be shown.",
		} as Effect);

		const message = createRoomMessage(world, room, gameWithShortDescription);

		expect(message.text).toContain("The guardroom has changed.\n");
		expect(message.text).not.toContain("This short description should not be shown.");
	});
});
