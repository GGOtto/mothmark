import {NextResponse} from "next/server";
import {z} from "zod";

import {getAdminPlaythrough} from "@/db/dbal/adminPlaythroughRepository";
import {adminRouteError, isResponse, requireAdminPermission} from "../../_shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
	request: Request,
	context: {params: Promise<{id: string}>},
): Promise<NextResponse> {
	const actor = await requireAdminPermission(request, "admin.playthroughs.view");
	if (isResponse(actor)) return actor;
	const id = z.uuid().safeParse((await context.params).id);
	if (!id.success)
		return NextResponse.json(
			{error: {code: "NOT_FOUND", message: "The playthrough does not exist."}},
			{status: 404},
		);
	try {
		const playthrough = await getAdminPlaythrough(actor.userId, id.data);
		return playthrough
			? NextResponse.json({data: playthrough}, {headers: {"cache-control": "private, no-store"}})
			: NextResponse.json(
					{error: {code: "NOT_FOUND", message: "The playthrough does not exist."}},
					{status: 404},
				);
	} catch (error) {
		return adminRouteError(error);
	}
}
