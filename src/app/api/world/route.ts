import {NextResponse} from "next/server";

import {resolveCurrentActor} from "@/auth/currentActor";
import {authRequiredResponse} from "@/auth/requestSecurity";
import {listOwnedWorlds} from "@/db/dbal/worldsRepository";

import {handleWorldRouteError} from "./_shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
	try {
		const actor = await resolveCurrentActor(request, "editor");
		if (!actor) return authRequiredResponse();
		return NextResponse.json({data: await listOwnedWorlds(actor.userId)});
	} catch (error) {
		return handleWorldRouteError(error);
	}
}

export function POST(): NextResponse {
	return NextResponse.json(
		{error: {code: "WORLD_CREATION_UNAVAILABLE", message: "World creation is not available yet."}},
		{status: 405, headers: {allow: "GET"}},
	);
}
