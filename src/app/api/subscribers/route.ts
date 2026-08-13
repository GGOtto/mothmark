import {NextResponse} from "next/server";
import {z} from "zod";

import {mutationSecurityError} from "@/auth/requestSecurity";
import {subscribeEmail} from "@/db/dbal/subscriberRepository";
import {EmailSchema, isResponse, readJson} from "../auth/_shared";

export const runtime = "nodejs";

const InputSchema = z.object({email: EmailSchema});

export async function POST(request: Request): Promise<NextResponse> {
	const securityError = mutationSecurityError(request);
	if (securityError) return securityError;
	const input = await readJson(request, InputSchema);
	if (isResponse(input)) return input;
	try {
		await subscribeEmail({email: input.email, source: "footer"});
		return NextResponse.json({data: {message: "You're subscribed to Notes from Mothmark."}});
	} catch (error) {
		console.error("Newsletter subscription failed", error);
		return NextResponse.json(
			{error: {code: "SUBSCRIPTION_FAILED", message: "The email could not be subscribed. Try again."}},
			{status: 500},
		);
	}
}
