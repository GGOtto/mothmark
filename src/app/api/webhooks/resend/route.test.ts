/** @jest-environment node */

import {
	claimResendWebhookEvent,
	createInboundFeedbackReply,
	finishResendWebhookEvent,
	listActiveAdministratorEmails,
	markFeedbackReplyAdminNotification,
	recordResendSentMessage,
	setFeedbackReplyDelivery,
} from "@/db/dbal/feedbackRepository";
import {
	retrieveReceivedFeedbackEmail,
	sendCustomerReplyAdminNotifications,
	sendFeedbackReplyEmail,
} from "@/feedback/feedbackEmail";

import {POST} from "./route";

jest.mock("svix", () => ({
	Webhook: class MockWebhook {
		verify(payload: string, headers: Record<string, string>) {
			if (headers["svix-signature"] !== "valid") throw new Error("Invalid signature");
			return JSON.parse(payload);
		}
	},
}));
jest.mock("@/db/dbal/feedbackRepository", () => ({
	claimResendWebhookEvent: jest.fn(),
	createInboundFeedbackReply: jest.fn(),
	finishResendWebhookEvent: jest.fn(),
	listActiveAdministratorEmails: jest.fn(),
	markFeedbackReplyAdminNotification: jest.fn(),
	recordResendSentMessage: jest.fn(),
	setFeedbackReplyDelivery: jest.fn(),
}));
jest.mock("@/feedback/feedbackEmail", () => ({
	feedbackReceivingIsConfigured: jest.fn(() => true),
	feedbackReplyDomain: jest.fn(() => "mothmark.app"),
	mailboxAddress: jest.fn((value: string) => {
		const match = value.match(/<([^<>]+)>/);
		return (match?.[1] ?? value).trim().toLowerCase();
	}),
	retrieveReceivedFeedbackEmail: jest.fn(),
	sendCustomerReplyAdminNotifications: jest.fn(),
	sendFeedbackReplyEmail: jest.fn(),
}));

const feedbackId = "3e816c4d-b957-45dc-8523-d53ec04c8d0f";
const replyId = "8ebc3f3f-b9ca-4f75-898f-e196bae50be4";
const originalEnvironment = {...process.env};

const webhookRequest = (event: unknown, signature = "valid") =>
	new Request("http://localhost/api/webhooks/resend", {
		body: JSON.stringify(event),
		headers: {
			"content-type": "application/json",
			"svix-id": "msg_webhook_event",
			"svix-signature": signature,
			"svix-timestamp": "1786478400",
		},
		method: "POST",
	});

const receivedEvent = (from: string) => ({
	data: {
		email_id: "received-email-id",
		from,
		message_id: "<received@example.test>",
		to: [`support+${feedbackId}@mothmark.app`],
	},
	type: "email.received",
});

const thread = {
	feedbackId,
	messageIds: ["<receipt@example.test>"],
	replyEmail: "reader@example.test",
	subject: "Mothmark support: idea",
};

describe("Resend feedback webhook", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		process.env.PUBLIC_APP_ORIGIN = "https://mothmark.test";
		process.env.RESEND_WEBHOOK_SECRET = "whsec_test";
		jest.mocked(claimResendWebhookEvent).mockResolvedValue(true);
		jest.mocked(finishResendWebhookEvent).mockResolvedValue(undefined);
		jest
			.mocked(listActiveAdministratorEmails)
			.mockResolvedValue(["admin@example.test", "second-admin@example.test"]);
		jest.mocked(markFeedbackReplyAdminNotification).mockResolvedValue(undefined);
		jest.mocked(setFeedbackReplyDelivery).mockResolvedValue(undefined);
		jest.mocked(sendCustomerReplyAdminNotifications).mockResolvedValue(undefined);
		jest.mocked(sendFeedbackReplyEmail).mockResolvedValue({resendEmailId: "relayed-email-id"});
	});

	afterAll(() => {
		process.env = originalEnvironment;
	});

	it("rejects an invalid webhook signature before touching storage", async () => {
		const response = await POST(webhookRequest(receivedEvent("reader@example.test"), "invalid"));

		expect(response.status).toBe(401);
		expect(claimResendWebhookEvent).not.toHaveBeenCalled();
	});

	it("imports a customer email reply and sends it to every admin inbox", async () => {
		jest.mocked(retrieveReceivedFeedbackEmail).mockResolvedValue({
			from: "Reader <reader@example.test>",
			messageId: "<received@example.test>",
			text: "Here is more detail.",
			to: [`support+${feedbackId}@mothmark.app`],
		});
		jest.mocked(createInboundFeedbackReply).mockResolvedValue({
			authorType: "customer",
			reply: {
				actorUserId: null,
				authorEmail: "reader@example.test",
				authorType: "customer",
				createdAt: "2026-08-11T12:10:00.000Z",
				deliveryAttemptedAt: null,
				deliveryStatus: "delivered",
				id: replyId,
				message: "Here is more detail.",
				source: "email",
			},
			thread,
		});

		const response = await POST(webhookRequest(receivedEvent("reader@example.test")));

		expect(response.status).toBe(200);
		expect(createInboundFeedbackReply).toHaveBeenCalledWith({
			feedbackId,
			message: "Here is more detail.",
			messageId: "<received@example.test>",
			resendEmailId: "received-email-id",
			senderEmail: "reader@example.test",
		});
		expect(sendCustomerReplyAdminNotifications).toHaveBeenCalledWith({
			adminUrl: `https://mothmark.test/admin/feedback/${feedbackId}`,
			feedbackId,
			message: "Here is more detail.",
			messageId: "<received@example.test>",
			recipients: ["admin@example.test", "second-admin@example.test"],
			replyId,
			subject: "Mothmark support: idea",
		});
		expect(markFeedbackReplyAdminNotification).toHaveBeenCalledWith({
			replyId,
			status: "delivered",
		});
	});

	it("relays an administrator inbox reply to the customer from support", async () => {
		jest.mocked(retrieveReceivedFeedbackEmail).mockResolvedValue({
			from: "Admin <admin@example.test>",
			messageId: "<admin-reply@example.test>",
			text: "Thanks for the extra detail.",
			to: [`support+${feedbackId}@mothmark.app`],
		});
		jest.mocked(createInboundFeedbackReply).mockResolvedValue({
			authorType: "admin",
			reply: {
				actorUserId: "fa64011c-a260-4712-baca-c8b0334b4740",
				authorEmail: "admin@example.test",
				authorType: "admin",
				createdAt: "2026-08-11T12:10:00.000Z",
				deliveryAttemptedAt: null,
				deliveryStatus: "pending",
				id: replyId,
				message: "Thanks for the extra detail.",
				source: "email",
			},
			thread,
		});

		const response = await POST(webhookRequest(receivedEvent("admin@example.test")));

		expect(response.status).toBe(200);
		expect(sendFeedbackReplyEmail).toHaveBeenCalledWith({
			adminRecipients: ["admin@example.test", "second-admin@example.test"],
			feedbackId,
			message: "Thanks for the extra detail.",
			messageIds: ["<receipt@example.test>"],
			replyId,
			subject: "Mothmark support: idea",
			to: "reader@example.test",
		});
		expect(setFeedbackReplyDelivery).toHaveBeenCalledWith({
			replyId,
			resendEmailId: "relayed-email-id",
			status: "delivered",
		});
	});

	it("records Resend message IDs used for future threading", async () => {
		const response = await POST(
			webhookRequest({
				data: {
					email_id: "sent-email-id",
					message_id: "<sent@example.test>",
					tags: {
						feedback_id: feedbackId,
						message_kind: "customer_receipt",
					},
				},
				type: "email.sent",
			}),
		);

		expect(response.status).toBe(200);
		expect(recordResendSentMessage).toHaveBeenCalledWith({
			feedbackId,
			messageId: "<sent@example.test>",
			messageKind: "customer_receipt",
			replyId: undefined,
			resendEmailId: "sent-email-id",
		});
	});

	it("acknowledges a duplicate event without sending again", async () => {
		jest.mocked(claimResendWebhookEvent).mockResolvedValue(false);

		const response = await POST(webhookRequest(receivedEvent("reader@example.test")));

		expect(response.status).toBe(200);
		expect(retrieveReceivedFeedbackEmail).not.toHaveBeenCalled();
		expect(sendFeedbackReplyEmail).not.toHaveBeenCalled();
	});
});
