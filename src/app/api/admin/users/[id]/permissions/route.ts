import {NextResponse} from "next/server";
import {z} from "zod";

import {mutationSecurityError} from "@/auth/requestSecurity";
import {PERMISSIONS, setUserPermissionOverride} from "@/db/dbal/adminRepository";

import {adminRouteError, isResponse, requireAdminPermission} from "../../../_shared";

const Schema = z.object({
	expiresAt: z.iso.datetime().nullable().optional(),
	permission: z.enum(PERMISSIONS),
	state: z.enum(["allow", "deny", "inherited"]),
});

export async function PUT(request: Request, context: {params: Promise<{id: string}>}) {
	const securityError = mutationSecurityError(request, "admin");
	if (securityError) return securityError;
	const actor = await requireAdminPermission(request, "admin.users.manage_permissions");
	if (isResponse(actor)) return actor;
	const id = z.uuid().safeParse((await context.params).id);
	const body = Schema.safeParse(await request.json().catch(() => undefined));
	if (!id.success || !body.success) {
		return NextResponse.json(
			{error: {code: "VALIDATION_ERROR", message: "Choose a valid permission state."}},
			{status: 400},
		);
	}
	try {
		const permissions = await setUserPermissionOverride({
			actorUserId: actor.userId,
			allowed: body.data.state === "inherited" ? null : body.data.state === "allow",
			expiresAt: body.data.expiresAt ? new Date(body.data.expiresAt) : null,
			permission: body.data.permission,
			targetUserId: id.data,
		});
		return NextResponse.json({data: {permissions}});
	} catch (error) {
		return adminRouteError(error);
	}
}
