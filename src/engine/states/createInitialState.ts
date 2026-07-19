import type {World} from "@/schemas/world/worldSchema";
import {idValue} from "@/utils/idUtils";
import {GameState, GameStateSchema} from "@/schemas/states/gameStateSchema";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";

export function createInitialGameState(world: World, startingRoomId: string): GameState {
	const flags: Record<string, boolean> = {};

	for (const room of world.rooms) {
		// TODO set up the room and feature flags
	}

	return createDefaultFieldObject(GameStateSchema);
}
