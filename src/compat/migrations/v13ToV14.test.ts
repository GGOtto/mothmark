/** @jest-environment node */

import {produce} from "immer";
import {createPlayerTestItem, createPlayerTestScenario} from "@/engine/utils/testUtils";
import {addItemBehaviorDraft} from "@/features/items/itemBehaviors";
import {GameMessageSchema, GameStateSchema} from "@/schemas/states/gameStateSchemas";
import {WorldSchema} from "@/schemas/world/worldSchema";

import {migrationFrom, PERSISTED_SCHEMA_VERSION} from ".";
import {applyVersionedTransform} from "./types";
import {v13ToV14} from "./v13ToV14";

describe("the v13 to v14 item-action and event-editor contract migration", () => {
	function legacyWorld() {
		const scenario = createPlayerTestScenario("navigation");
		return produce(scenario.world, (draft) => {
			const chest = createPlayerTestItem("chest", "Chest", "A locked chest.", "foyer");
			draft.items.push(
				produce(chest, (item) => {
					addItemBehaviorDraft(item, "takeable");
					addItemBehaviorDraft(item, "openable");
					addItemBehaviorDraft(item, "lockable");
					delete item.examine.afterExamine;
				}),
			);
			delete draft.events;
		});
	}

	it("preserves a v13 world with omitted optional item and event fields", () => {
		const value = structuredClone(legacyWorld());
		const result = applyVersionedTransform(v13ToV14, 13, v13ToV14.world, value, {
			id: "world-1",
			storage: "editor",
		});

		expect(result).toEqual({applied: true, schemaVersion: 14, value});
		expect(WorldSchema.safeParse(result.value).success).toBe(true);
	});

	it("preserves a v13 game state with omitted optional event branches", () => {
		const value = produce(createPlayerTestScenario("turn-event").game, (draft) => {
			for (const event of draft.events) {
				delete event.branch.if;
				delete event.branch.elifs;
				delete event.branch.else;
			}
		});
		const result = applyVersionedTransform(v13ToV14, 13, v13ToV14.gameState, value, {
			playthroughId: "playthrough-1",
			sequence: null,
			storage: "current",
		});

		expect(result).toEqual({applied: true, schemaVersion: 14, value});
		expect(GameStateSchema.safeParse(result.value).success).toBe(true);
	});

	it("preserves retained messages while advancing their version", () => {
		const value = structuredClone(createPlayerTestScenario("navigation").game.messages);
		const result = applyVersionedTransform(v13ToV14, 13, v13ToV14.messages, value, {
			playthroughId: "playthrough-1",
			sequence: null,
			storage: "transcript",
		});

		expect(result).toEqual({applied: true, schemaVersion: 14, value});
		expect(GameMessageSchema.array().safeParse(result.value).success).toBe(true);
	});

	it("is the final adjacent migration and cannot run twice", () => {
		const value = {retained: true};
		const result = applyVersionedTransform(
			v13ToV14,
			PERSISTED_SCHEMA_VERSION,
			v13ToV14.world,
			value,
			{id: "world-1", storage: "editor"},
		);

		expect(PERSISTED_SCHEMA_VERSION).toBe(14);
		expect(migrationFrom(13)).toBe(v13ToV14);
		expect(migrationFrom(PERSISTED_SCHEMA_VERSION)).toBeUndefined();
		expect(result).toEqual({
			applied: false,
			schemaVersion: PERSISTED_SCHEMA_VERSION,
			value,
		});
	});
});
