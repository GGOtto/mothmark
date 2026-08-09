import {NextResponse} from "next/server";
import {z} from "zod";

import {mutationSecurityError} from "@/auth/requestSecurity";
import {cancelScheduledCleanup, recheckCleanupEligibility} from "@/db/dbal/adminRepository";

import {adminRouteError, isResponse, requireAdminPermission} from "../../../_shared";

export async function POST(request: Request, context: {params: Promise<{id: string}>}) {
	const securityError = mutationSecurityError(request, "admin");
	if (securityError) return securityError;
	const actor = await requireAdminPermission(request, "admin.users.manage");
	if (isResponse(actor)) return actor;
	const id = z.uuid().safeParse((await context.params).id);
	const body = z
		.object({action: z.enum(["cancel", "recheck"])})
		.safeParse(await request.json().catch(() => undefined));
	if (!id.success || !body.success)
		return NextResponse.json(
			{error: {code: "VALIDATION_ERROR", message: "The cleanup action is invalid."}},
			{status: 400},
		);
	try {
		const data =
			body.data.action === "cancel"
				? {cancelled: await cancelScheduledCleanup({actorUserId: actor.userId, targetUserId: id.data})}
				: await recheckCleanupEligibility({actorUserId: actor.userId, targetUserId: id.data});
		return NextResponse.json({data});
	} catch (error) {
		return adminRouteError(error);
	}
}
