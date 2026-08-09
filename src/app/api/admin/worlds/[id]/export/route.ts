import {NextResponse} from "next/server";
import {z} from "zod";

import {getAdminWorld, recordAdministratorRead} from "@/db/dbal/adminRepository";

import {
	adminNotFoundResponse,
	adminRouteError,
	isResponse,
	requireAdminPermission,
} from "../../../_shared";

export async function GET(request: Request, context: {params: Promise<{id: string}>}) {
	const actor = await requireAdminPermission(request, "admin.worlds.view");
	if (isResponse(actor)) return actor;
	const id = z.uuid().safeParse((await context.params).id);
	if (!id.success) return adminNotFoundResponse();
	try {
		const world = await getAdminWorld(id.data);
		if (!world) return adminNotFoundResponse();
		await recordAdministratorRead(actor.userId, "world", world.id);
		return NextResponse.json(
			{
				format: "mothmark-world",
				id: world.id,
				name: world.name,
				revision: world.revision,
				schemaVersion: world.schemaVersion,
				world: world.world,
			},
			{
				headers: {
					"cache-control": "private, no-store",
					"content-disposition": `attachment; filename="${world.editorSlug || world.id}.mothmark.json"`,
				},
			},
		);
	} catch (error) {
		return adminRouteError(error);
	}
}
