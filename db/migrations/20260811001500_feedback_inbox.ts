import type {Knex} from "knex";

export const FEEDBACK_INBOX_CONSTRAINTS_SQL = `
	alter table feedback_messages
	add constraint feedback_messages_category_check check (category in ('bug', 'general', 'idea')),
	add constraint feedback_messages_account_type_check check (
		account_type is null or account_type in ('anonymous', 'registered')
	),
	add constraint feedback_messages_reply_email_length check (char_length(reply_email) <= 254),
	add constraint feedback_messages_subject_length check (char_length(subject) between 1 and 200),
	add constraint feedback_messages_message_length check (char_length(message) between 1 and 4000),
	add constraint feedback_messages_page_length check (page is null or char_length(page) <= 2048),
	add constraint feedback_messages_customer_receipt_status_check check (
		customer_receipt_status in ('pending', 'delivered', 'failed')
	),
	add constraint feedback_messages_notification_status_check check (
		notification_status in ('pending', 'delivered', 'failed')
	);

	alter table feedback_replies
	add constraint feedback_replies_message_length check (char_length(message) between 1 and 4000),
	add constraint feedback_replies_author_email_length check (char_length(author_email) <= 254),
	add constraint feedback_replies_author_type_check check (author_type in ('admin', 'customer')),
	add constraint feedback_replies_source_check check (source in ('admin_page', 'email')),
	add constraint feedback_replies_delivery_status_check check (
		delivery_status in ('pending', 'delivered', 'failed')
	),
	add constraint feedback_replies_admin_notification_status_check check (
		admin_notification_status in ('not_required', 'pending', 'delivered', 'failed')
	);

	alter table resend_webhook_events
	add constraint resend_webhook_events_status_check check (
		status in ('processing', 'completed', 'failed')
	)
`;

export async function up(knex: Knex): Promise<void> {
	await knex.schema.createTable("feedback_messages", (table) => {
		table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
		table.uuid("actor_user_id").nullable().references("id").inTable("users").onDelete("SET NULL");
		table.text("account_type").nullable();
		table.text("username").nullable();
		table.text("reply_email").notNullable();
		table.text("category").notNullable();
		table.text("subject").notNullable();
		table.text("message").notNullable();
		table.text("page").nullable();
		table.text("customer_receipt_status").notNullable().defaultTo("pending");
		table.text("customer_receipt_email_id").nullable().unique();
		table.text("customer_receipt_message_id").nullable().unique();
		table.text("notification_status").notNullable().defaultTo("pending");
		table.timestamp("notification_attempted_at").nullable();
		table.timestamp("viewed_at").nullable();
		table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
		table.index(["created_at"], "feedback_messages_created");
		table.index(["viewed_at", "created_at"], "feedback_messages_viewed_created");
	});

	await knex.schema.createTable("feedback_replies", (table) => {
		table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
		table
			.uuid("feedback_message_id")
			.notNullable()
			.references("id")
			.inTable("feedback_messages")
			.onDelete("CASCADE");
		table.uuid("actor_user_id").nullable().references("id").inTable("users").onDelete("SET NULL");
		table.text("author_type").notNullable();
		table.text("author_email").notNullable();
		table.text("source").notNullable();
		table.text("message").notNullable();
		table.text("delivery_status").notNullable().defaultTo("pending");
		table.timestamp("delivery_attempted_at").nullable();
		table.text("admin_notification_status").notNullable().defaultTo("not_required");
		table.text("source_resend_email_id").nullable().unique();
		table.text("source_message_id").nullable().unique();
		table.text("sent_resend_email_id").nullable().unique();
		table.text("sent_message_id").nullable().unique();
		table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
		table.index(["feedback_message_id", "created_at"], "feedback_replies_message_created");
	});

	await knex.schema.createTable("resend_webhook_events", (table) => {
		table.text("svix_id").primary();
		table.text("event_type").notNullable();
		table.text("email_id").nullable();
		table.text("status").notNullable().defaultTo("processing");
		table.integer("attempts").notNullable().defaultTo(1);
		table.text("last_error").nullable();
		table.timestamp("claimed_at").notNullable().defaultTo(knex.fn.now());
		table.timestamp("completed_at").nullable();
		table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
		table.index(["status", "claimed_at"], "resend_webhook_events_status_claimed");
	});

	await knex.raw(FEEDBACK_INBOX_CONSTRAINTS_SQL);
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.dropTableIfExists("resend_webhook_events");
	await knex.schema.dropTableIfExists("feedback_replies");
	await knex.schema.dropTableIfExists("feedback_messages");
}
