/** @jest-environment node */

import {resolveTurn} from "@/engine/player/resolveTurn";
import {createPlayerTestScenario} from "@/engine/utils/testUtils";
import {GameStateSchema, type GameState} from "@/schemas/states/gameStateSchemas";
import {WorldSchema} from "@/schemas/world/worldSchema";
import {PERSISTED_SCHEMA_VERSION, migrationFrom} from ".";
import {replayCompatibilityIssues} from "../replayCompatibility";
import {applyVersionedTransform} from "./types";
import {v4ToV5} from "./v4ToV5";

function withoutFacing(game: GameState): unknown {
	const value = structuredClone(game) as unknown as Record<string, unknown>;
	const player = value.player as Record<string, unknown>;
	delete player.facing;
	return value;
}

describe("the v4 to v5 player-facing migration", () => {
	it("keeps retained direction blocks absolute-only so historical relative attempts replay", () => {
		const scenario = createPlayerTestScenario("navigation");
		const retained = structuredClone(scenario.world) as unknown as Record<string, unknown>;
		for (const commandValue of retained.commands as Array<Record<string, unknown>>) {
			for (const patternValue of commandValue.patterns as Array<Record<string, unknown>>) {
				for (const blockValue of patternValue.blocks as Array<Record<string, unknown>>) {
					delete blockValue.allowRelative;
				}
			}
		}
		const result = applyVersionedTransform(v4ToV5, 4, v4ToV5.world, retained, {
			id: "world-1",
			storage: "publication",
		});
		const migrated = WorldSchema.parse(result.value);
		const directionBlocks = migrated.commands.flatMap((command) =>
			command.patterns.flatMap((pattern) =>
				pattern.blocks.filter((block) => block.type === "direction"),
			),
		);

		expect(directionBlocks.length).toBeGreaterThan(0);
		expect(directionBlocks.every((block) => !block.allowRelative)).toBe(true);
		const legacyAttempt = resolveTurn(migrated, createPlayerTestScenario("navigation").game, "right");
		expect(legacyAttempt.messages.at(-1)).toMatchObject({
			type: "error",
			text: "I don't know what that means.",
		});
	});

	it("replays retained turns in sequence to preserve the actual facing", () => {
		const scenario = createPlayerTestScenario("navigation");
		const legacyInGallery = withoutFacing(resolveTurn(scenario.world, scenario.game, "east"));
		const first = applyVersionedTransform(v4ToV5, 4, v4ToV5.gameState, legacyInGallery, {
			playthroughId: "playthrough-1",
			sequence: 1,
			storage: "turn",
			world: scenario.world,
			command: "east",
			previousState: scenario.game,
		});
		const migratedInGallery = GameStateSchema.parse(first.value);

		const legacyBackInFoyer = withoutFacing(resolveTurn(scenario.world, migratedInGallery, "west"));
		const second = applyVersionedTransform(v4ToV5, 4, v4ToV5.gameState, legacyBackInFoyer, {
			playthroughId: "playthrough-1",
			sequence: 2,
			storage: "turn",
			world: scenario.world,
			command: "west",
			previousState: migratedInGallery,
		});
		const migratedBackInFoyer = GameStateSchema.parse(second.value);

		expect(first.schemaVersion).toBe(5);
		expect(migratedInGallery.player.facing).toBe("e");
		expect(migratedBackInFoyer.player.facing).toBe("w");
	});

	it("passes exhaustive player-path replay after sequential facing migration", () => {
		const scenario = createPlayerTestScenario("navigation");
		const legacyEast = resolveTurn(scenario.world, scenario.game, "east");
		const first = GameStateSchema.parse(
			applyVersionedTransform(v4ToV5, 4, v4ToV5.gameState, withoutFacing(legacyEast), {
				playthroughId: "playthrough-1",
				sequence: 1,
				storage: "turn",
				world: scenario.world,
				command: "east",
				previousState: scenario.game,
			}).value,
		);
		const legacyWest = resolveTurn(scenario.world, first, "west");
		const second = GameStateSchema.parse(
			applyVersionedTransform(v4ToV5, 4, v4ToV5.gameState, withoutFacing(legacyWest), {
				playthroughId: "playthrough-1",
				sequence: 2,
				storage: "turn",
				world: scenario.world,
				command: "west",
				previousState: first,
			}).value,
		);

		expect(
			replayCompatibilityIssues(
				scenario.world,
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
				second,
			),
		).toEqual([]);
	});

	it("copies the final replayed facing into current state without changing authored progress", () => {
		const scenario = createPlayerTestScenario("navigation");
		const previousState = resolveTurn(scenario.world, scenario.game, "east");
		const retainedCurrent = withoutFacing(previousState);
		const result = applyVersionedTransform(v4ToV5, 4, v4ToV5.gameState, retainedCurrent, {
			playthroughId: "playthrough-1",
			sequence: null,
			storage: "current",
			world: scenario.world,
			previousState,
		});
		const migrated = GameStateSchema.parse(result.value);

		expect(migrated.player.facing).toBe("e");
		expect(migrated.player.currentRoom).toEqual(previousState.player.currentRoom);
		expect((result.value as Record<string, unknown>).messages).toEqual(previousState.messages);
	});

	it("uses neutral north when a standalone legacy state has no replay context", () => {
		const scenario = createPlayerTestScenario("navigation");
		const result = applyVersionedTransform(
			v4ToV5,
			4,
			v4ToV5.gameState,
			withoutFacing(scenario.game),
			{playthroughId: "unknown", sequence: null, storage: "unknown"},
		);

		expect(GameStateSchema.parse(result.value).player.facing).toBe("n");
	});

	it("is the final registered adjacent migration and cannot run twice", () => {
		const value = {retained: true};
		const result = applyVersionedTransform(v4ToV5, PERSISTED_SCHEMA_VERSION, v4ToV5.world, value, {
			id: "world-1",
			storage: "editor",
		});

		expect(PERSISTED_SCHEMA_VERSION).toBe(14);
		expect(migrationFrom(4)).toBe(v4ToV5);
		expect(migrationFrom(PERSISTED_SCHEMA_VERSION)).toBeUndefined();
		expect(result).toEqual({
			applied: false,
			schemaVersion: PERSISTED_SCHEMA_VERSION,
			value,
		});
	});
});
