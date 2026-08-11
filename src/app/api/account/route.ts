import {NextResponse} from "next/server";

import {PublicProfileInputSchema, normalizePublicProfileInput} from "@/auth/publicProfile";
import {resolveCurrentActor} from "@/auth/currentActor";
import {authRequiredResponse, mutationSecurityError} from "@/auth/requestSecurity";
import {
	getOwnedAccountSummary,
	permanentlyDeleteOwnedAccount,
	updateOwnedPublicProfile,
} from "@/db/dbal/accountRepository";
import {deleteRegisteredAccount} from "@/db/dbal/registeredAccountRepository";
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

export async function PATCH(request: Request): Promise<NextResponse> {
	const securityError = mutationSecurityError(request);
	if (securityError) return securityError;
	const actor = await resolveCurrentActor(request, "editor");
	if (!actor) return authRequiredResponse();
	if (actor.accountType !== "registered") {
		return NextResponse.json(
			{error: {code: "REGISTERED_ACCOUNT_REQUIRED", message: "Create an account first."}},
			{status: 403},
		);
	}
	const parsed = PublicProfileInputSchema.safeParse(await request.json().catch(() => undefined));
	if (!parsed.success) {
		return NextResponse.json(
			{error: {code: "INVALID_PROFILE", message: "Check the public profile fields and try again."}},
			{status: 400},
		);
	}
	const account = await updateOwnedPublicProfile(
		actor.userId,
		normalizePublicProfileInput(parsed.data),
	);
	if (!account) return authRequiredResponse();
	return NextResponse.json({data: account}, {headers: {"cache-control": "private, no-store"}});
}

export async function DELETE(request: Request): Promise<NextResponse> {
	const securityError = mutationSecurityError(request);
	if (securityError) return securityError;
	const actor = await resolveCurrentActor(request, "editor");
	if (!actor) return authRequiredResponse();
	if (actor.accountType === "registered") {
		let password = "";
		try {
			const body = (await request.json()) as {password?: unknown};
			if (typeof body.password === "string") password = body.password;
		} catch {
			return NextResponse.json(
				{error: {code: "INVALID_JSON", message: "The request body must contain valid JSON."}},
				{status: 400},
			);
		}
		const result = await deleteRegisteredAccount({password, userId: actor.userId});
		if (result === "sole_administrator") {
			return NextResponse.json(
				{
					error: {
						code: "SOLE_ADMINISTRATOR",
						message: "Provision a replacement administrator before deleting this account.",
					},
				},
				{status: 409},
			);
		}
		if (result === "invalid_credentials") {
			return NextResponse.json(
				{error: {code: "INVALID_CREDENTIALS", message: "The password is incorrect."}},
				{status: 401},
			);
		}
	} else if (!(await permanentlyDeleteOwnedAccount(actor.userId))) {
		return authRequiredResponse();
	}
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
