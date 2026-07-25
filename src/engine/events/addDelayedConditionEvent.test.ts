import {produce} from "immer";
import {GameStateSchema} from "@/schemas/states/gameStateSchemas";
import {EventSchema} from "@/schemas/world/eventSchema";
import type {ConditionWithEffect} from "@/schemas/world/conditionBranchSchemas";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {idValue, toID} from "@/utils/idUtils";
import {createPlayerTestEffectGroup} from "../utils/testUtils";
import {addDelayedConditionEvent} from "./addDelayedConditionEvent";

function delayedCondition(cancelIfConditionFails: boolean): ConditionWithEffect {
	return {
		condition: {type: "group", operation: "all", conditions: []},
		effect: createPlayerTestEffectGroup("delayed-effects", [
			{type: "message", operation: "show", message: "Later."},
		]),
		delayTurns: 4,
		cancelIfConditionFails,
	};
}

describe("addDelayedConditionEvent", () => {
	it("creates a disposable event that rechecks a cancellable condition after the delay", () => {
		const game = produce(createDefaultFieldObject(GameStateSchema), (draft) => {
			draft.player.turns = 7;
		});
		const condition = delayedCondition(true);

		const result = addDelayedConditionEvent(game, condition);

		expect(result).not.toBe(game);
		expect(game.events).toEqual([]);
		expect(result.events[0]).toMatchObject({
			name: "Delayed Condition",
			enabled: true,
			disposable: true,
			wait: 4,
			priority: 0,
			lastSuccess: 7,
			branch: {
				if: {
					condition: condition.condition,
					effect: condition.effect,
					delayTurns: 0,
					cancelIfConditionFails: true,
				},
			},
		});
		expect(result.events[0].branch.always).toBeUndefined();
		expect(result.events[0].branch.else).toMatchObject({
			name: "Cancel Delayed Condition",
			effects: [],
		});
		expect(idValue(result.events[0].id)).toBeTruthy();
		expect(idValue(result.events[0].branch.id)).toBeTruthy();
	});

	it("creates an unconditional delayed event when cancellation is disabled", () => {
		const game = createDefaultFieldObject(GameStateSchema);
		const condition = delayedCondition(false);

		const result = addDelayedConditionEvent(game, condition);

		expect(result.events[0].branch.if).toBeUndefined();
		expect(result.events[0].branch.else).toBeUndefined();
		expect(result.events[0].branch.always).toEqual(condition.effect);
	});

	it("inserts the delayed event according to queue priority", () => {
		const existing = produce(createDefaultFieldObject(EventSchema), (draft) => {
			draft.id = toID("event", "lower-priority");
			draft.priority = -1;
		});
		const game = produce(createDefaultFieldObject(GameStateSchema), (draft) => {
			draft.events = [existing];
		});

		const result = addDelayedConditionEvent(game, delayedCondition(false));

		expect(result.events.map((event) => event.priority)).toEqual([0, -1]);
	});
});
