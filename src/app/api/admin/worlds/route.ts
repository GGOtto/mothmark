import {NextResponse} from "next/server";

import {listAdminWorlds} from "@/db/dbal/adminRepository";
import {adminRouteError, isResponse, requireAdminPermission} from "../_shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
	const actor = await requireAdminPermission(request, "admin.worlds.view");
	if (isResponse(actor)) return actor;
	try {
		return NextResponse.json({data: {worlds: await listAdminWorlds()}});
	} catch (error) {
		return adminRouteError(error);
	}
}
