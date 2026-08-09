import {NextResponse} from "next/server";

import {resolveCurrentActor} from "@/auth/currentActor";
import {authRequiredResponse, mutationSecurityError} from "@/auth/requestSecurity";
import {getOwnedAccountSummary, permanentlyDeleteOwnedAccount} from "@/db/dbal/accountRepository";
import {EDITOR_SESSION_COOKIE} from "@/auth/sessionTokens";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
	const actor = await resolveCurrentActor(request, "editor");
	if (!actor) return NextResponse.json({data: null}, {headers: {"cache-control": "no-store"}});
	const account = await getOwnedAccountSummary(actor.userId);
	return NextResponse.json(
		{data: account ?? null},
		{headers: {"cache-control": "private, no-store"}},
	);
}

export async function DELETE(request: Request): Promise<NextResponse> {
	const securityError = mutationSecurityError(request);
	if (securityError) return securityError;
	const actor = await resolveCurrentActor(request, "editor");
	if (!actor) return authRequiredResponse();
	if (!(await permanentlyDeleteOwnedAccount(actor.userId))) return authRequiredResponse();
	const response = NextResponse.json({data: {deleted: true}});
	response.cookies.set(EDITOR_SESSION_COOKIE, "", {
		httpOnly: true,
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
		path: "/",
		maxAge: 0,
	});
	return response;
}
