import type {Knex} from "knex";

export const FEEDBACK_ADMIN_EMAIL_MESSAGES_CONSTRAINTS_SQL = `
	alter table feedback_admin_email_messages
	add constraint feedback_admin_email_messages_recipient_length check (
		char_length(recipient_email) between 3 and 254
	),
	add constraint feedback_admin_email_messages_kind_check check (
		message_kind in ('admin_notification', 'admin_conversation_copy', 'admin_inbound_reply')
	),
	add constraint feedback_admin_email_messages_message_id_length check (
		char_length(message_id) between 1 and 998
	)
`;

export async function up(knex: Knex): Promise<void> {
	await knex.schema.createTable("feedback_admin_email_messages", (table) => {
		table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
		table
			.uuid("feedback_message_id")
			.notNullable()
			.references("id")
			.inTable("feedback_messages")
			.onDelete("CASCADE");
		table
			.uuid("feedback_reply_id")
			.nullable()
			.references("id")
			.inTable("feedback_replies")
			.onDelete("CASCADE");
		table.text("recipient_email").notNullable();
		table.text("message_kind").notNullable();
		table.text("message_id").notNullable().unique();
		table.text("resend_email_id").nullable().unique();
		table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
		table.index(
			["feedback_message_id", "recipient_email", "created_at"],
			"feedback_admin_email_messages_thread",
		);
	});

	await knex.raw(FEEDBACK_ADMIN_EMAIL_MESSAGES_CONSTRAINTS_SQL);
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.dropTableIfExists("feedback_admin_email_messages");
}
