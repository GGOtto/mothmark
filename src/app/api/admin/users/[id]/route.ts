import {NextResponse} from "next/server";
import {z} from "zod";

import {
	administratorHasPermission,
	getAdminUser,
	recordAdministratorRead,
} from "@/db/dbal/adminRepository";
import {listAdminPlaythroughs} from "@/db/dbal/adminPlaythroughRepository";
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
	const actor = await requireAdminPermission(request, "admin.users.view");
	if (isResponse(actor)) return actor;
	const parsedId = z.uuid().safeParse((await context.params).id);
	if (!parsedId.success) return adminNotFoundResponse();
	try {
		const user = await getAdminUser(parsedId.data);
		if (!user) return adminNotFoundResponse();
		const playthroughs = (await administratorHasPermission(actor.userId, "admin.playthroughs.view"))
			? await listAdminPlaythroughs({playerUserId: user.id})
			: [];
		await recordAdministratorRead(actor.userId, "user", user.id);
		return NextResponse.json({data: {...user, playthroughs}});
	} catch (error) {
		return adminRouteError(error);
	}
}
