import {NextResponse} from "next/server";

import {resolveCurrentActor} from "@/auth/currentActor";
import {authRequiredResponse, mutationSecurityError} from "@/auth/requestSecurity";
import {duplicateOwnedWorld} from "@/db/dbal/worldsRepository";

import {
	WorldIdSchema,
	handleWorldRouteError,
	validationErrorResponse,
	worldNotFoundResponse,
} from "../../_shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
	request: Request,
	context: {params: Promise<{id: string}>},
): Promise<NextResponse> {
	const parsedId = WorldIdSchema.safeParse((await context.params).id);
	if (!parsedId.success) return validationErrorResponse(parsedId.error.issues);
	const securityError = mutationSecurityError(request);
	if (securityError) return securityError;
	try {
		const actor = await resolveCurrentActor(request, "editor");
		if (!actor) return authRequiredResponse();
		const world = await duplicateOwnedWorld(actor.userId, parsedId.data);
		return world ? NextResponse.json({data: world}, {status: 201}) : worldNotFoundResponse();
	} catch (error) {
		return handleWorldRouteError(error);
	}
}
