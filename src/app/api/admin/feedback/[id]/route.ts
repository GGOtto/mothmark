import {NextResponse} from "next/server";
import {z} from "zod";

import {recordAdministratorRead} from "@/db/dbal/adminRepository";
import {getAdminFeedbackMessage} from "@/db/dbal/feedbackRepository";
import {
	adminNotFoundResponse,
	adminRouteError,
	isResponse,
	requireAdminPermission,
} from "../../_shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
	request: Request,
	context: {params: Promise<{id: string}>},
): Promise<NextResponse> {
	const actor = await requireAdminPermission(request, "admin.feedback.view");
	if (isResponse(actor)) return actor;
	const id = z.uuid().safeParse((await context.params).id);
	if (!id.success) return adminNotFoundResponse();
	try {
		const feedback = await getAdminFeedbackMessage(id.data, true);
		if (!feedback) return adminNotFoundResponse();
		await recordAdministratorRead(actor.userId, "feedback", feedback.id);
		return NextResponse.json({data: feedback});
	} catch (error) {
		return adminRouteError(error);
	}
}
