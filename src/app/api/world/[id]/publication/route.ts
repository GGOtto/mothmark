import {NextResponse} from "next/server";
import {z} from "zod";

import {resolveCurrentActor} from "@/auth/currentActor";
import {authRequiredResponse, mutationSecurityError} from "@/auth/requestSecurity";
import {PUBLICATION_REQUEST_MAX_BYTES, readBoundedJson} from "@/auth/requestBody";
import {
	PUBLICATION_SUMMARY_MAX_LENGTH,
	PUBLICATION_TITLE_MAX_LENGTH,
	PublicationError,
	getOwnedPublication,
	publishOwnedWorld,
	publishOwnedWorldUpdate,
	updateOwnedPublication,
} from "@/db/dbal/publicationRepository";
import {worldPermissionError} from "../../_shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PublishRequestSchema = z.object({
	expectedRevision: z.number().int().positive(),
	title: z.string().trim().min(1).max(PUBLICATION_TITLE_MAX_LENGTH),
	summary: z.string().trim().min(1).max(PUBLICATION_SUMMARY_MAX_LENGTH),
	slug: z.string().trim().min(1).max(100),
	visibility: z.enum(["listed", "unlisted"]),
});

const PublishUpdateRequestSchema = PublishRequestSchema.pick({
	expectedRevision: true,
	title: true,
	summary: true,
});

const LifecycleRequestSchema = z.discriminatedUnion("action", [
	z.object({action: z.literal("set_visibility"), visibility: z.enum(["listed", "unlisted"])}),
	z.object({action: z.literal("unpublish")}),
	z.object({action: z.literal("republish")}),
]);

type Context = {params: Promise<{id: string}>};

const publicationErrorResponse = (error: unknown): NextResponse => {
	if (error instanceof PublicationError) {
		const status =
			error.code === "NOT_FOUND"
				? 404
				: error.code === "FORBIDDEN"
					? 403
					: ["PUBLICATION_EXISTS", "REVISION_CONFLICT", "SLUG_CONFLICT"].includes(error.code)
						? 409
						: 400;
		return NextResponse.json({error: {code: error.code, message: error.message}}, {status});
	}
	console.error("Publication request failed", error);
	return NextResponse.json(
		{error: {code: "INTERNAL_ERROR", message: "The publication request could not be completed."}},
		{status: 500},
	);
};

export async function GET(request: Request, context: Context): Promise<NextResponse> {
	const actor = await resolveCurrentActor(request, "editor");
	if (!actor) return authRequiredResponse();
	if (actor.accountType !== "registered") {
		return NextResponse.json(
			{error: {code: "NOT_FOUND", message: "Publishing is not available."}},
			{status: 404},
		);
	}
	const permissionError = await worldPermissionError(actor, "world.publish_owned");
	if (permissionError) return permissionError;
	const {id} = await context.params;
	try {
		return NextResponse.json({data: (await getOwnedPublication(actor.userId, id)) ?? null});
	} catch (error) {
		return publicationErrorResponse(error);
	}
}

export async function POST(request: Request, context: Context): Promise<NextResponse> {
	const securityError = mutationSecurityError(request);
	if (securityError) return securityError;
	const actor = await resolveCurrentActor(request, "editor");
	if (!actor) return authRequiredResponse();
	if (actor.accountType !== "registered") {
		return NextResponse.json(
			{error: {code: "FORBIDDEN", message: "Only a registered owner can publish a world."}},
			{status: 403},
		);
	}
	const permissionError = await worldPermissionError(actor, "world.publish_owned");
	if (permissionError) return permissionError;
	let body: unknown;
	try {
		body = await readBoundedJson(request, PUBLICATION_REQUEST_MAX_BYTES);
	} catch {
		return NextResponse.json(
			{error: {code: "INVALID_JSON", message: "The request body must contain valid JSON."}},
			{status: 400},
		);
	}
	const parsed = PublishRequestSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json(
			{
				error: {
					code: "VALIDATION_ERROR",
					message: "Check the publication details and try again.",
					issues: parsed.error.issues,
				},
			},
			{status: 400},
		);
	}
	const {id} = await context.params;
	try {
		return NextResponse.json(
			{data: await publishOwnedWorld({ownerUserId: actor.userId, worldId: id, ...parsed.data})},
			{status: 201},
		);
	} catch (error) {
		return publicationErrorResponse(error);
	}
}

async function registeredOwner(request: Request) {
	const actor = await resolveCurrentActor(request, "editor");
	if (!actor) return authRequiredResponse();
	if (actor.accountType !== "registered")
		return NextResponse.json(
			{error: {code: "FORBIDDEN", message: "Only a registered owner can manage publishing."}},
			{status: 403},
		);
	const permissionError = await worldPermissionError(actor, "world.publish_owned");
	return permissionError ?? actor;
}

export async function PUT(request: Request, context: Context): Promise<NextResponse> {
	const securityError = mutationSecurityError(request);
	if (securityError) return securityError;
	const actor = await registeredOwner(request);
	if (actor instanceof NextResponse) return actor;
	const parsed = PublishUpdateRequestSchema.safeParse(
		await readBoundedJson(request, PUBLICATION_REQUEST_MAX_BYTES).catch(() => undefined),
	);
	if (!parsed.success)
		return NextResponse.json(
			{error: {code: "VALIDATION_ERROR", message: "Check the release details and try again."}},
			{status: 400},
		);
	try {
		return NextResponse.json({
			data: await publishOwnedWorldUpdate({
				ownerUserId: actor.userId,
				worldId: (await context.params).id,
				...parsed.data,
			}),
		});
	} catch (error) {
		return publicationErrorResponse(error);
	}
}

export async function PATCH(request: Request, context: Context): Promise<NextResponse> {
	const securityError = mutationSecurityError(request);
	if (securityError) return securityError;
	const actor = await registeredOwner(request);
	if (actor instanceof NextResponse) return actor;
	const parsed = LifecycleRequestSchema.safeParse(
		await readBoundedJson(request, PUBLICATION_REQUEST_MAX_BYTES).catch(() => undefined),
	);
	if (!parsed.success)
		return NextResponse.json(
			{error: {code: "VALIDATION_ERROR", message: "Choose a valid publication action."}},
			{status: 400},
		);
	try {
		return NextResponse.json({
			data: await updateOwnedPublication({
				ownerUserId: actor.userId,
				worldId: (await context.params).id,
				...parsed.data,
			}),
		});
	} catch (error) {
		return publicationErrorResponse(error);
	}
}
