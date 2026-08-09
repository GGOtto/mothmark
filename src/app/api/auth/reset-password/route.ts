import {NextResponse} from "next/server";
import {z} from "zod";

import {PasswordValidationError} from "@/auth/passwords";
import {mutationSecurityError} from "@/auth/requestSecurity";
import {resetPassword} from "@/db/dbal/registeredAccountRepository";
import {PasswordSchema, isResponse, readJson} from "../_shared";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
	const securityError = mutationSecurityError(request);
	if (securityError) return securityError;
	const input = await readJson(
		request,
		z.object({password: PasswordSchema, token: z.string().min(1).max(512)}),
	);
	if (isResponse(input)) return input;
	try {
		if (!(await resetPassword(input.token, input.password))) {
			return NextResponse.json(
				{error: {code: "LINK_EXPIRED", message: "This reset link is invalid or has expired."}},
				{status: 410},
			);
		}
		return NextResponse.json({data: {passwordReset: true}});
	} catch (error) {
		if (error instanceof PasswordValidationError) {
			return NextResponse.json({error: {code: error.code, message: error.message}}, {status: 400});
		}
		throw error;
	}
}
