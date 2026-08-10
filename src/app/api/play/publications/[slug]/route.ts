import {NextResponse} from "next/server";

import {getPublicPublication} from "@/db/dbal/publicationRepository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = {params: Promise<{slug: string}>};

export async function GET(_: Request, context: Context): Promise<NextResponse> {
	try {
		const publication = await getPublicPublication((await context.params).slug);
		if (!publication) {
			return NextResponse.json(
				{error: {code: "NOT_FOUND", message: "The published world does not exist."}},
				{status: 404},
			);
		}
		const metadata = {
			authorUsername: publication.authorUsername,
			id: publication.id,
			slug: publication.slug,
			title: publication.title,
			summary: publication.summary,
			visibility: publication.visibility,
			release: publication.release,
		};
		return NextResponse.json({data: metadata}, {headers: {"cache-control": "public, max-age=30"}});
	} catch (error) {
		console.error("Published-world request failed", error);
		return NextResponse.json(
			{error: {code: "INTERNAL_ERROR", message: "The published world could not be loaded."}},
			{status: 500},
		);
	}
}
