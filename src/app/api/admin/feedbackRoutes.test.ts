/** @jest-environment node */

import {resolveCurrentActor} from "@/auth/currentActor";
import {administratorHasPermission, recordAdministratorRead} from "@/db/dbal/adminRepository";
import {
	beginAdminFeedbackReply,
	finishAdminFeedbackReply,
	getAdminFeedbackMessage,
	getFeedbackAdminEmailThreads,
	getFeedbackEmailThread,
	listActiveAdministratorEmails,
	listAdminFeedbackMessages,
	recordFeedbackAdminSentMessages,
} from "@/db/dbal/feedbackRepository";
import {
	sendFeedbackAdminConversationCopies,
	sendFeedbackReplyEmail,
} from "@/feedback/feedbackEmail";

import {GET as listFeedback} from "./feedback/route";
import {GET as getFeedback} from "./feedback/[id]/route";
import {POST as replyToFeedback} from "./feedback/[id]/replies/route";

jest.mock("@/auth/currentActor", () => ({resolveCurrentActor: jest.fn()}));
jest.mock("@/db/dbal/adminRepository", () => ({
	AdminControlError: class AdminControlError extends Error {},
	administratorHasPermission: jest.fn(),
	recordAdministratorRead: jest.fn(),
}));
jest.mock("@/db/dbal/feedbackRepository", () => ({
	FeedbackMessageNotFoundError: class FeedbackMessageNotFoundError extends Error {},
	beginAdminFeedbackReply: jest.fn(),
	finishAdminFeedbackReply: jest.fn(),
	getAdminFeedbackMessage: jest.fn(),
	getFeedbackAdminEmailThreads: jest.fn(),
	getFeedbackEmailThread: jest.fn(),
	listActiveAdministratorEmails: jest.fn(),
	listAdminFeedbackMessages: jest.fn(),
	recordFeedbackAdminSentMessages: jest.fn(),
}));
jest.mock("@/feedback/feedbackEmail", () => ({
	sendFeedbackAdminConversationCopies: jest.fn(),
	sendFeedbackReplyEmail: jest.fn(),
}));

const actorId = "3e816c4d-b957-45dc-8523-d53ec04c8d0f";
const feedbackId = "8ebc3f3f-b9ca-4f75-898f-e196bae50be4";
const replyId = "fa64011c-a260-4712-baca-c8b0334b4740";
const actor = {
	accountType: "registered",
	audience: "admin",
	siteRole: "admin",
	userId: actorId,
} as const;
const feedback = {
	accountType: null,
	actorUserId: null,
	category: "idea" as const,
	createdAt: "2026-08-11T12:00:00.000Z",
	customerReceiptStatus: "delivered" as const,
	id: feedbackId,
	message: "Please add an easier way to reply.",
	notificationAttemptedAt: "2026-08-11T12:00:01.000Z",
	notificationStatus: "delivered" as const,
	page: "https://mothmark.app/play",
	replies: [],
	replyCount: 0,
	replyEmail: "reader@example.test",
	status: "open" as const,
	subject: "Mothmark support: idea",
	username: null,
	viewedAt: "2026-08-11T12:05:00.000Z",
};
const context = {params: Promise.resolve({id: feedbackId})};
const request = (path: string) => new Request(`http://localhost${path}`);
const replyRequest = (body: unknown, csrf = true) =>
	new Request(`http://localhost/api/admin/feedback/${feedbackId}/replies`, {
		body: JSON.stringify(body),
		headers: {
			"content-type": "application/json",
			origin: "http://localhost",
			...(csrf && {cookie: "mothmark_admin_csrf=proof", "x-csrf-token": "proof"}),
		},
		method: "POST",
	});

describe("administrator feedback routes", () => {
	beforeEach(() => {
		jest.mocked(resolveCurrentActor).mockResolvedValue(actor);
		jest.mocked(administratorHasPermission).mockResolvedValue(true);
		jest.mocked(listAdminFeedbackMessages).mockResolvedValue([feedback]);
		jest.mocked(getAdminFeedbackMessage).mockResolvedValue(feedback);
		jest.mocked(beginAdminFeedbackReply).mockResolvedValue({
			category: "idea",
			reply: {
				actorUserId: actorId,
				authorEmail: "admin@example.test",
				authorType: "admin",
				createdAt: "2026-08-11T12:10:00.000Z",
				deliveryAttemptedAt: null,
				deliveryStatus: "pending",
				id: replyId,
				message: "Thanks for the suggestion.",
				source: "admin_page",
			},
			replyEmail: "reader@example.test",
			subject: "Mothmark support: idea",
		});
		jest.mocked(getFeedbackEmailThread).mockResolvedValue({
			feedbackId,
			messageIds: ["<receipt@example.test>"],
			replyEmail: "reader@example.test",
			subject: "Mothmark support: idea",
		});
		jest
			.mocked(listActiveAdministratorEmails)
			.mockResolvedValue(["admin@example.test", "second-admin@example.test"]);
		jest.mocked(getFeedbackAdminEmailThreads).mockResolvedValue([
			{messageIds: ["<admin-notification@example.test>"], recipient: "admin@example.test"},
			{
				messageIds: ["<second-notification@example.test>"],
				recipient: "second-admin@example.test",
			},
		]);
		jest.mocked(finishAdminFeedbackReply).mockResolvedValue(undefined);
		jest.mocked(recordFeedbackAdminSentMessages).mockResolvedValue(undefined);
		jest.mocked(sendFeedbackReplyEmail).mockResolvedValue({
			messageId: "<customer-copy@example.test>",
			resendEmailId: "sent-email-id",
		});
		jest.mocked(sendFeedbackAdminConversationCopies).mockResolvedValue([
			{
				messageId: "<admin-copy@example.test>",
				recipient: "admin@example.test",
				resendEmailId: "admin-copy-id",
			},
			{
				messageId: "<second-copy@example.test>",
				recipient: "second-admin@example.test",
				resendEmailId: "second-copy-id",
			},
		]);
	});

	it("requires an administrator session for the inbox, detail, and reply", async () => {
		jest.mocked(resolveCurrentActor).mockResolvedValue(undefined);

		const responses = await Promise.all([
			listFeedback(request("/api/admin/feedback")),
			getFeedback(request(`/api/admin/feedback/${feedbackId}`), context),
			replyToFeedback(replyRequest({message: "A reply."}), context),
		]);

		expect(responses.map(({status}) => status)).toEqual([401, 401, 401]);
		expect(listAdminFeedbackMessages).not.toHaveBeenCalled();
		expect(sendFeedbackReplyEmail).not.toHaveBeenCalled();
	});

	it("lists feedback and records a sensitive detail read", async () => {
		expect((await listFeedback(request("/api/admin/feedback"))).status).toBe(200);
		expect((await getFeedback(request(`/api/admin/feedback/${feedbackId}`), context)).status).toBe(
			200,
		);

		expect(administratorHasPermission).toHaveBeenNthCalledWith(1, actorId, "admin.feedback.view");
		expect(administratorHasPermission).toHaveBeenNthCalledWith(2, actorId, "admin.feedback.view");
		expect(getAdminFeedbackMessage).toHaveBeenCalledWith(feedbackId, true);
		expect(recordAdministratorRead).toHaveBeenCalledWith(actorId, "feedback", feedbackId);
	});

	it("delivers and records a reply from the Mothmark support address", async () => {
		const response = await replyToFeedback(
			replyRequest({message: "Thanks for the suggestion."}),
			context,
		);

		expect(response.status).toBe(201);
		expect(administratorHasPermission).toHaveBeenCalledWith(actorId, "admin.feedback.reply");
		expect(beginAdminFeedbackReply).toHaveBeenCalledWith({
			actorUserId: actorId,
			feedbackId,
			message: "Thanks for the suggestion.",
		});
		expect(sendFeedbackReplyEmail).toHaveBeenCalledWith({
			feedbackId,
			message: "Thanks for the suggestion.",
			messageIds: ["<receipt@example.test>"],
			replyId,
			subject: "Mothmark support: idea",
			to: "reader@example.test",
		});
		expect(sendFeedbackAdminConversationCopies).toHaveBeenCalledWith({
			adminUrl: `http://localhost/admin/feedback/${feedbackId}`,
			feedbackId,
			label: "Administrator reply",
			message: "Thanks for the suggestion.",
			recipients: [
				{messageIds: ["<admin-notification@example.test>"], recipient: "admin@example.test"},
				{
					messageIds: ["<second-notification@example.test>"],
					recipient: "second-admin@example.test",
				},
			],
			replyId,
			subject: "Mothmark support: idea",
		});
		expect(recordFeedbackAdminSentMessages).toHaveBeenCalledWith([
			{
				feedbackId,
				messageId: "<admin-copy@example.test>",
				messageKind: "admin_conversation_copy",
				recipient: "admin@example.test",
				replyId,
				resendEmailId: "admin-copy-id",
			},
			{
				feedbackId,
				messageId: "<second-copy@example.test>",
				messageKind: "admin_conversation_copy",
				recipient: "second-admin@example.test",
				replyId,
				resendEmailId: "second-copy-id",
			},
		]);
		expect(finishAdminFeedbackReply).toHaveBeenCalledWith({
			actorUserId: actorId,
			feedbackId,
			messageId: "<customer-copy@example.test>",
			replyId,
			resendEmailId: "sent-email-id",
			status: "delivered",
		});
	});

	it("records a failed delivery without claiming that the reply was sent", async () => {
		jest.mocked(sendFeedbackReplyEmail).mockRejectedValue(new Error("Resend unavailable"));

		const response = await replyToFeedback(replyRequest({message: "A reply."}), context);

		expect(response.status).toBe(502);
		expect(finishAdminFeedbackReply).toHaveBeenCalledWith({
			actorUserId: actorId,
			feedbackId,
			replyId,
			status: "failed",
		});
		expect(await response.json()).toEqual({
			error: {
				code: "DELIVERY_FAILED",
				message: "The reply could not be delivered. Try again.",
			},
		});
	});

	it("rejects an empty reply before creating a delivery attempt", async () => {
		const response = await replyToFeedback(replyRequest({message: "  "}), context);

		expect(response.status).toBe(400);
		expect(beginAdminFeedbackReply).not.toHaveBeenCalled();
	});
});
