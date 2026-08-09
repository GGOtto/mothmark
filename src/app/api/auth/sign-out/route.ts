import {NextResponse} from "next/server";

import {EDITOR_SESSION_COOKIE} from "@/auth/cookieNames";
import {mutationSecurityError} from "@/auth/requestSecurity";
import {readCookie} from "@/auth/sessionTokens";
import {revokeEditorSession} from "@/db/dbal/registeredAccountRepository";
import {clearEditorSessionCookie} from "../_shared";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
	const securityError = mutationSecurityError(request);
	if (securityError) return securityError;
	const token = readCookie(request, EDITOR_SESSION_COOKIE);
	if (token) await revokeEditorSession(token);
	const response = new NextResponse(null, {status: 204});
	clearEditorSessionCookie(response);
	return response;
}
