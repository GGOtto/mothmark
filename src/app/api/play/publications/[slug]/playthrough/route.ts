import {NextResponse} from "next/server";

import {resolveCurrentActor} from "@/auth/currentActor";
import {mutationSecurityError} from "@/auth/requestSecurity";
import {PublicationError, deleteHostedPlaythrough} from "@/db/dbal/publicationRepository";
import {requestNetwork} from "@/app/api/auth/_shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(
	request: Request,
	context: {params: Promise<{slug: string}>},
): Promise<NextResponse> {
	const securityError = mutationSecurityError(request, "play");
	if (securityError) return securityError;
	const actor = await resolveCurrentActor(request, "play");
	if (!actor)
		return NextResponse.json(
			{error: {code: "AUTH_REQUIRED", message: "Open the world before deleting its progress."}},
			{status: 401},
		);
	try {
		const deleted = await deleteHostedPlaythrough({
			playerUserId: actor.userId,
			slug: (await context.params).slug,
			network: requestNetwork(request),
		});
		return deleted
			? new NextResponse(null, {status: 204})
			: NextResponse.json(
					{error: {code: "NOT_FOUND", message: "No saved playthrough exists for this world."}},
					{status: 404},
				);
	} catch (error) {
		if (error instanceof PublicationError && error.code === "RATE_LIMITED")
			return NextResponse.json({error: {code: error.code, message: error.message}}, {status: 429});
		console.error("Hosted-play deletion failed", error);
		return NextResponse.json(
			{error: {code: "INTERNAL_ERROR", message: "The saved playthrough could not be deleted."}},
			{status: 500},
		);
	}
}
