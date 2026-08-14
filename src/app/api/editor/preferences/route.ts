import {NextResponse} from "next/server";
import {z} from "zod";

import {resolveCurrentActor} from "@/auth/currentActor";
import {AUTH_REQUEST_MAX_BYTES, readBoundedJson} from "@/auth/requestBody";
import {authRequiredResponse, mutationSecurityError} from "@/auth/requestSecurity";
import {
	getEditorPreferences,
	getOwnedItemActivity,
	updateEditorPreferences,
} from "@/db/dbal/editorPreferencesRepository";
import {userHasPermission} from "@/db/dbal/permissionRepository";
import {UpdateEditorPreferencesSchema} from "@/editor/editorPreferences";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WorldIdSchema = z.uuid();

const errorResponse = (status: number, code: string, message: string) =>
	NextResponse.json({error: {code, message}}, {status});

async function editorActor(
	request: Request,
): Promise<
	{error: NextResponse} | {actor: NonNullable<Awaited<ReturnType<typeof resolveCurrentActor>>>}
> {
	const actor = await resolveCurrentActor(request, "editor");
	if (!actor) return {error: authRequiredResponse()} as const;
	if (!(await userHasPermission(actor.userId, "editor.access"))) {
		return {error: errorResponse(403, "FORBIDDEN", "This account cannot use the editor.")} as const;
	}
	return {actor} as const;
}

export async function GET(request: Request): Promise<NextResponse> {
	try {
		const resolved = await editorActor(request);
		if ("error" in resolved) return resolved.error;
		const url = new URL(request.url);
		const worldIdValue = url.searchParams.get("worldId");
		const worldId = worldIdValue ? WorldIdSchema.safeParse(worldIdValue) : null;
		if (worldId && !worldId.success) {
			return errorResponse(400, "VALIDATION_ERROR", "The world ID is invalid.");
		}

		const [preferences, itemActivity] = await Promise.all([
			getEditorPreferences(resolved.actor.userId),
			worldId?.success
				? getOwnedItemActivity(resolved.actor.userId, worldId.data)
				: Promise.resolve({}),
		]);
		if (itemActivity === undefined) {
			return errorResponse(404, "WORLD_NOT_FOUND", "The requested world does not exist.");
		}
		return NextResponse.json({data: {preferences, itemActivity}});
	} catch (error) {
		console.error("Editor preferences request failed", error);
		return errorResponse(500, "INTERNAL_ERROR", "The editor preferences could not be loaded.");
	}
}

export async function PATCH(request: Request): Promise<NextResponse> {
	const securityError = mutationSecurityError(request);
	if (securityError) return securityError;

	let body: unknown;
	try {
		body = await readBoundedJson(request, AUTH_REQUEST_MAX_BYTES);
	} catch {
		return errorResponse(400, "INVALID_JSON", "The request body must contain valid JSON.");
	}
	const parsed = UpdateEditorPreferencesSchema.safeParse(body);
	if (!parsed.success) {
		return errorResponse(400, "VALIDATION_ERROR", "The editor preferences are invalid.");
	}

	try {
		const resolved = await editorActor(request);
		if ("error" in resolved) return resolved.error;
		const preferences = await updateEditorPreferences(resolved.actor.userId, parsed.data);
		return NextResponse.json({data: {preferences, itemActivity: {}}});
	} catch (error) {
		console.error("Editor preferences update failed", error);
		return errorResponse(500, "INTERNAL_ERROR", "The editor preferences could not be saved.");
	}
}
