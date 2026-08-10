import {NextResponse} from "next/server";
import {z} from "zod";

import {listAdminAudit} from "@/db/dbal/adminRepository";

import {adminRouteError, isResponse, requireAdminPermission} from "../_shared";

export async function GET(request: Request) {
	const actor = await requireAdminPermission(request, "admin.audit.view");
	if (isResponse(actor)) return actor;
	const query = Object.fromEntries(new URL(request.url).searchParams);
	const parsed = z
		.object({
			action: z.string().max(100).optional(),
			actor: z.uuid().optional(),
			from: z.coerce.date().optional(),
			target: z.uuid().optional(),
			to: z.coerce.date().optional(),
		})
		.safeParse(query);
	if (!parsed.success)
		return NextResponse.json(
			{error: {code: "VALIDATION_ERROR", message: "The audit filters are invalid."}},
			{status: 400},
		);
	try {
		return NextResponse.json({
			data: {
				entries: await listAdminAudit({
					action: parsed.data.action,
					actorUserId: parsed.data.actor,
					from: parsed.data.from,
					targetId: parsed.data.target,
					to: parsed.data.to,
				}),
			},
		});
	} catch (error) {
		return adminRouteError(error);
	}
}
