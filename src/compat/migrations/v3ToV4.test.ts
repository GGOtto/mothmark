/** @jest-environment node */

import {world as initialWorld} from "@/data/worlds/initialWorld";
import {resolveTurn} from "@/engine/player/resolveTurn";
import {createInitialGameState} from "@/engine/states/createInitialState";
import {WorldSchema} from "@/schemas/world/worldSchema";

import {PERSISTED_SCHEMA_VERSION, migrationFrom} from ".";
import {applyVersionedTransform} from "./types";
import {v3ToV4} from "./v3ToV4";

function retainedV3World(): unknown {
	const legacy = structuredClone(initialWorld) as unknown as Record<string, unknown>;
	const commands = Array.isArray(legacy.commands) ? legacy.commands : [];
	legacy.commands = commands.flatMap((value) => {
		if (!value || typeof value !== "object" || Array.isArray(value)) return [];
		const command = {...(value as Record<string, unknown>)};
		const id = command.id as {id?: unknown} | undefined;
		if (id?.id === "help" || id?.id === "list-exits") return [];
		delete command.showInHelp;
		delete command.helpPattern;
		delete command.helpDescription;
		return [command];
	});
	return legacy;
}

describe("the v3 to v4 command-help contract migration", () => {
	it("preserves a retained world while neutral help metadata parses", () => {
		const legacyWorld = retainedV3World();
		const result = applyVersionedTransform(v3ToV4, 3, v3ToV4.world, legacyWorld, {
			id: "world-1",
			name: "Retained v3 world",
			storage: "editor",
		});
		const parsed = WorldSchema.parse(result.value);

		expect(result).toEqual({applied: true, schemaVersion: 4, value: legacyWorld});
		expect(parsed.commands.every((command) => command.showInHelp === false)).toBe(true);
		expect(parsed.commands.some((command) => command.id.id === "help")).toBe(false);
	});

	it("keeps historical help attempts unchanged through the player path", () => {
		const world = WorldSchema.parse(retainedV3World());
		const game = createInitialGameState(world, world.startRoomId);
		const next = resolveTurn(world, game, "help");

		expect(next.messages.at(-1)).toMatchObject({
			type: "error",
			text: "I don't know what that means.",
		});
	});

	it("preserves retained game-state JSON while advancing its version", () => {
		const value = {retained: true, nested: [{authored: "unchanged"}]};
		const result = applyVersionedTransform(v3ToV4, 3, v3ToV4.gameState, value, {
			playthroughId: "playthrough-1",
			sequence: null,
			storage: "current",
		});

		expect(result).toEqual({applied: true, schemaVersion: 4, value});
	});

	it("preserves retained message JSON while advancing its version", () => {
		const value = {retained: true, nested: [{authored: "unchanged"}]};
		const result = applyVersionedTransform(v3ToV4, 3, v3ToV4.messages, value, {
			playthroughId: "playthrough-1",
			sequence: null,
			storage: "transcript",
		});

		expect(result).toEqual({applied: true, schemaVersion: 4, value});
	});

	it("remains registered as an adjacent migration and cannot run at a later version", () => {
		const value = {retained: true};
		const result = applyVersionedTransform(v3ToV4, PERSISTED_SCHEMA_VERSION, v3ToV4.world, value, {
			id: "world-1",
			storage: "editor",
		});

		expect(PERSISTED_SCHEMA_VERSION).toBe(13);
		expect(migrationFrom(3)).toBe(v3ToV4);
		expect(migrationFrom(4)).toBeDefined();
		expect(migrationFrom(PERSISTED_SCHEMA_VERSION)).toBeUndefined();
		expect(result).toEqual({
			applied: false,
			schemaVersion: PERSISTED_SCHEMA_VERSION,
			value,
		});
	});
});
