/** @jest-environment node */

import v2BlankWorld from "./fixtures/v2BlankWorld.json";
import {resolveTurn} from "@/engine/player/resolveTurn";
import {createPlayerTestScenario} from "@/engine/utils/testUtils";
import {GameStateSchema, type GameState} from "@/schemas/states/gameStateSchemas";
import {CommandSchema} from "@/schemas/world/commandSchemas";
import {WorldSchema} from "@/schemas/world/worldSchema";
import {toID} from "@/utils/idUtils";
import {PERSISTED_SCHEMA_VERSION, migrationFrom} from ".";
import {replayCompatibilityIssues} from "../replayCompatibility";
import {applyVersionedTransform} from "./types";
import {reorganizeConditionsAndEffects, v5ToV6} from "./v5ToV6";

describe("the v5 to v6 condition and effect migration", () => {
	function withoutV6RuntimeFields(game: GameState): unknown {
		const legacy = structuredClone(game) as unknown as Record<string, unknown>;
		const player = legacy.player as Record<string, unknown>;
		for (const field of [
			"previousRoom",
			"lastRoomTransitionTurn",
			"lastCommandSucceeded",
			"lastCommandTurn",
			"randomState",
			"carryingCapacity",
			"equippedItemIds",
			"hasWon",
			"isEnded",
			"endingMessage",
		])
			delete player[field];
		return legacy;
	}

	it("moves legacy operations under their owning domains throughout a world", () => {
		const scenario = createPlayerTestScenario("navigation");
		const retained = {
			...scenario.world,
			commands: v2BlankWorld.commands,
			conditions: [
				{
					identity: toID("condition", "contains-key"),
					condition: {
						type: "item",
						itemId: toID("item", "box"),
						test: {
							type: "contents",
							test: "contains-item",
							itemId: toID("item", "key"),
							placement: "inside",
							commandVariables: [{blockId: toID("command-block", "key-block"), field: "itemId"}],
						},
					},
				},
			],
			effects: [
				{
					id: toID("effect", "legacy-effects"),
					name: "Legacy effects",
					type: "group",
					allowMultipleUsesInWorld: true,
					effects: [
						{type: "item-action", action: "take", itemId: toID("item", "brass-bell")},
						{type: "flag", "flag-type": "normal", operation: "create", flag: "started", value: true},
						{
							type: "room",
							operation: "set-description",
							roomId: toID("room", "foyer"),
							variantId: "A changed foyer.",
							commandVariables: [{blockId: toID("command-block", "text-block"), field: "variantId"}],
						},
					],
				},
			],
		};

		const result = applyVersionedTransform(v5ToV6, 5, v5ToV6.world, retained, {
			id: "world-1",
			storage: "editor",
		});
		const migrated = WorldSchema.parse(result.value);

		expect(result.schemaVersion).toBe(6);
		expect(
			migrated.commands.find((command) => command.id.id === "take")?.behavior.if?.effect.effects[0],
		).toMatchObject({
			type: "player",
			operation: "take",
		});
		expect(migrated.conditions[0]?.condition).toMatchObject({
			type: "item",
			operation: "contains-item",
			containedItemId: toID("item", "key"),
		});
		expect(migrated.effects[0]?.effects).toEqual([
			expect.objectContaining({type: "player", operation: "take"}),
			expect.objectContaining({type: "world", operation: "set-flag"}),
			expect.objectContaining({
				type: "room",
				operation: "set-description",
				value: "A changed foyer.",
			}),
		]);
	});

	it("migrates every historically bundled command into the current command schema", () => {
		for (const command of v2BlankWorld.commands) {
			expect(() => CommandSchema.parse(reorganizeConditionsAndEffects(command))).not.toThrow();
		}
	});

	it("renames accepted legacy item fields and their command bindings", () => {
		expect(
			reorganizeConditionsAndEffects({
				type: "item",
				itemId: toID("item", "box"),
				test: {
					type: "contents",
					test: "contains-item",
					itemId: toID("item", "key"),
					placement: "inside",
					commandVariables: [{blockId: toID("command-block", "key-block"), field: "itemId"}],
				},
			}),
		).toEqual({
			type: "item",
			itemId: toID("item", "box"),
			operation: "contains-item",
			containedItemId: toID("item", "key"),
			placement: "inside",
			commandVariables: [{blockId: toID("command-block", "key-block"), field: "containedItemId"}],
		});
		expect(
			reorganizeConditionsAndEffects({
				type: "item",
				operation: "move-to-room",
				itemId: toID("item", "bell"),
				newRoomId: toID("room", "gallery"),
				commandVariables: [{blockId: toID("command-block", "room-block"), field: "newRoomId"}],
			}),
		).toEqual({
			type: "item",
			operation: "move-to-room",
			itemId: toID("item", "bell"),
			roomId: toID("room", "gallery"),
			commandVariables: [{blockId: toID("command-block", "room-block"), field: "roomId"}],
		});
		expect(
			reorganizeConditionsAndEffects({
				type: "room",
				operation: "set-description",
				roomId: toID("room", "gallery"),
				variantId: "The changed gallery.",
				commandVariables: [{blockId: toID("command-block", "text-block"), field: "variantId"}],
			}),
		).toEqual({
			type: "room",
			operation: "set-description",
			roomId: toID("room", "gallery"),
			value: "The changed gallery.",
			commandVariables: [{blockId: toID("command-block", "text-block"), field: "value"}],
		});
	});

	it("removes exact unreferenced copies of embedded outcomes from reusable effects", () => {
		const embeddedAlways = {
			type: "group",
			id: toID("effect", "command-always"),
			name: "Always",
			effects: [{type: "message", operation: "show", message: "Always runs."}],
			allowMultipleUsesInWorld: true,
		};
		const embeddedReferenced = {
			type: "group",
			id: toID("effect", "command-if"),
			name: "If",
			effects: [{type: "message", operation: "show", message: "Conditionally runs."}],
			allowMultipleUsesInWorld: true,
		};
		const explicitReusable = {
			type: "group",
			id: toID("effect", "ring-bell"),
			name: "Ring the bell",
			effects: [{type: "message", operation: "show", message: "The bell rings."}],
			allowMultipleUsesInWorld: true,
		};
		const result = applyVersionedTransform(
			v5ToV6,
			5,
			v5ToV6.world,
			{
				commands: [{behavior: {always: embeddedAlways, if: {effect: embeddedReferenced}}}],
				effects: [
					embeddedAlways,
					embeddedReferenced,
					explicitReusable,
					{
						type: "group",
						id: toID("effect", "uses-command-if"),
						name: "Use conditional outcome",
						effects: [{type: "effect-ref", effectId: toID("effect", "command-if")}],
						allowMultipleUsesInWorld: true,
					},
				],
			},
			{id: "world-1", storage: "editor"},
		);

		expect((result.value as {effects: unknown[]}).effects).toEqual([
			embeddedReferenced,
			explicitReusable,
			expect.objectContaining({name: "Use conditional outcome"}),
		]);
	});

	it("replays retained turns to populate the new player runtime fields", () => {
		const scenario = createPlayerTestScenario("navigation");
		const migratedWorld = WorldSchema.parse(
			applyVersionedTransform(v5ToV6, 5, v5ToV6.world, scenario.world, {
				id: "world-1",
				storage: "publication",
			}).value,
		);
		const legacyEast = resolveTurn(migratedWorld, scenario.game, "east");
		const first = GameStateSchema.parse(
			applyVersionedTransform(v5ToV6, 5, v5ToV6.gameState, withoutV6RuntimeFields(legacyEast), {
				playthroughId: "playthrough-1",
				sequence: 1,
				storage: "turn",
				world: migratedWorld,
				command: "east",
				previousState: scenario.game,
			}).value,
		);
		const legacyWest = resolveTurn(migratedWorld, first, "west");
		const second = GameStateSchema.parse(
			applyVersionedTransform(v5ToV6, 5, v5ToV6.gameState, withoutV6RuntimeFields(legacyWest), {
				playthroughId: "playthrough-1",
				sequence: 2,
				storage: "turn",
				world: migratedWorld,
				command: "west",
				previousState: first,
			}).value,
		);
		const current = GameStateSchema.parse(
			applyVersionedTransform(v5ToV6, 5, v5ToV6.gameState, withoutV6RuntimeFields(legacyWest), {
				playthroughId: "playthrough-1",
				sequence: null,
				storage: "current",
				world: migratedWorld,
				previousState: second,
			}).value,
		);

		expect(first.player).toMatchObject({
			previousRoom: scenario.world.startRoomId,
			lastCommandSucceeded: true,
			randomState: 0x6d2b79f5,
			equippedItemIds: [],
		});
		expect(
			replayCompatibilityIssues(
				migratedWorld,
				[
					{
						sequence: 1,
						command: "east",
						outputMessages: legacyEast.messages.slice(scenario.game.messages.length),
						resultingState: first,
					},
					{
						sequence: 2,
						command: "west",
						outputMessages: legacyWest.messages.slice(first.messages.length),
						resultingState: second,
					},
				],
				current,
			),
		).toEqual([]);
	});

	it("is registered at v5 and only applies at v5", () => {
		const value = {retained: true};
		const applied = applyVersionedTransform(v5ToV6, 5, v5ToV6.world, value, {
			id: "world-1",
			storage: "editor",
		});
		const skipped = applyVersionedTransform(v5ToV6, 6, v5ToV6.world, value, {
			id: "world-1",
			storage: "editor",
		});

		expect(PERSISTED_SCHEMA_VERSION).toBe(8);
		expect(migrationFrom(5)).toBe(v5ToV6);
		expect(migrationFrom(6)).toBeDefined();
		expect(applied).toEqual({applied: true, schemaVersion: 6, value});
		expect(skipped).toEqual({applied: false, schemaVersion: 6, value});
	});
});
