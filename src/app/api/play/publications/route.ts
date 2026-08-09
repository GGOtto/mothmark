import {NextResponse} from "next/server";

import {listPublications} from "@/db/dbal/publicationRepository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
	try {
		const search = new URL(request.url).searchParams.get("search") ?? "";
		return NextResponse.json(
			{data: {publications: await listPublications(search)}},
			{headers: {"cache-control": "public, max-age=30, stale-while-revalidate=120"}},
		);
	} catch (error) {
		console.error("Public catalog request failed", error);
		return NextResponse.json(
			{error: {code: "INTERNAL_ERROR", message: "Published worlds could not be loaded."}},
			{status: 500},
		);
	}
}
