import {NextResponse} from "next/server";

import {resolveCurrentActor} from "@/auth/currentActor";
import {authRequiredResponse, mutationSecurityError} from "@/auth/requestSecurity";
import {readBoundedJson, WORLD_REQUEST_MAX_BYTES} from "@/auth/requestBody";
import {
	deleteOwnedWorld,
	getOwnedWorld,
	getOwnedWorldBySlug,
	permanentlyDeleteOwnedWorld,
	updateOwnedWorld,
} from "@/db/dbal/worldsRepository";
import {
	getOwnedItemActivitySnapshot,
	recordItemActivity,
} from "@/db/dbal/editorPreferencesRepository";

import {
	WorldIdSchema,
	WorldLocatorSchema,
	handleWorldRouteError,
	requestBodyErrorResponse,
	UpdateWorldRequestSchema,
	validationErrorResponse,
	worldNotFoundResponse,
	worldRevisionConflictResponse,
	worldPermissionError,
} from "../_shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type WorldRouteContext = {
	params: Promise<{id: string}>;
};

const parseWorldId = async (context: WorldRouteContext) => {
	const {id} = await context.params;
	return WorldIdSchema.safeParse(id);
};

const parseWorldLocator = async (context: WorldRouteContext) => {
	const {id} = await context.params;
	return WorldLocatorSchema.safeParse(id);
};

export async function GET(request: Request, context: WorldRouteContext): Promise<NextResponse> {
	const locatorResult = await parseWorldLocator(context);

	if (!locatorResult.success) {
		return validationErrorResponse(locatorResult.error.issues);
	}

	try {
		const actor = await resolveCurrentActor(request, "editor");
		if (!actor) return authRequiredResponse();
		const permissionError = await worldPermissionError(actor, "editor.access");
		if (permissionError) return permissionError;
		const world = WorldIdSchema.safeParse(locatorResult.data).success
			? await getOwnedWorld(actor.userId, locatorResult.data)
			: await getOwnedWorldBySlug(actor.userId, locatorResult.data);
		return world ? NextResponse.json({data: world}) : worldNotFoundResponse();
	} catch (error) {
		return handleWorldRouteError(error);
	}
}

export async function PUT(request: Request, context: WorldRouteContext): Promise<NextResponse> {
	const idResult = await parseWorldId(context);

	if (!idResult.success) {
		return validationErrorResponse(idResult.error.issues);
	}
	const securityError = mutationSecurityError(request);
	if (securityError) return securityError;

	let body: unknown;

	try {
		body = await readBoundedJson(request, WORLD_REQUEST_MAX_BYTES);
	} catch (error) {
		return requestBodyErrorResponse(error);
	}

	const bodyResult = UpdateWorldRequestSchema.safeParse(body);

	if (!bodyResult.success) {
		return validationErrorResponse(bodyResult.error.issues);
	}

	try {
		const actor = await resolveCurrentActor(request, "editor");
		if (!actor) return authRequiredResponse();
		const permissionError = await worldPermissionError(actor, "world.update_owned");
		if (permissionError) return permissionError;
		const {expectedRevision, ...update} = bodyResult.data;
		const activitySnapshot = update.world
			? await getOwnedItemActivitySnapshot(actor.userId, idResult.data)
			: undefined;
		const world = await updateOwnedWorld(actor.userId, idResult.data, update, expectedRevision);

		if (world) {
			if (update.world && activitySnapshot) {
				try {
					await recordItemActivity({
						worldId: idResult.data,
						previousWorld: activitySnapshot.world,
						nextWorld: update.world,
						worldCreatedAt: activitySnapshot.createdAt,
						previousWorldUpdatedAt: activitySnapshot.updatedAt,
					});
				} catch (error) {
					// Activity metadata must never turn an otherwise successful authored-world save into a failure.
					console.error("Could not record editor item activity", error);
				}
			}
			return NextResponse.json({data: world});
		}

		return expectedRevision === undefined ? worldNotFoundResponse() : worldRevisionConflictResponse();
	} catch (error) {
		return handleWorldRouteError(error);
	}
}

export const PATCH = PUT;

export async function DELETE(request: Request, context: WorldRouteContext): Promise<Response> {
	const idResult = await parseWorldId(context);

	if (!idResult.success) {
		return validationErrorResponse(idResult.error.issues);
	}
	const securityError = mutationSecurityError(request);
	if (securityError) return securityError;

	try {
		const actor = await resolveCurrentActor(request, "editor");
		if (!actor) return authRequiredResponse();
		const permissionError = await worldPermissionError(actor, "world.delete_owned");
		if (permissionError) return permissionError;
		const permanent = new URL(request.url).searchParams.get("permanent") === "1";
		const deleted = permanent
			? await permanentlyDeleteOwnedWorld(actor.userId, idResult.data)
			: await deleteOwnedWorld(actor.userId, idResult.data);
		return deleted ? new Response(null, {status: 204}) : worldNotFoundResponse();
	} catch (error) {
		return handleWorldRouteError(error);
	}
}
