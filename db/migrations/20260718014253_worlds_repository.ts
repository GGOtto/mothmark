import type {Knex} from "knex";

export async function up(knex: Knex): Promise<void> {
	await knex.schema.createTable("worlds", (table) => {
		table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

		table.text("name").notNullable();
		table.text("slug").nullable().unique();

		table.jsonb("world").notNullable();

		table.integer("schema_version").nullable();

		table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());

		table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.dropTableIfExists("worlds");
}
