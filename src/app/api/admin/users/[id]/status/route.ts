import {NextResponse} from "next/server";
import {z} from "zod";

import {mutationSecurityError} from "@/auth/requestSecurity";
import {setUserSuspension} from "@/db/dbal/adminRepository";

import {adminRouteError, isResponse, requireAdminPermission} from "../../../_shared";

const Schema = z.discriminatedUnion("status", [
	z.object({reason: z.string().trim().min(1).max(1_000), status: z.literal("suspended")}),
	z.object({status: z.literal("active")}),
]);

export async function PUT(request: Request, context: {params: Promise<{id: string}>}) {
	const securityError = mutationSecurityError(request, "admin");
	if (securityError) return securityError;
	const actor = await requireAdminPermission(request, "admin.users.manage");
	if (isResponse(actor)) return actor;
	const id = z.uuid().safeParse((await context.params).id);
	const body = Schema.safeParse(await request.json().catch(() => undefined));
	if (!id.success || !body.success)
		return NextResponse.json(
			{error: {code: "VALIDATION_ERROR", message: "Suspension requires a reason."}},
			{status: 400},
		);
	try {
		await setUserSuspension({
			actorUserId: actor.userId,
			reason: body.data.status === "suspended" ? body.data.reason : undefined,
			suspended: body.data.status === "suspended",
			targetUserId: id.data,
		});
		return NextResponse.json({data: {status: body.data.status}});
	} catch (error) {
		return adminRouteError(error);
	}
}
