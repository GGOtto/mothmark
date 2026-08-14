import type {Knex} from "knex";

export async function up(knex: Knex): Promise<void> {
	await knex.schema.createTable("editor_preferences", (table) => {
		table.uuid("user_id").primary().references("id").inTable("users").onDelete("CASCADE");
		table.text("item_list_view").notNullable().defaultTo("cards");
		table.text("item_list_sort").notNullable().defaultTo("updated-desc");
		table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
		table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
		table.check("item_list_view in ('cards', 'rows', 'marks', 'index')");
		table.check(
			"item_list_sort in ('updated-desc', 'updated-asc', 'name-asc', 'name-desc', 'created-desc', 'place-asc')",
		);
	});
	await knex.raw(`
		comment on table editor_preferences is
		'Per-user reversible editor preferences. Add future editor-specific settings here instead of storing them in authored worlds or play data.'
	`);

	await knex.schema.createTable("editor_item_activity", (table) => {
		table.uuid("world_id").notNullable().references("id").inTable("worlds").onDelete("CASCADE");
		table.text("item_id").notNullable();
		table.timestamp("created_at").notNullable();
		table.timestamp("updated_at").notNullable();
		table.primary(["world_id", "item_id"]);
		table.index(["world_id", "updated_at"]);
	});
	await knex.raw(`
		comment on table editor_item_activity is
		'Editor-only item activity used for library sorting. This is not authored world content.'
	`);
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.dropTableIfExists("editor_item_activity");
	await knex.schema.dropTableIfExists("editor_preferences");
}
