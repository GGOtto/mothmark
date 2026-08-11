import type {Knex} from "knex";

export const SESSION_CLIENT_LABEL_CONSTRAINT_SQL = `
	alter table sessions
	add constraint sessions_client_label_length check (
		client_label is null or char_length(client_label) <= 120
	)
`;

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable("sessions", (table) => {
		table.text("client_label").nullable();
	});
	await knex.raw(SESSION_CLIENT_LABEL_CONSTRAINT_SQL);
}

export async function down(knex: Knex): Promise<void> {
	await knex.raw("alter table sessions drop constraint if exists sessions_client_label_length");
	await knex.schema.alterTable("sessions", (table) => {
		table.dropColumn("client_label");
	});
}
