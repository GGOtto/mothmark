import {NextResponse} from "next/server";

import {resolveCurrentActor} from "@/auth/currentActor";
import {authRequiredResponse} from "@/auth/requestSecurity";
import {exportOwnedWorld} from "@/db/dbal/worldsRepository";

import {
	WorldIdSchema,
	handleWorldRouteError,
	validationErrorResponse,
	worldNotFoundResponse,
	worldPermissionError,
} from "../../_shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
	request: Request,
	context: {params: Promise<{id: string}>},
): Promise<NextResponse> {
	const parsedId = WorldIdSchema.safeParse((await context.params).id);
	if (!parsedId.success) return validationErrorResponse(parsedId.error.issues);
	try {
		const actor = await resolveCurrentActor(request, "editor");
		if (!actor) return authRequiredResponse();
		const permissionError = await worldPermissionError(actor, "world.export_owned");
		if (permissionError) return permissionError;
		const exported = await exportOwnedWorld(actor.userId, parsedId.data);
		if (!exported) return worldNotFoundResponse();
		return NextResponse.json(exported, {
			headers: {
				"cache-control": "private, no-store",
				"content-disposition": `attachment; filename="${exported.editorSlug}.mothmark.json"`,
			},
		});
	} catch (error) {
		return handleWorldRouteError(error);
	}
}
