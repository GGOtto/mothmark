import {NextResponse} from "next/server";
import {z} from "zod";

import {mutationSecurityError} from "@/auth/requestSecurity";
import {
	PlaythroughDiagnosticError,
	runPlaythroughDiagnostic,
} from "@/db/dbal/adminPlaythroughRepository";
import {adminRouteError, isResponse, requireAdminPermission} from "../../../_shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TargetSchema = z.discriminatedUnion("type", [
	z.object({type: z.literal("original")}),
	z.object({type: z.literal("current_release")}),
	z.object({type: z.literal("release"), releaseId: z.uuid()}),
	z.object({type: z.literal("editor")}),
]);

export async function POST(
	request: Request,
	context: {params: Promise<{id: string}>},
): Promise<NextResponse> {
	const securityError = mutationSecurityError(request, "admin");
	if (securityError) return securityError;
	const actor = await requireAdminPermission(request, "admin.playthroughs.view");
	if (isResponse(actor)) return actor;
	const id = z.uuid().safeParse((await context.params).id);
	const target = TargetSchema.safeParse(await request.json().catch(() => undefined));
	if (!id.success || !target.success)
		return NextResponse.json(
			{error: {code: "VALIDATION_ERROR", message: "Choose a valid diagnostic target."}},
			{status: 400},
		);
	try {
		return NextResponse.json({
			data: await runPlaythroughDiagnostic({
				actorUserId: actor.userId,
				playthroughId: id.data,
				target: target.data,
			}),
		});
	} catch (error) {
		if (error instanceof PlaythroughDiagnosticError)
			return NextResponse.json(
				{error: {code: error.code, message: error.message}},
				{status: error.code === "NOT_FOUND" ? 404 : 422},
			);
		return adminRouteError(error);
	}
}
