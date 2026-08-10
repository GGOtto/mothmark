import {NextResponse} from "next/server";

import {resolveCurrentActor} from "@/auth/currentActor";
import {authRequiredResponse, mutationSecurityError} from "@/auth/requestSecurity";
import {readBoundedJson, WORLD_REQUEST_MAX_BYTES} from "@/auth/requestBody";
import {
	createOwnedWorld,
	getOwnedWorldLibrary,
	listOwnedTrashedWorlds,
} from "@/db/dbal/worldsRepository";

import {
	CreateWorldRequestSchema,
	handleWorldRouteError,
	requestBodyErrorResponse,
	validationErrorResponse,
	worldPermissionError,
} from "./_shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
	try {
		const actor = await resolveCurrentActor(request, "editor");
		if (!actor) return authRequiredResponse();
		const permissionError = await worldPermissionError(actor, "editor.access");
		if (permissionError) return permissionError;
		if (new URL(request.url).searchParams.get("view") === "trash") {
			return NextResponse.json({data: {worlds: await listOwnedTrashedWorlds(actor.userId)}});
		}
		return NextResponse.json({data: await getOwnedWorldLibrary(actor.userId)});
	} catch (error) {
		return handleWorldRouteError(error);
	}
}

export async function POST(request: Request): Promise<NextResponse> {
	const securityError = mutationSecurityError(request);
	if (securityError) return securityError;

	let body: unknown;
	try {
		body = await readBoundedJson(request, WORLD_REQUEST_MAX_BYTES);
	} catch (error) {
		return requestBodyErrorResponse(error);
	}
	const parsed = CreateWorldRequestSchema.safeParse(body);
	if (!parsed.success) return validationErrorResponse(parsed.error.issues);

	try {
		const actor = await resolveCurrentActor(request, "editor");
		if (!actor) return authRequiredResponse();
		const permissionError = await worldPermissionError(actor, "world.create");
		if (permissionError) return permissionError;
		return NextResponse.json(
			{data: await createOwnedWorld(actor.userId, parsed.data)},
			{status: 201},
		);
	} catch (error) {
		return handleWorldRouteError(error);
	}
}
