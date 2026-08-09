import {NextResponse} from "next/server";
import {z} from "zod";

import {resolveCurrentActor} from "@/auth/currentActor";
import {mutationSecurityError} from "@/auth/requestSecurity";
import {
	HOSTED_COMMAND_MAX_LENGTH,
	PublicationError,
	submitHostedCommand,
} from "@/db/dbal/publicationRepository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CommandSchema = z.object({
	command: z
		.string()
		.min(1)
		.max(HOSTED_COMMAND_MAX_LENGTH)
		.refine((value) => value.trim().length > 0 && !/[\r\n]/.test(value)),
	expectedRevision: z.number().int().positive(),
});
type Context = {params: Promise<{slug: string}>};

export async function POST(request: Request, context: Context): Promise<NextResponse> {
	const securityError = mutationSecurityError(request, "play");
	if (securityError) return securityError;
	const actor = await resolveCurrentActor(request, "play");
	if (!actor) {
		return NextResponse.json(
			{
				error: {
					code: "AUTH_REQUIRED",
					message: "Open the published world before submitting a command.",
				},
			},
			{status: 401},
		);
	}
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json(
			{error: {code: "INVALID_JSON", message: "The request body must contain valid JSON."}},
			{status: 400},
		);
	}
	const parsed = CommandSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json(
			{error: {code: "VALIDATION_ERROR", message: "Enter one valid command line."}},
			{status: 400},
		);
	}
	try {
		return NextResponse.json({
			data: await submitHostedCommand({
				playerUserId: actor.userId,
				slug: (await context.params).slug,
				...parsed.data,
			}),
		});
	} catch (error) {
		if (error instanceof PublicationError) {
			const status =
				error.code === "REVISION_CONFLICT"
					? 409
					: error.code === "NOT_FOUND"
						? 404
						: error.code === "FORBIDDEN"
							? 403
							: 400;
			return NextResponse.json({error: {code: error.code, message: error.message}}, {status});
		}
		console.error("Hosted command failed", error);
		return NextResponse.json(
			{error: {code: "INTERNAL_ERROR", message: "The command could not be saved."}},
			{status: 500},
		);
	}
}
