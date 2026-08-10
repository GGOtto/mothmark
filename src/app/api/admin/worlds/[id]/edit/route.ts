import {NextResponse} from "next/server";
import {z} from "zod";

import {mutationSecurityError} from "@/auth/requestSecurity";
import {updateWorldAdministratively} from "@/db/dbal/adminRepository";
import {WorldSchema} from "@/schemas/world/worldSchema";

import {adminRouteError, isResponse, requireAdminPermission} from "../../../_shared";

const Schema = z.object({
	expectedRevision: z.number().int().positive(),
	reason: z.string().trim().min(1).max(1_000),
	world: WorldSchema,
});

export async function PUT(request: Request, context: {params: Promise<{id: string}>}) {
	const securityError = mutationSecurityError(request, "admin");
	if (securityError) return securityError;
	const actor = await requireAdminPermission(request, "admin.worlds.manage");
	if (isResponse(actor)) return actor;
	const id = z.uuid().safeParse((await context.params).id);
	const body = Schema.safeParse(await request.json().catch(() => undefined));
	if (!id.success || !body.success)
		return NextResponse.json(
			{
				error: {
					code: "VALIDATION_ERROR",
					message: "Administrative editing requires a valid world, revision, and reason.",
				},
			},
			{status: 400},
		);
	try {
		const revision = await updateWorldAdministratively({
			actorUserId: actor.userId,
			worldId: id.data,
			...body.data,
		});
		return NextResponse.json({data: {revision}});
	} catch (error) {
		return adminRouteError(error);
	}
}
