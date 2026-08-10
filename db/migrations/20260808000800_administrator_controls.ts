import type {Knex} from "knex";

export async function up(knex: Knex): Promise<void> {
	await knex.schema.createTable("user_permission_overrides", (table) => {
		table.uuid("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
		table.text("permission").notNullable();
		table.boolean("allowed").notNullable();
		table.timestamp("expires_at").nullable();
		table
			.uuid("updated_by_user_id")
			.nullable()
			.references("id")
			.inTable("users")
			.onDelete("SET NULL");
		table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
		table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
		table.primary(["user_id", "permission"]);
		table.index(["user_id", "expires_at"]);
	});

	await knex.schema.createTable("admin_audit_log", (table) => {
		table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
		table.uuid("actor_user_id").nullable().references("id").inTable("users").onDelete("SET NULL");
		table.text("action").notNullable();
		table.text("target_type").notNullable();
		table.uuid("target_id").notNullable();
		table.text("reason").nullable();
		table.jsonb("details").notNullable().defaultTo(knex.raw("'{}'::jsonb"));
		table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
		table.index(["actor_user_id", "created_at"]);
		table.index(["action", "created_at"]);
		table.index(["target_type", "target_id", "created_at"]);
	});

	await knex.schema.alterTable("users", (table) => {
		table.timestamp("suspended_at").nullable();
		table.text("suspension_reason").nullable();
		table
			.uuid("suspended_by_user_id")
			.nullable()
			.references("id")
			.inTable("users")
			.onDelete("SET NULL");
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.alterTable("users", (table) => {
		table.dropColumn("suspended_by_user_id");
		table.dropColumn("suspension_reason");
		table.dropColumn("suspended_at");
	});
	await knex.schema.dropTableIfExists("admin_audit_log");
	await knex.schema.dropTableIfExists("user_permission_overrides");
}
