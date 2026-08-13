/** @jest-environment node */

import {produce} from "immer";

import v2BlankWorld from "./fixtures/v2BlankWorld.json";
import {resolveTurn} from "@/engine/player/resolveTurn";
import {createInitialGameState} from "@/engine/states/createInitialState";
import {createPlayerTestScenario} from "@/engine/utils/testUtils";
import {CommandSchema} from "@/schemas/world/commandSchemas";
import {compareIds, toID} from "@/utils/idUtils";
import {reorganizeConditionsAndEffects} from "./v5ToV6";

describe("the v5 to v6 migration through the player path", () => {
	it("preserves the retained Take command as a Player effect", () => {
		const historicalTake = v2BlankWorld.commands.find((command) => command.id.id === "take");
		const migratedTake = CommandSchema.parse(reorganizeConditionsAndEffects(historicalTake));
		const scenario = createPlayerTestScenario("navigation");
		const world = produce(scenario.world, (draft) => {
			draft.commands = [migratedTake];
			const bell = draft.items.find((item) => compareIds(item.id, toID("item", "brass-bell")));
			if (bell) {
				bell.behaviors = [
					{type: "takeable", size: "small", blockedMessage: "The bell is fixed in place."},
				];
			}
		});
		const result = resolveTurn(world, createInitialGameState(world, world.startRoomId), "take bell");
		const bell = result.itemStates.find((item) => compareIds(item.id, toID("item", "brass-bell")));

		expect(migratedTake.behavior.if?.effect.effects[0]).toMatchObject({
			type: "player",
			operation: "take",
		});
		expect(bell?.location).toEqual({type: "inventory"});
		expect(result.messages.at(-1)?.text).toContain("Brass Bell");
	});
});
