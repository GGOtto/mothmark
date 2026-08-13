import type {Knex} from "knex";

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable("world_publications", (table) => {
		table.boolean("is_official").notNullable().defaultTo(false);
		table.boolean("listed_on_homepage").notNullable().defaultTo(false);
		table.integer("homepage_position").nullable();
		table.index(
			["status", "visibility", "is_official", "listed_on_homepage"],
			"world_publications_discovery_index",
		);
	});
	await knex.raw(`
		alter table world_publications
		add constraint world_publications_homepage_curation_complete
		check (
			(not listed_on_homepage and homepage_position is null)
			or (
				listed_on_homepage
				and is_official
				and visibility = 'listed'
				and homepage_position > 0
			)
		)
	`);
}

export async function down(knex: Knex): Promise<void> {
	await knex.raw(`
		alter table world_publications
		drop constraint if exists world_publications_homepage_curation_complete
	`);
	await knex.schema.alterTable("world_publications", (table) => {
		table.dropIndex(
			["status", "visibility", "is_official", "listed_on_homepage"],
			"world_publications_discovery_index",
		);
		table.dropColumn("homepage_position");
		table.dropColumn("listed_on_homepage");
		table.dropColumn("is_official");
	});
}
