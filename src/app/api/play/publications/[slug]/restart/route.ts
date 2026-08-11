import {NextResponse} from "next/server";
import {z} from "zod";

import {resolveCurrentActor} from "@/auth/currentActor";
import {mutationSecurityError} from "@/auth/requestSecurity";
import {PublicationError, restartHostedPlay} from "@/db/dbal/publicationRepository";
import {requestNetwork} from "@/app/api/auth/_shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RestartRequestSchema = z.object({
	sourcePlaythroughId: z.uuid(),
	expectedTargetReleaseId: z.uuid(),
	restartRequestId: z.uuid(),
	source: z.enum(["player_menu", "release_notice", "play_again"]),
});

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
		const parsed = RestartRequestSchema.safeParse(await request.json().catch(() => undefined));
		if (!parsed.success)
			return NextResponse.json(
				{
					error: {
						code: "INVALID_REQUEST",
						message: "The restart request is invalid. Refresh and try again.",
					},
				},
				{status: 400},
			);
		const result = await restartHostedPlay({
			playerUserId: actor.userId,
			slug: (await context.params).slug,
			...parsed.data,
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
							: error.code === "RESTART_CONFLICT"
								? 409
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
