/** @jest-environment node */

import {produce} from "immer";

import {resolveTurn} from "@/engine/player/resolveTurn";
import {
	createPlayerTestEffectGroup,
	createPlayerTestEvent,
	createPlayerTestScenario,
} from "@/engine/utils/testUtils";
import {WorldSchema} from "@/schemas/world/worldSchema";
import {toID} from "@/utils/idUtils";
import {applyVersionedTransform} from "./types";
import {v8ToV9} from "./v8ToV9";

describe("the v8 to v9 migration through the player path", () => {
	it("keeps a referenced legacy saved condition functional after naming it", () => {
		const scenario = createPlayerTestScenario("navigation");
		const conditionId = toID("condition", "ready-in-foyer");
		const event = createPlayerTestEvent("legacy-saved-condition", [], (draft) => {
			draft.disposable = true;
			delete draft.branch.always;
			draft.branch.if = {
				condition: {
					type: "group",
					operation: "all",
					conditions: [{type: "condition-ref", conditionId}],
				},
				effect: createPlayerTestEffectGroup("legacy-saved-condition-effects", [
					{type: "message", operation: "show", message: "The stored condition passed."},
				]),
				delayTurns: 0,
				cancelIfConditionFails: true,
			};
		});
		const retained = produce(scenario.world, (draft) => {
			draft.conditions = [
				{
					identity: conditionId,
					name: "Player is in the foyer",
					condition: {
						type: "player",
						operation: "is-in-room",
						roomId: toID("room", "foyer"),
					},
				},
			];
			draft.events = [event];
		});
		const legacy = structuredClone(retained) as unknown as Record<string, unknown>;
		const conditions = legacy.conditions as Array<Record<string, unknown>>;
		delete conditions[0].name;

		const migrated = WorldSchema.parse(
			applyVersionedTransform(v8ToV9, 8, v8ToV9.world, legacy, {
				id: "world-1",
				storage: "publication",
			}).value,
		);
		const result = resolveTurn(migrated, {...scenario.game, events: [event]}, "help");

		expect(migrated.conditions[0].name).toBe("");
		expect(result.messages.at(-1)).toMatchObject({
			type: "system",
			text: "The stored condition passed.",
		});
	});
});
