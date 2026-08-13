import {NextResponse} from "next/server";

import {listAdminSubscribers} from "@/db/dbal/subscriberRepository";
import {adminRouteError, isResponse, requireAdminPermission} from "../_shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
	const actor = await requireAdminPermission(request, "admin.subscribers.view");
	if (isResponse(actor)) return actor;
	try {
		return NextResponse.json({data: {subscribers: await listAdminSubscribers(actor.userId)}});
	} catch (error) {
		return adminRouteError(error);
	}
}
