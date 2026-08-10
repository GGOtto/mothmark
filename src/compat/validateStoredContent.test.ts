/** @jest-environment node */

import type {Knex} from "knex";

import {world as initialWorld} from "@/data/worlds/initialWorld";

import {PERSISTED_SCHEMA_VERSION} from "./migrations";
import {resetWorldToBlank} from "./migrations/v1ToV2";
import {assertStoredContentValid} from "./runStorageCompatibility";
import {validateStoredContent} from "./validateStoredContent";

type StoredRows = Record<
	"playthrough_turns" | "playthroughs" | "world_versions" | "worlds",
	unknown[]
>;

function databaseWith(rows: Partial<StoredRows>): Knex {
	return ((table: keyof StoredRows) => {
		const result = rows[table] ?? [];
		const query: {
			orderBy: () => typeof query;
			select: () => typeof query;
			then: Promise<unknown[]>["then"];
		} = {
			select: () => query,
			orderBy: () => query,
			then: (onfulfilled, onrejected) => Promise.resolve(result).then(onfulfilled, onrejected),
		};
		return query;
	}) as unknown as Knex;
}

describe("retained-content deployment validation", () => {
	it("accepts reset drafts and publication snapshots when no playthrough depends on them", async () => {
		const draft = resetWorldToBlank(initialWorld, {
			id: "draft-1",
			name: "Reset draft",
			storage: "editor",
		});
		const publication = resetWorldToBlank(initialWorld, {
			id: "version-1",
			storage: "publication",
		});
		const validation = await validateStoredContent(
			databaseWith({
				worlds: [
					{
						id: "draft-1",
						kind: "editor",
						schema_version: PERSISTED_SCHEMA_VERSION,
						world: draft,
					},
				],
				world_versions: [
					{
						id: "version-1",
						schema_version: PERSISTED_SCHEMA_VERSION,
						world: publication,
					},
				],
			}),
		);

		expect(validation).toEqual({
			counts: {worlds: 1, worldVersions: 1, playthroughs: 0, turns: 0},
			issues: [],
		});
		expect(() => assertStoredContentValid(validation)).not.toThrow();
	});

	it("fails promotion when any migrated world cannot parse", async () => {
		const validation = await validateStoredContent(
			databaseWith({
				worlds: [
					{
						id: "invalid-world",
						kind: "editor",
						schema_version: PERSISTED_SCHEMA_VERSION,
						world: {},
					},
				],
			}),
		);

		expect(validation.issues[0]).toContain("worlds invalid-world:");
		expect(() => assertStoredContentValid(validation)).toThrow("Stored-content validation failed");
	});

	it("fails promotion if a retained playthrough points at the now-blank publication", async () => {
		const publication = resetWorldToBlank(initialWorld, {
			id: "version-1",
			storage: "publication",
		});
		const validation = await validateStoredContent(
			databaseWith({
				world_versions: [
					{
						id: "version-1",
						schema_version: PERSISTED_SCHEMA_VERSION,
						world: publication,
					},
				],
				playthroughs: [
					{
						id: "playthrough-1",
						world_version_id: "version-1",
						current_state: {},
						transcript: "[]",
						commands: "",
						command_count: 0,
						schema_version: PERSISTED_SCHEMA_VERSION,
					},
				],
			}),
		);

		expect(validation.issues).toEqual([
			"playthroughs playthrough-1: Pinned publication has no valid starting room.",
		]);
		expect(() => assertStoredContentValid(validation)).toThrow(
			"Pinned publication has no valid starting room",
		);
	});
});
