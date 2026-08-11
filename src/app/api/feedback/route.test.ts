/** @jest-environment node */

import {resolveCurrentActor} from "@/auth/currentActor";
import {getOwnedAccountSummary} from "@/db/dbal/accountRepository";
import {
	createFeedbackMessage,
	enforceFeedbackRateLimit,
	FeedbackRateLimitError,
	listActiveAdministratorEmails,
	markCustomerFeedbackReceipt,
	markFeedbackNotification,
	recordFeedbackAdminSentMessages,
} from "@/db/dbal/feedbackRepository";
import {
	feedbackEmailIsConfigured,
	sendCustomerFeedbackReceipt,
	sendFeedbackEmail,
} from "@/feedback/feedbackEmail";

import {POST} from "./route";

jest.mock("@/auth/currentActor", () => ({resolveCurrentActor: jest.fn()}));
jest.mock("@/db/dbal/accountRepository", () => ({getOwnedAccountSummary: jest.fn()}));
jest.mock("@/db/dbal/feedbackRepository", () => ({
	createFeedbackMessage: jest.fn(),
	enforceFeedbackRateLimit: jest.fn(),
	FeedbackRateLimitError: class FeedbackRateLimitError extends Error {
		readonly retryAfterSeconds = 3600;
		constructor() {
			super("You can send up to 3 feedback messages per hour.");
		}
	},
	listActiveAdministratorEmails: jest.fn(),
	markCustomerFeedbackReceipt: jest.fn(),
	markFeedbackNotification: jest.fn(),
	recordFeedbackAdminSentMessages: jest.fn(),
}));
jest.mock("@/feedback/feedbackEmail", () => ({
	feedbackEmailIsConfigured: jest.fn(),
	sendCustomerFeedbackReceipt: jest.fn(),
	sendFeedbackEmail: jest.fn(),
}));

const feedbackRequest = (body: unknown) =>
	new Request("http://localhost/api/feedback", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: "http://localhost",
			cookie: "mothmark_editor_csrf=csrf",
			"x-csrf-token": "csrf",
			"x-forwarded-for": "203.0.113.7",
		},
		body: JSON.stringify(body),
	});

const registeredActor = {
	accountType: "registered",
	audience: "editor",
	siteRole: "user",
	userId: "34c21ebd-d28a-4d78-8a79-d3db740a260e",
} as const;

const registeredAccount = {
	accountType: "registered" as const,
	cleanupAfter: null,
	cleanupCancelledAt: null,
	cleanupWasRecentlyCancelled: false,
	cleanupScheduledAt: null,
	createdAt: "2026-08-11T12:00:00.000Z",
	displayName: null,
	email: "author@example.test",
	profileBio: null,
	profileWebsite: null,
	retentionClass: "empty" as const,
	sessions: [],
	siteRole: "user" as const,
	status: "active" as const,
	usage: {activeWorlds: 1, maxWorlds: 5, trashedWorlds: 0},
	userId: registeredActor.userId,
	username: "archivekeeper",
};

const anonymousActor = {
	...registeredActor,
	accountType: "anonymous" as const,
	userId: "cf4a513e-ddda-4fe6-8525-14336509a5ca",
};

const anonymousAccount = {
	...registeredAccount,
	accountType: "anonymous" as const,
	email: null,
	userId: anonymousActor.userId,
	username: null,
};

const feedbackId = "3e816c4d-b957-45dc-8523-d53ec04c8d0f";
const storedFeedback = {
	accountType: null,
	actorUserId: null,
	category: "idea" as const,
	createdAt: "2026-08-11T12:00:00.000Z",
	customerReceiptStatus: "pending" as const,
	id: feedbackId,
	message: "A focused piece of feedback.",
	notificationAttemptedAt: null,
	notificationStatus: "pending" as const,
	page: "http://localhost/play",
	replies: [],
	replyCount: 0,
	replyEmail: "reader@example.test",
	status: "new" as const,
	subject: "Mothmark support: idea",
	username: null,
	viewedAt: null,
};

describe("feedback API", () => {
	beforeEach(() => {
		jest.mocked(feedbackEmailIsConfigured).mockReturnValue(true);
		jest.mocked(resolveCurrentActor).mockResolvedValue(undefined);
		jest.mocked(enforceFeedbackRateLimit).mockResolvedValue(undefined);
		jest
			.mocked(listActiveAdministratorEmails)
			.mockResolvedValue(["first-admin@example.test", "second-admin@example.test"]);
		jest.mocked(createFeedbackMessage).mockResolvedValue(storedFeedback);
		jest.mocked(markCustomerFeedbackReceipt).mockResolvedValue(undefined);
		jest.mocked(markFeedbackNotification).mockResolvedValue(undefined);
		jest.mocked(recordFeedbackAdminSentMessages).mockResolvedValue(undefined);
		jest.mocked(sendCustomerFeedbackReceipt).mockResolvedValue({
			messageId: "<receipt@example.test>",
			resendEmailId: "receipt-email-id",
		});
		jest.mocked(sendFeedbackEmail).mockResolvedValue([
			{
				messageId: "<first-admin@example.test>",
				recipient: "first-admin@example.test",
				resendEmailId: "first-admin-email-id",
			},
			{
				messageId: "<second-admin@example.test>",
				recipient: "second-admin@example.test",
				resendEmailId: "second-admin-email-id",
			},
		]);
	});

	it("rate limits and delivers valid signed-out feedback", async () => {
		const response = await POST(
			feedbackRequest({
				category: "idea",
				includePage: true,
				message: "A focused piece of feedback.",
				page: "http://localhost/play",
				replyEmail: "reader@example.test",
				website: "",
			}),
		);

		expect(response.status).toBe(201);
		expect(enforceFeedbackRateLimit).toHaveBeenCalledWith({
			actorUserId: undefined,
			network: "203.0.113.7",
		});
		expect(createFeedbackMessage).toHaveBeenCalledWith({
			accountType: undefined,
			actorUserId: undefined,
			category: "idea",
			message: "A focused piece of feedback.",
			page: "http://localhost/play",
			replyEmail: "reader@example.test",
			username: undefined,
		});
		expect(sendFeedbackEmail).toHaveBeenCalledWith({
			accountEmail: undefined,
			accountType: undefined,
			category: "idea",
			feedbackId,
			message: "A focused piece of feedback.",
			page: "http://localhost/play",
			recipients: ["first-admin@example.test", "second-admin@example.test"],
			replyEmail: "reader@example.test",
			subject: "Mothmark support: idea",
			username: undefined,
		});
		expect(sendCustomerFeedbackReceipt).toHaveBeenCalledWith({
			category: "idea",
			feedbackId,
			message: "A focused piece of feedback.",
			subject: "Mothmark support: idea",
			to: "reader@example.test",
		});
		expect(markCustomerFeedbackReceipt).toHaveBeenCalledWith({
			feedbackId,
			messageId: "<receipt@example.test>",
			resendEmailId: "receipt-email-id",
			status: "delivered",
		});
		expect(recordFeedbackAdminSentMessages).toHaveBeenCalledWith([
			{
				feedbackId,
				messageId: "<first-admin@example.test>",
				messageKind: "admin_notification",
				recipient: "first-admin@example.test",
				resendEmailId: "first-admin-email-id",
			},
			{
				feedbackId,
				messageId: "<second-admin@example.test>",
				messageKind: "admin_notification",
				recipient: "second-admin@example.test",
				resendEmailId: "second-admin-email-id",
			},
		]);
		expect(markFeedbackNotification).toHaveBeenCalledWith(feedbackId, "delivered");
		expect(getOwnedAccountSummary).not.toHaveBeenCalled();
	});

	it("requires a reply email for feedback without a registered email", async () => {
		const response = await POST(
			feedbackRequest({category: "general", message: "A note without a reply address."}),
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: {
				code: "VALIDATION_ERROR",
				message: "Enter an email address so we can reply to your feedback.",
			},
		});
		expect(enforceFeedbackRateLimit).not.toHaveBeenCalled();
		expect(sendFeedbackEmail).not.toHaveBeenCalled();
	});

	it("requires at least one active administrator email", async () => {
		jest.mocked(listActiveAdministratorEmails).mockResolvedValue([]);

		const response = await POST(
			feedbackRequest({
				category: "general",
				message: "A note.",
				replyEmail: "reader@example.test",
			}),
		);

		expect(response.status).toBe(503);
		expect(enforceFeedbackRateLimit).not.toHaveBeenCalled();
		expect(createFeedbackMessage).not.toHaveBeenCalled();
	});

	it("uses a registered account email as the trusted reply address", async () => {
		jest.mocked(resolveCurrentActor).mockResolvedValue(registeredActor);
		jest.mocked(getOwnedAccountSummary).mockResolvedValue(registeredAccount);

		const response = await POST(
			feedbackRequest({
				category: "bug",
				message: "A registered report.",
				replyEmail: "different@example.test",
			}),
		);

		expect(response.status).toBe(201);
		expect(sendFeedbackEmail).toHaveBeenCalledWith(
			expect.objectContaining({
				accountEmail: "author@example.test",
				replyEmail: "author@example.test",
				username: "archivekeeper",
			}),
		);
	});

	it("uses the submitted reply email for a temporary anonymous account", async () => {
		jest.mocked(resolveCurrentActor).mockResolvedValue(anonymousActor);
		jest.mocked(getOwnedAccountSummary).mockResolvedValue(anonymousAccount);

		const response = await POST(
			feedbackRequest({
				category: "idea",
				message: "A temporary-account suggestion.",
				replyEmail: "visitor@example.test",
			}),
		);

		expect(response.status).toBe(201);
		expect(enforceFeedbackRateLimit).toHaveBeenCalledWith({
			actorUserId: anonymousActor.userId,
			network: "203.0.113.7",
		});
		expect(sendFeedbackEmail).toHaveBeenCalledWith(
			expect.objectContaining({
				accountEmail: null,
				accountType: "anonymous",
				replyEmail: "visitor@example.test",
			}),
		);
	});

	it("rejects empty feedback before recording a rate-limit event", async () => {
		const response = await POST(feedbackRequest({category: "general", message: ""}));
		expect(response.status).toBe(400);
		expect(enforceFeedbackRateLimit).not.toHaveBeenCalled();
	});

	it("returns a retry window when the sender reaches the limit", async () => {
		jest.mocked(enforceFeedbackRateLimit).mockRejectedValue(new FeedbackRateLimitError());
		const response = await POST(
			feedbackRequest({
				category: "bug",
				message: "A fourth note.",
				replyEmail: "reader@example.test",
			}),
		);

		expect(response.status).toBe(429);
		expect(response.headers.get("retry-after")).toBe("3600");
		expect(await response.json()).toEqual({
			error: {
				code: "RATE_LIMITED",
				message: "You can send up to 3 feedback messages per hour.",
			},
		});
		expect(sendFeedbackEmail).not.toHaveBeenCalled();
	});

	it("retains feedback when the administrator notification fails", async () => {
		jest.mocked(sendFeedbackEmail).mockRejectedValue(new Error("Resend unavailable"));

		const response = await POST(
			feedbackRequest({
				category: "idea",
				message: "Please keep this message.",
				replyEmail: "reader@example.test",
			}),
		);

		expect(response.status).toBe(201);
		expect(createFeedbackMessage).toHaveBeenCalledTimes(1);
		expect(markFeedbackNotification).toHaveBeenCalledWith(feedbackId, "failed");
		expect(await response.json()).toEqual({
			data: {
				customerReceiptDelivered: true,
				id: feedbackId,
				notificationDelivered: false,
				sent: true,
			},
		});
	});

	it("retains feedback and records when the customer receipt fails", async () => {
		jest.mocked(sendCustomerFeedbackReceipt).mockRejectedValue(new Error("Resend unavailable"));

		const response = await POST(
			feedbackRequest({
				category: "idea",
				message: "Please keep this message.",
				replyEmail: "reader@example.test",
			}),
		);

		expect(response.status).toBe(201);
		expect(markCustomerFeedbackReceipt).toHaveBeenCalledWith({
			feedbackId,
			messageId: undefined,
			resendEmailId: undefined,
			status: "failed",
		});
		expect(await response.json()).toEqual({
			data: {
				customerReceiptDelivered: false,
				id: feedbackId,
				notificationDelivered: true,
				sent: true,
			},
		});
	});

	it("fails closed when feedback delivery is not configured", async () => {
		jest.mocked(feedbackEmailIsConfigured).mockReturnValue(false);
		const response = await POST(
			feedbackRequest({
				category: "general",
				message: "A note.",
				replyEmail: "reader@example.test",
			}),
		);

		expect(response.status).toBe(503);
		expect(enforceFeedbackRateLimit).not.toHaveBeenCalled();
	});
});
