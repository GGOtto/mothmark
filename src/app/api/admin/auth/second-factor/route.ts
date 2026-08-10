import {NextResponse} from "next/server";
import {z} from "zod";

import {ADMIN_CHALLENGE_COOKIE, ADMIN_SESSION_COOKIE} from "@/auth/cookieNames";
import {mutationSecurityError} from "@/auth/requestSecurity";
import {ADMIN_SESSION_DURATION_MS, readCookie} from "@/auth/sessionTokens";
import {completeAdministratorSignIn} from "@/db/dbal/adminAuthRepository";
import {isResponse, readJson, requestNetwork} from "../../../auth/_shared";

export const runtime = "nodejs";

function clearChallenge(response: NextResponse): void {
	response.cookies.set(ADMIN_CHALLENGE_COOKIE, "", {
		httpOnly: true,
		maxAge: 0,
		path: "/api/admin/auth",
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
	});
}

export async function POST(request: Request): Promise<NextResponse> {
	const securityError = mutationSecurityError(request, "admin");
	if (securityError) return securityError;
	const input = await readJson(request, z.object({secondFactor: z.string().trim().min(6).max(64)}));
	if (isResponse(input)) return input;
	const challengeToken = readCookie(request, ADMIN_CHALLENGE_COOKIE);
	if (!challengeToken) {
		return NextResponse.json(
			{error: {code: "CHALLENGE_EXPIRED", message: "That sign-in challenge expired. Start again."}},
			{status: 401},
		);
	}
	const result = await completeAdministratorSignIn({
		challengeToken,
		network: requestNetwork(request),
		secondFactor: input.secondFactor,
	});
	if (result.status === "invalid") {
		return NextResponse.json(
			{
				error: {
					code: "INVALID_SECOND_FACTOR",
					message: "The authentication code is invalid or has already been used.",
				},
			},
			{status: 401},
		);
	}
	const response = NextResponse.json({data: {authenticated: true}});
	response.cookies.set(ADMIN_SESSION_COOKIE, result.sessionToken, {
		expires: result.expiresAt,
		httpOnly: true,
		maxAge: Math.floor(ADMIN_SESSION_DURATION_MS / 1_000),
		path: "/",
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
	});
	clearChallenge(response);
	return response;
}
