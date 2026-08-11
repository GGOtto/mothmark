import {NextResponse} from "next/server";
import {z} from "zod";

import {mutationSecurityError} from "@/auth/requestSecurity";
import {sessionClientLabel} from "@/auth/sessionClient";
import {authenticateEditor} from "@/db/dbal/registeredAccountRepository";
import {
	EmailSchema,
	PasswordSchema,
	isResponse,
	readJson,
	requestNetwork,
	setEditorSessionCookie,
} from "../_shared";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
	const securityError = mutationSecurityError(request);
	if (securityError) return securityError;
	const input = await readJson(request, z.object({email: EmailSchema, password: PasswordSchema}));
	if (isResponse(input)) return input;
	const result = await authenticateEditor({
		...input,
		clientLabel: sessionClientLabel(request.headers.get("user-agent")),
		network: requestNetwork(request),
	});
	if (result.status !== "authenticated") {
		return NextResponse.json(
			{
				error: {
					code: "INVALID_CREDENTIALS",
					message: "The email or password is incorrect. Try again or reset your password.",
				},
			},
			{status: result.status === "throttled" ? 429 : 401},
		);
	}
	const response = NextResponse.json({data: {userId: result.signIn.userId}});
	setEditorSessionCookie(response, result.signIn);
	return response;
}
