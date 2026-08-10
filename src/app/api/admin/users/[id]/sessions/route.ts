import {NextResponse} from "next/server";
import {z} from "zod";

import {mutationSecurityError} from "@/auth/requestSecurity";
import {revokeUserSessions} from "@/db/dbal/adminRepository";

import {adminRouteError, isResponse, requireAdminPermission} from "../../../_shared";

export async function DELETE(request: Request, context: {params: Promise<{id: string}>}) {
	const securityError = mutationSecurityError(request, "admin");
	if (securityError) return securityError;
	const actor = await requireAdminPermission(request, "admin.users.manage");
	if (isResponse(actor)) return actor;
	const id = z.uuid().safeParse((await context.params).id);
	const body = z
		.object({sessionId: z.uuid().optional()})
		.safeParse(await request.json().catch(() => ({})));
	if (!id.success || !body.success)
		return NextResponse.json(
			{error: {code: "VALIDATION_ERROR", message: "The session selection is invalid."}},
			{status: 400},
		);
	try {
		const count = await revokeUserSessions({
			actorUserId: actor.userId,
			sessionId: body.data.sessionId,
			targetUserId: id.data,
		});
		return NextResponse.json({data: {revoked: count}});
	} catch (error) {
		return adminRouteError(error);
	}
}
