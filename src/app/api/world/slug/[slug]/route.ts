import {NextResponse} from "next/server";

import {worldNotFoundResponse} from "../../_shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type WorldSlugRouteContext = {
	params: Promise<{slug: string}>;
};

export async function GET(_: Request, context: WorldSlugRouteContext): Promise<NextResponse> {
	await context.params;
	return worldNotFoundResponse();
}
