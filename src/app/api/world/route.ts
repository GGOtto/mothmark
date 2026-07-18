import {NextResponse} from "next/server";

import {createWorld, listWorlds} from "@/db/dbal/worldsRepository";

import {
	CreateWorldRequestSchema,
	handleWorldRouteError,
	invalidJsonResponse,
	validationErrorResponse,
} from "./_shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
	try {
		return NextResponse.json({data: await listWorlds()});
	} catch (error) {
		return handleWorldRouteError(error);
	}
}

export async function POST(request: Request): Promise<NextResponse> {
	let body: unknown;

	try {
		body = await request.json();
	} catch {
		return invalidJsonResponse();
	}

	const result = CreateWorldRequestSchema.safeParse(body);

	if (!result.success) {
		return validationErrorResponse(result.error.issues);
	}

	try {
		const world = await createWorld(result.data);
		return NextResponse.json({data: world}, {status: 201});
	} catch (error) {
		return handleWorldRouteError(error);
	}
}
