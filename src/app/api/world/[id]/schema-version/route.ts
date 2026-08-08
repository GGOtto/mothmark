import {NextResponse} from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SchemaVersionRouteContext = {
	params: Promise<{id: string}>;
};

export async function PATCH(_: Request, context: SchemaVersionRouteContext): Promise<NextResponse> {
	await context.params;
	return NextResponse.json(
		{error: {code: "NOT_FOUND", message: "This endpoint is not available."}},
		{status: 404},
	);
}
