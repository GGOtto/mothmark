import type {Knex} from "knex";

export const PUBLIC_PROFILE_CONSTRAINTS_SQL = `
	alter table users
	add constraint users_profile_bio_length check (
		profile_bio is null or char_length(profile_bio) <= 500
	),
	add constraint users_profile_website_length check (
		profile_website is null or char_length(profile_website) <= 2048
	)
`;

export const CLEAR_LEGACY_EMAIL_DISPLAY_NAMES_SQL = `
	update users as user_account
	set display_name = null, updated_at = now()
	from user_emails as user_email
	where user_email.user_id = user_account.id
		and user_account.account_type = 'registered'
		and lower(trim(user_account.display_name)) = lower(trim(user_email.email))
`;

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable("users", (table) => {
		table.text("profile_bio").nullable();
		table.text("profile_website").nullable();
	});
	await knex.raw(PUBLIC_PROFILE_CONSTRAINTS_SQL);
	await knex.raw(CLEAR_LEGACY_EMAIL_DISPLAY_NAMES_SQL);
}

export async function down(knex: Knex): Promise<void> {
	await knex.raw(`
		alter table users
		drop constraint if exists users_profile_website_length,
		drop constraint if exists users_profile_bio_length
	`);
	await knex.schema.alterTable("users", (table) => {
		table.dropColumn("profile_website");
		table.dropColumn("profile_bio");
	});
}
