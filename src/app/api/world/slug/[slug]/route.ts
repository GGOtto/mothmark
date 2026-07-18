import {NextResponse} from "next/server";

import {getWorldBySlug} from "@/db/dbal/worldsRepository";

import {handleWorldRouteError, worldNotFoundResponse} from "../../_shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type WorldSlugRouteContext = {
	params: Promise<{slug: string}>;
};

export async function GET(_: Request, context: WorldSlugRouteContext): Promise<NextResponse> {
	const {slug} = await context.params;

	if (!slug.trim()) {
		return worldNotFoundResponse();
	}

	try {
		const world = await getWorldBySlug(slug);
		return world ? NextResponse.json({data: world}) : worldNotFoundResponse();
	} catch (error) {
		return handleWorldRouteError(error);
	}
}
