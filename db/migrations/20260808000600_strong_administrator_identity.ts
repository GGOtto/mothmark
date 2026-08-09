import type {Knex} from "knex";

export async function up(knex: Knex): Promise<void> {
	await knex.schema.createTable("auth_identities", (table) => {
		table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
		table.uuid("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
		table.text("provider").notNullable();
		table.text("provider_subject").notNullable();
		table.text("email").nullable();
		table.timestamp("email_verified_at").nullable();
		table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
		table.timestamp("last_authenticated_at").notNullable().defaultTo(knex.fn.now());

		table.unique(["provider", "provider_subject"]);
		table.unique(["user_id", "provider"]);
		table.index(["user_id"]);
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.dropTableIfExists("auth_identities");
}
