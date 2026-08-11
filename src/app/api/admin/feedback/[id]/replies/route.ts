import {NextResponse} from "next/server";
import {z} from "zod";

import {RequestBodyError, readBoundedJson} from "@/auth/requestBody";
import {mutationSecurityError} from "@/auth/requestSecurity";
import {
	beginAdminFeedbackReply,
	FeedbackMessageNotFoundError,
	finishAdminFeedbackReply,
	getAdminFeedbackMessage,
	getFeedbackAdminEmailThreads,
	getFeedbackEmailThread,
	listActiveAdministratorEmails,
	recordFeedbackAdminSentMessages,
} from "@/db/dbal/feedbackRepository";
import {
	sendFeedbackAdminConversationCopies,
	sendFeedbackReplyEmail,
} from "@/feedback/feedbackEmail";
import {
	adminNotFoundResponse,
	adminRouteError,
	isResponse,
	requireAdminPermission,
} from "../../../_shared";

export const runtime = "nodejs";

const FeedbackReplySchema = z.object({message: z.string().trim().min(1).max(4_000)});

export async function POST(
	request: Request,
	context: {params: Promise<{id: string}>},
): Promise<NextResponse> {
	const securityError = mutationSecurityError(request, "admin");
	if (securityError) return securityError;
	const actor = await requireAdminPermission(request, "admin.feedback.reply");
	if (isResponse(actor)) return actor;
	const id = z.uuid().safeParse((await context.params).id);
	if (!id.success) return adminNotFoundResponse();

	let input: z.infer<typeof FeedbackReplySchema>;
	try {
		const parsed = FeedbackReplySchema.safeParse(await readBoundedJson(request, 8 * 1_024));
		if (!parsed.success) {
			return NextResponse.json(
				{error: {code: "VALIDATION_ERROR", message: "Enter a reply before sending."}},
				{status: 400},
			);
		}
		input = parsed.data;
	} catch (error) {
		const status =
			error instanceof RequestBodyError && error.code === "REQUEST_TOO_LARGE" ? 413 : 400;
		return NextResponse.json(
			{error: {code: "INVALID_REQUEST", message: "The feedback reply could not be read."}},
			{status},
		);
	}

	try {
		const pending = await beginAdminFeedbackReply({
			actorUserId: actor.userId,
			feedbackId: id.data,
			message: input.message,
		});
		let messageId: string | undefined;
		let resendEmailId: string | undefined;
		try {
			const [thread, adminRecipients] = await Promise.all([
				getFeedbackEmailThread(id.data),
				listActiveAdministratorEmails(),
			]);
			if (!thread) throw new FeedbackMessageNotFoundError();
			const adminThreads = await getFeedbackAdminEmailThreads(id.data, adminRecipients);
			const [sent, adminCopies] = await Promise.all([
				sendFeedbackReplyEmail({
					feedbackId: id.data,
					message: input.message,
					messageIds: thread.messageIds,
					replyId: pending.reply.id,
					subject: pending.subject,
					to: pending.replyEmail,
				}),
				sendFeedbackAdminConversationCopies({
					adminUrl: new URL(`/admin/feedback/${id.data}`, request.url).toString(),
					feedbackId: id.data,
					label: "Administrator reply",
					message: input.message,
					recipients: adminThreads,
					replyId: pending.reply.id,
					subject: pending.subject,
				}),
			]);
			await recordFeedbackAdminSentMessages(
				adminCopies.map((copy) => ({
					...copy,
					feedbackId: id.data,
					messageKind: "admin_conversation_copy" as const,
					replyId: pending.reply.id,
				})),
			);
			messageId = sent.messageId;
			resendEmailId = sent.resendEmailId;
		} catch {
			await finishAdminFeedbackReply({
				actorUserId: actor.userId,
				feedbackId: id.data,
				replyId: pending.reply.id,
				status: "failed",
			});
			return NextResponse.json(
				{error: {code: "DELIVERY_FAILED", message: "The reply could not be delivered. Try again."}},
				{status: 502},
			);
		}
		await finishAdminFeedbackReply({
			actorUserId: actor.userId,
			feedbackId: id.data,
			messageId,
			replyId: pending.reply.id,
			resendEmailId,
			status: "delivered",
		});
		const feedback = await getAdminFeedbackMessage(id.data);
		return feedback ? NextResponse.json({data: feedback}, {status: 201}) : adminNotFoundResponse();
	} catch (error) {
		if (error instanceof FeedbackMessageNotFoundError) return adminNotFoundResponse();
		return adminRouteError(error);
	}
}
