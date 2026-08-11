import {NextResponse} from "next/server";
import {z} from "zod";

import {resolveCurrentActor} from "@/auth/currentActor";
import {mutationSecurityError} from "@/auth/requestSecurity";
import {RequestBodyError, readBoundedJson} from "@/auth/requestBody";
import {getOwnedAccountSummary} from "@/db/dbal/accountRepository";
import {
	createFeedbackMessage,
	enforceFeedbackRateLimit,
	FeedbackRateLimitError,
	listActiveAdministratorEmails,
	markCustomerFeedbackReceipt,
	markFeedbackNotification,
} from "@/db/dbal/feedbackRepository";
import {
	feedbackEmailIsConfigured,
	sendCustomerFeedbackReceipt,
	sendFeedbackEmail,
} from "@/feedback/feedbackEmail";
import {requestNetwork} from "../auth/_shared";

export const runtime = "nodejs";

const FEEDBACK_REQUEST_MAX_BYTES = 8 * 1024;
const ReplyEmailSchema = z.string().trim().pipe(z.email().max(254));
const FeedbackPageSchema = z
	.url()
	.max(2_048)
	.refine((value) => ["http:", "https:"].includes(new URL(value).protocol));
const FeedbackSchema = z.object({
	category: z.enum(["bug", "general", "idea"]),
	includePage: z.boolean().optional().default(false),
	message: z.string().trim().min(1).max(4_000),
	page: FeedbackPageSchema.optional(),
	replyEmail: ReplyEmailSchema.optional(),
	website: z.string().max(0).optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
	const securityError = mutationSecurityError(request);
	if (securityError) return securityError;
	if (!feedbackEmailIsConfigured()) {
		return NextResponse.json(
			{error: {code: "EMAIL_UNAVAILABLE", message: "Feedback delivery is not configured."}},
			{status: 503},
		);
	}

	let input: z.infer<typeof FeedbackSchema>;
	try {
		const parsed = FeedbackSchema.safeParse(
			await readBoundedJson(request, FEEDBACK_REQUEST_MAX_BYTES),
		);
		if (!parsed.success) {
			return NextResponse.json(
				{error: {code: "VALIDATION_ERROR", message: "Check the feedback form."}},
				{status: 400},
			);
		}
		input = parsed.data;
	} catch (error) {
		if (error instanceof RequestBodyError && error.code === "REQUEST_TOO_LARGE") {
			return NextResponse.json({error: {code: error.code, message: error.message}}, {status: 413});
		}
		return NextResponse.json(
			{error: {code: "INVALID_JSON", message: "The request body must contain valid JSON."}},
			{status: 400},
		);
	}

	const actor = await resolveCurrentActor(request, "editor");
	const account = actor ? await getOwnedAccountSummary(actor.userId) : undefined;
	const replyEmail = account?.email ?? input.replyEmail;
	if (!replyEmail) {
		return NextResponse.json(
			{
				error: {
					code: "VALIDATION_ERROR",
					message: "Enter an email address so we can reply to your feedback.",
				},
			},
			{status: 400},
		);
	}
	let recipients: string[];
	try {
		recipients = await listActiveAdministratorEmails();
	} catch {
		console.error("Feedback administrator recipients could not be loaded.");
		return NextResponse.json(
			{error: {code: "EMAIL_UNAVAILABLE", message: "Feedback delivery is not configured."}},
			{status: 503},
		);
	}
	if (recipients.length === 0) {
		return NextResponse.json(
			{error: {code: "EMAIL_UNAVAILABLE", message: "Feedback delivery is not configured."}},
			{status: 503},
		);
	}

	try {
		await enforceFeedbackRateLimit({actorUserId: actor?.userId, network: requestNetwork(request)});
	} catch (error) {
		if (error instanceof FeedbackRateLimitError) {
			return NextResponse.json(
				{error: {code: "RATE_LIMITED", message: error.message}},
				{headers: {"retry-after": String(error.retryAfterSeconds)}, status: 429},
			);
		}
		throw error;
	}

	let feedback: Awaited<ReturnType<typeof createFeedbackMessage>>;
	try {
		feedback = await createFeedbackMessage({
			accountType: account?.accountType,
			actorUserId: actor?.userId,
			category: input.category,
			message: input.message,
			page: input.includePage ? input.page : undefined,
			replyEmail,
			username: account?.username,
		});
	} catch {
		console.error("Feedback message could not be saved.");
		return NextResponse.json(
			{error: {code: "SAVE_FAILED", message: "Feedback could not be sent. Try again later."}},
			{status: 500},
		);
	}

	let customerReceiptDelivered = false;
	let receiptEmailId: string | undefined;
	try {
		const receipt = await sendCustomerFeedbackReceipt({
			category: input.category,
			feedbackId: feedback.id,
			message: input.message,
			subject: feedback.subject,
			to: replyEmail,
		});
		receiptEmailId = receipt.resendEmailId;
		customerReceiptDelivered = true;
	} catch {
		console.error("Feedback customer receipt could not be delivered.");
	}
	try {
		await markCustomerFeedbackReceipt({
			feedbackId: feedback.id,
			resendEmailId: receiptEmailId,
			status: customerReceiptDelivered ? "delivered" : "failed",
		});
	} catch {
		console.error("Feedback customer receipt status could not be recorded.");
	}

	let notificationDelivered = false;
	try {
		await sendFeedbackEmail({
			accountEmail: account?.email,
			accountType: account?.accountType,
			category: input.category,
			feedbackId: feedback.id,
			message: input.message,
			page: input.includePage ? input.page : undefined,
			recipients,
			replyEmail,
			subject: feedback.subject,
			username: account?.username,
		});
		notificationDelivered = true;
	} catch {
		console.error("Feedback administrator notification could not be delivered.");
	}
	try {
		await markFeedbackNotification(feedback.id, notificationDelivered ? "delivered" : "failed");
	} catch {
		console.error("Feedback notification status could not be recorded.");
	}

	return NextResponse.json(
		{data: {customerReceiptDelivered, id: feedback.id, notificationDelivered, sent: true}},
		{status: 201},
	);
}
