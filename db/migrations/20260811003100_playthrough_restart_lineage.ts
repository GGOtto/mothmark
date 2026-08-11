import type {Knex} from "knex";

export const PLAYTHROUGH_RESTART_LINEAGE_CONSTRAINT_SQL = `
	alter table playthroughs
	add constraint playthroughs_restart_lineage_complete check (
		(
			restarted_from_playthrough_id is null
			and restart_request_id is null
			and restart_source is null
			and restart_reason is null
			and restart_from_release_id is null
			and restarted_at is null
		)
		or
		(
			restarted_from_playthrough_id is not null
			and restart_request_id is not null
			and restart_source is not null
			and restart_reason is not null
			and restart_from_release_id is not null
			and restarted_at is not null
		)
	),
	add constraint playthroughs_restart_source_check check (
		restart_source is null or restart_source in ('player_menu', 'release_notice', 'play_again')
	),
	add constraint playthroughs_restart_reason_check check (
		restart_reason is null or restart_reason in ('manual_restart', 'new_release', 'replay_completed')
	),
	add constraint playthroughs_restart_not_self check (
		restarted_from_playthrough_id is null or restarted_from_playthrough_id <> id
	)
`;

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable("playthroughs", (table) => {
		table
			.uuid("restarted_from_playthrough_id")
			.nullable()
			.references("id")
			.inTable("playthroughs")
			.onDelete("CASCADE");
		table
			.uuid("restart_initiated_by_user_id")
			.nullable()
			.references("id")
			.inTable("users")
			.onDelete("SET NULL");
		table.uuid("restart_request_id").nullable();
		table.text("restart_source").nullable();
		table.text("restart_reason").nullable();
		table
			.uuid("restart_from_release_id")
			.nullable()
			.references("id")
			.inTable("world_releases")
			.onDelete("RESTRICT");
		table.timestamp("restarted_at").nullable();
	});
	await knex.raw(PLAYTHROUGH_RESTART_LINEAGE_CONSTRAINT_SQL);
	await knex.raw(`
		create unique index playthroughs_restart_request_unique
		on playthroughs (restart_request_id)
		where restart_request_id is not null
	`);
	await knex.raw(`
		create unique index playthroughs_single_restart_successor
		on playthroughs (restarted_from_playthrough_id)
		where restarted_from_playthrough_id is not null
	`);
}

export async function down(knex: Knex): Promise<void> {
	await knex.raw("drop index if exists playthroughs_single_restart_successor");
	await knex.raw("drop index if exists playthroughs_restart_request_unique");
	await knex.raw("alter table playthroughs drop constraint if exists playthroughs_restart_not_self");
	await knex.raw(
		"alter table playthroughs drop constraint if exists playthroughs_restart_reason_check",
	);
	await knex.raw(
		"alter table playthroughs drop constraint if exists playthroughs_restart_source_check",
	);
	await knex.raw(
		"alter table playthroughs drop constraint if exists playthroughs_restart_lineage_complete",
	);
	await knex.schema.alterTable("playthroughs", (table) => {
		table.dropColumn("restarted_at");
		table.dropColumn("restart_from_release_id");
		table.dropColumn("restart_reason");
		table.dropColumn("restart_source");
		table.dropColumn("restart_request_id");
		table.dropColumn("restart_initiated_by_user_id");
		table.dropColumn("restarted_from_playthrough_id");
	});
}
