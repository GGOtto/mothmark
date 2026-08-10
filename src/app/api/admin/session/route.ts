import {NextResponse} from "next/server";

import {isResponse, requireAdministrator} from "../_shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
	const actor = await requireAdministrator(request);
	if (isResponse(actor)) return actor;
	return NextResponse.json({
		data: {accountType: actor.accountType, siteRole: actor.siteRole, userId: actor.userId},
	});
}
