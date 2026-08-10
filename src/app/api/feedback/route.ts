import {NextResponse} from "next/server";
import {z} from "zod";

import {resolveCurrentActor} from "@/auth/currentActor";
import {mutationSecurityError} from "@/auth/requestSecurity";
import {RequestBodyError, readBoundedJson} from "@/auth/requestBody";
import {getOwnedAccountSummary} from "@/db/dbal/accountRepository";
import {enforceFeedbackRateLimit, FeedbackRateLimitError} from "@/db/dbal/feedbackRepository";
import {feedbackEmailIsConfigured, sendFeedbackEmail} from "@/feedback/feedbackEmail";
import {requestNetwork} from "../auth/_shared";

export const runtime = "nodejs";

const FEEDBACK_REQUEST_MAX_BYTES = 8 * 1024;
const FeedbackSchema = z.object({
	category: z.enum(["bug", "general", "idea"]),
	includePage: z.boolean().optional().default(false),
	message: z.string().trim().min(1).max(4_000),
	page: z.string().trim().max(2_048).optional(),
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

	const account = actor ? await getOwnedAccountSummary(actor.userId) : undefined;
	try {
		await sendFeedbackEmail({
			accountEmail: account?.email,
			accountType: account?.accountType,
			category: input.category,
			message: input.message,
			page: input.includePage ? input.page : undefined,
			username: account?.username,
		});
	} catch {
		console.error("Feedback email could not be delivered.");
		return NextResponse.json(
			{error: {code: "DELIVERY_FAILED", message: "Feedback could not be sent. Try again later."}},
			{status: 502},
		);
	}

	return NextResponse.json({data: {sent: true}}, {status: 201});
}
