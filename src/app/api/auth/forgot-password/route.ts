import {NextResponse} from "next/server";
import {z} from "zod";

import {authenticationEmailIsConfigured, sendAuthenticationEmail} from "@/auth/email";
import {mutationSecurityError} from "@/auth/requestSecurity";
import {beginPasswordReset} from "@/db/dbal/registeredAccountRepository";
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
		const result = await beginPasswordReset({...input, network: requestNetwork(request)});
		if (result.dispatch) {
			await sendAuthenticationEmail({...result.dispatch, kind: "password_reset"});
		}
	} catch {
		console.error("Password recovery could not be started.");
	}
	return NextResponse.json(
		{data: {message: "If the address belongs to an account, a recovery message is on its way."}},
		{status: 202},
	);
}
