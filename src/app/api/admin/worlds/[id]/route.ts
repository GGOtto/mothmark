import {NextResponse} from "next/server";
import {z} from "zod";

import {getAdminWorld, recordAdministratorRead} from "@/db/dbal/adminRepository";
import {
	adminNotFoundResponse,
	adminRouteError,
	isResponse,
	requireAdministrator,
} from "../../_shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
	request: Request,
	context: {params: Promise<{id: string}>},
): Promise<NextResponse> {
	const actor = await requireAdministrator(request);
	if (isResponse(actor)) return actor;
	const parsedId = z.uuid().safeParse((await context.params).id);
	if (!parsedId.success) return adminNotFoundResponse();
	try {
		const world = await getAdminWorld(parsedId.data);
		if (!world) return adminNotFoundResponse();
		await recordAdministratorRead(actor.userId, "world", world.id);
		return NextResponse.json({data: world});
	} catch (error) {
		return adminRouteError(error);
	}
}
