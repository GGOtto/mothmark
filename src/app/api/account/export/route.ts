import {NextResponse} from "next/server";

import {resolveCurrentActor} from "@/auth/currentActor";
import {authRequiredResponse} from "@/auth/requestSecurity";
import {exportOwnedAccount} from "@/db/dbal/accountRepository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
	const actor = await resolveCurrentActor(request, "editor");
	if (!actor) return authRequiredResponse();
	const exported = await exportOwnedAccount(actor.userId);
	if (!exported) return authRequiredResponse();
	return NextResponse.json(exported, {
		headers: {
			"cache-control": "private, no-store",
			"content-disposition": 'attachment; filename="mothmark-account-export.json"',
		},
	});
}
