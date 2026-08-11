/** @jest-environment node */

import {createHash} from "node:crypto";

import {world as initialWorld} from "@/data/worlds/initialWorld";
import {WorldSchema} from "@/schemas/world/worldSchema";
import {idValue} from "@/utils/idUtils";

import {PERSISTED_SCHEMA_VERSION, migrationFrom, validateStorageMigrationRegistry} from ".";
import {applyVersionedTransform, defineStorageMigration, unchanged} from "./types";
import {resetWorldToBlank, v1ToV2} from "./v1ToV2";

describe("the initial v1 to v2 storage migration", () => {
	it("replaces editor content with the canonical blank world and preserves its title", () => {
		const legacyWorld = structuredClone(initialWorld);
		const migrated = resetWorldToBlank(legacyWorld, {
			id: "world-1",
			name: "The retained database name",
			storage: "editor",
		});
		const parsed = WorldSchema.parse(migrated);

		expect(parsed.metadata).toEqual({
			title: "The retained database name",
			author: "",
			description: "",
			version: "0.1.0",
			layers: [],
		});
		expect(parsed).toMatchObject({
			rooms: [],
			items: [],
			connections: [],
			conditions: [],
			effects: [],
			events: [],
			initialState: {flags: [], counters: [], texts: []},
		});
		expect(parsed.commands.map((command) => idValue(command.id))).toEqual([
			"command-1",
			"command-2",
			"take",
			"drop",
			"examine",
			"open",
			"close",
			"lock",
			"unlock",
			"use",
			"use-targeted",
			"put-inside",
			"put-on",
		]);
		expect(parsed.commands.every((command) => command.showInHelp === false)).toBe(true);
		expect(legacyWorld).toEqual(initialWorld);
	});

	it.each(["publication", "template"] as const)(
		"uses the stored title when blanking a %s world",
		(storage) => {
			const parsed = WorldSchema.parse(resetWorldToBlank(initialWorld, {id: "stored-world", storage}));
			expect(parsed.metadata.title).toBe(initialWorld.metadata.title);
			expect(parsed.rooms).toEqual([]);
		},
	);

	it("advances a v1 document to v2 and refuses to apply the reset a second time", () => {
		const first = applyVersionedTransform(v1ToV2, 1, v1ToV2.world, initialWorld, {
			id: "world-1",
			name: "Only once",
			storage: "editor",
		});
		const second = applyVersionedTransform(v1ToV2, first.schemaVersion, v1ToV2.world, first.value, {
			id: "world-1",
			name: "Should not blank again",
			storage: "editor",
		});

		expect(first).toMatchObject({applied: true, schemaVersion: 2});
		expect(WorldSchema.parse(first.value).metadata.title).toBe("Only once");
		expect(second).toEqual({applied: false, schemaVersion: 2, value: first.value});
	});

	it("pins the complete v2 reset document so historical migration output cannot drift", () => {
		const migrated = resetWorldToBlank(initialWorld, {
			id: "world-1",
			name: "The retained database name",
			storage: "editor",
		});
		const digest = createHash("sha256").update(JSON.stringify(migrated)).digest("hex");
		expect(digest).toBe("987b6724ca7ef89b42df248449a4a3fea08a1e1557eae80622566e0a0a21c21c");
	});

	it("leaves an already-current nonblank world untouched", () => {
		const result = applyVersionedTransform(
			v1ToV2,
			PERSISTED_SCHEMA_VERSION,
			v1ToV2.world,
			initialWorld,
			{id: "world-2", storage: "editor"},
		);
		expect(result).toEqual({
			applied: false,
			schemaVersion: PERSISTED_SCHEMA_VERSION,
			value: initialWorld,
		});
	});

	it("bumps unchanged game-state documents to v2", () => {
		const value = {retained: true};
		const result = applyVersionedTransform(v1ToV2, 1, v1ToV2.gameState, value, {
			playthroughId: "playthrough-1",
			sequence: null,
			storage: "unknown",
		});
		expect(result).toEqual({applied: true, schemaVersion: 2, value});
	});

	it("bumps unchanged message documents to v2", () => {
		const value = {retained: true};
		const result = applyVersionedTransform(v1ToV2, 1, v1ToV2.messages, value, {
			playthroughId: "playthrough-1",
			sequence: null,
			storage: "unknown",
		});
		expect(result).toEqual({applied: true, schemaVersion: 2, value});
	});

	it("remains the immutable first registered migration", () => {
		expect(migrationFrom(1)).toBe(v1ToV2);
		expect(v1ToV2).toMatchObject({
			id: "v1-to-v2-reset-worlds-to-blank",
			fromVersion: 1,
			toVersion: 2,
		});
	});

	it("rejects migration definitions that skip a schema version", () => {
		expect(() =>
			defineStorageMigration({
				id: "invalid-version-jump",
				fromVersion: 2,
				toVersion: 4,
				world: unchanged,
				gameState: unchanged,
				messages: unchanged,
			}),
		).toThrow("must advance exactly one version");
	});

	it("rejects missing, reordered, and duplicate migration history", () => {
		expect(() => validateStorageMigrationRegistry([], 2)).toThrow(
			"Storage migrations end at version 1; current version is 2.",
		);
		expect(() => validateStorageMigrationRegistry([{...v1ToV2, fromVersion: 2}], 3)).toThrow(
			"expected 1",
		);
		expect(() => validateStorageMigrationRegistry([v1ToV2, {...v1ToV2}], 3)).toThrow(
			"Duplicate storage migration ID",
		);
	});
});
