/** @jest-environment node */

import {produce} from "immer";
import {createInitialGameState} from "@/engine/states/createInitialState";
import {resolveTurn} from "@/engine/player/resolveTurn";
import {createPlayerTestEvent, createPlayerTestScenario} from "@/engine/utils/testUtils";
import {WorldSchema} from "@/schemas/world/worldSchema";
import {toID} from "@/utils/idUtils";

import {applyVersionedTransform} from "./types";
import {v14ToV15} from "./v14ToV15";

describe("the v14 to v15 migration through the player path", () => {
	it("starts with events resolved and lets the player use an exit they opened", () => {
		const scenario = createPlayerTestScenario("navigation");
		const event = createPlayerTestEvent(
			"open-east",
			[
				{
					type: "navigation",
					operation: "unlock-exit",
					roomId: toID("room", "foyer"),
					direction: "e",
				},
			],
			(draft) => {
				draft.disposable = true;
			},
		);
		const legacyWorld = produce(scenario.world, (draft) => {
			draft.rooms[0].initiallyBlockedExits = ["e"];
			draft.events = [event];
		});
		const world = WorldSchema.parse(
			applyVersionedTransform(v14ToV15, 14, v14ToV15.world, legacyWorld, {
				id: "world-1",
				storage: "publication",
			}).value,
		);

		const initial = createInitialGameState(world, world.startRoomId);
		const moved = resolveTurn(world, initial, "east");

		expect(initial.player.turns).toBe(0);
		expect(initial.events).toEqual([]);
		expect(moved.player.currentRoom).toEqual(toID("room", "gallery"));
	});
});
