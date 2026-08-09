import {NextResponse} from "next/server";
import {z} from "zod";

import {mutationSecurityError} from "@/auth/requestSecurity";
import {setUserWorldLimit} from "@/db/dbal/adminRepository";

import {adminRouteError, isResponse, requireAdminPermission} from "../../../_shared";

export async function PUT(request: Request, context: {params: Promise<{id: string}>}) {
	const securityError = mutationSecurityError(request, "admin");
	if (securityError) return securityError;
	const actor = await requireAdminPermission(request, "admin.users.manage");
	if (isResponse(actor)) return actor;
	const id = z.uuid().safeParse((await context.params).id);
	const body = z
		.object({maxWorlds: z.number().int().min(1).max(10_000)})
		.safeParse(await request.json().catch(() => undefined));
	if (!id.success || !body.success)
		return NextResponse.json(
			{error: {code: "VALIDATION_ERROR", message: "Enter a world limit from 1 to 10,000."}},
			{status: 400},
		);
	try {
		await setUserWorldLimit({
			actorUserId: actor.userId,
			maxWorlds: body.data.maxWorlds,
			targetUserId: id.data,
		});
		return NextResponse.json({data: {maxWorlds: body.data.maxWorlds}});
	} catch (error) {
		return adminRouteError(error);
	}
}
