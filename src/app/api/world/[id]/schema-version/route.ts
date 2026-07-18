import {NextResponse} from "next/server";

import {updateWorldSchemaVersion} from "@/db/dbal/worldsRepository";

import {
	handleWorldRouteError,
	invalidJsonResponse,
	UpdateSchemaVersionRequestSchema,
	validationErrorResponse,
	WorldIdSchema,
	worldNotFoundResponse,
} from "../../_shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SchemaVersionRouteContext = {
	params: Promise<{id: string}>;
};

export async function PATCH(
	request: Request,
	context: SchemaVersionRouteContext,
): Promise<NextResponse> {
	const {id} = await context.params;
	const idResult = WorldIdSchema.safeParse(id);

	if (!idResult.success) {
		return validationErrorResponse(idResult.error.issues);
	}

	let body: unknown;

	try {
		body = await request.json();
	} catch {
		return invalidJsonResponse();
	}

	const bodyResult = UpdateSchemaVersionRequestSchema.safeParse(body);

	if (!bodyResult.success) {
		return validationErrorResponse(bodyResult.error.issues);
	}

	try {
		const world = await updateWorldSchemaVersion(idResult.data, bodyResult.data.schemaVersion);
		return world ? NextResponse.json({data: world}) : worldNotFoundResponse();
	} catch (error) {
		return handleWorldRouteError(error);
	}
}
