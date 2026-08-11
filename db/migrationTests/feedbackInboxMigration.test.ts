import {FEEDBACK_INBOX_CONSTRAINTS_SQL} from "../migrations/20260811001500_feedback_inbox";

describe("feedback inbox migration", () => {
	it("bounds retained contact information and message content", () => {
		expect(FEEDBACK_INBOX_CONSTRAINTS_SQL).toContain("char_length(reply_email) <= 254");
		expect(FEEDBACK_INBOX_CONSTRAINTS_SQL).toContain("char_length(author_email) <= 254");
		expect(FEEDBACK_INBOX_CONSTRAINTS_SQL).toContain("char_length(subject) between 1 and 200");
		expect(FEEDBACK_INBOX_CONSTRAINTS_SQL).toContain("char_length(message) between 1 and 4000");
		expect(FEEDBACK_INBOX_CONSTRAINTS_SQL).toContain("char_length(page) <= 2048");
	});

	it("limits notification and reply delivery states", () => {
		expect(FEEDBACK_INBOX_CONSTRAINTS_SQL).toContain(
			"notification_status in ('pending', 'delivered', 'failed')",
		);
		expect(FEEDBACK_INBOX_CONSTRAINTS_SQL).toContain(
			"delivery_status in ('pending', 'delivered', 'failed')",
		);
		expect(FEEDBACK_INBOX_CONSTRAINTS_SQL).toContain(
			"admin_notification_status in ('not_required', 'pending', 'delivered', 'failed')",
		);
		expect(FEEDBACK_INBOX_CONSTRAINTS_SQL).toContain(
			"status in ('processing', 'completed', 'failed')",
		);
	});
});
