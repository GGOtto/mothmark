import {NextResponse} from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function POST(): NextResponse {
	return NextResponse.json(
		{error: {code: "NOT_FOUND", message: "This endpoint is not available."}},
		{status: 404},
	);
}
