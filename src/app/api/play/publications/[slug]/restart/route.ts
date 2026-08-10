import {NextResponse} from "next/server";

import {resolveCurrentActor} from "@/auth/currentActor";
import {mutationSecurityError} from "@/auth/requestSecurity";
import {PublicationError, restartHostedPlay} from "@/db/dbal/publicationRepository";
import {requestNetwork} from "@/app/api/auth/_shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
	request: Request,
	context: {params: Promise<{slug: string}>},
): Promise<NextResponse> {
	const securityError = mutationSecurityError(request, "play");
	if (securityError) return securityError;
	const actor = await resolveCurrentActor(request, "play");
	if (!actor)
		return NextResponse.json(
			{error: {code: "AUTH_REQUIRED", message: "Open the world before restarting it."}},
			{status: 401},
		);
	try {
		const result = await restartHostedPlay({
			playerUserId: actor.userId,
			slug: (await context.params).slug,
			network: requestNetwork(request),
		});
		return NextResponse.json({data: result});
	} catch (error) {
		if (error instanceof PublicationError)
			return NextResponse.json(
				{error: {code: error.code, message: error.message}},
				{
					status:
						error.code === "RATE_LIMITED"
							? 429
							: error.code === "NOT_FOUND" || error.code === "UNPUBLISHED"
								? 404
								: 403,
				},
			);
		console.error("Hosted-play restart failed", error);
		return NextResponse.json(
			{error: {code: "INTERNAL_ERROR", message: "The playthrough could not be restarted."}},
			{status: 500},
		);
	}
}
