import type {Knex} from "knex";

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable("users", (table) => {
		table.timestamp("cleanup_cancelled_at").nullable();
	});

	await knex.schema.alterTable("worlds", (table) => {
		table.timestamp("trash_purge_after").nullable();
		table.index(["owner_user_id", "deleted_at"]);
	});

	await knex.schema.createTable("operational_events", (table) => {
		table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
		table.text("event_type").notNullable();
		table.jsonb("details").notNullable().defaultTo(knex.raw("'{}'::jsonb"));
		table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
		table.index(["event_type", "created_at"]);
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.dropTableIfExists("operational_events");
	await knex.schema.alterTable("worlds", (table) => {
		table.dropIndex(["owner_user_id", "deleted_at"]);
		table.dropColumn("trash_purge_after");
	});
	await knex.schema.alterTable("users", (table) => {
		table.dropColumn("cleanup_cancelled_at");
	});
}
