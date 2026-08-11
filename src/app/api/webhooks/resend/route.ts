import {NextResponse} from "next/server";
import {Webhook} from "svix";
import {z} from "zod";

import {
	claimResendWebhookEvent,
	createInboundFeedbackReply,
	finishResendWebhookEvent,
	getFeedbackAdminEmailThreads,
	listActiveAdministratorEmails,
	markFeedbackReplyAdminNotification,
	recordFeedbackAdminSentMessages,
	recordResendSentMessage,
	setFeedbackReplyDelivery,
} from "@/db/dbal/feedbackRepository";
import {
	feedbackReceivingIsConfigured,
	feedbackReplyDomain,
	mailboxAddress,
	retrieveReceivedFeedbackEmail,
	sendFeedbackAdminConversationCopies,
	sendFeedbackReplyEmail,
} from "@/feedback/feedbackEmail";

export const runtime = "nodejs";

const MAX_WEBHOOK_BYTES = 64 * 1_024;
const ResendEventSchema = z.object({
	data: z
		.object({
			email_id: z.string().min(1),
			from: z.string().optional(),
			message_id: z.string().optional(),
			tags: z.unknown().optional(),
			to: z.array(z.string()).optional(),
		})
		.passthrough(),
	type: z.string(),
});

type ResendEvent = z.infer<typeof ResendEventSchema>;

const eventTags = (value: unknown): Record<string, string> => {
	if (Array.isArray(value)) {
		return Object.fromEntries(
			value.flatMap((item) => {
				if (!item || typeof item !== "object") return [];
				const {name, value: tagValue} = item as {name?: unknown; value?: unknown};
				return typeof name === "string" && typeof tagValue === "string" ? [[name, tagValue]] : [];
			}),
		);
	}
	if (!value || typeof value !== "object") return {};
	return Object.fromEntries(
		Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
	);
};

const feedbackIdFromRecipients = (recipients: string[]): string | undefined => {
	const replyDomain = feedbackReplyDomain();
	for (const recipient of recipients) {
		const address = mailboxAddress(recipient);
		if (!address?.endsWith(`@${replyDomain}`)) continue;
		const localPart = address.slice(0, -replyDomain.length - 1);
		const parsed = z.uuid().safeParse(localPart.match(/^support\+(.+)$/)?.[1]);
		if (parsed.success) return parsed.data;
	}
	return undefined;
};

const handleSentEvent = async (event: ResendEvent): Promise<void> => {
	if (!event.data.message_id) return;
	const tags = eventTags(event.data.tags);
	await recordResendSentMessage({
		feedbackId: tags.feedback_id,
		messageId: event.data.message_id,
		messageKind: tags.message_kind,
		recipients: event.data.to,
		replyId: tags.feedback_reply_id,
		resendEmailId: event.data.email_id,
	});
};

const handleReceivedEvent = async (event: ResendEvent): Promise<void> => {
	const feedbackId = feedbackIdFromRecipients(event.data.to ?? []);
	if (!feedbackId) return;
	const received = await retrieveReceivedFeedbackEmail(event.data.email_id);
	const senderEmail = mailboxAddress(received.from);
	const eventSender = event.data.from ? mailboxAddress(event.data.from) : senderEmail;
	if (!senderEmail || !eventSender || senderEmail !== eventSender) {
		throw new Error("The received feedback sender could not be verified.");
	}
	const inbound = await createInboundFeedbackReply({
		feedbackId,
		message: received.text,
		messageId: received.messageId,
		resendEmailId: event.data.email_id,
		senderEmail,
	});
	if (!inbound) return;
	const adminRecipients = await listActiveAdministratorEmails();
	if (adminRecipients.length === 0) throw new Error("No feedback administrators are configured.");

	if (inbound.authorType === "customer") {
		const origin = process.env.PUBLIC_APP_ORIGIN?.trim();
		if (!origin) throw new Error("Feedback email is not configured.");
		try {
			const adminThreads = await getFeedbackAdminEmailThreads(feedbackId, adminRecipients);
			const copies = await sendFeedbackAdminConversationCopies({
				adminUrl: new URL(`/admin/feedback/${feedbackId}`, origin).toString(),
				feedbackId,
				label: "Customer reply",
				message: received.text,
				recipients: adminThreads,
				replyId: inbound.reply.id,
				subject: inbound.thread.subject,
			});
			await recordFeedbackAdminSentMessages(
				copies.map((copy) => ({
					...copy,
					feedbackId,
					messageKind: "admin_conversation_copy" as const,
					replyId: inbound.reply.id,
				})),
			);
			await markFeedbackReplyAdminNotification({
				replyId: inbound.reply.id,
				status: "delivered",
			});
		} catch (error) {
			await markFeedbackReplyAdminNotification({
				replyId: inbound.reply.id,
				status: "failed",
			});
			throw error;
		}
		return;
	}

	try {
		const otherAdminRecipients = adminRecipients.filter(
			(recipient) => recipient.trim().toLowerCase() !== inbound.reply.authorEmail.toLowerCase(),
		);
		const adminThreads = await getFeedbackAdminEmailThreads(feedbackId, otherAdminRecipients);
		const origin = process.env.PUBLIC_APP_ORIGIN?.trim();
		if (!origin) throw new Error("Feedback email is not configured.");
		const [sent, copies] = await Promise.all([
			sendFeedbackReplyEmail({
				feedbackId,
				message: received.text,
				messageIds: inbound.thread.messageIds,
				replyId: inbound.reply.id,
				subject: inbound.thread.subject,
				to: inbound.thread.replyEmail,
			}),
			sendFeedbackAdminConversationCopies({
				adminUrl: new URL(`/admin/feedback/${feedbackId}`, origin).toString(),
				feedbackId,
				label: "Administrator reply",
				message: received.text,
				recipients: adminThreads,
				replyId: inbound.reply.id,
				subject: inbound.thread.subject,
			}),
		]);
		await recordFeedbackAdminSentMessages(
			copies.map((copy) => ({
				...copy,
				feedbackId,
				messageKind: "admin_conversation_copy" as const,
				replyId: inbound.reply.id,
			})),
		);
		await setFeedbackReplyDelivery({
			messageId: sent.messageId,
			replyId: inbound.reply.id,
			resendEmailId: sent.resendEmailId,
			status: "delivered",
		});
	} catch (error) {
		await setFeedbackReplyDelivery({replyId: inbound.reply.id, status: "failed"});
		throw error;
	}
};

export async function POST(request: Request): Promise<NextResponse> {
	if (!feedbackReceivingIsConfigured()) {
		return NextResponse.json(
			{error: {code: "WEBHOOK_UNAVAILABLE", message: "Feedback receiving is not configured."}},
			{status: 503},
		);
	}
	const body = await request.text();
	if (new TextEncoder().encode(body).byteLength > MAX_WEBHOOK_BYTES) {
		return NextResponse.json(
			{error: {code: "REQUEST_TOO_LARGE", message: "The webhook request is too large."}},
			{status: 413},
		);
	}
	const svixId = request.headers.get("svix-id");
	const svixTimestamp = request.headers.get("svix-timestamp");
	const svixSignature = request.headers.get("svix-signature");
	if (!svixId || !svixTimestamp || !svixSignature) {
		return NextResponse.json(
			{error: {code: "INVALID_SIGNATURE", message: "The webhook signature is invalid."}},
			{status: 401},
		);
	}

	let event: ResendEvent;
	try {
		const verified = new Webhook(process.env.RESEND_WEBHOOK_SECRET!).verify(body, {
			"svix-id": svixId,
			"svix-signature": svixSignature,
			"svix-timestamp": svixTimestamp,
		});
		event = ResendEventSchema.parse(verified);
	} catch {
		return NextResponse.json(
			{error: {code: "INVALID_SIGNATURE", message: "The webhook signature is invalid."}},
			{status: 401},
		);
	}

	if (event.type !== "email.received" && event.type !== "email.sent") {
		return NextResponse.json({data: {accepted: true}});
	}
	const claimed = await claimResendWebhookEvent({
		emailId: event.data.email_id,
		eventType: event.type,
		svixId,
	});
	if (!claimed) return NextResponse.json({data: {accepted: true, duplicate: true}});

	try {
		if (event.type === "email.sent") await handleSentEvent(event);
		else await handleReceivedEvent(event);
		await finishResendWebhookEvent({status: "completed", svixId});
		return NextResponse.json({data: {accepted: true}});
	} catch (error) {
		console.error("Resend feedback webhook processing failed.");
		await finishResendWebhookEvent({
			error: error instanceof Error ? error.message : "Unknown webhook processing error.",
			status: "failed",
			svixId,
		});
		return NextResponse.json(
			{error: {code: "WEBHOOK_FAILED", message: "The webhook could not be processed."}},
			{status: 500},
		);
	}
}
