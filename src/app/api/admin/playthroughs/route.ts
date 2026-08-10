import {NextResponse} from "next/server";
import {z} from "zod";

import {listAdminPlaythroughs} from "@/db/dbal/adminPlaythroughRepository";
import {adminRouteError, isResponse, requireAdminPermission} from "../_shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Filters = z.object({
	publicationId: z.uuid().optional(),
	worldId: z.uuid().optional(),
	releaseId: z.uuid().optional(),
	status: z.enum(["active", "completed", "abandoned", "errored"]).optional(),
	from: z.coerce.date().optional(),
	to: z.coerce.date().optional(),
	minimumCommands: z.coerce.number().int().min(0).max(100_000).optional(),
	errorsOnly: z
		.enum(["true", "false"])
		.transform((value) => value === "true")
		.optional(),
});

export async function GET(request: Request): Promise<NextResponse> {
	const actor = await requireAdminPermission(request, "admin.playthroughs.view");
	if (isResponse(actor)) return actor;
	const parsed = Filters.safeParse(Object.fromEntries(new URL(request.url).searchParams));
	if (!parsed.success)
		return NextResponse.json(
			{error: {code: "VALIDATION_ERROR", message: "Check the playthrough filters."}},
			{status: 400},
		);
	try {
		return NextResponse.json({data: {playthroughs: await listAdminPlaythroughs(parsed.data)}});
	} catch (error) {
		return adminRouteError(error);
	}
}
