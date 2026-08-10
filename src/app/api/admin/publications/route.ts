import {NextResponse} from "next/server";

import {listAdminPublications} from "@/db/dbal/publicationRepository";
import {adminRouteError, isResponse, requireAdminPermission} from "../_shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
	const actor = await requireAdminPermission(request, "admin.publications.manage");
	if (isResponse(actor)) return actor;
	try {
		return NextResponse.json({data: {publications: await listAdminPublications()}});
	} catch (error) {
		return adminRouteError(error);
	}
}
