import type {Knex} from "knex";

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable("playthroughs", (table) => {
		table.integer("schema_version").notNullable().defaultTo(1);
		table.check("schema_version > 0");
	});
	await knex.schema.alterTable("playthrough_turns", (table) => {
		table.integer("schema_version").notNullable().defaultTo(1);
		table.check("schema_version > 0");
	});

	await knex.schema.createTable("storage_contract_state", (table) => {
		table.integer("singleton").primary();
		table.integer("schema_version").notNullable();
		table.text("contract_digest").notNullable();
		table.jsonb("contract").notNullable();
		table.text("validated_commit").nullable();
		table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
		table.check("singleton = 1");
		table.check("schema_version > 0");
	});

	await knex.schema.createTable("storage_migration_log", (table) => {
		table.text("migration_id").primary();
		table.integer("from_version").notNullable();
		table.integer("to_version").notNullable();
		table.text("contract_digest").notNullable();
		table.text("deployed_commit").nullable();
		table.jsonb("record_counts").notNullable();
		table.timestamp("applied_at").notNullable().defaultTo(knex.fn.now());
		table.check("from_version > 0");
		table.check("to_version = from_version + 1");
	});

	await knex.raw(`
		create function mothmark_require_current_storage_version() returns trigger as $$
		declare required_version integer;
		begin
			if current_setting('mothmark.storage_migration', true) <> '' then
				return new;
			end if;
			select schema_version into required_version from storage_contract_state where singleton = 1;
			if required_version is not null and new.schema_version <> required_version then
				raise exception 'storage schema version % is required', required_version;
			end if;
			return new;
		end;
		$$ language plpgsql
	`);
	for (const table of ["worlds", "world_versions", "playthroughs", "playthrough_turns"]) {
		await knex.raw(
			`create trigger ${table}_storage_version before insert or update on ${table} for each row execute function mothmark_require_current_storage_version()`,
		);
	}

	await knex.raw(`
		create or replace function mothmark_reject_immutable_change() returns trigger as $$
		begin
			if current_setting('mothmark.storage_migration', true) <> '' then
				if tg_table_name = 'world_versions'
					and (to_jsonb(new) - array['world', 'schema_version']) =
						(to_jsonb(old) - array['world', 'schema_version']) then
					return new;
				end if;
				if tg_table_name = 'playthrough_turns'
					and (to_jsonb(new) - array['resulting_state', 'output_messages', 'schema_version']) =
						(to_jsonb(old) - array['resulting_state', 'output_messages', 'schema_version']) then
					return new;
				end if;
			end if;
			raise exception 'immutable publication record';
		end;
		$$ language plpgsql
	`);
}

export async function down(knex: Knex): Promise<void> {
	for (const table of ["worlds", "world_versions", "playthroughs", "playthrough_turns"]) {
		await knex.raw(`drop trigger if exists ${table}_storage_version on ${table}`);
	}
	await knex.raw("drop function if exists mothmark_require_current_storage_version()");
	await knex.raw(`
		create or replace function mothmark_reject_immutable_change() returns trigger as $$
		begin
			raise exception 'immutable publication record';
		end;
		$$ language plpgsql
	`);
	await knex.schema.dropTableIfExists("storage_migration_log");
	await knex.schema.dropTableIfExists("storage_contract_state");
	await knex.schema.alterTable("playthrough_turns", (table) => {
		table.dropColumn("schema_version");
	});
	await knex.schema.alterTable("playthroughs", (table) => {
		table.dropColumn("schema_version");
	});
}
