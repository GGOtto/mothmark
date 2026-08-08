import {NextResponse} from "next/server";

import {authRequiredResponse, mutationSecurityError} from "@/auth/requestSecurity";
import {EDITOR_SESSION_COOKIE, EDITOR_SESSION_DURATION_MS, readCookie} from "@/auth/sessionTokens";
import {
	createAnonymousEditorBootstrap,
	findBootstrapEditorActor,
	getOrCreateFirstOwnedWorld,
} from "@/db/dbal/sessionsRepository";
import {handleWorldRouteError} from "../../world/_shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
	const securityError = mutationSecurityError(request);
	if (securityError) return securityError;

	try {
		const sessionToken = readCookie(request, EDITOR_SESSION_COOKIE);
		const actor = sessionToken ? await findBootstrapEditorActor(sessionToken) : undefined;
		if (actor === "blocked") return authRequiredResponse();
		if (actor) {
			return NextResponse.json({data: await getOrCreateFirstOwnedWorld(actor.userId)});
		}

		const bootstrap = await createAnonymousEditorBootstrap();
		const response = NextResponse.json({data: bootstrap.world}, {status: 201});
		response.cookies.set(EDITOR_SESSION_COOKIE, bootstrap.sessionToken, {
			httpOnly: true,
			sameSite: "lax",
			secure: process.env.NODE_ENV === "production",
			path: "/",
			maxAge: Math.floor(EDITOR_SESSION_DURATION_MS / 1_000),
			expires: bootstrap.expiresAt,
		});
		return response;
	} catch (error) {
		return handleWorldRouteError(error);
	}
}
