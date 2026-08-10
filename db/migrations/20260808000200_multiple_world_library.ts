import type {Knex} from "knex";

export const DEFAULT_MAX_WORLDS = 5;

export async function up(knex: Knex): Promise<void> {
	await knex.schema.createTable("user_limits", (table) => {
		table.uuid("user_id").primary().references("id").inTable("users").onDelete("CASCADE");
		table.integer("max_worlds").notNullable().defaultTo(DEFAULT_MAX_WORLDS);
		table
			.uuid("updated_by_user_id")
			.nullable()
			.references("id")
			.inTable("users")
			.onDelete("SET NULL");
		table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
		table.check("max_worlds > 0");
	});

	await knex("user_limits").insert(
		knex("users")
			.select("id as user_id")
			.select(knex.raw("? as max_worlds", [DEFAULT_MAX_WORLDS])),
	);

	await knex.schema.createTable("user_world_activity", (table) => {
		table.uuid("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
		table.uuid("world_id").notNullable().references("id").inTable("worlds").onDelete("CASCADE");
		table.timestamp("last_opened_at").notNullable().defaultTo(knex.fn.now());
		table.primary(["user_id", "world_id"]);
		table.index(["user_id", "last_opened_at"]);
	});

	await knex("user_world_activity").insert(
		knex("worlds")
			.select("owner_user_id as user_id", "id as world_id", "updated_at as last_opened_at")
			.where({kind: "editor"})
			.whereNotNull("owner_user_id")
			.whereNull("deleted_at"),
	);
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.dropTableIfExists("user_world_activity");
	await knex.schema.dropTableIfExists("user_limits");
}
