import type {Knex} from "knex";

import {world as compactStarterWorld} from "../../src/data/worlds/initialWorld";

const ACTIVE_TEMPLATE_SLUG = "main";
const PREVIOUS_TEMPLATE_SLUG = "main-before-compact-starter";

export async function up(knex: Knex): Promise<void> {
	await knex.transaction(async (transaction) => {
		const previousTemplate = await transaction("worlds")
			.where({kind: "template", slug: ACTIVE_TEMPLATE_SLUG})
			.forUpdate()
			.first();
		if (previousTemplate) {
			await transaction("worlds")
				.where({id: previousTemplate.id})
				.update({slug: PREVIOUS_TEMPLATE_SLUG});
		}
		await transaction("worlds").insert({
			name: compactStarterWorld.metadata.title,
			slug: ACTIVE_TEMPLATE_SLUG,
			world: compactStarterWorld,
			schema_version: 1,
			kind: "template",
			owner_user_id: null,
			updated_by_user_id: null,
		});
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.transaction(async (transaction) => {
		await transaction("worlds").where({kind: "template", slug: ACTIVE_TEMPLATE_SLUG}).delete();
		await transaction("worlds")
			.where({kind: "template", slug: PREVIOUS_TEMPLATE_SLUG})
			.update({slug: ACTIVE_TEMPLATE_SLUG});
	});
}
