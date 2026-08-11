import {NextResponse} from "next/server";

import {listAdminFeedbackMessages} from "@/db/dbal/feedbackRepository";
import {adminRouteError, isResponse, requireAdminPermission} from "../_shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
	const actor = await requireAdminPermission(request, "admin.feedback.view");
	if (isResponse(actor)) return actor;
	try {
		return NextResponse.json({data: {feedback: await listAdminFeedbackMessages()}});
	} catch (error) {
		return adminRouteError(error);
	}
}
