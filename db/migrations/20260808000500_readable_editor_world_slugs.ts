import type {Knex} from "knex";

import {createUniqueWorldSlug} from "../../src/utils/worldSlug";

type EditorWorldRow = {
	id: string;
	name: string;
	owner_user_id: string;
};

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable("worlds", (table) => {
		table.text("editor_slug").nullable();
	});

	const worlds = await knex<EditorWorldRow>("worlds")
		.select("id", "name", "owner_user_id")
		.where("kind", "editor")
		.whereNotNull("owner_user_id")
		.orderBy("owner_user_id", "asc")
		.orderBy("created_at", "asc")
		.orderBy("id", "asc");
	const slugsByOwner = new Map<string, Set<string>>();
	for (const world of worlds) {
		const existing = slugsByOwner.get(world.owner_user_id) ?? new Set<string>();
		const editorSlug = createUniqueWorldSlug(world.name, existing);
		existing.add(editorSlug);
		slugsByOwner.set(world.owner_user_id, existing);
		await knex("worlds").where({id: world.id}).update({editor_slug: editorSlug});
	}

	await knex.raw(
		"alter table worlds add constraint worlds_editor_slug_check check ((kind = 'editor' and editor_slug is not null) or (kind = 'template' and editor_slug is null))",
	);
	await knex.raw(
		"create unique index worlds_owner_editor_slug_unique on worlds (owner_user_id, editor_slug) where kind = 'editor'",
	);
}

export async function down(knex: Knex): Promise<void> {
	await knex.raw("drop index if exists worlds_owner_editor_slug_unique");
	await knex.raw("alter table worlds drop constraint if exists worlds_editor_slug_check");
	await knex.schema.alterTable("worlds", (table) => {
		table.dropColumn("editor_slug");
	});
}
