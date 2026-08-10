import type {Knex} from "knex";

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable("users", (table) => {
		table.text("username").nullable();
	});
	await knex.schema.alterTable("account_registrations", (table) => {
		table.text("username").nullable();
	});

	await knex.raw(`
		update users
		set username = 'user-' || substring(replace(id::text, '-', '') from 1 for 12)
		where account_type = 'registered' and username is null
	`);
	await knex.raw(`
		update account_registrations
		set username = 'pending-' || substring(replace(id::text, '-', '') from 1 for 12)
		where username is null
	`);

	await knex.schema.alterTable("account_registrations", (table) => {
		table.text("username").notNullable().alter();
	});
	await knex.raw(`
		alter table users
		add constraint users_registered_username_required
		check (account_type <> 'registered' or username is not null),
		add constraint users_username_format
		check (username is null or username ~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,29}$')
	`);
	await knex.raw(`
		alter table account_registrations
		add constraint account_registrations_username_format
		check (username ~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,29}$')
	`);
	await knex.raw(
		"create unique index users_username_unique on users (lower(username)) where username is not null",
	);
	await knex.raw(`
		create unique index account_registrations_pending_username_unique
		on account_registrations (lower(username))
		where completed_at is null and superseded_at is null
	`);
}

export async function down(knex: Knex): Promise<void> {
	await knex.raw("drop index if exists account_registrations_pending_username_unique");
	await knex.raw("drop index if exists users_username_unique");
	await knex.schema.alterTable("account_registrations", (table) => {
		table.dropColumn("username");
	});
	await knex.schema.alterTable("users", (table) => {
		table.dropColumn("username");
	});
}
