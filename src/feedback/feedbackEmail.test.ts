/** @jest-environment node */

import {feedbackEmailIsConfigured, sendFeedbackEmail} from "./feedbackEmail";

describe("feedback email", () => {
	const originalEnvironment = {...process.env};

	beforeEach(() => {
		process.env.RESEND_API_KEY = "resend-key";
		process.env.AUTH_EMAIL_FROM = "Mothmark <feedback@mothmark.test>";
		process.env.FEEDBACK_EMAIL_TO = "owner@mothmark.test";
	});

	afterAll(() => {
		process.env = originalEnvironment;
	});

	it("requires a dedicated feedback recipient", () => {
		expect(feedbackEmailIsConfigured()).toBe(true);
		delete process.env.FEEDBACK_EMAIL_TO;
		expect(feedbackEmailIsConfigured()).toBe(false);
	});

	it("sends the message and account context only to the configured recipient", async () => {
		const request = jest.spyOn(global, "fetch").mockResolvedValue(new Response(null, {status: 202}));

		await sendFeedbackEmail({
			accountEmail: "author@example.test",
			accountType: "registered",
			category: "bug",
			message: "The publish button did not respond.",
			page: "https://mothmark.test/worlds/example",
			username: "archivekeeper",
		});

		expect(request).toHaveBeenCalledWith(
			"https://api.resend.com/emails",
			expect.objectContaining({
				headers: {
					authorization: "Bearer resend-key",
					"content-type": "application/json",
				},
				method: "POST",
			}),
		);
		const options = request.mock.calls[0][1] as RequestInit;
		expect(JSON.parse(String(options.body))).toEqual({
			from: "Mothmark <feedback@mothmark.test>",
			to: ["owner@mothmark.test"],
			subject: "Mothmark feedback: bug",
			text: [
				"Category: bug",
				"From: archivekeeper",
				"Account type: registered",
				"Page: https://mothmark.test/worlds/example",
				"",
				"The publish button did not respond.",
			].join("\n"),
		});
	});
});
