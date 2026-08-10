import {NextResponse} from "next/server";
import {z} from "zod";

import {ADMIN_CHALLENGE_COOKIE} from "@/auth/cookieNames";
import {mutationSecurityError} from "@/auth/requestSecurity";
import {beginAdministratorSignIn} from "@/db/dbal/adminAuthRepository";
import {
	EmailSchema,
	PasswordSchema,
	isResponse,
	readJson,
	requestNetwork,
} from "../../../auth/_shared";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
	const securityError = mutationSecurityError(request, "admin");
	if (securityError) return securityError;
	const input = await readJson(request, z.object({email: EmailSchema, password: PasswordSchema}));
	if (isResponse(input)) return input;
	const result = await beginAdministratorSignIn({...input, network: requestNetwork(request)});
	if (result.status === "invalid") {
		return NextResponse.json(
			{error: {code: "INVALID_CREDENTIALS", message: "The administrator credentials are incorrect."}},
			{status: 401},
		);
	}
	const response = NextResponse.json({data: {secondFactorRequired: true}});
	response.cookies.set(ADMIN_CHALLENGE_COOKIE, result.challengeToken, {
		expires: result.expiresAt,
		httpOnly: true,
		maxAge: 5 * 60,
		path: "/api/admin/auth",
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
	});
	return response;
}
