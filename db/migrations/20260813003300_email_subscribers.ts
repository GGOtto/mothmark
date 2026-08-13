import type {Knex} from "knex";

export async function up(knex: Knex): Promise<void> {
	await knex.schema.createTable("email_subscribers", (table) => {
		table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
		table.text("email").notNullable();
		table.text("normalized_email").notNullable().unique();
		table.text("source").notNullable();
		table.timestamp("subscribed_at").notNullable().defaultTo(knex.fn.now());
		table.timestamp("unsubscribed_at").nullable();
		table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
		table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
		table.check("source in ('footer', 'registration')");
		table.check("char_length(email) between 3 and 254");
		table.index(["unsubscribed_at", "subscribed_at"]);
	});

	await knex.schema.alterTable("account_registrations", (table) => {
		table.boolean("subscribe_to_updates").notNullable().defaultTo(false);
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.alterTable("account_registrations", (table) => {
		table.dropColumn("subscribe_to_updates");
	});
	await knex.schema.dropTableIfExists("email_subscribers");
}
