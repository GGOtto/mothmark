import {NextResponse} from "next/server";

import {resolveCurrentActor} from "@/auth/currentActor";
import {readBoundedJson} from "@/auth/requestBody";
import {authRequiredResponse, mutationSecurityError} from "@/auth/requestSecurity";
import {userHasPermission} from "@/db/dbal/permissionRepository";
import {ItemIconInferenceBatchRequestSchema} from "@/features/item-suggestions/lexicalSchemas";
import {suggestFromWordNet} from "@/features/item-suggestions/wordnetLexicon.server";
import {resolveItemIconWithInferredTags} from "@/itemIcons";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ITEM_ICON_INFERENCE_REQUEST_MAX_BYTES = 64 * 1024;

const errorResponse = (status: number, code: string, message: string) =>
	NextResponse.json({error: {code, message}}, {status});

export async function POST(request: Request): Promise<NextResponse> {
	const securityError = mutationSecurityError(request);
	if (securityError) return securityError;

	let body: unknown;
	try {
		body = await readBoundedJson(request, ITEM_ICON_INFERENCE_REQUEST_MAX_BYTES);
	} catch {
		return errorResponse(400, "INVALID_JSON", "The icon inference request must contain valid JSON.");
	}
	const parsed = ItemIconInferenceBatchRequestSchema.safeParse(body);
	if (!parsed.success) {
		return errorResponse(400, "VALIDATION_ERROR", "The icon inference request is invalid.");
	}

	try {
		const actor = await resolveCurrentActor(request, "editor");
		if (!actor) return authRequiredResponse();
		if (!(await userHasPermission(actor.userId, "editor.access"))) {
			return errorResponse(403, "FORBIDDEN", "This account cannot use the editor.");
		}
		const categories = await Promise.all(
			parsed.data.items.map(async (item) => {
				const lexical = await suggestFromWordNet(item);
				const {iconCategory: _contextCategory, ...iconInput} = item;
				return resolveItemIconWithInferredTags(
					iconInput,
					lexical.concepts.map(({tag}) => tag),
				).category;
			}),
		);
		return NextResponse.json({data: {categories}});
	} catch (error) {
		console.error("Item icon inference request failed", error);
		return errorResponse(500, "INTERNAL_ERROR", "Automatic item icons are temporarily unavailable.");
	}
}
