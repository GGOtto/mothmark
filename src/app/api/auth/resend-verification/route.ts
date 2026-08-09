import {NextResponse} from "next/server";
import {z} from "zod";

import {authenticationEmailIsConfigured, sendAuthenticationEmail} from "@/auth/email";
import {mutationSecurityError} from "@/auth/requestSecurity";
import {resendVerification} from "@/db/dbal/registeredAccountRepository";
import {
	EmailSchema,
	authenticationEmailUnavailableResponse,
	isResponse,
	readJson,
	requestNetwork,
} from "../_shared";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
	const securityError = mutationSecurityError(request);
	if (securityError) return securityError;
	const input = await readJson(request, z.object({email: EmailSchema}));
	if (isResponse(input)) return input;
	if (!authenticationEmailIsConfigured()) return authenticationEmailUnavailableResponse();
	try {
		const dispatch = await resendVerification(input.email, requestNetwork(request));
		if (dispatch) await sendAuthenticationEmail({...dispatch, kind: "verify_email"});
	} catch {
		console.error("Verification email could not be resent.");
	}
	return NextResponse.json(
		{data: {message: "If a verification is pending, a new message is on its way."}},
		{status: 202},
	);
}
