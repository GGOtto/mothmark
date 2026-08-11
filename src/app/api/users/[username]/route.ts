import {NextResponse} from "next/server";

import {getPublicUserProfile} from "@/db/dbal/publicProfileRepository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
	_: Request,
	context: {params: Promise<{username: string}>},
): Promise<NextResponse> {
	try {
		const profile = await getPublicUserProfile((await context.params).username);
		if (!profile) {
			return NextResponse.json(
				{error: {code: "NOT_FOUND", message: "This public profile does not exist."}},
				{status: 404},
			);
		}
		return NextResponse.json(
			{data: profile},
			{headers: {"cache-control": "public, max-age=30, stale-while-revalidate=120"}},
		);
	} catch (error) {
		console.error("Public profile request failed", error);
		return NextResponse.json(
			{error: {code: "INTERNAL_ERROR", message: "The public profile could not be loaded."}},
			{status: 500},
		);
	}
}
