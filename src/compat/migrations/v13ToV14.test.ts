/** @jest-environment node */

import {produce} from "immer";
import {resolveTurn} from "@/engine/player/resolveTurn";
import {createPlayerTestItem, createPlayerTestScenario} from "@/engine/utils/testUtils";
import {addItemBehaviorDraft} from "@/features/items/itemBehaviors";
import {GameMessageSchema, GameStateSchema} from "@/schemas/states/gameStateSchemas";
import {WorldSchema} from "@/schemas/world/worldSchema";

import {observableState} from "../replayCompatibility";
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

	it("replays retained turn states through the expanded command catalog", () => {
		const {world, game} = createPlayerTestScenario("navigation");
		const retained = resolveTurn(world, game, "look");
		const result = applyVersionedTransform(v13ToV14, 13, v13ToV14.gameState, retained, {
			playthroughId: "playthrough-1",
			sequence: 1,
			storage: "turn",
			world,
			command: "look",
			previousState: game,
		});

		expect(result.applied).toBe(true);
		expect(result.schemaVersion).toBe(14);
		expect(observableState(GameStateSchema.parse(result.value))).toEqual(observableState(retained));
	});

	it("rebuilds turn output and the transcript from replayed states", () => {
		const {world, game} = createPlayerTestScenario("navigation");
		const state = resolveTurn(world, game, "look");
		const output = state.messages.slice(game.messages.length);
		const outputResult = applyVersionedTransform(v13ToV14, 13, v13ToV14.messages, [], {
			playthroughId: "playthrough-1",
			sequence: 1,
			storage: "output",
			gameState: state,
			previousState: game,
		});
		const transcriptResult = applyVersionedTransform(v13ToV14, 13, v13ToV14.messages, [], {
			playthroughId: "playthrough-1",
			sequence: null,
			storage: "transcript",
			gameState: state,
			previousState: state,
		});

		expect(outputResult.applied).toBe(true);
		expect(outputResult.schemaVersion).toBe(14);
		expect(
			GameMessageSchema.array()
				.parse(outputResult.value)
				.map(({type, text}) => ({type, text})),
		).toEqual(output.map(({type, text}) => ({type, text})));
		expect(transcriptResult.applied).toBe(true);
		expect(transcriptResult.schemaVersion).toBe(14);
		expect(
			GameMessageSchema.array()
				.parse(transcriptResult.value)
				.map(({type, text}) => ({type, text})),
		).toEqual(state.messages.map(({type, text}) => ({type, text})));
		expect(GameMessageSchema.array().safeParse(outputResult.value).success).toBe(true);
		expect(GameMessageSchema.array().safeParse(transcriptResult.value).success).toBe(true);
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
