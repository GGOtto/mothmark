import "server-only";

import {createHash, randomUUID} from "node:crypto";

import type {Knex} from "knex";

import {feedbackConversationSubject} from "@/feedback/feedbackThread";
import {getDb} from "./knex";

const database = getDb();
const FEEDBACK_WINDOW_MS = 60 * 60 * 1_000;

type DeliveryStatus = "delivered" | "failed" | "pending";
type FeedbackCategory = "bug" | "general" | "idea";

type FeedbackMessageRow = {
	account_type: "anonymous" | "registered" | null;
	actor_user_id: string | null;
	category: FeedbackCategory;
	created_at: Date | string;
	customer_receipt_email_id: string | null;
	customer_receipt_message_id: string | null;
	customer_receipt_status: DeliveryStatus;
	id: string;
	message: string;
	notification_attempted_at: Date | string | null;
	notification_status: DeliveryStatus;
	page: string | null;
	reply_email: string;
	subject: string;
	username: string | null;
	viewed_at: Date | string | null;
};

type FeedbackReplyRow = {
	admin_notification_status: DeliveryStatus | "not_required";
	actor_user_id: string | null;
	author_email: string;
	author_type: "admin" | "customer";
	created_at: Date | string;
	delivery_attempted_at: Date | string | null;
	delivery_status: DeliveryStatus;
	feedback_message_id: string;
	id: string;
	message: string;
	sent_message_id: string | null;
	sent_resend_email_id: string | null;
	source: "admin_page" | "email";
	source_message_id: string | null;
	source_resend_email_id: string | null;
};

type FeedbackAdminEmailMessageRow = {
	created_at: Date | string;
	feedback_message_id: string;
	feedback_reply_id: string | null;
	id: string;
	message_id: string;
	message_kind: "admin_conversation_copy" | "admin_inbound_reply" | "admin_notification";
	recipient_email: string;
	resend_email_id: string | null;
};

export type AdminFeedbackReply = {
	actorUserId: string | null;
	authorEmail: string;
	authorType: "admin" | "customer";
	createdAt: string;
	deliveryAttemptedAt: string | null;
	deliveryStatus: DeliveryStatus;
	id: string;
	message: string;
	source: "admin_page" | "email";
};

export type AdminFeedbackSummary = {
	accountType: "anonymous" | "registered" | null;
	category: FeedbackCategory;
	customerReceiptStatus: DeliveryStatus;
	createdAt: string;
	id: string;
	message: string;
	notificationStatus: DeliveryStatus;
	replyCount: number;
	replyEmail: string;
	status: "new" | "open" | "replied";
	subject: string;
	username: string | null;
};

export type AdminFeedbackDetail = AdminFeedbackSummary & {
	actorUserId: string | null;
	notificationAttemptedAt: string | null;
	page: string | null;
	replies: AdminFeedbackReply[];
	viewedAt: string | null;
};

const iso = (value: Date | string | null): string | null =>
	value === null ? null : new Date(value).toISOString();

const mapReply = (row: FeedbackReplyRow): AdminFeedbackReply => ({
	actorUserId: row.actor_user_id,
	authorEmail: row.author_email,
	authorType: row.author_type,
	createdAt: new Date(row.created_at).toISOString(),
	deliveryAttemptedAt: iso(row.delivery_attempted_at),
	deliveryStatus: row.delivery_status,
	id: row.id,
	message: row.message,
	source: row.source,
});

const mapFeedback = (row: FeedbackMessageRow, replies: FeedbackReplyRow[]): AdminFeedbackDetail => {
	const mappedReplies = replies.map(mapReply);
	return {
		accountType: row.account_type,
		actorUserId: row.actor_user_id,
		category: row.category,
		createdAt: new Date(row.created_at).toISOString(),
		customerReceiptStatus: row.customer_receipt_status,
		id: row.id,
		message: row.message,
		notificationAttemptedAt: iso(row.notification_attempted_at),
		notificationStatus: row.notification_status,
		page: row.page,
		replies: mappedReplies,
		replyCount: mappedReplies.filter(({deliveryStatus}) => deliveryStatus === "delivered").length,
		replyEmail: row.reply_email,
		status: mappedReplies.some(
			({authorType, deliveryStatus}) => authorType === "admin" && deliveryStatus === "delivered",
		)
			? "replied"
			: row.viewed_at
				? "open"
				: "new",
		username: row.username,
		subject: row.subject,
		viewedAt: iso(row.viewed_at),
	};
};

const feedbackRepliesByMessage = async (
	messageIds: string[],
	connection: Knex | Knex.Transaction = database,
): Promise<Map<string, FeedbackReplyRow[]>> => {
	const rows = messageIds.length
		? ((await connection("feedback_replies")
				.whereIn("feedback_message_id", messageIds)
				.orderBy("created_at", "asc")) as FeedbackReplyRow[])
		: [];
	const byMessage = new Map<string, FeedbackReplyRow[]>();
	for (const row of rows) {
		const replies = byMessage.get(row.feedback_message_id) ?? [];
		replies.push(row);
		byMessage.set(row.feedback_message_id, replies);
	}
	return byMessage;
};

export async function listActiveAdministratorEmails(): Promise<string[]> {
	const rows = await database("users as account")
		.join("user_emails as email", "email.user_id", "account.id")
		.distinct<{email: string}[]>("email.email")
		.where({
			"account.account_type": "registered",
			"account.site_role": "admin",
			"account.status": "active",
		})
		.orderBy("email.email", "asc");
	return rows.map(({email}) => email);
}

export async function createFeedbackMessage(input: {
	accountType?: "anonymous" | "registered";
	actorUserId?: string;
	category: FeedbackCategory;
	message: string;
	page?: string;
	replyEmail: string;
	username?: string | null;
}): Promise<AdminFeedbackDetail> {
	const id = randomUUID();
	const subject = feedbackConversationSubject(input.category, id);
	const [row] = (await database("feedback_messages")
		.insert({
			account_type: input.accountType ?? null,
			actor_user_id: input.actorUserId ?? null,
			category: input.category,
			id,
			message: input.message,
			page: input.page ?? null,
			reply_email: input.replyEmail,
			subject,
			username: input.username ?? null,
		})
		.returning("*")) as FeedbackMessageRow[];
	return mapFeedback(row, []);
}

export async function markFeedbackNotification(
	feedbackId: string,
	status: Exclude<DeliveryStatus, "pending">,
): Promise<void> {
	await database("feedback_messages").where({id: feedbackId}).update({
		notification_attempted_at: database.fn.now(),
		notification_status: status,
	});
}

export async function markCustomerFeedbackReceipt(input: {
	feedbackId: string;
	messageId?: string;
	resendEmailId?: string;
	status: Exclude<DeliveryStatus, "pending">;
}): Promise<void> {
	await database("feedback_messages")
		.where({id: input.feedbackId})
		.update({
			customer_receipt_email_id: input.resendEmailId ?? null,
			customer_receipt_message_id: input.messageId ?? null,
			customer_receipt_status: input.status,
		});
}

export type FeedbackEmailThread = {
	feedbackId: string;
	messageIds: string[];
	replyEmail: string;
	subject: string;
};

export type FeedbackAdminEmailThread = {
	messageIds: string[];
	recipient: string;
};

export type FeedbackAdminSentMessage = {
	feedbackId: string;
	messageId?: string;
	messageKind: "admin_conversation_copy" | "admin_notification";
	recipient: string;
	replyId?: string;
	resendEmailId?: string;
};

const normalizedEmails = (emails: string[]): string[] => [
	...new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean)),
];

export async function getFeedbackAdminEmailThreads(
	feedbackId: string,
	recipients: string[],
): Promise<FeedbackAdminEmailThread[]> {
	const normalizedRecipients = normalizedEmails(recipients);
	const rows = normalizedRecipients.length
		? ((await database("feedback_admin_email_messages")
				.where({feedback_message_id: feedbackId})
				.whereIn("recipient_email", normalizedRecipients)
				.orderBy("created_at", "asc")
				.orderBy("id", "asc")) as FeedbackAdminEmailMessageRow[])
		: [];
	const messageIds = new Map<string, string[]>();
	for (const row of rows) {
		const ids = messageIds.get(row.recipient_email) ?? [];
		ids.push(row.message_id);
		messageIds.set(row.recipient_email, ids);
	}
	return normalizedRecipients.map((recipient) => ({
		messageIds: messageIds.get(recipient) ?? [],
		recipient,
	}));
}

export async function recordFeedbackAdminSentMessages(
	messages: FeedbackAdminSentMessage[],
): Promise<void> {
	const rows = messages.flatMap((message) =>
		message.messageId
			? [
					{
						feedback_message_id: message.feedbackId,
						feedback_reply_id: message.replyId ?? null,
						message_id: message.messageId,
						message_kind: message.messageKind,
						recipient_email: message.recipient.trim().toLowerCase(),
						resend_email_id: message.resendEmailId ?? null,
					},
				]
			: [],
	);
	if (rows.length === 0) return;
	await database("feedback_admin_email_messages").insert(rows).onConflict("message_id").ignore();
}

export async function getFeedbackEmailThread(
	feedbackId: string,
): Promise<FeedbackEmailThread | undefined> {
	const feedback = (await database("feedback_messages").where({id: feedbackId}).first()) as
		FeedbackMessageRow | undefined;
	if (!feedback) return undefined;
	const replies = (await database("feedback_replies")
		.where({feedback_message_id: feedbackId})
		.orderBy("created_at", "asc")) as FeedbackReplyRow[];
	const messageIds = [
		feedback.customer_receipt_message_id,
		...replies.map((reply) =>
			reply.author_type === "customer" ? reply.source_message_id : reply.sent_message_id,
		),
	].filter((value): value is string => Boolean(value));
	return {
		feedbackId,
		messageIds,
		replyEmail: feedback.reply_email,
		subject: feedback.subject,
	};
}

export async function setFeedbackReplyDelivery(input: {
	messageId?: string;
	replyId: string;
	resendEmailId?: string;
	status: Exclude<DeliveryStatus, "pending">;
}): Promise<void> {
	await database("feedback_replies")
		.where({id: input.replyId})
		.update({
			delivery_attempted_at: database.fn.now(),
			delivery_status: input.status,
			sent_message_id: input.messageId ?? null,
			sent_resend_email_id: input.resendEmailId ?? null,
		});
}

export async function recordResendSentMessage(input: {
	feedbackId?: string;
	messageId: string;
	messageKind?: string;
	recipients?: string[];
	replyId?: string;
	resendEmailId: string;
}): Promise<void> {
	if (input.messageKind === "customer_receipt" && input.feedbackId) {
		await database("feedback_messages").where({id: input.feedbackId}).update({
			customer_receipt_email_id: input.resendEmailId,
			customer_receipt_message_id: input.messageId,
		});
		return;
	}
	if (input.messageKind === "conversation_reply" && input.replyId) {
		await database("feedback_replies").where({id: input.replyId}).update({
			sent_message_id: input.messageId,
			sent_resend_email_id: input.resendEmailId,
		});
		return;
	}
	if (
		(input.messageKind === "admin_notification" || input.messageKind === "admin_conversation_copy") &&
		input.feedbackId
	) {
		await recordFeedbackAdminSentMessages(
			normalizedEmails(input.recipients ?? []).map((recipient) => ({
				feedbackId: input.feedbackId!,
				messageId: input.messageId,
				messageKind: input.messageKind as "admin_conversation_copy" | "admin_notification",
				recipient,
				replyId: input.replyId,
				resendEmailId: input.resendEmailId,
			})),
		);
	}
}

export async function listAdminFeedbackMessages(): Promise<AdminFeedbackSummary[]> {
	const rows = (await database("feedback_messages")
		.orderBy("created_at", "desc")
		.limit(250)) as FeedbackMessageRow[];
	const replies = await feedbackRepliesByMessage(rows.map(({id}) => id));
	return rows.map((row) => {
		const detail = mapFeedback(row, replies.get(row.id) ?? []);
		return {
			accountType: detail.accountType,
			category: detail.category,
			createdAt: detail.createdAt,
			customerReceiptStatus: detail.customerReceiptStatus,
			id: detail.id,
			message: detail.message,
			notificationStatus: detail.notificationStatus,
			replyCount: detail.replyCount,
			replyEmail: detail.replyEmail,
			status: detail.status,
			subject: detail.subject,
			username: detail.username,
		};
	});
}

export async function getAdminFeedbackMessage(
	feedbackId: string,
	markViewed = false,
): Promise<AdminFeedbackDetail | undefined> {
	return database.transaction(async (transaction) => {
		if (markViewed) {
			await transaction("feedback_messages")
				.where({id: feedbackId})
				.whereNull("viewed_at")
				.update({viewed_at: transaction.fn.now()});
		}
		const row = (await transaction("feedback_messages").where({id: feedbackId}).first()) as
			FeedbackMessageRow | undefined;
		if (!row) return undefined;
		const replies = await feedbackRepliesByMessage([feedbackId], transaction);
		return mapFeedback(row, replies.get(feedbackId) ?? []);
	});
}

export async function beginAdminFeedbackReply(input: {
	actorUserId: string;
	feedbackId: string;
	message: string;
}): Promise<{
	category: FeedbackCategory;
	reply: AdminFeedbackReply;
	replyEmail: string;
	subject: string;
}> {
	return database.transaction(async (transaction) => {
		const feedback = (await transaction("feedback_messages")
			.where({id: input.feedbackId})
			.forUpdate()
			.first()) as FeedbackMessageRow | undefined;
		if (!feedback) throw new FeedbackMessageNotFoundError();
		const actorEmail = await transaction("user_emails")
			.select<{email: string}[]>("email")
			.where({user_id: input.actorUserId})
			.first();
		if (!actorEmail) throw new FeedbackMessageNotFoundError();
		const [row] = (await transaction("feedback_replies")
			.insert({
				actor_user_id: input.actorUserId,
				author_email: actorEmail.email,
				author_type: "admin",
				feedback_message_id: input.feedbackId,
				message: input.message,
				source: "admin_page",
			})
			.returning("*")) as FeedbackReplyRow[];
		return {
			category: feedback.category,
			reply: mapReply(row),
			replyEmail: feedback.reply_email,
			subject: feedback.subject,
		};
	});
}

export async function finishAdminFeedbackReply(input: {
	actorUserId: string;
	feedbackId: string;
	messageId?: string;
	resendEmailId?: string;
	replyId: string;
	status: Exclude<DeliveryStatus, "pending">;
}): Promise<void> {
	await database.transaction(async (transaction) => {
		await transaction("feedback_replies")
			.where({id: input.replyId})
			.update({
				delivery_attempted_at: transaction.fn.now(),
				delivery_status: input.status,
				sent_message_id: input.messageId ?? null,
				sent_resend_email_id: input.resendEmailId ?? null,
			});
		await transaction("admin_audit_log").insert({
			action: input.status === "delivered" ? "feedback.reply_sent" : "feedback.reply_failed",
			actor_user_id: input.actorUserId,
			details: {replyId: input.replyId},
			target_id: input.feedbackId,
			target_type: "feedback",
		});
	});
}

export async function createInboundFeedbackReply(input: {
	feedbackId: string;
	message: string;
	messageId: string;
	resendEmailId: string;
	senderEmail: string;
}): Promise<
	| {
			authorType: "admin" | "customer";
			reply: AdminFeedbackReply;
			thread: FeedbackEmailThread;
	  }
	| undefined
> {
	const normalizedSender = input.senderEmail.trim().toLowerCase();
	return database.transaction(async (transaction) => {
		const feedback = (await transaction("feedback_messages")
			.where({id: input.feedbackId})
			.forUpdate()
			.first()) as FeedbackMessageRow | undefined;
		if (!feedback) return undefined;
		let authorType: "admin" | "customer";
		let actorUserId: string | null = null;
		if (feedback.reply_email.trim().toLowerCase() === normalizedSender) {
			authorType = "customer";
		} else {
			const admin = await transaction("users as account")
				.join("user_emails as email", "email.user_id", "account.id")
				.select<{id: string}[]>("account.id")
				.whereRaw("lower(email.email) = ?", [normalizedSender])
				.where({"account.site_role": "admin", "account.status": "active"})
				.first();
			if (!admin) return undefined;
			authorType = "admin";
			actorUserId = admin.id;
		}
		await transaction("feedback_replies")
			.insert({
				actor_user_id: actorUserId,
				admin_notification_status: authorType === "customer" ? "pending" : "not_required",
				author_email: normalizedSender,
				author_type: authorType,
				delivery_status: authorType === "customer" ? "delivered" : "pending",
				feedback_message_id: input.feedbackId,
				message: input.message,
				source: "email",
				source_message_id: input.messageId,
				source_resend_email_id: input.resendEmailId,
			})
			.onConflict("source_resend_email_id")
			.ignore();
		const row = (await transaction("feedback_replies")
			.where({source_resend_email_id: input.resendEmailId})
			.first()) as FeedbackReplyRow;
		const allReplies = (await transaction("feedback_replies")
			.where({feedback_message_id: input.feedbackId})
			.orderBy("created_at", "asc")) as FeedbackReplyRow[];
		if (authorType === "admin") {
			await transaction("feedback_admin_email_messages")
				.insert({
					feedback_message_id: input.feedbackId,
					feedback_reply_id: row.id,
					message_id: input.messageId,
					message_kind: "admin_inbound_reply",
					recipient_email: normalizedSender,
					resend_email_id: null,
				})
				.onConflict("message_id")
				.ignore();
		}
		const messageIds = [
			feedback.customer_receipt_message_id,
			...allReplies.map((reply) =>
				reply.author_type === "customer" ? reply.source_message_id : reply.sent_message_id,
			),
		].filter((value): value is string => Boolean(value));
		return {
			authorType,
			reply: mapReply(row),
			thread: {
				feedbackId: feedback.id,
				messageIds,
				replyEmail: feedback.reply_email,
				subject: feedback.subject,
			},
		};
	});
}

export async function markFeedbackReplyAdminNotification(input: {
	replyId: string;
	status: Exclude<DeliveryStatus, "pending">;
}): Promise<void> {
	await database("feedback_replies")
		.where({id: input.replyId})
		.update({admin_notification_status: input.status});
}

export async function claimResendWebhookEvent(input: {
	emailId?: string;
	eventType: string;
	svixId: string;
}): Promise<boolean> {
	return database.transaction(async (transaction) => {
		const [inserted] = await transaction("resend_webhook_events")
			.insert({
				email_id: input.emailId ?? null,
				event_type: input.eventType,
				svix_id: input.svixId,
			})
			.onConflict("svix_id")
			.ignore()
			.returning("svix_id");
		if (inserted) return true;
		const current = await transaction("resend_webhook_events")
			.where({svix_id: input.svixId})
			.forUpdate()
			.first();
		if (!current || current.status === "completed") return false;
		const stale = Date.now() - new Date(current.claimed_at).getTime() > 5 * 60 * 1_000;
		if (current.status === "processing" && !stale) return false;
		await transaction("resend_webhook_events")
			.where({svix_id: input.svixId})
			.update({
				attempts: Number(current.attempts) + 1,
				claimed_at: transaction.fn.now(),
				last_error: null,
				status: "processing",
			});
		return true;
	});
}

export async function finishResendWebhookEvent(input: {
	error?: string;
	status: "completed" | "failed";
	svixId: string;
}): Promise<void> {
	await database("resend_webhook_events")
		.where({svix_id: input.svixId})
		.update({
			completed_at: input.status === "completed" ? database.fn.now() : null,
			last_error: input.error?.slice(0, 1_000) ?? null,
			status: input.status,
		});
}

export class FeedbackMessageNotFoundError extends Error {
	constructor() {
		super("The feedback message was not found.");
		this.name = "FeedbackMessageNotFoundError";
	}
}

export class FeedbackRateLimitError extends Error {
	readonly retryAfterSeconds = Math.ceil(FEEDBACK_WINDOW_MS / 1_000);

	constructor() {
		super("You can send up to 3 feedback messages per hour.");
		this.name = "FeedbackRateLimitError";
	}
}

const dimensionHash = (kind: string, value: string) =>
	createHash("sha256").update(`${kind}:${value}`).digest("hex");

export async function enforceFeedbackRateLimit(input: {
	actorUserId?: string;
	network: string;
}): Promise<void> {
	const dimensions = input.actorUserId
		? [
				{kind: "actor", value: input.actorUserId, limit: 3},
				{kind: "network", value: input.network, limit: 20},
			]
		: [{kind: "network", value: input.network, limit: 3}];

	await database.transaction(async (transaction) => {
		const now = new Date();
		const cutoff = new Date(now.getTime() - FEEDBACK_WINDOW_MS);
		const hashed = dimensions.map((dimension) => ({
			...dimension,
			hash: dimensionHash(dimension.kind, dimension.value),
		}));

		for (const dimension of [...hashed].sort((left, right) => left.hash.localeCompare(right.hash))) {
			await transaction.raw("select pg_advisory_xact_lock(hashtext(?))", [
				`mothmark-feedback-rate:${dimension.hash}`,
			]);
		}

		for (const dimension of hashed) {
			const count = await transaction("request_rate_limit_events")
				.where({action: "feedback_submit", dimension_hash: dimension.hash})
				.where("attempted_at", ">=", cutoff)
				.count<{count: string}[]>("id as count")
				.first();
			if (Number(count?.count ?? 0) >= dimension.limit) throw new FeedbackRateLimitError();
		}

		await transaction("request_rate_limit_events").insert(
			hashed.map((dimension) => ({
				action: "feedback_submit",
				attempted_at: now,
				dimension_hash: dimension.hash,
			})),
		);
	});
}
