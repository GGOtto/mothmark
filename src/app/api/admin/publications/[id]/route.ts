import {NextResponse} from "next/server";
import {z} from "zod";

import {mutationSecurityError} from "@/auth/requestSecurity";
import {
	PublicationError,
	listAdminPublications,
	setPublicationSuspension,
	updateAdminPublicationCuration,
} from "@/db/dbal/publicationRepository";
import {adminRouteError, isResponse, requireAdminPermission} from "../../_shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
	request: Request,
	context: {params: Promise<{id: string}>},
): Promise<NextResponse> {
	const actor = await requireAdminPermission(request, "admin.publications.manage");
	if (isResponse(actor)) return actor;
	try {
		const id = (await context.params).id;
		const publication = (await listAdminPublications()).find((candidate) => candidate.id === id);
		return publication
			? NextResponse.json({data: publication})
			: NextResponse.json(
					{error: {code: "NOT_FOUND", message: "The publication does not exist."}},
					{status: 404},
				);
	} catch (error) {
		return adminRouteError(error);
	}
}

const SuspensionSchema = z.discriminatedUnion("status", [
	z.object({status: z.literal("suspended"), reason: z.string().trim().min(1).max(1_000)}),
	z.object({status: z.literal("unpublished")}),
]);
const CurationSchema = z
	.object({
		action: z.literal("update_curation"),
		visibility: z.enum(["listed", "unlisted"]),
		isOfficial: z.boolean(),
		listedOnHomepage: z.boolean(),
		homepagePosition: z.number().int().min(1).max(10_000).nullable(),
		reason: z.string().trim().min(1).max(1_000),
	})
	.refine(
		(value) =>
			value.listedOnHomepage
				? value.visibility === "listed" && value.isOfficial && value.homepagePosition !== null
				: value.homepagePosition === null,
		{
			message: "A home page publication must be listed, official, and have a positive position.",
		},
	);
const PublicationUpdateSchema = z.union([SuspensionSchema, CurationSchema]);

export async function PUT(
	request: Request,
	context: {params: Promise<{id: string}>},
): Promise<NextResponse> {
	const securityError = mutationSecurityError(request, "admin");
	if (securityError) return securityError;
	const actor = await requireAdminPermission(request, "admin.publications.manage");
	if (isResponse(actor)) return actor;
	const parsed = PublicationUpdateSchema.safeParse(await request.json().catch(() => undefined));
	if (!parsed.success)
		return NextResponse.json(
			{error: {code: "VALIDATION_ERROR", message: "Check the publication controls and reason."}},
			{status: 400},
		);
	try {
		if ("action" in parsed.data)
			return NextResponse.json({
				data: await updateAdminPublicationCuration({
					actorUserId: actor.userId,
					publicationId: (await context.params).id,
					visibility: parsed.data.visibility,
					isOfficial: parsed.data.isOfficial,
					listedOnHomepage: parsed.data.listedOnHomepage,
					homepagePosition: parsed.data.homepagePosition,
					reason: parsed.data.reason,
				}),
			});
		return NextResponse.json({
			data: await setPublicationSuspension({
				actorUserId: actor.userId,
				publicationId: (await context.params).id,
				suspended: parsed.data.status === "suspended",
				reason: parsed.data.status === "suspended" ? parsed.data.reason : undefined,
			}),
		});
	} catch (error) {
		if (error instanceof PublicationError)
			return NextResponse.json(
				{error: {code: error.code, message: error.message}},
				{status: error.code === "NOT_FOUND" ? 404 : 400},
			);
		return adminRouteError(error);
	}
}
