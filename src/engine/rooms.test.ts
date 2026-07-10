import type {World} from "@/schemas/worldSchema";
import type {GameState} from "./gameState";
import {createGameMessage} from "./gameState";
import {lookAtRoom, refreshLatestRoomMessage} from "./rooms";

function createWorld(description: string): World {
	return {
		startRoomId: "gate",
		rooms: [
			{
				id: "gate",
				name: "Gate",
				description: {
					default: description,
					variants: [],
				},
				features: [],
			},
		],
		connections: [],
	} as unknown as World;
}

function createGameState(): GameState {
	return {
		currentRoomId: "gate",
		flags: {},
		inventory: [],
		messages: [],
	};
}

describe("refreshLatestRoomMessage", () => {
	it("refreshes the latest room output from the current world data", () => {
		const initialWorld = createWorld("Original description.");
		const editedWorld = createWorld("Edited description.");
		const lookedState = lookAtRoom(initialWorld, createGameState());
		const commandMessage = createGameMessage("look", "command");
		const stateWithCommand: GameState = {
			...lookedState,
			messages: [...lookedState.messages, commandMessage],
		};

		const refreshedState = refreshLatestRoomMessage(editedWorld, stateWithCommand);

		expect(refreshedState.messages).toHaveLength(2);
		expect(refreshedState.messages[0].text).toContain("Edited description.");
		expect(refreshedState.messages[0].text).not.toContain("Original description.");
		expect(refreshedState.messages[1]).toBe(commandMessage);
	});
});
