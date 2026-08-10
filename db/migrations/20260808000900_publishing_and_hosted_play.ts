import type {Knex} from "knex";

export async function up(knex: Knex): Promise<void> {
	await knex.schema.createTable("world_versions", (table) => {
		table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
		table.uuid("world_id").notNullable().references("id").inTable("worlds").onDelete("RESTRICT");
		table.integer("revision").notNullable();
		table.jsonb("world").notNullable();
		table.integer("schema_version").notNullable();
		table.text("engine_version").notNullable();
		table
			.uuid("created_by_user_id")
			.nullable()
			.references("id")
			.inTable("users")
			.onDelete("SET NULL");
		table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
		table.unique(["world_id", "revision"]);
		table.check("revision > 0");
		table.check("schema_version > 0");
	});

	await knex.schema.createTable("world_publications", (table) => {
		table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
		table
			.uuid("world_id")
			.notNullable()
			.unique()
			.references("id")
			.inTable("worlds")
			.onDelete("RESTRICT");
		table.text("slug").notNullable().unique();
		table.text("status").notNullable().defaultTo("published");
		table.text("visibility").notNullable();
		table
			.uuid("created_by_user_id")
			.nullable()
			.references("id")
			.inTable("users")
			.onDelete("SET NULL");
		table.timestamp("published_at").notNullable().defaultTo(knex.fn.now());
		table.timestamp("unpublished_at").nullable();
		table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
		table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
		table.check("status in ('published', 'unpublished', 'suspended')");
		table.check("visibility in ('listed', 'unlisted')");
		table.index(["status", "visibility", "published_at"]);
	});

	await knex.schema.createTable("world_releases", (table) => {
		table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
		table
			.uuid("publication_id")
			.notNullable()
			.references("id")
			.inTable("world_publications")
			.onDelete("RESTRICT");
		table
			.uuid("world_version_id")
			.notNullable()
			.references("id")
			.inTable("world_versions")
			.onDelete("RESTRICT");
		table.integer("release_number").notNullable();
		table.text("title").notNullable();
		table.text("summary").notNullable();
		table
			.uuid("published_by_user_id")
			.nullable()
			.references("id")
			.inTable("users")
			.onDelete("SET NULL");
		table.timestamp("published_at").notNullable().defaultTo(knex.fn.now());
		table.unique(["publication_id", "release_number"]);
		table.unique(["publication_id", "world_version_id"]);
		table.check("release_number > 0");
	});

	await knex.schema.alterTable("world_publications", (table) => {
		table
			.uuid("current_release_id")
			.nullable()
			.references("id")
			.inTable("world_releases")
			.onDelete("RESTRICT");
	});

	await knex.schema.createTable("playthroughs", (table) => {
		table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
		table.uuid("player_user_id").nullable().references("id").inTable("users").onDelete("SET NULL");
		table
			.uuid("publication_id")
			.notNullable()
			.references("id")
			.inTable("world_publications")
			.onDelete("RESTRICT");
		table
			.uuid("release_id")
			.notNullable()
			.references("id")
			.inTable("world_releases")
			.onDelete("RESTRICT");
		table.uuid("world_id").notNullable().references("id").inTable("worlds").onDelete("RESTRICT");
		table
			.uuid("world_version_id")
			.notNullable()
			.references("id")
			.inTable("world_versions")
			.onDelete("RESTRICT");
		table.text("commands").notNullable().defaultTo("");
		table.text("transcript").notNullable().defaultTo("");
		table.jsonb("current_state").notNullable();
		table.integer("command_count").notNullable().defaultTo(0);
		table.integer("revision").notNullable().defaultTo(1);
		table.text("status").notNullable().defaultTo("active");
		table.timestamp("started_at").notNullable().defaultTo(knex.fn.now());
		table.timestamp("last_command_at").nullable();
		table.timestamp("ended_at").nullable();
		table.timestamp("anonymized_at").nullable();
		table.timestamp("purge_after").nullable();
		table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
		table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
		table.check("command_count >= 0");
		table.check("revision > 0");
		table.check("status in ('active', 'completed', 'abandoned', 'errored')");
		table.index(["publication_id", "updated_at"]);
		table.index(["purge_after"]);
	});
	await knex.raw(
		"create unique index playthroughs_one_active_per_player_publication on playthroughs (player_user_id, publication_id) where status = 'active' and player_user_id is not null",
	);

	await knex.schema.createTable("playthrough_turns", (table) => {
		table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
		table
			.uuid("playthrough_id")
			.notNullable()
			.references("id")
			.inTable("playthroughs")
			.onDelete("CASCADE");
		table.integer("sequence").notNullable();
		table.text("command").notNullable();
		table.jsonb("output_messages").notNullable();
		table.jsonb("resulting_state").notNullable();
		table.text("engine_version").notNullable();
		table.timestamp("accepted_at").notNullable().defaultTo(knex.fn.now());
		table.unique(["playthrough_id", "sequence"]);
		table.check("sequence > 0");
	});

	await knex.raw(`
		create function mothmark_reject_immutable_change() returns trigger as $$
		begin
			raise exception 'immutable publication record';
		end;
		$$ language plpgsql
	`);
	for (const table of ["world_versions", "world_releases", "playthrough_turns"]) {
		await knex.raw(
			`create trigger ${table}_immutable before update on ${table} for each row execute function mothmark_reject_immutable_change()`,
		);
	}
}

export async function down(knex: Knex): Promise<void> {
	for (const table of ["world_versions", "world_releases", "playthrough_turns"]) {
		await knex.raw(`drop trigger if exists ${table}_immutable on ${table}`);
	}
	await knex.raw("drop function if exists mothmark_reject_immutable_change()");
	await knex.schema.dropTableIfExists("playthrough_turns");
	await knex.schema.dropTableIfExists("playthroughs");
	await knex.schema.alterTable("world_publications", (table) =>
		table.dropColumn("current_release_id"),
	);
	await knex.schema.dropTableIfExists("world_releases");
	await knex.schema.dropTableIfExists("world_publications");
	await knex.schema.dropTableIfExists("world_versions");
}
