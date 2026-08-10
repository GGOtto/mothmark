import {NextResponse} from "next/server";
import {z} from "zod";

import {mutationSecurityError} from "@/auth/requestSecurity";
import {applyAdminWorldAction} from "@/db/dbal/adminRepository";

import {
	adminRouteError,
	isResponse,
	requireAdministrator,
	requireAdminPermission,
} from "../../../_shared";

const Schema = z.discriminatedUnion("action", [
	z.object({action: z.literal("archive"), reason: z.string().trim().max(1_000).optional()}),
	z.object({action: z.literal("restore"), reason: z.string().trim().max(1_000).optional()}),
	z.object({action: z.literal("delete"), reason: z.string().trim().min(1).max(1_000)}),
	z.object({
		action: z.literal("transfer"),
		reason: z.string().trim().min(1).max(1_000),
		targetUserId: z.uuid(),
	}),
]);

export async function POST(request: Request, context: {params: Promise<{id: string}>}) {
	const securityError = mutationSecurityError(request, "admin");
	if (securityError) return securityError;
	const administrator = await requireAdministrator(request);
	if (isResponse(administrator)) return administrator;
	const body = Schema.safeParse(await request.json().catch(() => undefined));
	const id = z.uuid().safeParse((await context.params).id);
	if (!id.success || !body.success)
		return NextResponse.json(
			{
				error: {
					code: "VALIDATION_ERROR",
					message: "This world action needs valid values and a reason where required.",
				},
			},
			{status: 400},
		);
	const permission =
		body.data.action === "transfer" ? "admin.worlds.transfer" : "admin.worlds.manage";
	const actor = await requireAdminPermission(request, permission);
	if (isResponse(actor)) return actor;
	try {
		await applyAdminWorldAction(actor.userId, id.data, body.data);
		return new NextResponse(null, {status: 204});
	} catch (error) {
		return adminRouteError(error);
	}
}
