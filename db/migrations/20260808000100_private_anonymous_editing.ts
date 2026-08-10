import type {Knex} from "knex";

export async function up(knex: Knex): Promise<void> {
	await knex("worlds").whereNull("schema_version").update({schema_version: 1});
	await knex.schema.alterTable("worlds", (table) => {
		table.integer("schema_version").notNullable().alter();
	});

	await knex.schema.createTable("users", (table) => {
		table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
		table.text("account_type").notNullable();
		table.text("site_role").notNullable();
		table.text("status").notNullable();
		table.text("display_name").nullable();
		table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
		table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
		table.timestamp("last_seen_at").notNullable().defaultTo(knex.fn.now());
		table.timestamp("registered_at").nullable();
		table.timestamp("deleted_at").nullable();
		table.timestamp("cleanup_scheduled_at").nullable();
		table.timestamp("cleanup_after").nullable();
		table.text("cleanup_reason").nullable();

		table.check("account_type in ('anonymous', 'registered')");
		table.check("site_role in ('user', 'admin')");
		table.check("status in ('active', 'suspended', 'deleted')");
	});

	await knex.schema.createTable("sessions", (table) => {
		table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
		table.uuid("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
		table.text("audience").notNullable();
		table.text("token_hash").notNullable().unique();
		table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
		table.timestamp("last_seen_at").notNullable().defaultTo(knex.fn.now());
		table.timestamp("expires_at").notNullable();
		table.timestamp("revoked_at").nullable();

		table.check("audience in ('editor', 'play', 'admin')");
		table.index(["user_id", "audience"]);
	});

	await knex.schema.alterTable("worlds", (table) => {
		table.uuid("owner_user_id").nullable().references("id").inTable("users").onDelete("CASCADE");
		table.text("kind").notNullable().defaultTo("editor");
		table
			.uuid("updated_by_user_id")
			.nullable()
			.references("id")
			.inTable("users")
			.onDelete("SET NULL");
		table.timestamp("deleted_at").nullable();
		table.index(["owner_user_id", "updated_at"]);
	});

	await knex.raw(
		"alter table worlds add constraint worlds_kind_check check (kind in ('template', 'editor'))",
	);
	await knex("worlds").where({slug: "main"}).update({kind: "template", owner_user_id: null});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.alterTable("worlds", (table) => {
		table.dropIndex(["owner_user_id", "updated_at"]);
		table.dropColumn("deleted_at");
		table.dropColumn("updated_by_user_id");
		table.dropColumn("kind");
		table.dropColumn("owner_user_id");
	});
	await knex.schema.dropTableIfExists("sessions");
	await knex.schema.dropTableIfExists("users");
	await knex.schema.alterTable("worlds", (table) => {
		table.integer("schema_version").nullable().alter();
	});
}
