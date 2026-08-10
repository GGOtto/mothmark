import type {Knex} from "knex";

export async function up(knex: Knex): Promise<void> {
	await knex.schema.createTable("request_rate_limit_events", (table) => {
		table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
		table.text("action").notNullable();
		table.text("dimension_hash").notNullable();
		table.timestamp("attempted_at").notNullable().defaultTo(knex.fn.now());
		table.index(["action", "dimension_hash", "attempted_at"], "request_rate_limit_lookup");
		table.index(["attempted_at"], "request_rate_limit_expiry");
	});
	await knex.schema.alterTable("playthroughs", (table) => {
		table.index(["status", "updated_at"], "playthroughs_status_updated");
		table.index(["release_id", "updated_at"], "playthroughs_release_updated");
		table.index(["world_id", "updated_at"], "playthroughs_world_updated");
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.alterTable("playthroughs", (table) => {
		table.dropIndex(["status", "updated_at"], "playthroughs_status_updated");
		table.dropIndex(["release_id", "updated_at"], "playthroughs_release_updated");
		table.dropIndex(["world_id", "updated_at"], "playthroughs_world_updated");
	});
	await knex.schema.dropTableIfExists("request_rate_limit_events");
}
