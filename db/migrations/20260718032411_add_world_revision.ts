import type {Knex} from "knex";

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable("worlds", (table) => {
		table.integer("revision").notNullable().defaultTo(1);
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.alterTable("worlds", (table) => {
		table.dropColumn("revision");
	});
}
