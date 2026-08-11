/** @jest-environment node */

import {
	feedbackEmailIsConfigured,
	feedbackReceivingIsConfigured,
	retrieveReceivedFeedbackEmail,
	sendCustomerFeedbackReceipt,
	sendFeedbackEmail,
	sendFeedbackReplyEmail,
} from "./feedbackEmail";

describe("feedback email", () => {
	const originalEnvironment = {...process.env};
	const feedbackId = "3e816c4d-b957-45dc-8523-d53ec04c8d0f";

	beforeEach(() => {
		jest.restoreAllMocks();
		process.env.RESEND_API_KEY = "full-access-key";
		process.env.PUBLIC_APP_ORIGIN = "https://mothmark.test";
		process.env.RESEND_WEBHOOK_SECRET = "whsec_test";
	});

	afterAll(() => {
		process.env = originalEnvironment;
	});

	it("uses one full-access key and separately requires webhook verification", () => {
		expect(feedbackEmailIsConfigured()).toBe(true);
		expect(feedbackReceivingIsConfigured()).toBe(true);
		delete process.env.RESEND_WEBHOOK_SECRET;
		expect(feedbackEmailIsConfigured()).toBe(false);
		expect(feedbackReceivingIsConfigured()).toBe(false);
		process.env.RESEND_WEBHOOK_SECRET = "whsec_test";
		delete process.env.PUBLIC_APP_ORIGIN;
		expect(feedbackEmailIsConfigured()).toBe(false);
	});

	it("sends the customer a receipt in the support conversation", async () => {
		const request = jest
			.spyOn(global, "fetch")
			.mockResolvedValue(new Response(JSON.stringify({id: "receipt-email-id"}), {status: 200}));

		await expect(
			sendCustomerFeedbackReceipt({
				category: "idea",
				feedbackId,
				message: "Please add an inbox.",
				subject: "Mothmark support: idea",
				to: "reader@example.test",
			}),
		).resolves.toEqual({resendEmailId: "receipt-email-id"});
		const options = request.mock.calls[0][1] as RequestInit;
		expect(JSON.parse(String(options.body))).toMatchObject({
			from: "Mothmark Support <support@mothmark.app>",
			reply_to: `support+${feedbackId}@mothmark.app`,
			subject: "Mothmark support: idea",
			to: ["reader@example.test"],
		});
	});

	it("sends the message and account context separately to every administrator", async () => {
		const request = jest.spyOn(global, "fetch").mockResolvedValue(new Response(null, {status: 202}));

		await sendFeedbackEmail({
			accountEmail: "author@example.test",
			accountType: "registered",
			category: "bug",
			feedbackId,
			message: "The publish button did not respond.",
			page: "https://mothmark.test/worlds/example",
			recipients: ["first-admin@example.test", "second-admin@example.test"],
			replyEmail: "author@example.test",
			subject: "Mothmark support: bug",
			username: "archivekeeper",
		});

		expect(request).toHaveBeenCalledTimes(2);
		const bodies = request.mock.calls.map(([, options]) =>
			JSON.parse(String((options as RequestInit).body)),
		);
		expect(bodies.map(({to}) => to)).toEqual([
			["first-admin@example.test"],
			["second-admin@example.test"],
		]);
		for (const body of bodies) {
			expect(body).toMatchObject({
				from: "Mothmark Support <support@mothmark.app>",
				reply_to: `support+${feedbackId}@mothmark.app`,
				subject: "Mothmark support: bug",
			});
			expect(body.text).toContain("Customer email: author@example.test");
			expect(body.text).toContain(`https://mothmark.test/admin/feedback/${feedbackId}`);
		}
	});

	it("delivers a threaded support reply to the customer and every admin inbox", async () => {
		const request = jest
			.spyOn(global, "fetch")
			.mockResolvedValue(new Response(JSON.stringify({id: "reply-email-id"}), {status: 200}));

		await expect(
			sendFeedbackReplyEmail({
				adminRecipients: ["first-admin@example.test", "second-admin@example.test"],
				feedbackId,
				message: "Thanks. We have added this to the plan.",
				messageIds: ["<receipt@example.test>", "<customer-reply@example.test>"],
				replyId: "8ebc3f3f-b9ca-4f75-898f-e196bae50be4",
				subject: "Mothmark support: idea",
				to: "reader@example.test",
			}),
		).resolves.toEqual({resendEmailId: "reply-email-id"});

		const options = request.mock.calls[0][1] as RequestInit;
		expect(options.headers).toMatchObject({
			authorization: "Bearer full-access-key",
			"idempotency-key": "feedback-reply/8ebc3f3f-b9ca-4f75-898f-e196bae50be4",
		});
		expect(JSON.parse(String(options.body))).toMatchObject({
			bcc: ["first-admin@example.test", "second-admin@example.test"],
			from: "Mothmark Support <support@mothmark.app>",
			headers: {
				"In-Reply-To": "<customer-reply@example.test>",
				References: "<receipt@example.test> <customer-reply@example.test>",
			},
			reply_to: `support+${feedbackId}@mothmark.app`,
			subject: "Re: Mothmark support: idea",
			to: ["reader@example.test"],
		});
	});

	it("uses the same full-access key when retrieving a received message", async () => {
		const request = jest.spyOn(global, "fetch").mockResolvedValue(
			new Response(
				JSON.stringify({
					from: "Reader <reader@example.test>",
					message_id: "<received@example.test>",
					text: "A reply from the customer.",
					to: [`support+${feedbackId}@mothmark.app`],
				}),
				{status: 200},
			),
		);

		await expect(retrieveReceivedFeedbackEmail("received-email-id")).resolves.toMatchObject({
			from: "Reader <reader@example.test>",
			messageId: "<received@example.test>",
			text: "A reply from the customer.",
		});
		expect(request).toHaveBeenCalledWith(
			"https://api.resend.com/emails/receiving/received-email-id",
			{headers: {authorization: "Bearer full-access-key"}},
		);
	});

	it("stores only the newly written part of an inbox reply", async () => {
		jest.spyOn(global, "fetch").mockResolvedValue(
			new Response(
				JSON.stringify({
					from: "reader@example.test",
					message_id: "<received@example.test>",
					text:
						"One more detail.\n\nOn Tue, Aug 11, 2026 at 12:00 PM Mothmark Support wrote:\n> Earlier message",
					to: [`support+${feedbackId}@mothmark.app`],
				}),
				{status: 200},
			),
		);

		await expect(retrieveReceivedFeedbackEmail("received-email-id")).resolves.toMatchObject({
			text: "One more detail.",
		});
	});
});
