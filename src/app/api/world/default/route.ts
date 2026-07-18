import {NextResponse} from "next/server";

import {createDefaultWorld} from "@/db/dbal/worldsRepository";

import {
	CreateDefaultWorldRequestSchema,
	handleWorldRouteError,
	invalidJsonResponse,
	validationErrorResponse,
} from "../_shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
	let body: unknown;

	try {
		body = await request.json();
	} catch {
		return invalidJsonResponse();
	}

	const result = CreateDefaultWorldRequestSchema.safeParse(body);

	if (!result.success) {
		return validationErrorResponse(result.error.issues);
	}

	try {
		const world = await createDefaultWorld(result.data);
		return NextResponse.json({data: world}, {status: 201});
	} catch (error) {
		return handleWorldRouteError(error);
	}
}
