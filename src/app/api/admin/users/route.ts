import {NextResponse} from "next/server";

import {listAdminUsers} from "@/db/dbal/adminRepository";
import {adminRouteError, isResponse, requireAdminPermission} from "../_shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
	const actor = await requireAdminPermission(request, "admin.users.view");
	if (isResponse(actor)) return actor;
	try {
		return NextResponse.json({data: {users: await listAdminUsers()}});
	} catch (error) {
		return adminRouteError(error);
	}
}
