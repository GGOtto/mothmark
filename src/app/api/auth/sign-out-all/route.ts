import {NextResponse} from "next/server";

import {resolveCurrentActor} from "@/auth/currentActor";
import {authRequiredResponse, mutationSecurityError} from "@/auth/requestSecurity";
import {revokeAllEditorSessions} from "@/db/dbal/registeredAccountRepository";
import {clearEditorSessionCookie} from "../_shared";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
	const securityError = mutationSecurityError(request);
	if (securityError) return securityError;
	const actor = await resolveCurrentActor(request, "editor");
	if (!actor || actor.accountType !== "registered") return authRequiredResponse();
	await revokeAllEditorSessions(actor.userId);
	const response = new NextResponse(null, {status: 204});
	clearEditorSessionCookie(response);
	return response;
}
