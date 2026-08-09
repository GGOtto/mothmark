import {NextResponse} from "next/server";

import {ADMIN_SESSION_COOKIE} from "@/auth/cookieNames";
import {mutationSecurityError} from "@/auth/requestSecurity";
import {readCookie} from "@/auth/sessionTokens";
import {revokeAdministratorSession} from "@/db/dbal/adminAuthRepository";
import {isResponse, requireAdministrator} from "../../_shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
	const securityError = mutationSecurityError(request, "admin");
	if (securityError) return securityError;
	const actor = await requireAdministrator(request);
	if (isResponse(actor)) return actor;
	const token = readCookie(request, ADMIN_SESSION_COOKIE);
	if (token) await revokeAdministratorSession(token);
	const response = new NextResponse(null, {status: 204});
	response.cookies.set(ADMIN_SESSION_COOKIE, "", {
		httpOnly: true,
		maxAge: 0,
		path: "/",
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
	});
	return response;
}
