import {NextResponse} from "next/server";

import {deleteWorld, getWorld, updateWorld} from "@/db/dbal/worldsRepository";

import {
	WorldIdSchema,
	handleWorldRouteError,
	invalidJsonResponse,
	UpdateWorldRequestSchema,
	validationErrorResponse,
	worldNotFoundResponse,
	worldRevisionConflictResponse,
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

export async function GET(_: Request, context: WorldRouteContext): Promise<NextResponse> {
	const idResult = await parseWorldId(context);

	if (!idResult.success) {
		return validationErrorResponse(idResult.error.issues);
	}

	try {
		const world = await getWorld(idResult.data);
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

	let body: unknown;

	try {
		body = await request.json();
	} catch {
		return invalidJsonResponse();
	}

	const bodyResult = UpdateWorldRequestSchema.safeParse(body);

	if (!bodyResult.success) {
		return validationErrorResponse(bodyResult.error.issues);
	}

	try {
		const {expectedRevision, ...update} = bodyResult.data;
		const world = await updateWorld(idResult.data, update, expectedRevision);

		if (world) return NextResponse.json({data: world});

		return expectedRevision === undefined ? worldNotFoundResponse() : worldRevisionConflictResponse();
	} catch (error) {
		return handleWorldRouteError(error);
	}
}

export const PATCH = PUT;

export async function DELETE(_: Request, context: WorldRouteContext): Promise<Response> {
	const idResult = await parseWorldId(context);

	if (!idResult.success) {
		return validationErrorResponse(idResult.error.issues);
	}

	try {
		return (await deleteWorld(idResult.data))
			? new Response(null, {status: 204})
			: worldNotFoundResponse();
	} catch (error) {
		return handleWorldRouteError(error);
	}
}
