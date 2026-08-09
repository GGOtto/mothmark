import {NextResponse} from "next/server";

import {listAdminPublications} from "@/db/dbal/publicationRepository";
import {adminRouteError, isResponse, requireAdminPermission} from "../../_shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
	request: Request,
	context: {params: Promise<{id: string}>},
): Promise<NextResponse> {
	const actor = await requireAdminPermission(request, "admin.publications.manage");
	if (isResponse(actor)) return actor;
	try {
		const id = (await context.params).id;
		const publication = (await listAdminPublications()).find((candidate) => candidate.id === id);
		return publication
			? NextResponse.json({data: publication})
			: NextResponse.json(
					{error: {code: "NOT_FOUND", message: "The publication does not exist."}},
					{status: 404},
				);
	} catch (error) {
		return adminRouteError(error);
	}
}
