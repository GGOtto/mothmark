import {NextResponse} from "next/server";

import {mutationSecurityError} from "@/auth/requestSecurity";
import {PLAY_SESSION_COOKIE, PLAY_SESSION_DURATION_MS, readCookie} from "@/auth/sessionTokens";
import {PublicationError, bootstrapHostedPlay} from "@/db/dbal/publicationRepository";
import {findBootstrapPlayActor} from "@/db/dbal/sessionsRepository";
import {requestNetwork} from "@/app/api/auth/_shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = {params: Promise<{slug: string}>};

export async function POST(request: Request, context: Context): Promise<NextResponse> {
	const securityError = mutationSecurityError(request, "play");
	if (securityError) return securityError;
	try {
		const token = readCookie(request, PLAY_SESSION_COOKIE);
		const actor = token ? await findBootstrapPlayActor(token) : undefined;
		if (actor === "blocked") {
			return NextResponse.json(
				{error: {code: "FORBIDDEN", message: "Hosted play is not available for this account."}},
				{status: 403},
			);
		}
		const result = await bootstrapHostedPlay(
			(await context.params).slug,
			actor?.userId,
			requestNetwork(request),
		);
		const response = NextResponse.json(
			{
				data: {
					publication: result.publication,
					playthrough: result.playthrough,
					newerReleaseAvailable: result.newerReleaseAvailable,
				},
			},
			{status: result.session ? 201 : 200},
		);
		if (result.session) {
			response.cookies.set(PLAY_SESSION_COOKIE, result.session.token, {
				httpOnly: true,
				sameSite: "lax",
				secure: process.env.NODE_ENV === "production",
				path: "/",
				maxAge: Math.floor(PLAY_SESSION_DURATION_MS / 1_000),
				expires: result.session.expiresAt,
			});
		}
		return response;
	} catch (error) {
		if (error instanceof PublicationError) {
			return NextResponse.json(
				{error: {code: error.code, message: error.message}},
				{
					status:
						error.code === "RATE_LIMITED"
							? 429
							: ["FORBIDDEN", "SUSPENDED"].includes(error.code)
								? 403
								: 404,
				},
			);
		}
		console.error("Hosted-play bootstrap failed", error);
		return NextResponse.json(
			{error: {code: "INTERNAL_ERROR", message: "The hosted playthrough could not be started."}},
			{status: 500},
		);
	}
}
