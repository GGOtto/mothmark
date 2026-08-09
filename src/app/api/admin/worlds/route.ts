import {NextResponse} from "next/server";

import {listAdminWorlds} from "@/db/dbal/adminRepository";
import {adminRouteError, isResponse, requireAdministrator} from "../_shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
	const actor = await requireAdministrator(request);
	if (isResponse(actor)) return actor;
	try {
		return NextResponse.json({data: {worlds: await listAdminWorlds()}});
	} catch (error) {
		return adminRouteError(error);
	}
}
