import {NextResponse} from "next/server";

import {PLAY_SESSION_COOKIE, readCookie} from "@/auth/sessionTokens";
import {listPublications} from "@/db/dbal/publicationRepository";
import {findBootstrapPlayActor} from "@/db/dbal/sessionsRepository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
	try {
		const search = new URL(request.url).searchParams.get("search") ?? "";
		const token = readCookie(request, PLAY_SESSION_COOKIE);
		const actor = token ? await findBootstrapPlayActor(token) : undefined;
		return NextResponse.json(
			{
				data: {
					publications: await listPublications(search, actor === "blocked" ? undefined : actor?.userId),
				},
			},
			{
				headers: {
					"cache-control": token
						? "private, no-store"
						: "public, max-age=30, stale-while-revalidate=120",
				},
			},
		);
	} catch (error) {
		console.error("Public catalog request failed", error);
		return NextResponse.json(
			{error: {code: "INTERNAL_ERROR", message: "Published worlds could not be loaded."}},
			{status: 500},
		);
	}
}
