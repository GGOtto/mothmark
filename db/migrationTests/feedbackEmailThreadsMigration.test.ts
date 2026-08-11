import {FEEDBACK_ADMIN_EMAIL_MESSAGES_CONSTRAINTS_SQL} from "../migrations/20260811003000_feedback_email_threads";

describe("feedback email threads migration", () => {
	it("constrains mailbox thread records to supported message kinds and bounded identifiers", () => {
		expect(FEEDBACK_ADMIN_EMAIL_MESSAGES_CONSTRAINTS_SQL).toContain(
			"'admin_notification', 'admin_conversation_copy', 'admin_inbound_reply'",
		);
		expect(FEEDBACK_ADMIN_EMAIL_MESSAGES_CONSTRAINTS_SQL).toContain(
			"char_length(recipient_email) between 3 and 254",
		);
		expect(FEEDBACK_ADMIN_EMAIL_MESSAGES_CONSTRAINTS_SQL).toContain(
			"char_length(message_id) between 1 and 998",
		);
	});
});
