import {readdir} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

import createKnex from "knex";

import {addSchemaVersionColumn} from "../migrations/20260809001100_storage_compatibility";

describe("storage compatibility migration", () => {
	const database = createKnex({client: "pg"});
	const migrationDirectory = path.resolve(
		path.dirname(fileURLToPath(import.meta.url)),
		"../migrations",
	);

	afterAll(async () => {
		await database.destroy();
	});

	it("keeps test modules outside Knex's executable migration directory", async () => {
		const entries = await readdir(migrationDirectory);

		expect(entries.filter((entry) => entry.includes(".test."))).toEqual([]);
	});

	it.each([
		["playthroughs", "playthroughs_schema_version_check"],
		["playthrough_turns", "playthrough_turns_schema_version_check"],
	])("generates valid SQL for the %s schema-version constraint", (tableName, constraintName) => {
		const statements = database.schema
			.alterTable(tableName, (table) => addSchemaVersionColumn(table, constraintName))
			.toSQL()
			.map(({sql}) => sql);

		expect(statements).toContain(
			`alter table "${tableName}" add constraint ${constraintName} check(schema_version > 0)`,
		);
		expect(statements.join("\n")).not.toContain(`"${tableName}"_1`);
	});
});
